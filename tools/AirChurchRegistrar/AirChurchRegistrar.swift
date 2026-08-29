import SwiftUI
import AppKit
import Darwin

private let repositoryPath = "/Users/armsone/git/airChurch.net"
private let pipelinePath = "scripts/airchurch-registration-pipeline.mjs"

struct CompletedSummary: Decodable {
    let collected: Int?
    let verified: Int?
    let registered: Int?

    var headline: String? {
        if let registered { return "완료 자료 있음 · 등록 \(registered.formatted())곳" }
        if let verified { return "완료 자료 있음 · 검증 \(verified.formatted())곳" }
        if let collected { return "완료 자료 있음 · 수집 \(collected.formatted())곳" }
        return nil
    }
}

struct DenominationItem: Decodable, Identifiable {
    let id: String
    let name: String
    let uiState: String
    let reason: String
    let executable: Bool
    let completed: CompletedSummary?

    var stateLabel: String {
        switch uiState {
        case "auto": return "자동 실행 가능"
        case "login_required": return "로그인 필요"
        case "no_directory": return "공개 전체 명부 없음"
        default: return uiState
        }
    }

    var stateColor: Color {
        switch uiState {
        case "auto": return .green
        case "login_required": return .red
        default: return .secondary
        }
    }
}

@MainActor
final class RegistrationModel: ObservableObject, @unchecked Sendable {
    @Published var denominations: [DenominationItem] = []
    @Published var selectedIDs: Set<String> = []
    @Published var running = false
    @Published var paused = false
    @Published var progress = 0.0
    @Published var status = "준비됨"
    @Published var detail = "공개된 공식 자료만 사용합니다."
    @Published var log = ""
    @Published var directoryCount = 0
    @Published var verifiedCount = 0
    @Published var reviewCount = 0
    @Published var registeredCount = 0
    @Published var approvedCount = 0
    @Published var alertMessage: String?
    private var activeProcessID: Int32?
    private var statusBeforePause = ""

    var selectedIDsParam: String {
        denominations.filter { $0.executable && selectedIDs.contains($0.id) }.map(\.id).joined(separator: ",")
    }

    func toggle(_ id: String) {
        if selectedIDs.contains(id) { selectedIDs.remove(id) } else { selectedIDs.insert(id) }
    }

    func loadCatalog() {
        runProcess(command: "list", showProgress: false) { [weak self] output in
            guard let self, let data = output.data(using: .utf8),
                  let items = try? JSONDecoder().decode([DenominationItem].self, from: data) else { return }
            self.denominations = items
            if self.selectedIDs.isEmpty {
                self.selectedIDs = Set(items.filter(\.executable).map(\.id))
            }
        }
    }

    func refreshStatus() {
        runProcess(command: "status", showProgress: false) { [weak self] output in
            guard let self, let data = output.data(using: .utf8),
                  let value = try? JSONSerialization.jsonObject(with: data) as? [String: Int] else { return }
            self.directoryCount = value["directory"] ?? 0
            self.verifiedCount = value["verified"] ?? 0
            self.reviewCount = value["review"] ?? 0
            self.registeredCount = value["registered"] ?? 0
            self.approvedCount = value["approved"] ?? 0
        }
    }

    func newCollection() {
        guard !selectedIDsParam.isEmpty else { alertMessage = "교단을 하나 이상 선택해 주세요."; return }
        runSteps(["reset", "collect"])
    }

    func collectAndValidate() {
        guard !selectedIDsParam.isEmpty else { alertMessage = "교단을 하나 이상 선택해 주세요."; return }
        runSteps(["collect", "discover", "validate"])
    }

    func validateAgain() { runSteps(["validate"]) }

    func register(username: String, password: String) {
        let credentials = ["username": username, "password": password]
        guard let data = try? JSONSerialization.data(withJSONObject: credentials) else { return }
        running = true; progress = 0; log = ""; status = "DB 등록 중"
        runProcess(command: "register", stdin: data) { [weak self] _ in self?.refreshStatus() }
    }

