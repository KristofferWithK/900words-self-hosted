// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "CluecabGemma",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CluecabGemma", targets: ["GemmaPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        // Google's source tag contains stale Android Git LFS pointers, so a
        // normal SwiftPM checkout fails before it reaches iOS. Pin the exact
        // official v0.16.0 Apple artifact and its published checksum, and
        // compile the matching Apache-licensed Swift wrapper vendored below.
        .binaryTarget(
            name: "CLiteRTLM",
            url: "https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.16.0/CLiteRTLM.xcframework.zip",
            checksum: "4e0f683da07566ee79c143d2d58d387f77052b0e6a41562c969e5d2728fc9f4b"
        ),
        .target(
            name: "LiteRTLM",
            dependencies: ["CLiteRTLM"],
            path: "vendor/LiteRTLM",
            exclude: ["LICENSE", "SOURCE.md"]
        ),
        .target(
            name: "GemmaPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                "LiteRTLM"
            ],
            path: "ios/Sources/GemmaPlugin")
    ]
)
