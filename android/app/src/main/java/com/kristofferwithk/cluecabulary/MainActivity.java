package com.kristofferwithk.cluecabulary;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupSharePlugin.class);
        bridgeBuilder.addWebViewListener(BackupSharePlugin.PAGE_LISTENER);
        super.onCreate(savedInstanceState);

        // Capacitor's shell has no Back handling of its own, so Android's default ran and
        // Back closed the app from any screen. The web app already answers Back: every
        // screen above Home and every sheet pushes a history entry (src/stores/uiStore.ts),
        // and App.tsx's popstate handler closes the sheet or returns Home. So Back walks the
        // WebView's history. Entries pushed without a user gesture (a cold start straight
        // into a round) are skipped by Chromium, so with no history left the app is asked
        // directly (window.__cluecabBack, App.tsx); only when it has nothing to close does
        // Android's own Back run and the app go to the background.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView == null) {
                    systemBack(this);
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                webView.evaluateJavascript(
                    "(function(){try{return !!(window.__cluecabBack&&window.__cluecabBack());}catch(e){return false;}})()",
                    handled -> {
                        if (!"true".equals(handled)) systemBack(this);
                    }
                );
            }
        });
    }

    private void systemBack(OnBackPressedCallback callback) {
        callback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        callback.setEnabled(true);
    }
}
