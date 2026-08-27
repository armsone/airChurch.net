import SwiftUI
import AppKit

private let repositoryPath = "/Users/armsone/git/airChurch.net"
private let pipelinePath = "scripts/airchurch-registration-pipeline.mjs"

@MainActor
final class RegistrationModel: ObservableObject, @unchecked Sendable {
    @Published var tonghap = true
    @Published var kmc = true
    @Published var salvation = true
    @Published var running = false
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

    var selectedIDs: String {
        var values: [String] = []
        if tonghap { values.append("tonghap") }
        if kmc { values.append("kmc") }
        if salvation { values.append("salvation") }
        return values.joined(separator: ",")
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
        guard !selectedIDs.isEmpty else { alertMessage = "교단을 하나 이상 선택해 주세요."; return }
        runSteps(["reset", "collect"])
    }

    func collectAndValidate() {
        guard !selectedIDs.isEmpty else { alertMessage = "교단을 하나 이상 선택해 주세요."; return }
        runSteps(["collect", "discover", "validate"])
    }

    func validateAgain() { runSteps(["validate"]) }

    func register(username: String, password: String) {
        let credentials = ["username": username, "password": password]
        guard let data = try? JSONSerialization.data(withJSONObject: credentials) else { return }
        running = true; progress = 0; log = ""; status = "DB 등록 중"
        runProcess(command: "register", stdin: data) { [weak self] _ in self?.refreshStatus() }
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
        let ids = selectedIDs
        Task.detached { [weak self] in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["node", pipelinePath, command, "--only", ids]
            process.currentDirectoryURL = URL(fileURLWithPath: repositoryPath)
            var environment = ProcessInfo.processInfo.environment
            environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
            process.environment = environment
            let pipe = Pipe(); process.standardOutput = pipe; process.standardError = pipe
            if let stdin { let input = Pipe(); process.standardInput = input; try? process.run(); input.fileHandleForWriting.write(stdin); try? input.fileHandleForWriting.close() }
            else { try? process.run() }
            var complete = "", buffer = ""
            while process.isRunning {
                let data = pipe.fileHandleForReading.availableData
                if data.isEmpty { break }
                let text = String(decoding: data, as: UTF8.self); complete += text; buffer += text
                let lines = buffer.split(separator: "\n", omittingEmptySubsequences: false); buffer = String(lines.last ?? "")
                for line in lines.dropLast() { await self?.consume(String(line)) }
            }
            let rest = pipe.fileHandleForReading.readDataToEndOfFile()
            if !rest.isEmpty { let text = String(decoding: rest, as: UTF8.self); complete += text; buffer += text }
            if !buffer.isEmpty { await self?.consume(buffer) }
            process.waitUntilExit()
            let finalOutput = complete.trimmingCharacters(in: .whitespacesAndNewlines)
            let exitStatus = process.terminationStatus
            await MainActor.run {
                guard let self else { return }
                if exitStatus == 0 { completion(finalOutput); if command == "register" { self.running = false; self.status = "등록 완료"; NSSound(named: "Glass")?.play() } }
                else { self.running = false; self.status = "작업 중단"; self.alertMessage = "작업을 완료하지 못했습니다. 아래 기록에서 원인을 확인해 주세요." }
            }
        }
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

            GroupBox("조사할 교단") {
                HStack(spacing: 24) { Toggle("예장 통합", isOn: $model.tonghap); Toggle("기독교대한감리회", isOn: $model.kmc); Toggle("구세군대한본영", isOn: $model.salvation); Spacer() }.toggleStyle(.checkbox).padding(.vertical, 5)
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
                Button("새 자료 수집") { model.newCollection() }
                Button("수집·검증 자동 실행") { model.collectAndValidate() }.buttonStyle(.borderedProminent).tint(Color(red: 0.08, green: 0.25, blue: 0.21))
                Button("검증 다시 계산") { model.validateAgain() }
                Spacer()
                Button("통과 교회 DB 등록") { showLogin = true }.disabled(model.verifiedCount == 0)
            }.disabled(model.running)

            DisclosureGroup("상세 진행 기록") {
                ScrollView { Text(model.log.isEmpty ? "실행 기록이 여기에 표시됩니다." : model.log).font(.system(.caption, design: .monospaced)).frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled).padding(10) }
                    .frame(height: 150).background(.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
            }

            HStack { Image(systemName: "checkmark.shield"); Text("로그인·비공개 영역과 개인 민감정보는 수집하지 않습니다.").font(.caption); Spacer(); if model.approvedCount > 0 { Text("전체 공개 \(model.approvedCount.formatted())곳").font(.caption.bold()) } }.foregroundStyle(.secondary)
        }
        .padding(24).frame(minWidth: 780, minHeight: 570)
        .background(LinearGradient(colors: [Color(red: 0.96, green: 0.98, blue: 0.97), Color(red: 0.98, green: 0.96, blue: 0.94)], startPoint: .topLeading, endPoint: .bottomTrailing))
        .onAppear { model.refreshStatus() }
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