    func togglePause() {
        guard running, let processID = activeProcessID else { return }
        let processIDs = processTree(root: processID)
        if paused {
            for id in processIDs { Darwin.kill(id, SIGCONT) }
            paused = false
            status = statusBeforePause.isEmpty ? "실행 중" : statusBeforePause
            detail = "중단한 지점부터 계속 진행합니다."
        } else {
            statusBeforePause = status
            for id in processIDs.reversed() { Darwin.kill(id, SIGSTOP) }
            paused = true
            status = "멈춤"
            detail = "계속 버튼을 누르면 중단한 지점부터 진행합니다."
        }
    }

    func cancelCurrentWork() {
        guard running, let processID = activeProcessID else { return }
        let processIDs = processTree(root: processID)
        for id in processIDs { Darwin.kill(id, SIGCONT) }
        for id in processIDs.reversed() { Darwin.kill(id, SIGTERM) }
        paused = false
        status = "취소 중"
        detail = "현재 작업을 안전하게 종료하고 있습니다."
    }

    private func processTree(root: Int32) -> [Int32] {
        var result: [Int32] = []
        func appendTree(_ processID: Int32) {
            result.append(processID)
            let process = Process()
            let pipe = Pipe()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/pgrep")
            process.arguments = ["-P", String(processID)]
            process.standardOutput = pipe
            process.standardError = FileHandle.nullDevice
            try? process.run()
            process.waitUntilExit()
            let output = String(decoding: pipe.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
            for child in output.split(whereSeparator: \.isWhitespace).compactMap({ Int32($0) }) { appendTree(child) }
        }
        appendTree(root)
        return result
    }

    private func runSteps(_ steps: [String]) {
        running = true; progress = 0; log = ""
        func run(_ index: Int) {
            if index >= steps.count { self.running = false; self.status = "완료"; self.detail = "작업을 마쳤습니다."; NSSound(named: "Glass")?.play(); self.refreshStatus(); return }
            self.runProcess(command: steps[index]) { _ in run(index + 1) }
        }
        run(0)
    }

    private func runProcess(command: String, stdin: Data? = nil, showProgress: Bool = true, completion: @escaping (String) -> Void) {
        if showProgress { status = command == "collect" ? "공개 자료 수집 중" : command == "discover" ? "YouTube 검증 중" : command == "validate" ? "최종 검증 중" : command == "reset" ? "새 작업 준비 중" : "처리 중" }
        let ids = selectedIDsParam
        Task.detached { [weak self] in
            guard let model = self else { return }
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["node", pipelinePath, command, "--only", ids]
            process.currentDirectoryURL = URL(fileURLWithPath: repositoryPath)
            var environment = ProcessInfo.processInfo.environment
            environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
            process.environment = environment
            let pipe = Pipe(); process.standardOutput = pipe; process.standardError = pipe
            if let stdin { let input = Pipe(); process.standardInput = input; try? process.run(); await model.setActiveProcess(process.processIdentifier, enabled: showProgress); input.fileHandleForWriting.write(stdin); try? input.fileHandleForWriting.close() }
            else { try? process.run(); await model.setActiveProcess(process.processIdentifier, enabled: showProgress) }
            var complete = "", buffer = ""
            while process.isRunning {
                let data = pipe.fileHandleForReading.availableData
                if data.isEmpty { break }
                let text = String(decoding: data, as: UTF8.self); complete += text; buffer += text
                let lines = buffer.split(separator: "\n", omittingEmptySubsequences: false); buffer = String(lines.last ?? "")
                for line in lines.dropLast() { await model.consume(String(line)) }
            }
            let rest = pipe.fileHandleForReading.readDataToEndOfFile()
            if !rest.isEmpty { let text = String(decoding: rest, as: UTF8.self); complete += text; buffer += text }
            if !buffer.isEmpty { await model.consume(buffer) }
            process.waitUntilExit()
            let finalOutput = complete.trimmingCharacters(in: .whitespacesAndNewlines)
            let exitStatus = process.terminationStatus
            await MainActor.run {
                model.clearActiveProcess(process.processIdentifier)
                if exitStatus == 0 { completion(finalOutput); if command == "register" { model.running = false; model.status = "등록 완료"; NSSound(named: "Glass")?.play() } }
                else if model.status == "취소 중" { model.running = false; model.progress = 0; model.status = "취소됨"; model.detail = "현재 작업을 취소했습니다." }
                else { model.running = false; model.status = "작업 중단"; model.alertMessage = "작업을 완료하지 못했습니다. 아래 기록에서 원인을 확인해 주세요." }
            }
        }
    }

    private func setActiveProcess(_ processID: Int32, enabled: Bool) {
        if enabled { activeProcessID = processID }
    }

    private func clearActiveProcess(_ processID: Int32) {
        if activeProcessID == processID { activeProcessID = nil }
        paused = false
    }

    private func consume(_ line: String) {
        if line.hasPrefix("PROGRESS|") {
            let parts = line.split(separator: "|", maxSplits: 4).map(String.init)
            if parts.count == 5, let current = Double(parts[2]), let total = Double(parts[3]) {
                progress = total > 0 ? min(1, current / total) : 0
                detail = parts[4]
            }
        } else if line.hasPrefix("ERROR|") {
            alertMessage = String(line.dropFirst(6))
        }
        if !line.trimmingCharacters(in: .whitespaces).isEmpty { log += line + "\n" }
    }
}

struct StatCard: View {
    let title: String; let value: Int; let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 5) { Text(title).font(.caption).foregroundStyle(.secondary); Text(value.formatted()).font(.title2.bold()).foregroundStyle(color) }
            .frame(maxWidth: .infinity, alignment: .leading).padding(14).background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.black.opacity(0.07)))
    }
}

