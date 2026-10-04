import Capacitor
import StoreKit
import OSLog
import UIKit

private let passPluginLogger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.kristofferwithk.cluecabulary",
    category: "PassPlugin"
)

/**
 * The bridge controller the app actually runs, and the only one it makes:
 * SceneDelegate constructs this class in code, and Info.plist names no
 * storyboard entry point, so UIKit never instantiates a stock
 * CAPBridgeViewController of its own (the scene manifest says why).
 *
 * Registering here is the whole reason the subclass exists. A plain
 * CAPBridgeViewController at the root would leave both plugins unregistered
 * and say nothing about it: the JavaScript proxies still exist, their calls
 * just reject, and the app degrades to "Casey's reminder could not be set up"
 * with a clean build log.
 */
final class PassBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        guard let bridge else {
            passPluginLogger.error("pass-plugin-registration outcome=bridge-unavailable")
            return
        }
        bridge.registerPluginInstance(PassPlugin())
        bridge.registerPluginInstance(RemindersPlugin())
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "unknown"
        passPluginLogger.notice("pass-plugin-registration completed bundle=\(bundleIdentifier, privacy: .public) plugins=PassPlugin,RemindersPlugin")
    }
}

/**
 * The native half of the 900 Pass. StoreKit 2's verified current-entitlements
 * stream is queried whenever JavaScript asks; no web-storage flag can claim a
 * purchase. Product IDs mirror src/purchase/pass.ts exactly.
 */
