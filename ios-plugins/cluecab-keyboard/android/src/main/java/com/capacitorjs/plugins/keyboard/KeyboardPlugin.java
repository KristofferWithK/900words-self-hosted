package com.capacitorjs.plugins.keyboard;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewParent;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * The Android half of the fork: the same contract the iOS plugin keeps under
 * Keyboard.resize 'body', so src/ui/nativeKeyboard.ts runs unchanged.
 *
 *   1. keyboardWillShow arrives BEFORE anything on the page moves, with the
 *      height the keyboard will cover (CSS px of the WebView) and the
 *      animation's duration in `durationMs`, like the iOS fork's payload.
 *   2. The WebView itself never resizes. Capacitor's SystemBars plugin pads the
 *      WebView's parent by the keyboard's height (SystemBars.java,
 *      initWindowInsetsListener), which shrank the page mid-layout and let the
 *      board reflow into whatever was left. This plugin listens one level
 *      higher, on the content view, and hands the WebView's parent insets with
 *      the IME taken out, so SystemBars pads for the system bars only.
 *   3. The page is shrunk here instead, one animation duration plus 200 ms
 *      after willShow, by setting document.body.style.height, exactly as
 *      Keyboard.m's setKeyboardHeight:delay: does. The listener freezes the
 *      board on willShow, rides the composer up, and releases on this very
 *      style mutation.
 *
 * Any other resize mode leaves the insets alone and only reports events.
 */
@CapacitorPlugin(name = "Keyboard")
public class KeyboardPlugin extends Plugin {

    /** iOS: setKeyboardHeight:delay:duration + 0.2 on show. */
    private static final long SETTLE_MS = 200;
    /** iOS: setKeyboardHeight:0 delay:0.01 on hide. */
    private static final long HIDE_MS = 10;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable applyHeight = this::applyBodyHeight;
    private boolean resizeBody;
    private boolean shown = false;
    /** How many CSS px of the WebView the keyboard covers while shown. */
    private int covered = 0;
    /** The IME animation's duration, seen in onPrepare just before its insets. */
    private long pendingDurationMs = 0;

    @Override
    public void load() {
        resizeBody = "body".equals(getConfig().getString("resize", "native"));
        getActivity().runOnUiThread(this::attach);
    }

    private void attach() {
        View webView = getBridge().getWebView();
        ViewParent parent = webView.getParent();
        ViewParent host = parent != null ? parent.getParent() : null;
        if (!(host instanceof View)) {
            Logger.warn("Keyboard", "no view above the WebView's parent; keyboard events disabled");
            return;
        }
        View content = (View) host;
        // Without adjustResize the IME insets are not dispatched, and an
        // unspecified mode may PAN the window to reveal the focused field.
        getActivity().getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        ViewCompat.setWindowInsetsAnimationCallback(
            content,
            new WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                @Override
                public void onPrepare(@NonNull WindowInsetsAnimationCompat animation) {
                    if ((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                        pendingDurationMs = animation.getDurationMillis();
                    }
                }

                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> runningAnimations
                ) {
                    return insets;
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    if ((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) == 0) return;
                    if (shown) {
                        notifyListeners("keyboardDidShow", heightData());
                    } else {
                        notifyListeners("keyboardDidHide", new JSObject());
                    }
                }
            }
        );

        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            onInsets(v, insets);
            if (!resizeBody) return insets;
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .setVisible(WindowInsetsCompat.Type.ime(), false)
                .build();
        });
        ViewCompat.requestApplyInsets(content);
    }

    private void onInsets(View content, WindowInsetsCompat insets) {
        boolean visible = insets.isVisible(WindowInsetsCompat.Type.ime());
        int imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
        long durationMs = pendingDurationMs;
        pendingDurationMs = 0;

        int now = 0;
        if (visible && imeBottom > 0) {
            View webView = getBridge().getWebView();
            int[] at = new int[2];
            webView.getLocationInWindow(at);
            int webViewBottom = at[1] + webView.getHeight();
            int keyboardTop = content.getRootView().getHeight() - imeBottom;
            float density = webView.getResources().getDisplayMetrics().density;
            now = Math.max(0, Math.round((webViewBottom - keyboardTop) / density));
        }

        if (now > 0) {
            // iOS returns early on an unchanged height; so does this.
            if (shown && now == covered) return;
            shown = true;
            covered = now;
            if (resizeBody) schedule(durationMs + SETTLE_MS);
            JSObject data = heightData();
            data.put("durationMs", durationMs);
            notifyListeners("keyboardWillShow", data);
        } else if (shown) {
            shown = false;
            covered = 0;
            if (resizeBody) schedule(HIDE_MS);
            notifyListeners("keyboardWillHide", new JSObject());
        }
    }

    private JSObject heightData() {
        JSObject data = new JSObject();
        data.put("keyboardHeight", covered);
        return data;
    }

    private void schedule(long delayMs) {
        main.removeCallbacks(applyHeight);
        main.postDelayed(applyHeight, delayMs);
    }

    /**
     * Keyboard.m's resizeElement for 'body': the document ends where the
     * keyboard begins. innerHeight - covered is the same sum the listener's
     * probe makes, so the ride lands where this puts the dock.
     */
    private void applyBodyHeight() {
        String js = shown && covered > 0
            ? "(function(){var b=document.body;if(b){b.style.height=(window.innerHeight-" + covered + ")+'px';}})()"
            : "(function(){var b=document.body;if(b){b.style.height=null;}})()";
        getBridge().eval(js, null);
    }

    @Override
    protected void handleOnDestroy() {
        main.removeCallbacks(applyHeight);
    }
}