struct DenominationRow: View {
    let item: DenominationItem
    let selected: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Toggle("", isOn: Binding(get: { selected }, set: { _ in onToggle() }))
                .labelsHidden().toggleStyle(.checkbox).disabled(!item.executable)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name).font(.callout.weight(.medium))
                Text(item.reason).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            if let headline = item.completed?.headline {
                Text(headline).font(.caption2.bold()).foregroundStyle(.purple)
            }
            Text(item.stateLabel).font(.caption.bold()).foregroundStyle(item.stateColor)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(item.stateColor.opacity(0.13), in: Capsule())
        }
        .padding(.vertical, 3)
        .opacity(item.executable ? 1 : 0.6)
    }
}

struct ContentView: View {
    @StateObject private var model = RegistrationModel()
    @State private var showLogin = false
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 14) {
                Image(systemName: "building.2.crop.circle.fill").font(.system(size: 42)).foregroundStyle(Color(red: 0.08, green: 0.25, blue: 0.21))
                VStack(alignment: .leading, spacing: 3) { Text("에어처치 교회 등록기").font(.system(size: 25, weight: .bold)); Text("공개 자료 수집 · 공식 채널 검증 · 안전한 등록").foregroundStyle(.secondary) }
                Spacer()
                Text(model.running ? "실행 중" : "대기").font(.caption.bold()).padding(.horizontal, 12).padding(.vertical, 7).background(model.running ? Color.orange.opacity(0.17) : Color.green.opacity(0.14), in: Capsule())
            }

            GroupBox("조사할 교단 (선택한 교단만 자동 실행됩니다)") {
                List(model.denominations) { item in
                    DenominationRow(item: item, selected: model.selectedIDs.contains(item.id)) { model.toggle(item.id) }
                }
                .listStyle(.plain)
                .frame(height: 220)
            }

            HStack(spacing: 10) {
                StatCard(title: "수집", value: model.directoryCount, color: .blue)
                StatCard(title: "자동 통과", value: model.verifiedCount, color: .green)
                StatCard(title: "재검토", value: model.reviewCount, color: .orange)
                StatCard(title: "최근 등록", value: model.registeredCount, color: .purple)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack { Text(model.status).font(.headline); Spacer(); Text("\(Int(model.progress * 100))%").monospacedDigit().foregroundStyle(.secondary) }
                ProgressView(value: model.progress).progressViewStyle(.linear)
                Text(model.detail).font(.callout).foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                Group {
                    Button("새 자료 수집") { model.newCollection() }
                    Button("수집·검증 자동 실행") { model.collectAndValidate() }.buttonStyle(.borderedProminent).tint(Color(red: 0.08, green: 0.25, blue: 0.21))
                    Button("검증 다시 계산") { model.validateAgain() }
                }.disabled(model.running)
                if model.running {
                    Button(model.paused ? "계속" : "멈춤") { model.togglePause() }
                    Button("취소", role: .destructive) { model.cancelCurrentWork() }
                }
                Spacer()
                Button("통과 교회 DB 등록") { showLogin = true }.disabled(model.verifiedCount == 0 || model.running)
            }

            DisclosureGroup("상세 진행 기록") {
                ScrollView { Text(model.log.isEmpty ? "실행 기록이 여기에 표시됩니다." : model.log).font(.system(.caption, design: .monospaced)).frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled).padding(10) }
                    .frame(height: 150).background(.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
            }

            HStack { Image(systemName: "checkmark.shield"); Text("로그인·비공개 영역과 개인 민감정보는 수집하지 않습니다.").font(.caption); Spacer(); if model.approvedCount > 0 { Text("전체 공개 \(model.approvedCount.formatted())곳").font(.caption.bold()) } }.foregroundStyle(.secondary)
        }
        .padding(24).frame(minWidth: 800, minHeight: 720)
        .background(LinearGradient(colors: [Color(red: 0.96, green: 0.98, blue: 0.97), Color(red: 0.98, green: 0.96, blue: 0.94)], startPoint: .topLeading, endPoint: .bottomTrailing))
        .foregroundStyle(Color(red: 0.10, green: 0.16, blue: 0.14))
        .environment(\.colorScheme, .light)
        .onAppear { model.loadCatalog(); model.refreshStatus() }
        .alert("에어처치 교회 등록기", isPresented: Binding(get: { model.alertMessage != nil }, set: { if !$0 { model.alertMessage = nil } })) { Button("확인") { model.alertMessage = nil } } message: { Text(model.alertMessage ?? "") }
        .sheet(isPresented: $showLogin) {
            VStack(alignment: .leading, spacing: 16) {
                Text("검증 통과 교회 등록").font(.title2.bold())
                Text("\(model.verifiedCount.formatted())곳을 다시 YouTube 확인한 뒤 DB에 등록합니다. 관리자 계정은 저장하지 않습니다.").foregroundStyle(.secondary)
                TextField("관리자 아이디", text: $username).textFieldStyle(.roundedBorder)
                SecureField("비밀번호", text: $password).textFieldStyle(.roundedBorder)
                HStack { Button("취소") { showLogin = false }; Spacer(); Button("확인하고 등록") { showLogin = false; model.register(username: username, password: password); password = "" }.buttonStyle(.borderedProminent).disabled(username.isEmpty || password.isEmpty) }
            }.padding(24).frame(width: 440)
        }
    }
}

@main
struct AirChurchRegistrarApp: App {
    init() { NSApplication.shared.applicationIconImage = NSImage(systemSymbolName: "building.2.crop.circle.fill", accessibilityDescription: "에어처치") }
    var body: some Scene { WindowGroup { ContentView() }.windowStyle(.hiddenTitleBar) }
}
