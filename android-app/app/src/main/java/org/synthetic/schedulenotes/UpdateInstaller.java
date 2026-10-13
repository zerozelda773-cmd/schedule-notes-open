package org.synthetic.schedulenotes;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.net.ssl.HttpsURLConnection;

final class UpdateInstaller {
    private static final long MAX_APK_SIZE = 500L * 1024L * 1024L;
    private static final long STORAGE_RESERVE = 10L * 1024L * 1024L;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final int MAX_REDIRECTS = 5;

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private volatile File pendingInstallFile;

    UpdateInstaller(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    void startDownload(String manifestJson) {
        if (!downloading.compareAndSet(false, true)) {
            emit("error", "已有更新正在下载，请稍候", -1);
            return;
        }
        executor.execute(() -> {
            File partial = null;
            File completed = null;
            try {
                UpdateInfo update = parseUpdateInfo(manifestJson);
                long currentVersion = installedVersionCode();
                if (update.versionCode <= currentVersion) throw new UpdateFailure("更新版本必须高于当前版本");
                File directory = UpdateFileProvider.updateDirectory(activity);
                if (directory == null) throw new UpdateFailure("无法使用更新存储目录");
                if (!directory.exists() && !directory.mkdirs()) throw new UpdateFailure("无法创建更新存储目录");
                if (directory.getUsableSpace() < update.fileSize + STORAGE_RESERVE) throw new UpdateFailure("存储空间不足，无法下载更新");

                deletePendingInstall();
                partial = new File(directory, "update-" + update.versionCode + ".part");
                completed = new File(directory, "update-" + update.versionCode + ".apk");
                deleteQuietly(partial);
                deleteQuietly(completed);

                emit("starting", "正在连接更新服务器…", 0);
                download(update, partial);
                emit("verifying", "下载完成，正在执行安全校验…", 100);
                validateDownloadedApk(update, partial);
                if (!partial.renameTo(completed)) throw new UpdateFailure("更新文件保存失败");
                pendingInstallFile = completed;
                emit("verified", "安全校验通过，准备打开系统安装界面", 100);
                activity.runOnUiThread(this::continueInstall);
                partial = null;
                completed = null;
            } catch (UpdateFailure error) {
                emit("error", error.getMessage(), -1);
            } catch (SocketTimeoutException error) {
                emit("error", "下载超时或连接中断，请检查网络后重试", -1);
            } catch (UnknownHostException error) {
                emit("error", "网络连接失败，请检查网络后重试", -1);
            } catch (IOException error) {
                String detail = String.valueOf(error.getMessage()).toLowerCase(Locale.ROOT);
                emit("error", detail.contains("space") || detail.contains("enospc") ?
                    "存储空间不足，无法保存更新" : "下载中断，请检查网络后重试", -1);
            } catch (Exception error) {
                emit("error", "更新校验失败，请重新检查更新", -1);
            } finally {
                deleteQuietly(partial);
                deleteQuietly(completed);
                downloading.set(false);
            }
        });
    }

    void continueInstall() {
        File file = pendingInstallFile;
        if (file == null || !file.isFile()) {
            emit("error", "没有可安装的已验证更新，请重新下载", -1);
            pendingInstallFile = null;
            return;
        }
        if (!canInstallPackages()) {
            emit("permission_required", "请允许工作进度台安装未知应用，返回后将继续安装", 100);
            try {
                Intent settingsIntent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                    new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())) :
                    new Intent(Settings.ACTION_SECURITY_SETTINGS);
                activity.startActivity(settingsIntent);
            } catch (ActivityNotFoundException error) {
                emit("error", "无法打开安装授权页面，请在系统设置中允许安装未知应用", -1);
            }
            return;
        }
        try {
            Uri uri = UpdateFileProvider.uriFor(activity, file);
            Intent installIntent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            pendingInstallFile = null;
            emit("installing", "已通过校验，请在 Android 系统界面确认安装", 100);
            activity.startActivity(installIntent);
        } catch (ActivityNotFoundException | SecurityException error) {
            pendingInstallFile = file;
            emit("error", "无法打开系统安装界面，请检查安装权限", -1);
        }
    }

    void onResume() {
        if (pendingInstallFile == null) return;
        if (canInstallPackages()) continueInstall();
        else emit("permission_required", "尚未获得安装权限，点击“继续安装”可再次前往授权", 100);
    }

    void destroy() {
        executor.shutdownNow();
    }

    private UpdateInfo parseUpdateInfo(String json) throws UpdateFailure {
        try {
            JSONObject payload = new JSONObject(json);
            int versionCode = payload.getInt("versionCode");
            String versionName = payload.getString("versionName").trim();
            String apkUrl = payload.getString("apkUrl").trim();
            String sha256 = payload.getString("sha256").trim().toLowerCase(Locale.ROOT);
            long fileSize = payload.getLong("fileSize");
            URL url = new URL(apkUrl);
            if (versionCode < 1 || !versionName.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?") ||
                !"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null || url.getQuery() != null || url.getRef() != null ||
                !url.getPath().toLowerCase(Locale.ROOT).endsWith(".apk") || !sha256.matches("[0-9a-f]{64}") ||
                fileSize < 1 || fileSize > MAX_APK_SIZE) {
                throw new UpdateFailure("更新下载信息格式异常");
            }
            return new UpdateInfo(versionCode, versionName, url, sha256, fileSize);
        } catch (UpdateFailure error) {
            throw error;
        } catch (Exception error) {
            throw new UpdateFailure("更新下载信息格式异常");
        }
    }

    private void download(UpdateInfo update, File destination) throws Exception {
        HttpsURLConnection connection = openConnection(update.url);
        try {
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new UpdateFailure("更新下载失败：服务器返回 HTTP " + status);
            long contentLength = connection.getContentLengthLong();
            if (contentLength > 0 && contentLength != update.fileSize) throw new UpdateFailure("更新文件大小与清单不一致");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long total = 0;
            int lastPercent = -1;
            byte[] buffer = new byte[64 * 1024];
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(destination))) {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new IOException("download interrupted");
                    total += count;
                    if (total > update.fileSize) throw new UpdateFailure("更新文件大小与清单不一致");
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0, count);
                    int percent = (int) Math.min(100, total * 100 / update.fileSize);
                    if (percent != lastPercent) {
                        emit("downloading", "正在下载更新 " + percent + "%", percent);
                        lastPercent = percent;
                    }
                }
            }
            if (total != update.fileSize) throw new UpdateFailure("下载中断：文件大小不完整");
            if (!hex(digest.digest()).equals(update.sha256)) throw new UpdateFailure("SHA-256 校验失败，已删除无效安装包");
        } finally {
            connection.disconnect();
        }
    }

    private HttpsURLConnection openConnection(URL initialUrl) throws Exception {
        URL url = initialUrl;
        for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
            HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
            connection.setRequestProperty("Accept-Encoding", "identity");
            int status = connection.getResponseCode();
            if (status < 300 || status >= 400) return connection;
            String location = connection.getHeaderField("Location");
            connection.disconnect();
            if (location == null || redirects == MAX_REDIRECTS) throw new UpdateFailure("更新下载重定向异常");
            URL redirected = new URL(url, location);
            if (!"https".equalsIgnoreCase(redirected.getProtocol()) || redirected.getUserInfo() != null) {
                throw new UpdateFailure("更新下载地址不是安全 HTTPS 地址");
            }
            url = redirected;
        }
        throw new UpdateFailure("更新下载重定向过多");
    }

    private void validateDownloadedApk(UpdateInfo update, File apk) throws Exception {
        PackageManager manager = activity.getPackageManager();
        PackageInfo archive = packageInfoForArchive(manager, apk);
        if (archive == null) throw new UpdateFailure("无法解析下载的 APK");
        if (!activity.getPackageName().equals(archive.packageName)) throw new UpdateFailure("APK 包名不符，已禁止安装");
        long archiveVersion = versionCode(archive);
        long currentVersion = installedVersionCode();
        if (archiveVersion != update.versionCode || archiveVersion <= currentVersion) {
            throw new UpdateFailure("APK 版本不符，必须高于当前版本");
        }
        if (!update.versionName.equals(archive.versionName)) throw new UpdateFailure("APK 版本名称与清单不符");
        PackageInfo current = packageInfoForInstalled(manager);
        if (!signerDigests(current).equals(signerDigests(archive))) {
            throw new UpdateFailure("APK 签名不符，已禁止安装");
        }
    }

    private PackageInfo packageInfoForArchive(PackageManager manager, File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return manager.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        }
        return manager.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
    }

    private PackageInfo packageInfoForInstalled(PackageManager manager) throws PackageManager.NameNotFoundException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return manager.getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
        }
        return manager.getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNATURES);
    }

    private long installedVersionCode() throws PackageManager.NameNotFoundException {
        return versionCode(packageInfoForInstalled(activity.getPackageManager()));
    }

    @SuppressWarnings("deprecation")
    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return activity.getPackageManager().canRequestPackageInstalls();
        }
        return Settings.Global.getInt(activity.getContentResolver(), Settings.Global.INSTALL_NON_MARKET_APPS, 0) == 1;
    }

    @SuppressWarnings("deprecation")
    private long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    @SuppressWarnings("deprecation")
    private Set<String> signerDigests(PackageInfo info) throws UpdateFailure {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) throw new UpdateFailure("无法读取 APK 签名");
            signatures = info.signingInfo.getApkContentsSigners();
        } else {
            signatures = info.signatures;
        }
        if (signatures == null || signatures.length == 0) throw new UpdateFailure("无法读取 APK 签名");
        Set<String> digests = new HashSet<>();
        try {
            for (Signature signature : signatures) {
                digests.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
            }
        } catch (NoSuchAlgorithmException error) {
            throw new UpdateFailure("设备不支持 SHA-256 校验");
        }
        return digests;
    }

    private void emit(String state, String message, int percent) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("state", state);
            payload.put("message", message);
            payload.put("percent", percent);
        } catch (Exception ignored) { return; }
        String script = "window.handleAndroidUpdateEvent&&window.handleAndroidUpdateEvent(" + payload + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private void deletePendingInstall() {
        File old = pendingInstallFile;
        pendingInstallFile = null;
        deleteQuietly(old);
    }

    private static void deleteQuietly(File file) {
        if (file != null && file.exists()) file.delete();
    }

    private static String hex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return builder.toString();
    }

    private static final class UpdateInfo {
        final int versionCode;
        final String versionName;
        final URL url;
        final String sha256;
        final long fileSize;

        UpdateInfo(int versionCode, String versionName, URL url, String sha256, long fileSize) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.url = url;
            this.sha256 = sha256;
            this.fileSize = fileSize;
        }
    }

    private static final class UpdateFailure extends Exception {
        UpdateFailure(String message) { super(message); }
    }
}
