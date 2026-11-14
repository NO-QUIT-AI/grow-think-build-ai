package com.noquitai.app;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class CallMessagingService extends FirebaseMessagingService {
    static final String CHANNEL = "incoming_calls";
    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("NO QUIT AI voice and video invitations");
        channel.enableVibration(true);
        channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
        ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String id = data.get("inviteId");
        if (!"incoming_call".equals(data.get("kind")) || id == null || !id.matches("[a-fA-F0-9-]{36}")) return;
        NotificationManager manager = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if (!"ringing".equals(data.get("status"))) {
            manager.cancel(id.hashCode());
            getSharedPreferences("call_push", 0).edit().putString("closed_invite", id).apply();
            return;
        }
        if (!getSharedPreferences("call_push", 0).getBoolean("enabled", false)) return;
        long expires;
        try { expires = Long.parseLong(data.get("expiresAt")); } catch (Exception e) { return; }
        long remaining = expires - System.currentTimeMillis();
        if (remaining <= 0 || remaining > 30000) return;
        createChannel(this);
        Intent screen = new Intent(this, IncomingCallActivity.class).putExtra("inviteId", id).putExtra("video", "video".equals(data.get("callType"))).putExtra("expiresAt", expires);
        PendingIntent open = PendingIntent.getActivity(this, id.hashCode(), screen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_call_notification).setContentTitle("NO QUIT AI")
            .setContentText("Incoming " + ("video".equals(data.get("callType")) ? "video" : "voice") + " call")
            .setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_MAX)
            .setContentIntent(open).setFullScreenIntent(open, true).setTimeoutAfter(remaining)
            .setOngoing(true).setAutoCancel(true).build();
        try { manager.notify(id.hashCode(), notification); } catch (SecurityException ignored) {}
    }
}