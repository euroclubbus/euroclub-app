package com.eclub.app;

import android.os.Bundle;

import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Iterator;

/**
 * Кеп (29.09): власний міні-плагін Meta App Events (Facebook Core SDK).
 * За замовчуванням SDK НЕ шле нічого (AutoLogAppEvents/AdvertiserID вимкнені в
 * маніфесті) — вмикається тільки після згоди користувача (setConsent granted=true).
 */
@CapacitorPlugin(name = "MetaEvents")
public class MetaEventsPlugin extends Plugin {

    private AppEventsLogger logger;
    private boolean consent = false;

    private AppEventsLogger logger() {
        if (logger == null) logger = AppEventsLogger.newLogger(getContext());
        return logger;
    }

    @PluginMethod
    public void setConsent(PluginCall call) {
        consent = Boolean.TRUE.equals(call.getBoolean("granted", false));
        try {
            FacebookSdk.setAutoLogAppEventsEnabled(consent);
            FacebookSdk.setAdvertiserIDCollectionEnabled(consent);
            if (consent) {
                if (!FacebookSdk.isInitialized()) FacebookSdk.sdkInitialize(getContext().getApplicationContext());
                AppEventsLogger.activateApp(getActivity().getApplication());
            }
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void logEvent(PluginCall call) {
        if (!consent) { call.resolve(); return; }
        String name = call.getString("name");
        if (name == null || name.isEmpty()) { call.reject("name required"); return; }
        Bundle params = toBundle(call.getObject("params"));
        Double value = call.getDouble("valueToSum");
        try {
            if (value != null) logger().logEvent(name, value, params);
            else logger().logEvent(name, params);
        } catch (Exception e) { call.reject(e.getMessage()); return; }
        call.resolve();
    }

    @PluginMethod
    public void logPurchase(PluginCall call) {
        if (!consent) { call.resolve(); return; }
        Double amount = call.getDouble("amount");
        String currency = call.getString("currency", "UAH");
        if (amount == null) { call.reject("amount required"); return; }
        try {
            logger().logPurchase(BigDecimal.valueOf(amount), Currency.getInstance(currency.toUpperCase()), toBundle(call.getObject("params")));
            logger().flush();
        } catch (Exception e) { call.reject(e.getMessage()); return; }
        call.resolve();
    }

    // На Android немає ATT — повертаємо "authorized", щоб JS-код був однаковий.
    @PluginMethod
    public void requestTracking(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", "authorized");
        call.resolve(ret);
    }

    private Bundle toBundle(JSObject obj) {
        Bundle b = new Bundle();
        if (obj == null) return b;
        Iterator<String> keys = obj.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            Object v = obj.opt(k);
            if (v == null) continue;
            if (v instanceof Integer) b.putInt(k, (Integer) v);
            else if (v instanceof Long) b.putLong(k, (Long) v);
            else if (v instanceof Double) b.putDouble(k, (Double) v);
            else if (v instanceof Boolean) b.putBoolean(k, (Boolean) v);
            else b.putString(k, String.valueOf(v));
        }
        return b;
    }
}
