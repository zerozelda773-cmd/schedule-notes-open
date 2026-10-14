package org.synthetic.schedulenotes;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.WindowInsets;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.Collections;
import java.io.ByteArrayInputStream;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private WebView webView;
    private SharedStateStore sharedStateStore;
    private static final java.util.concurrent.ExecutorService stateWriter = java.util.concurrent.Executors.newSingleThreadExecutor();
    private ValueCallback<Uri[]> fileChooserCallback;
    private UpdateInstaller updateInstaller;
    private PptxDocumentSaver pptxSaver;
    private PptxDocumentSaver activityDocumentSaver;
    private SecureCredentialStore credentialStore;
    private MorningBriefSpeaker morningBriefSpeaker;
    private final PptxTransferBuffer pptxTransfer = new PptxTransferBuffer();
    private final PptxTransferBuffer activityDocumentTransfer = new PptxTransferBuffer(".docx", ".xlsx");
    private boolean graphOrientationActive;
    private int orientationBeforeGraph = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private int configurationBeforeGraph = Configuration.ORIENTATION_UNDEFINED;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sharedStateStore = SharedStateStore.get(getApplicationContext());
        getWindow().setStatusBarColor(Color.rgb(245, 246, 247));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        FrameLayout rootView = new FrameLayout(this);
        rootView.setBackgroundColor(Color.rgb(245, 246, 247));
        webView = new WebView(this);
        rootView.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        rootView.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets safeInsets = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                left = safeInsets.left;
                top = safeInsets.top;
                right = safeInsets.right;
                if (insets.isVisible(WindowInsets.Type.ime())) {
                    bottom = insets.getInsets(WindowInsets.Type.ime()).bottom;
                }
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && insets.getDisplayCutout() != null) {
                    left = Math.max(left, insets.getDisplayCutout().getSafeInsetLeft());
                    top = Math.max(top, insets.getDisplayCutout().getSafeInsetTop());
                    right = Math.max(right, insets.getDisplayCutout().getSafeInsetRight());
                }
            }
            view.setPadding(left, top, right, bottom);
            if (BuildConfig.DEBUG) {
                android.util.Log.d("CloudResizeInsets", "applied=" + view.getPaddingLeft() + ","
                    + view.getPaddingTop() + "," + view.getPaddingRight() + "," + view.getPaddingBottom());
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) return WindowInsets.CONSUMED;
            WindowInsets consumed = insets.consumeSystemWindowInsets();
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? consumed.consumeDisplayCutout() : consumed;
        });
        setContentView(rootView);
        rootView.requestApplyInsets();
        credentialStore = new SecureCredentialStore(this);
        morningBriefSpeaker = new MorningBriefSpeaker(this, webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
            || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            android.widget.TextView error = new android.widget.TextView(this);
            error.setText("当前 WebView 不支持安全运行能力，请更新 Android System WebView / Chrome。");
            setContentView(error);
            return;
        }
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        AndroidBridge actions = new AndroidBridge();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
        WebViewCompat.addWebMessageListener(webView, "NativeMessage", Collections.singleton(TrustedWebPolicy.ORIGIN),
            (view, message, sourceOrigin, isMainFrame, reply) -> {
                if (!TrustedWebPolicy.context(sourceOrigin, isMainFrame)) {
                    if (BuildConfig.DEBUG) android.util.Log.d("NativeSecurityGate", "PRIVILEGED MESSAGE REJECTED: untrusted origin or non-main frame");
                    return;
                }
                String id = "";
                try {
                    org.json.JSONObject m = TrustedWebPolicy.validate(message.getData());
                    id = m.getString("id");
                    if ("state.save".equals(m.getString("type"))) {
                        final String requestId = id, snapshot = m.getJSONObject("payload").getString("snapshot");
                        stateWriter.execute(() -> {
                            org.json.JSONObject response = new org.json.JSONObject();
                            try { response.put("id",requestId).put("result",sharedStateStore.save(snapshot)).put("ok",true); }
                            catch (Exception failure) { try { response.put("id",requestId).put("ok",false).put("error","Local state commit failed"); } catch (org.json.JSONException ignored) { } }
                            view.post(() -> reply.postMessage(response.toString()));
                        });
                        return;
                    }
                    Object result = dispatchNative(actions, m.getString("type"), m.getJSONObject("payload"));
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
                        reply.postMessage(new org.json.JSONObject().put("id",id).put("ok",true).put("result",result == null ? org.json.JSONObject.NULL : result).toString());
                } catch (Exception invalid) {
                    try { if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) reply.postMessage(new org.json.JSONObject().put("id",id).put("ok",false).put("error", "Native message rejected").toString()); }
                    catch (org.json.JSONException ignored) { }
                }
            });
        }
        try {
            java.io.InputStream adapter = getAssets().open("www/android-native-adapter.js");
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int count;
            while ((count=adapter.read(buffer)) != -1) bytes.write(buffer,0,count);
            adapter.close();
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(webView, bytes.toString("UTF-8"), Collections.singleton(TrustedWebPolicy.ORIGIN));
            }
        } catch (Exception missing) { throw new IllegalStateException("Missing secure Native adapter", missing); }
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) {
                    if (!TrustedWebPolicy.asset(uri)) return blockedResource();


                    String assetPath = uri.getPath();
                    if ("/assets/www/vendor/tesseract/lang/eng.traineddata.gz".equals(assetPath)
                        || "/assets/www/vendor/tesseract/lang/chi_sim.traineddata.gz".equals(assetPath)) {
                        uri = uri.buildUpon().path(assetPath.substring(0, assetPath.length() - 3)).build();
                    }
                    WebResourceResponse response = assets.shouldInterceptRequest(uri);
                    if (response == null) return blockedResource();
                    if ("/assets/www/app.js".equals(uri.getPath())) {
                        String prefix;
                        try {
                            prefix = "try { window.WorkDeskPersistence.bootstrap(" + stateWriter.submit(() -> sharedStateStore.read()).get(15,java.util.concurrent.TimeUnit.SECONDS).toString() + "); } catch (error) { window.WorkDeskPersistence.fail(error); }\n";
                        } catch (Exception failure) {


                            prefix = "window.WorkDeskPersistence.fail(new Error('SQLITE_READ_FAILED'));\n";
                        }
                        java.io.SequenceInputStream script = new java.io.SequenceInputStream(new ByteArrayInputStream(prefix.getBytes(StandardCharsets.UTF_8)),response.getData());
                        response = new WebResourceResponse("application/javascript","UTF-8",script);
                    }
                    java.util.Map<String,String> headers = new java.util.HashMap<>();
                    if (response.getResponseHeaders() != null) headers.putAll(response.getResponseHeaders());
                    headers.put("Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src https:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
                    headers.put("X-Content-Type-Options", "nosniff");
                    response.setResponseHeaders(headers);
                    return response;
                }
                if ("file".equals(uri.getScheme()) || "content".equals(uri.getScheme())) return blockedResource();
                return null;
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (TrustedWebPolicy.asset(uri)) return false;
                if (!request.isForMainFrame()) return true;
                if ("appassets.androidplatform.net".equals(uri.getHost())) return true;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        updateInstaller = new UpdateInstaller(this, webView);
        pptxSaver = new PptxDocumentSaver(this, (id, ok, filename, location, error, uri) -> {
            org.json.JSONObject payload = new org.json.JSONObject();
            try {
                payload.put("ok", ok).put("filename", filename).put("location", location).put("error", error);
            } catch (org.json.JSONException impossible) { return; }
            webView.evaluateJavascript("window.QuarterlyPpt?.onAndroidSaveResult(" + org.json.JSONObject.quote(id) + "," + payload + ")", null);
            if (ok) {
                new android.app.AlertDialog.Builder(this).setTitle("PPT 已保存")
                    .setMessage(filename + "\n" + location + "\n可在文件管理器中找到，或使用 PowerPoint / WPS 打开。")
                    .setPositiveButton("打开文件", (dialog, which) -> {
                        Intent open = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, PptxDocumentSaver.MIME)
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try { startActivity(Intent.createChooser(open, "打开季度 PPT")); }
                        catch (RuntimeException unavailable) { Toast.makeText(this, "文件已保存。请安装 PowerPoint / WPS，或从文件管理器打开。", Toast.LENGTH_LONG).show(); }
                    }).setNegativeButton("完成", null).show();
            } else Toast.makeText(this, error, Toast.LENGTH_LONG).show();
        });
        activityDocumentSaver = new PptxDocumentSaver(this, (id, ok, filename, location, error, uri) -> {
            org.json.JSONObject payload = new org.json.JSONObject();
            try { payload.put("ok", ok).put("filename", filename).put("location", location).put("error", error); }
            catch (org.json.JSONException impossible) { return; }
            webView.evaluateJavascript("window.activityCenterApp?.onAndroidSaveResult(" + org.json.JSONObject.quote(id) + "," + payload + ")", null);
            Toast.makeText(this, ok ? "申请文件已保存：" + filename : error, Toast.LENGTH_LONG).show();
        }, 4104, ".docx", ".xlsx");
        webView.loadUrl(TrustedWebPolicy.ENTRY);
    }

    private static WebResourceResponse blockedResource() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private Object dispatchNative(AndroidBridge a, String type, org.json.JSONObject p) throws Exception {
        switch(type) {
            case "state.read": return stateWriter.submit(() -> sharedStateStore.read()).get().toString();
            case "runtime.info": return new org.json.JSONObject().put("production",!BuildConfig.DEBUG);
            case "credential.read": return a.loadSecureCredentials();
            case "credential.write": return a.saveSecureCredentials(p.getString("email"),p.getString("password"),p.getBoolean("rememberAccount"),p.getBoolean("rememberPassword"));
            case "credential.clear": a.clearSecureCredentials(); return null;
            case "credential.clearPassword": a.clearSecurePassword(); return null;
            case "orientation.enterLandscape": a.requestGraphLandscape(); return null;
            case "orientation.restorePortrait": a.restoreGraphOrientation(); return null;
            case "tts.briefing.start": morningBriefSpeaker.start(); return null;
            case "tts.briefing.stop": morningBriefSpeaker.stop(); return null;
            case "ppt.begin": return a.beginPptxTransfer(p.getString("requestId"),p.getString("filename"),p.getInt("totalChars"));
            case "ppt.chunk": return a.appendPptxChunk(p.getString("requestId"),p.getInt("index"),p.getString("chunk"));
            case "ppt.finish": return a.finishPptxTransfer(p.getString("requestId"));
            case "ppt.cancel": a.cancelPptxTransfer(p.getString("requestId")); return null;
            case "activityDocument.begin": return activityDocumentTransfer.begin(p.getString("requestId"),p.getString("filename"),p.getInt("totalChars"));
            case "activityDocument.chunk": return activityDocumentTransfer.append(p.getString("requestId"),p.getInt("index"),p.getString("chunk"));
            case "activityDocument.finish": {
                PptxTransferBuffer.Transfer transfer = activityDocumentTransfer.finish(p.getString("requestId"));
                if (transfer == null) return "申请文件数据不完整，请重新生成。";
                runOnUiThread(() -> activityDocumentSaver.start(transfer.id, transfer.filename, transfer.base64));
                return "";
            }
            case "activityDocument.cancel": activityDocumentTransfer.cancel(p.getString("requestId")); return null;
            case "file.save": a.saveTextFile(p.getString("filename"),p.getString("content"),p.getString("mimeType")); return null;
            case "update.download": a.downloadUpdate(p.getString("manifest")); return null;
            case "update.install": a.continueUpdateInstall(); return null;
            default: throw new IllegalArgumentException("Unknown type");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (updateInstaller != null) updateInstaller.onResume();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (webView == null) return;
        webView.post(() -> {
            int width = webView.getWidth();
            int height = webView.getHeight();
            String orientation = newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE ? "landscape" : "portrait";
            webView.evaluateJavascript(
                "(function(){try{window.CustomerRelationshipOrientation&&window.CustomerRelationshipOrientation.onNativeViewportChanged(" + width + "," + height + "," + org.json.JSONObject.quote(orientation) + ");}catch(error){}})()",
                null
            );
        });
    }

    @Override
    protected void onDestroy() {
        if (morningBriefSpeaker != null) morningBriefSpeaker.destroy();
        if (updateInstaller != null) updateInstaller.destroy();
        if (pptxSaver != null) pptxSaver.destroy();
        if (activityDocumentSaver != null) activityDocumentSaver.destroy();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (pptxSaver != null && pptxSaver.onActivityResult(requestCode, resultCode, data)) return;
        if (activityDocumentSaver != null && activityDocumentSaver.onActivityResult(requestCode, resultCode, data)) return;
        if (requestCode != FILE_CHOOSER_REQUEST || fileChooserCallback == null) return;
        fileChooserCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        fileChooserCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{return !!(window.WorkspaceNavigationController&&window.WorkspaceNavigationController.handleBack&&window.WorkspaceNavigationController.handleBack('android'));}catch(error){return false;}})()",
            result -> {
                if ("true".equals(result)) return;
                fallbackBackNavigation();
            }
        );
    }

    private void fallbackBackNavigation() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else MainActivity.super.onBackPressed();
    }

    public class AndroidBridge {
        public void requestGraphLandscape() {
            runOnUiThread(() -> {
                if (!graphOrientationActive) {
                    graphOrientationActive = true;
                    orientationBeforeGraph = getRequestedOrientation();
                    configurationBeforeGraph = getResources().getConfiguration().orientation;
                }
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            });
        }

        public void restoreGraphOrientation() {
            runOnUiThread(() -> {
                if (!graphOrientationActive) return;
                graphOrientationActive = false;
                int restore = orientationBeforeGraph;
                if (restore == ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED) {
                    restore = configurationBeforeGraph == Configuration.ORIENTATION_LANDSCAPE
                        ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                        : ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
                }
                setRequestedOrientation(restore);
                orientationBeforeGraph = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
                configurationBeforeGraph = Configuration.ORIENTATION_UNDEFINED;
            });
        }

        public String getGraphOrientationState() {
            try {
                return new org.json.JSONObject()
                    .put("active", graphOrientationActive)
                    .put("width", webView == null ? 0 : webView.getWidth())
                    .put("height", webView == null ? 0 : webView.getHeight())
                    .put("orientation", getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE ? "landscape" : "portrait")
                    .toString();
            } catch (org.json.JSONException impossible) {
                return "{}";
            }
        }

        public boolean isProductionBuild() {
            return (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0;
        }

        public String loadSecureCredentials() {
            return credentialStore.loadJson();
        }

        public String saveSecureCredentials(String email, String password, boolean rememberAccount, boolean rememberPassword) {
            try {
                credentialStore.save(email, password, rememberAccount, rememberPassword);
                return "";
            } catch (Exception error) {
                return "无法安全保存登录信息：" + error.getMessage();
            }
        }

        public void clearSecureCredentials() { credentialStore.clear(); }

        public void clearSecurePassword() { credentialStore.clearPassword(); }

        public String beginPptxTransfer(String requestId, String filename, int totalChars) {
            return pptxTransfer.begin(requestId, filename, totalChars);
        }

        public String appendPptxChunk(String requestId, int index, String chunk) {
            return pptxTransfer.append(requestId, index, chunk);
        }

        public String finishPptxTransfer(String requestId) {
            PptxTransferBuffer.Transfer transfer = pptxTransfer.finish(requestId);
            if (transfer == null) return "PPT 数据不完整，请重新生成。";
            runOnUiThread(() -> pptxSaver.start(transfer.id, transfer.filename, transfer.base64));
            return "";
        }

        public void cancelPptxTransfer(String requestId) { pptxTransfer.cancel(requestId); }

        public void savePptx(String requestId, String filename, String base64) {
            runOnUiThread(() -> pptxSaver.start(requestId, filename, base64));
        }

        public void downloadUpdate(String manifestJson) {
            updateInstaller.startDownload(manifestJson);
        }

        public void continueUpdateInstall() {
            runOnUiThread(() -> updateInstaller.continueInstall());
        }

        public void saveTextFile(String filename, String content, String mimeType) {
            runOnUiThread(() -> {
                try {
                    OutputStream output;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, safeFilename(filename));
                        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/工作进度台");
                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri == null) throw new IllegalStateException("无法创建下载文件");
                        output = getContentResolver().openOutputStream(uri);
                    } else {
                        File directory = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "工作进度台");
                        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法创建下载目录");
                        output = new FileOutputStream(new File(directory, safeFilename(filename)));
                    }
                    if (output == null) throw new IllegalStateException("无法写入下载文件");
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                    output.close();
                    Toast.makeText(MainActivity.this, "已保存到下载/工作进度台", Toast.LENGTH_LONG).show();
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "保存失败：" + error.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        private String safeFilename(String value) {
            return value == null ? "工作进度台.txt" : value.replaceAll("[\\\\/:*?\"<>|]", "_");
        }
    }
}
