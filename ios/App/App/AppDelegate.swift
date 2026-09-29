import UIKit
import Capacitor
import FBSDKCoreKit
import AppTrackingTransparency

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Кеп (29.09): ініціалізація Meta SDK. Події не йдуть, поки користувач не дасть
        // згоду (FacebookAutoLogAppEventsEnabled=false в Info.plist + MetaEventsPlugin).
        ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Кеп (01.09): ОБОВ'ЯЗКОВІ для @capacitor/push-notifications — без цих двох методів
    // плагін ніколи не дізнається про токен від APNs, навіть якщо дозвіл надано і
    // entitlements правильно налаштовані. Стандартна вимога Capacitor, раніше була
    // відсутня повністю. GoogleService-Info.plist НЕ потрібен — push на iOS йде через
    // окремий Worker (euroclub-push-sender), напряму APNs, без Firebase (див. коментар
    // у euroclub-admin/api/send-push.ts).
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}

// Кеп (29.09): власний контролер, щоб зареєструвати локальний плагін MetaEvents.
// Тримаємо його в AppDelegate.swift, щоб не міняти project.pbxproj (новий файл треба
// було б додавати в Xcode вручну). Main.storyboard посилається на MainViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MetaEventsPlugin())
    }
}

@objc(MetaEventsPlugin)
public class MetaEventsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MetaEventsPlugin"
    public let jsName = "MetaEvents"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setConsent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logPurchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestTracking", returnType: CAPPluginReturnPromise),
    ]
    private var consent = false

    @objc func setConsent(_ call: CAPPluginCall) {
        consent = call.getBool("granted") ?? false
        DispatchQueue.main.async {
            Settings.shared.isAutoLogAppEventsEnabled = self.consent
            Settings.shared.isAdvertiserIDCollectionEnabled = self.consent
            // SDK 17 сам читає статус ATT — окремий прапорець не потрібен.
            if self.consent { AppEvents.shared.activateApp() }
            call.resolve()
        }
    }

    @objc func logEvent(_ call: CAPPluginCall) {
        guard consent else { call.resolve(); return }
        guard let name = call.getString("name"), !name.isEmpty else { call.reject("name required"); return }
        let params = toParams(call.getObject("params"))
        DispatchQueue.main.async {
            if let v = call.getDouble("valueToSum") {
                AppEvents.shared.logEvent(AppEvents.Name(name), valueToSum: v, parameters: params)
            } else {
                AppEvents.shared.logEvent(AppEvents.Name(name), parameters: params)
            }
            call.resolve()
        }
    }

    @objc func logPurchase(_ call: CAPPluginCall) {
        guard consent else { call.resolve(); return }
        guard let amount = call.getDouble("amount") else { call.reject("amount required"); return }
        let currency = (call.getString("currency") ?? "UAH").uppercased()
        let params = toParams(call.getObject("params"))
        DispatchQueue.main.async {
            AppEvents.shared.logPurchase(amount: amount, currency: currency, parameters: params)
            AppEvents.shared.flush()
            call.resolve()
        }
    }

    // Системний запит Apple (ATT). Повертає authorized | denied | restricted | notDetermined.
    @objc func requestTracking(_ call: CAPPluginCall) {
        guard #available(iOS 14, *) else { call.resolve(["status": "authorized"]); return }
        DispatchQueue.main.async {
            ATTrackingManager.requestTrackingAuthorization { status in
                let s: String
                switch status {
                case .authorized: s = "authorized"
                case .denied: s = "denied"
                case .restricted: s = "restricted"
                default: s = "notDetermined"
                }
                call.resolve(["status": s])
            }
        }
    }

    private func toParams(_ obj: JSObject?) -> [AppEvents.ParameterName: Any] {
        var out: [AppEvents.ParameterName: Any] = [:]
        obj?.forEach { k, v in out[AppEvents.ParameterName(k)] = v }
        return out
    }
}
