package com.noquitai.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.*;

public class IncomingCallActivity extends Activity {
    private final Handler timer = new Handler(android.os.Looper.getMainLooper());
    private final Runnable checkClosed = new Runnable() {
        @Override public void run() {
            String id = getIntent().getStringExtra("inviteId");
            if (id != null && id.equals(getSharedPreferences("call_push", 0).getString("closed_invite", ""))) { finish(); return; }
            timer.postDelayed(this, 500);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        long remaining = getIntent().getLongExtra("expiresAt", 0) - System.currentTimeMillis();
        if (remaining <= 0) { finish(); return; }
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL); layout.setGravity(Gravity.CENTER); layout.setPadding(32, 32, 32, 32);
        ImageView logo = new ImageView(this); logo.setImageResource(R.mipmap.ic_launcher); layout.addView(logo, new LinearLayout.LayoutParams(200, 200));
        TextView title = new TextView(this); title.setText("NO QUIT AI"); title.setTextSize(28); layout.addView(title);
        TextView type = new TextView(this); type.setText(getIntent().getBooleanExtra("video", false) ? "Incoming video call" : "Incoming voice call"); type.setTextSize(20); layout.addView(type);
        Button answer = new Button(this); answer.setText("Accept"); answer.setOnClickListener(v -> open("accept")); layout.addView(answer);
        Button decline = new Button(this); decline.setText("Reject"); decline.setOnClickListener(v -> open("reject")); layout.addView(decline);
        setContentView(layout);
        timer.postDelayed(this::finish, remaining);
        timer.post(checkClosed);
    }
    private void open(String action) {
        String id = getIntent().getStringExtra("inviteId");
        if (id == null || !id.matches("[a-fA-F0-9-]{36}")) { finish(); return; }
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(id.hashCode());
        Intent intent = new Intent(this, MainActivity.class).setData(android.net.Uri.parse("https://noquitai.com/?incomingCall=" + id + "&callAction=" + action));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent); finish();
    }
    @Override protected void onDestroy() { timer.removeCallbacksAndMessages(null); super.onDestroy(); }
}