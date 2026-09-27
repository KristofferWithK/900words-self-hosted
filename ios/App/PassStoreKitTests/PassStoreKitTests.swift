import Foundation
import StoreKitTest
import UIKit
import WebKit
import XCTest
@testable import App

final class PassStoreKitTests: XCTestCase {
    private let monthlyProductID = "com.kristofferwithk.cluecabulary.pass.monthly"
    private let lifetimeProductID = "com.kristofferwithk.cluecabulary.pass.lifetime"
    private var storeKitSession: SKTestSession?

    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false

        guard let fixture = Bundle(for: PassStoreKitTests.self)
            .url(forResource: "PassStoreKit", withExtension: "storekit") else {
            XCTFail("PassStoreKit.storekit must be copied into the XCTest bundle.")
            return
        }

        let session = try SKTestSession(contentsOf: fixture)
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        storeKitSession = session
    }

    @MainActor
    func testRootControllerPassBridgeStatusAndOffers() async throws {
        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)

        let status = try await callPassValue(method: "status", on: webView)
        XCTAssertEqual(status["entitled"] as? Bool, false, "A clean StoreKit session should start without an entitlement.")

        let offerResult = try await callPassValue(method: "offers", on: webView)
        guard let offers = offerResult["offers"] as? [[String: Any]] else {
            XCTFail("Pass.offers returned no offers array: \(offerResult)")
            return
        }

        let offersByID = Dictionary(uniqueKeysWithValues: offers.compactMap { offer -> (String, [String: Any])? in
            guard let id = offer["id"] as? String else { return nil }
            return (id, offer)
        })
        XCTAssertEqual(Set(offersByID.keys), Set([
            "com.kristofferwithk.cluecabulary.pass.monthly",
            "com.kristofferwithk.cluecabulary.pass.lifetime",
        ]))
        XCTAssertEqual(offersByID[monthlyProductID]?["displayPrice"] as? String, "$0.99")
        // This is the intended test-fixture value; the separate live ASC audit
        // found $9.99 and must not silently redefine the StoreKit test offer.
        XCTAssertEqual(offersByID[lifetimeProductID]?["displayPrice"] as? String, "$10.99")
    }

    @MainActor
    func testMonthlyPurchaseEntitlementSurvivesWebViewReloadAndRestore() async throws {
        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)

        let purchase = try await callPassValue(
            method: "purchase",
            options: ["productId": monthlyProductID],
            on: webView
        )
        assertEntitled(purchase, productID: monthlyProductID)
        assertEntitled(try await callPassValue(method: "status", on: webView), productID: monthlyProductID)

        // A WKWebView navigation reload only: the app process is intentionally
        // left running, so this does not claim to test a process relaunch.
        try await reloadWebViewAndWait(webView)
        try await assertPassPluginAvailable(on: webView)
        assertEntitled(try await callPassValue(method: "status", on: webView), productID: monthlyProductID)

        let restore = try await callPassValue(method: "restore", on: webView)
        assertEntitled(restore, productID: monthlyProductID)
        assertEntitled(try await callPassValue(method: "status", on: webView), productID: monthlyProductID)
    }

    @MainActor
    func testLifetimePurchaseGrantsEntitlementThroughRootBridge() async throws {
        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)

        let purchase = try await callPassValue(
            method: "purchase",
            options: ["productId": lifetimeProductID],
            on: webView
        )
        assertEntitled(purchase, productID: lifetimeProductID)
        assertEntitled(try await callPassValue(method: "status", on: webView), productID: lifetimeProductID)
    }

    @MainActor
    func testExpiringMonthlySubscriptionRemovesEntitlement() async throws {
        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)

        let purchase = try await callPassValue(
            method: "purchase",
            options: ["productId": monthlyProductID],
            on: webView
        )
        assertEntitled(purchase, productID: monthlyProductID)

        let session = try XCTUnwrap(storeKitSession)
        try session.expireSubscription(productIdentifier: monthlyProductID)
        let status = try await waitForEntitlement(false, productID: nil, on: webView)
        XCTAssertEqual(status["entitled"] as? Bool, false)
    }

    @MainActor
    func testRefundingLifetimePurchaseRemovesEntitlement() async throws {
        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)

        let purchase = try await callPassValue(
            method: "purchase",
            options: ["productId": lifetimeProductID],
            on: webView
        )
        assertEntitled(purchase, productID: lifetimeProductID)

        let session = try XCTUnwrap(storeKitSession)
        let transaction = try XCTUnwrap(session.allTransactions().last)
        try session.refundTransaction(identifier: transaction.identifier)
        let status = try await waitForEntitlement(false, productID: nil, on: webView)
        XCTAssertEqual(status["entitled"] as? Bool, false)
    }

    @MainActor
    func testAskToBuyPendingPurchaseCanBeApproved() async throws {
        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)
        let session = try XCTUnwrap(storeKitSession)
        session.askToBuyEnabled = true

        let purchase = try await callPassValue(
            method: "purchase",
            options: ["productId": monthlyProductID],
            on: webView
        )
        XCTAssertEqual(purchase["entitled"] as? Bool, false)
        XCTAssertEqual(purchase["pending"] as? Bool, true)

        let pendingTransaction = try XCTUnwrap(session.allTransactions().last)
        try session.approveAskToBuyTransaction(identifier: pendingTransaction.identifier)
        let status = try await waitForEntitlement(true, productID: monthlyProductID, on: webView)
        assertEntitled(status, productID: monthlyProductID)
    }

    @MainActor
    func testInjectedStoreKitPurchaseFailureRejectsWithoutEntitlement() async throws {
        guard #available(iOS 17.0, *) else {
            throw XCTSkip("StoreKit purchase error injection requires iOS 17 or later.")
        }

        let webView = try await rootPassWebView()
        try await assertPassPluginAvailable(on: webView)
        let session = try XCTUnwrap(storeKitSession)
        let purchaseAPI = StoreKitPurchaseAPI()
        try await session.setSimulatedError(
            .generic(.networkError(URLError(.notConnectedToInternet))),
            forAPI: purchaseAPI
        )

        let failedPurchase: [String: Any]
        do {
            failedPurchase = try await callPass(
                method: "purchase",
                options: ["productId": lifetimeProductID],
                on: webView
            )
        } catch {
            try await session.setSimulatedError(nil, forAPI: purchaseAPI)
            throw error
        }
        try await session.setSimulatedError(nil, forAPI: purchaseAPI)

        XCTAssertEqual(failedPurchase["timedOut"] as? Bool, false)
        XCTAssertNil(failedPurchase["value"])
        XCTAssertFalse((failedPurchase["errorMessage"] as? String ?? "").isEmpty)
        // An injected thrown error does not exercise StoreKit's .userCancelled branch.
        let status = try await callPassValue(method: "status", on: webView)
        XCTAssertEqual(status["entitled"] as? Bool, false)
    }

    @MainActor
    private func rootPassWebView() async throws -> WKWebView {
        let deadline = Date().addingTimeInterval(150)
        while Date() < deadline {
            let controllers = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .compactMap { $0.rootViewController as? PassBridgeViewController }

            if let controller = controllers.first {
                controller.loadViewIfNeeded()
                if let webView = controller.bridge?.webView,
                   let ready = try? await webView.evaluateJavaScript(
                    "typeof window.Capacitor?.nativePromise === 'function'"
                   ) as? Bool,
                   ready {
                    return webView
                }
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }

        throw NSError(
            domain: "PassStoreKitTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "The app root PassBridgeViewController WKWebView did not become ready within 150 seconds."]
        )
    }

    @MainActor
    private func callPass(method: String, on webView: WKWebView) async throws -> [String: Any] {
        try await callPass(method: method, options: [:], on: webView)
    }

    @MainActor
    private func callPass(
        method: String,
        options: [String: String],
        on webView: WKWebView
    ) async throws -> [String: Any] {
        let result = try await webView.callAsyncJavaScript(
            """
            const nativeCall = window.Capacitor.nativePromise('Pass', methodName, options)
              .then(value => ({ timedOut: false, value }))
              .catch(error => ({
                timedOut: false,
                errorCode: error && error.code != null ? String(error.code) : null,
                errorMessage: error && error.message ? String(error.message) : String(error)
              }));
            const timeout = new Promise(resolve =>
              setTimeout(() => resolve({ timedOut: true }), timeoutMilliseconds)
            );
            return await Promise.race([nativeCall, timeout]);
            """,
            arguments: [
                "methodName": method,
                "options": options,
                "timeoutMilliseconds": 10_000,
            ],
            in: nil,
            contentWorld: .page
        )
        guard let dictionary = result as? [String: Any] else {
            throw NSError(
                domain: "PassStoreKitTests",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Capacitor nativePromise returned a non-object result."]
            )
        }
        return dictionary
    }

    @MainActor
    private func callPassValue(
        method: String,
        options: [String: String] = [:],
        on webView: WKWebView
    ) async throws -> [String: Any] {
        let call = try await callPass(method: method, options: options, on: webView)
        guard call["timedOut"] as? Bool != true else {
            throw NSError(
                domain: "PassStoreKitTests",
                code: 4,
                userInfo: [NSLocalizedDescriptionKey: "PASS_BRIDGE_TIMEOUT: Pass.\(method) did not settle within 10 seconds."]
            )
        }
        guard let value = call["value"] as? [String: Any] else {
            let code = call["errorCode"] ?? "unknown"
            let message = call["errorMessage"] ?? "no error message"
            throw NSError(
                domain: "PassStoreKitTests",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "Pass.\(method) rejected through the native bridge (code=\(code), message=\(message))."]
            )
        }
        return value
    }

    @MainActor
    private func assertPassPluginAvailable(on webView: WKWebView) async throws {
        let passPluginAvailable = try await webView.evaluateJavaScript(
            "window.Capacitor.isPluginAvailable('Pass')"
        ) as? Bool
        XCTAssertTrue(
            passPluginAvailable == true,
            "NEGATIVE_CONTROL_PLUGIN_MISSING: the app root Capacitor bridge does not advertise Pass."
        )
        guard passPluginAvailable == true else {
            throw NSError(
                domain: "PassStoreKitTests",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "NEGATIVE_CONTROL_PLUGIN_MISSING: Pass is not registered."]
            )
        }
    }

    @MainActor
    private func reloadWebViewAndWait(_ webView: WKWebView) async throws {
        _ = try await webView.evaluateJavaScript("window.__passStoreKitReloadMarker = true")
        guard webView.reload() != nil else {
            throw NSError(
                domain: "PassStoreKitTests",
                code: 6,
                userInfo: [NSLocalizedDescriptionKey: "WKWebView.reload() did not start a navigation."]
            )
        }

        for _ in 0..<150 {
            let ready = try? await webView.evaluateJavaScript(
                "window.__passStoreKitReloadMarker !== true && typeof window.Capacitor?.nativePromise === 'function'"
            ) as? Bool
            if ready == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }

        throw NSError(
            domain: "PassStoreKitTests",
            code: 7,
            userInfo: [NSLocalizedDescriptionKey: "The root WKWebView did not finish its reload and restore the Capacitor bridge."]
        )
    }

    @MainActor
    private func waitForEntitlement(
        _ entitled: Bool,
        productID: String?,
        on webView: WKWebView
    ) async throws -> [String: Any] {
        let deadline = Date().addingTimeInterval(10)
        var lastStatus: [String: Any] = [:]
        while Date() < deadline {
            lastStatus = try await callPassValue(method: "status", on: webView)
            let hasExpectedEntitlement = lastStatus["entitled"] as? Bool == entitled
            let hasExpectedProduct = productID == nil || lastStatus["productId"] as? String == productID
            if hasExpectedEntitlement && hasExpectedProduct { return lastStatus }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        throw NSError(
            domain: "PassStoreKitTests",
            code: 8,
            userInfo: [NSLocalizedDescriptionKey: "Pass.status did not converge to entitled=\(entitled), productId=\(productID ?? "none") within 10 seconds; last result: \(lastStatus)."]
        )
    }

    private func assertEntitled(
        _ result: [String: Any],
        productID: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(result["entitled"] as? Bool, true, file: file, line: line)
        XCTAssertEqual(result["productId"] as? String, productID, file: file, line: line)
    }
}
