#!/usr/bin/env swift

import Foundation
import ImageIO
import Vision

func escaped(_ value: String) -> String {
    value
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
}

for file in CommandLine.arguments.dropFirst() {
    var faces = 0
    var largestFaceArea = 0.0
    var recognizedTextCharacters = 0
    var errorMessage: String? = nil
    do {
        let url = URL(fileURLWithPath: file)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw NSError(domain: "airChurchPhotoAudit", code: 1, userInfo: [NSLocalizedDescriptionKey: "image_decode_failed"])
        }
        let faceRequest = VNDetectFaceRectanglesRequest()
        let textRequest = VNRecognizeTextRequest()
        textRequest.recognitionLevel = .fast
        textRequest.usesLanguageCorrection = false
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([faceRequest, textRequest])
        let observations = faceRequest.results ?? []
        faces = observations.count
        largestFaceArea = observations.map { Double($0.boundingBox.width * $0.boundingBox.height) }.max() ?? 0
        recognizedTextCharacters = (textRequest.results ?? []).reduce(0) { total, observation in
            total + (observation.topCandidates(1).first?.string.filter { !$0.isWhitespace }.count ?? 0)
        }
    } catch {
        errorMessage = error.localizedDescription
    }
    let errorJson = errorMessage.map { "\"\(escaped($0))\"" } ?? "null"
    print("{\"file\":\"\(escaped(file))\",\"faces\":\(faces),\"largestFaceArea\":\(largestFaceArea),\"recognizedTextCharacters\":\(recognizedTextCharacters),\"error\":\(errorJson)}")
}
