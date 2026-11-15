package com.noquitai.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;
import android.accessibilityservice.AccessibilityServiceInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSafety")
public class DeviceSafetyPlugin extends Plugin {
    @PluginMethod public void check(PluginCall call) {
        KeyguardManager keyguard = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        AccessibilityManager accessibility = (AccessibilityManager) getContext().getSystemService(Context.ACCESSIBILITY_SERVICE);
        JSObject result = new JSObject();
        result.put("screenLock", keyguard != null && keyguard.isDeviceSecure());
        result.put("accessibilityServices", accessibility == null ? 0 : accessibility.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK).size());
        // Android permits checking these permissions for this app only, not scanning every installed app.
        result.put("overlay", Settings.canDrawOverlays(getContext()));
        result.put("unknownSources", getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }
    @PluginMethod public void openSettings(PluginCall call) {
        String section = call.getString("section", "security");
        String action = "security".equals(section) ? Settings.ACTION_SECURITY_SETTINGS : "apps".equals(section) ? Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS : Settings.ACTION_SETTINGS;
        try { getActivity().startActivity(new Intent(action)); call.resolve(); }
        catch (Exception error) { call.reject("Settings could not open"); }
    }
}