import Capacitor
import UIKit
import UserNotifications

/**
 * A deliberately local-only notification bridge. It neither registers for
 * remote notifications nor receives a device token, so no APNs/backend push
 * can be introduced by this feature accidentally.
 */
@objc(RemindersPlugin)
public final class RemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RemindersPlugin"
    public let jsName = "Reminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reschedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
    ]

    private let reminderIdentifier = "casey-daily-reminder"

    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            call.resolve(["permission": self.permissionName(settings.authorizationStatus)])
        }
    }

    /** This is invoked solely by the explicit Settings opt-in action. */
    @objc func enable(_ call: CAPPluginCall) {
        guard let copy = copy(from: call) else { return }
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    guard granted else {
                        call.resolve(["enabled": false, "permission": "denied"])
                        return
                    }
                    self.schedule(copy, call: call, enabledResponse: true)
                }
            case .authorized, .provisional, .ephemeral:
                self.schedule(copy, call: call, enabledResponse: true)
            case .denied:
                call.resolve(["enabled": false, "permission": "denied"])
            @unknown default:
                call.resolve(["enabled": false, "permission": "denied"])
            }
        }
    }

    /** Refreshes copy after a completed game, without ever prompting again. */
    @objc func reschedule(_ call: CAPPluginCall) {
        guard let copy = copy(from: call) else { return }
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                self.schedule(copy, call: call, enabledResponse: false)
            default:
                call.resolve(["scheduled": false])
            }
        }
    }

    @objc func disable(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [reminderIdentifier])
        call.resolve()
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("iPhone could not open notification settings.")
                return
            }
            UIApplication.shared.open(url) { opened in
                opened ? call.resolve() : call.reject("iPhone could not open notification settings.")
            }
        }
    }

    private func copy(from call: CAPPluginCall) -> (title: String, body: String)? {
        guard let title = call.getString("title"), let body = call.getString("body"), !title.isEmpty, !body.isEmpty else {
            call.reject("A reminder needs Casey’s local title and message.")
            return nil
        }
        return (title, body)
    }

    private func schedule(_ copy: (title: String, body: String), call: CAPPluginCall, enabledResponse: Bool) {
        let content = UNMutableNotificationContent()
        content.title = copy.title
        content.body = copy.body
        content.sound = .default

        // The hour is the app's (REMINDER_HOUR in src/reminders/reminders.ts),
        // sent with every schedule call; the fallback only covers a call from
        // an older bundle that did not send one.
        var date = DateComponents()
        date.hour = call.getInt("hour") ?? 15
        date.minute = call.getInt("minute") ?? 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: true)
        let request = UNNotificationRequest(identifier: reminderIdentifier, content: content, trigger: trigger)
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderIdentifier])
        center.add(request) { error in
            if let error {
                call.reject("iPhone could not schedule Casey’s reminder.", nil, error)
            } else if enabledResponse {
                call.resolve(["enabled": true, "permission": "authorized"])
            } else {
                call.resolve(["scheduled": true])
            }
        }
    }

    private func permissionName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "not-determined"
        case .authorized, .provisional, .ephemeral: return "authorized"
        case .denied: return "denied"
        @unknown default: return "denied"
        }
    }
}