@objc(PassPlugin)
public final class PassPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PassPlugin"
    public let jsName = "Pass"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offers", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "redeemCode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    private let productIDs = [
        "com.kristofferwithk.cluecabulary.pass.monthly",
        "com.kristofferwithk.cluecabulary.pass.lifetime",
    ]
    private let lifetimeID = "com.kristofferwithk.cluecabulary.pass.lifetime"
    /** Apple's subscriptions page, for when the StoreKit sheet cannot open. Mirrors APPLE_SUBSCRIPTIONS_URL in pass.ts. */
    private let subscriptionsURL = URL(string: "https://apps.apple.com/account/subscriptions")

    private var updatesTask: Task<Void, Never>?

    /**
     * StoreKit delivers tickets that did not come from `purchase()` here: a
     * code redeemed in Apple's sheet, an Ask to Buy approval, a purchase made
     * on another device. Apple asks every app to listen from launch and finish
     * what arrives; JavaScript hears it as `passChanged`.
     */
    public override func load() {
        updatesTask = Task.detached { [weak self] in
            for await verification in Transaction.updates {
                guard let self else { return }
                guard case .verified(let transaction) = verification,
                      self.productIDs.contains(transaction.productID) else { continue }
                await transaction.finish()
                let current = (try? await self.ownedPassProducts()) ?? []
                let fresh: Set<String> = transaction.revocationDate == nil ? [transaction.productID] : []
                self.notifyListeners("passChanged", data: self.result(for: current.union(fresh)))
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func status(_ call: CAPPluginCall) {
        Task {
            do {
                call.resolve(result(for: try await ownedPassProducts()))
            } catch {
                call.reject("StoreKit could not verify this ticket.", nil, error)
            }
        }
    }

    @objc func offers(_ call: CAPPluginCall) {
        Task {
            let bundleIdentifier = Bundle.main.bundleIdentifier ?? "unknown"
            let requestedIDs = productIDs.joined(separator: ",")
            let storefront = await Storefront.current
            let storefrontCountry = storefront?.countryCode ?? "unknown"
            let canMakePayments = SKPaymentQueue.canMakePayments()
            do {
                let products = try await Product.products(for: productIDs)
                let byID = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
                let offers = productIDs.compactMap { id -> [String: String]? in
                    guard let product = byID[id] else { return nil }
                    return ["id": product.id, "displayPrice": product.displayPrice]
                }
                if offers.isEmpty {
                    passPluginLogger.notice("pass-offers outcome=storekit-empty bundle=\(bundleIdentifier, privacy: .public) requestedIDs=\(requestedIDs, privacy: .public) returnedProducts=none storefront=\(storefrontCountry, privacy: .public) canMakePayments=\(canMakePayments, privacy: .public)")
                } else {
                    let productSummary = offers.map { "\($0["id"] ?? "unknown")=\($0["displayPrice"] ?? "unknown")" }.joined(separator: ",")
                    passPluginLogger.notice("pass-offers outcome=storekit-products bundle=\(bundleIdentifier, privacy: .public) requestedIDs=\(requestedIDs, privacy: .public) returnedProducts=\(productSummary, privacy: .public) storefront=\(storefrontCountry, privacy: .public) canMakePayments=\(canMakePayments, privacy: .public)")
                }
                call.resolve(["offers": offers])
            } catch {
                let diagnostic = safeStoreKitErrorCode(error)
                passPluginLogger.error("pass-offers outcome=storekit-request-failed bundle=\(bundleIdentifier, privacy: .public) requestedIDs=\(requestedIDs, privacy: .public) storefront=\(storefrontCountry, privacy: .public) canMakePayments=\(canMakePayments, privacy: .public) errorDomain=\(diagnostic.domain, privacy: .public) errorCode=\(diagnostic.code, privacy: .public)")
                call.reject("StoreKit could not load ticket prices.", diagnostic.bridgeCode)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productID = call.getString("productId"), productIDs.contains(productID) else {
            call.reject("That is not a 900 Pass product.")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [productID]).first else {
                    call.reject("This ticket is not available in App Store Connect yet.")
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    guard productIDs.contains(transaction.productID), transaction.revocationDate == nil else {
                        call.reject("Apple did not verify a valid 900 Pass ticket.")
                        return
                    }
                    await transaction.finish()
                    // The stream is asked first, but right after finish() it
                    // can still be empty; the verified transaction just
                    // checked is itself the proof, so an empty answer must not
                    // put the paid player back in front of the purchase dialog.
                    let current = (try? await ownedPassProducts()) ?? []
                    call.resolve(result(for: current.union([transaction.productID])))
                case .pending:
                    call.resolve(["entitled": false, "pending": true])
                case .userCancelled:
                    call.resolve(["entitled": false, "cancelled": true])
                @unknown default:
                    call.reject("Apple returned an unknown purchase result.")
                }
            } catch {
                call.reject("Apple could not complete this purchase.", nil, error)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(result(for: try await ownedPassProducts()))
            } catch {
                call.reject("Apple could not restore purchases.", nil, error)
            }
        }
    }

    @objc func redeemCode(_ call: CAPPluginCall) {
        // Apple owns the sheet and the code. Neither enters JavaScript nor a server.
        Task { @MainActor in
            if #available(iOS 16.0, *),
               let scene = self.bridge?.viewController?.view.window?.windowScene {
                do {
                    try await AppStore.presentOfferCodeRedeemSheet(in: scene)
                } catch {
                    call.reject("Apple could not open code redemption.", nil, error)
                    return
                }
                // The sheet has closed. A redeemed ticket is in the stream now,
                // or arrives shortly through Transaction.updates.
                var data = self.result(for: (try? await self.ownedPassProducts()) ?? [])
                data["awaited"] = true
                call.resolve(data)
            } else {
                SKPaymentQueue.default().presentCodeRedemptionSheet()
                call.resolve(["awaited": false])
            }
        }
    }

    /**
     * "Manage or cancel subscription" in Settings: Apple's own sheet, where the
     * player can see, change or cancel the monthly plan. The app cannot cancel
     * it itself; no StoreKit API does. Resolves when the sheet closes, so
     * JavaScript reads the plan again. If the sheet cannot open, Apple's
     * subscriptions page opens instead.
     */
    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            if let scene = self.bridge?.viewController?.view.window?.windowScene {
                do {
                    try await AppStore.showManageSubscriptions(in: scene)
                    passPluginLogger.notice("pass-manage outcome=sheet")
                    call.resolve(["opened": true, "sheet": true])
                    return
                } catch {
                    let diagnostic = self.safeStoreKitErrorCode(error)
                    passPluginLogger.error("pass-manage outcome=sheet-failed errorDomain=\(diagnostic.domain, privacy: .public) errorCode=\(diagnostic.code, privacy: .public)")
                }
            }
            guard let url = self.subscriptionsURL else {
                call.reject("Apple's subscription settings could not be opened.")
                return
            }
            UIApplication.shared.open(url) { opened in
                passPluginLogger.notice("pass-manage outcome=\(opened ? "page" : "page-failed", privacy: .public)")
                if opened {
                    call.resolve(["opened": true, "sheet": false])
                } else {
                    call.reject("Apple's subscription settings could not be opened.")
                }
            }
        }
    }

    /**
     * Every pass product this Apple Account holds now: verified, not revoked.
     * An unverified entitlement throws, as it always has, so a status read
     * fails closed rather than guessing.
     */
    private func ownedPassProducts() async throws -> Set<String> {
        var owned = Set<String>()
        for await verification in Transaction.currentEntitlements {
            let transaction = try checkVerified(verification)
            if productIDs.contains(transaction.productID), transaction.revocationDate == nil {
                owned.insert(transaction.productID)
            }
        }
        return owned
    }

    /**
     * The answer JavaScript reads. Lifetime wins when both are owned, as on
     * Android (PassEntitlement.java): this used to return whichever ticket the
     * stream listed first, so a player with both could be shown as monthly.
     * `ownedProductIds` lists both, so "Your plan" can say the monthly plan
     * still renews and should be cancelled.
     */
    private func result(for owned: Set<String>) -> [String: Any] {
        let ownedInOrder = productIDs.filter { owned.contains($0) }
        guard let productID = owned.contains(lifetimeID) ? lifetimeID : ownedInOrder.first else {
            return ["entitled": false]
        }
        return ["entitled": true, "productId": productID, "ownedProductIds": ownedInOrder]
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error): throw error
        case .verified(let safe): return safe
        }
    }

    private func safeStoreKitErrorCode(_ error: Error) -> (domain: String, code: Int, bridgeCode: String) {
        let nativeError = error as NSError
        let domain = String(nativeError.domain.filter {
            $0.isASCII && ($0.isLetter || $0.isNumber || ".-_".contains($0))
        }.prefix(64))
        let safeDomain = domain.isEmpty ? "UnknownErrorDomain" : domain
        return (safeDomain, nativeError.code, "\(safeDomain):\(nativeError.code)")
    }
}
