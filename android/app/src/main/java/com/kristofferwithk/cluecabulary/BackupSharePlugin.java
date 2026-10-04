package com.kristofferwithk.cluecabulary;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Backup export on Android.
 *
 * src/backup/apply.ts hands the backup file to navigator.share, which iOS's WKWebView has and
 * Android's WebView does not; the fallback, an anchor download of a blob: URL, does nothing in
 * a WebView without a download handler. So the export button did nothing on Android.
 *
 * Rather than a second code path in the app, this supplies the missing API: on every page load
 * it defines navigator.canShare / navigator.share for FILES only (the one thing the app shares),
 * and share() sends the file to Android's own share sheet through shareFile below. The web
 * bundle stays byte-identical to the iOS one; iOS never sees any of this.
 */
@CapacitorPlugin(name = "BackupShare")
public class BackupSharePlugin extends Plugin {

    // The plugin is looked up when share() is CALLED, not when this runs: at page-finished the
    // Capacitor plugin proxies may not exist yet, and an early bail-out left navigator.share
    // undefined for the whole session.
    private static final String POLYFILL =
        "(function () {\n" +
        "  if (navigator.share) return 'present';\n" +
        "  navigator.canShare = function (d) { return !!(d && d.files && d.files.length === 1); };\n" +
        "  navigator.share = function (d) {\n" +
        "    var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackupShare;\n" +
        "    var f = d && d.files && d.files[0];\n" +
        "    if (!plugin || !f) return Promise.reject(new TypeError('Only a single file can be shared here.'));\n" +
        "    return new Promise(function (resolve, reject) {\n" +
        "      var r = new FileReader();\n" +
        "      r.onload = function () { var s = String(r.result); resolve(s.slice(s.indexOf(',') + 1)); };\n" +
        "      r.onerror = function () { reject(r.error); };\n" +
        "      r.readAsDataURL(f);\n" +
        "    }).then(function (data) {\n" +
        "      return plugin.shareFile({ name: f.name, type: f.type || 'application/octet-stream', data: data, title: (d && d.title) || '' });\n" +
        "    }).then(function () {});\n" +
        "  };\n" +
        "  return 'installed';\n" +
        "})();";

    /**
     * Installs the polyfill on every page load. MainActivity registers this on the bridge
     * BUILDER: a listener a plugin adds in load() is discarded, because Bridge.Builder.create()
     * replaces the bridge's listener list with the builder's own after the plugins have loaded
     * (Capacitor 8, Bridge.java setWebViewListeners).
     */
    static final WebViewListener PAGE_LISTENER = new WebViewListener() {
        @Override
        public void onPageLoaded(WebView webView) {
            webView.evaluateJavascript(POLYFILL, result -> Logger.debug("BackupShare", "navigator.share " + result));
        }
    };

    @PluginMethod
    public void shareFile(PluginCall call) {
        String name = call.getString("name", "backup.json");
        String type = call.getString("type", "application/octet-stream");
        String data = call.getString("data");
        String title = call.getString("title", "");
        if (data == null) {
            call.reject("data is required");
            return;
        }
        try {
            // cache/shared/ is inside the FileProvider's cache-path (res/xml/file_paths.xml).
            File dir = new File(getContext().getCacheDir(), "shared");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot create " + dir);
            File file = new File(dir, new File(name).getName());
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(type);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            if (!title.isEmpty()) {
                send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.putExtra(Intent.EXTRA_TITLE, title);
            }
            send.setClipData(ClipData.newRawUri(title, uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(send, title.isEmpty() ? null : title));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not share the file: " + e.getMessage(), e);
        }
    }
}
