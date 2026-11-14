package com.noquitai.app;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "CallPush", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class CallPushPlugin extends Plugin {
    @PluginMethod public void register(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermission"); return;
        }
        registerToken(call);
    }
    @PermissionCallback private void notificationPermission(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) { call.reject("Notifications denied. Enable them in Android settings."); return; }
        registerToken(call);
    }
    private void registerToken(PluginCall call) {
        CallMessagingService.createChannel(getContext());
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) { call.reject("Firebase registration failed"); return; }
            getContext().getSharedPreferences("call_push", 0).edit().putBoolean("enabled", true).apply();
            JSObject result = new JSObject(); result.put("token", task.getResult()); call.resolve(result);
        });
    }
    @PluginMethod public void disable(PluginCall call) {
        getContext().getSharedPreferences("call_push", 0).edit().putBoolean("enabled", false).apply();
        FirebaseMessaging.getInstance().deleteToken();
        ((android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE)).cancelAll();
        call.resolve();
    }
    @PluginMethod public void dismiss(PluginCall call) {
        String id = call.getString("inviteId");
        if (id != null) ((android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE)).cancel(id.hashCode());
        call.resolve();
    }
}