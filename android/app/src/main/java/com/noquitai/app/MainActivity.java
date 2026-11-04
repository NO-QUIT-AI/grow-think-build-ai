package com.noquitai.app;

import android.os.Bundle;
import android.net.Uri;
import android.content.Intent;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private static final String HOME = "https://noquitai.com/android-app";
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.hide(WindowInsetsCompat.Type.systemBars());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        android.widget.ImageView splash = new android.widget.ImageView(this);
        splash.setImageResource(com.noquitai.app.R.drawable.splash);
        splash.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
        addContentView(splash, new android.view.ViewGroup.LayoutParams(-1, -1));
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (splash.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup)splash.getParent()).removeView(splash);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return super.shouldOverrideUrlLoading(view, request);
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "noquitai.com".equals(uri.getHost()) && "/android-app".equals(uri.getPath())) return false;
                if ("https".equals(uri.getScheme()) && "localhost".equals(uri.getHost()) && "/offline.html".equals(uri.getPath())) return false;
                if ("https".equals(uri.getScheme()) && "noquitai.com".equals(uri.getHost()) && ("/privacy".equals(uri.getPath()) || "/contact".equals(uri.getPath()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
            }
        });
        bridge.getWebView().getSettings().setSupportMultipleWindows(false);
        bridge.getWebView().getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                WebView web = bridge.getWebView();
                if (web.canGoBack()) { web.goBack(); return; }
                new AlertDialog.Builder(MainActivity.this).setTitle("Close NO QUIT AI?").setNegativeButton("Stay", null).setPositiveButton("Close", (dialog, which) -> finish()).show();
            }
        });
    }
}
