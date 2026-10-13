package org.synthetic.schedulenotes;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;


final class PptxDocumentSaver {
    private static final String TRACE = "PptxSaveTrace";
    static final int REQUEST_CODE = 4103;
    static final String MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    static final int MAX_BYTES = 32 * 1024 * 1024;
    interface Result { void complete(String id, boolean ok, String filename, String location, String error, Uri uri); }
    private final Activity activity;
    private final Result result;
    private final Executor executor;
    private final int requestCode;
    private final java.util.Set<String> allowedExtensions;
    private String pendingId;
    private String pendingName;
    private byte[] pendingBytes;
    private volatile boolean closed;

    PptxDocumentSaver(Activity activity, Result result) { this(activity, result, Executors.newSingleThreadExecutor()); }
    PptxDocumentSaver(Activity activity, Result result, Executor executor) {
        this(activity, result, executor, REQUEST_CODE, ".pptx");
    }
    PptxDocumentSaver(Activity activity, Result result, int requestCode, String... extensions) {
        this(activity, result, Executors.newSingleThreadExecutor(), requestCode, extensions);
    }
    PptxDocumentSaver(Activity activity, Result result, Executor executor, int requestCode, String... extensions) {
        this.activity = activity; this.result = result; this.executor = executor;
        this.requestCode = requestCode;
        this.allowedExtensions = new java.util.HashSet<>(java.util.Arrays.asList(extensions));
    }

    static String mimeForFilename(String filename) {
        if (filename.endsWith(".pptx")) return MIME;
        if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        throw new IllegalArgumentException("Unsupported document type");
    }

    private static void validateOfficePackage(byte[] bytes, String filename) throws java.io.IOException {
        if (filename.endsWith(".pptx")) return; // Existing PPT contract stays unchanged.
        String required = filename.endsWith(".docx") ? "word/document.xml" : "xl/workbook.xml";
        boolean mainPart = false, contentTypes = false;
        String expectedType = filename.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
        int entries = 0; long expanded = 0;
        try (java.util.zip.ZipInputStream zip = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(bytes))) {
            java.util.zip.ZipEntry entry; byte[] chunk = new byte[65536];
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (++entries > 1024 || name.startsWith("/") || name.contains("..") || name.contains("\\") || name.contains(":") || name.toLowerCase(java.util.Locale.ROOT).contains("vbaproject")) throw new java.io.IOException("Invalid package entry");
                if (name.equals(required)) mainPart = true;
                java.io.ByteArrayOutputStream types = name.equals("[Content_Types].xml") ? new java.io.ByteArrayOutputStream() : null;
                int read;
                while ((read = zip.read(chunk)) != -1) {
                    if ((expanded += read) > 64L * 1024 * 1024) throw new java.io.IOException("Expanded package too large");
                    if (types != null) {
                        if (types.size() + read > 1024 * 1024) throw new java.io.IOException("Content types too large");
                        types.write(chunk, 0, read);
                    }
                }
                if (types != null) {
                    String xml = new String(types.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
                    if (xml.toLowerCase(java.util.Locale.ROOT).contains("macroenabled")) throw new java.io.IOException("Macro document rejected");
                    contentTypes = xml.contains(expectedType);
                }
            }
        }
        if (!mainPart || !contentTypes) throw new java.io.IOException("Wrong Office package");
    }

    void start(String id, String filename, String encoded) {
        if (closed) return;
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,80}")) return;
        if (pendingId != null) { result.complete(id, false, "", "", "已有 PPT 正在保存，请先完成或取消。", null); return; }
        pendingId = id;
        executor.execute(() -> {
            try {
                if (encoded == null || encoded.length() > ((MAX_BYTES + 2L) / 3) * 4) throw new IllegalArgumentException();
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length < 4 || bytes.length > MAX_BYTES || bytes[0] != 'P' || bytes[1] != 'K' || bytes[2] != 3 || bytes[3] != 4) throw new IllegalArgumentException();
                String clean = filename == null ? "季度汇报.pptx" : filename.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
                if (allowedExtensions.stream().noneMatch(clean::endsWith) || clean.length() > 180) throw new IllegalArgumentException();
                try { validateOfficePackage(bytes, clean); } catch (java.io.IOException invalid) { throw new IllegalArgumentException(invalid); }
                String extension = clean.substring(clean.length() - 5);
                String uniqueName = clean.substring(0, clean.length() - 5) + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8) + extension;
                activity.runOnUiThread(() -> {
                    if (closed) return;
                    pendingBytes = bytes; pendingName = uniqueName;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mimeForFilename(clean)).putExtra(Intent.EXTRA_TITLE, uniqueName)
                        .putExtra(Intent.EXTRA_LOCAL_ONLY, true)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    try { Log.i(TRACE, "CREATE_DOCUMENT_INTENT"); activity.startActivityForResult(intent, requestCode); }
                    catch (RuntimeException error) { finish(false, "", "无法打开系统文件保存器，请启用文件管理器后重试。", null); }
                });
            } catch (RuntimeException error) {
                activity.runOnUiThread(() -> finish(false, "", "文档无效或超过 32 MB，请检查后重试。", null));
            }
        });
    }

    boolean onActivityResult(int request, int code, Intent data) {
        if (request != requestCode) return false;
        if (pendingId == null) return true;
        if (code != Activity.RESULT_OK || data == null || data.getData() == null) {
            finish(false, "", "已取消保存，文件尚未写入。请再次生成并选择本地目录。", null); return true;
        }
        Uri uri = data.getData();
        Log.i(TRACE, "SAVE_TARGET_SELECTED");
        if (!"content".equals(uri.getScheme()) || pendingBytes == null) {
            finish(false, "", "保存位置无效，请重新选择本地目录。", null); return true;
        }
        byte[] bytes = pendingBytes;
        executor.execute(() -> {
            try {
                Log.i(TRACE, "FILE_WRITE_START");
                try (OutputStream out = activity.getContentResolver().openOutputStream(uri, "w")) {
                    if (out == null) throw new java.io.IOException();
                    out.write(bytes); out.flush();
                }
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long count = 0;
                try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
                    if (in == null) throw new java.io.IOException();
                    byte[] buffer = new byte[65536]; int read;
                    while ((read = in.read(buffer)) != -1) {
                        count += read;
                        if (count > bytes.length || Thread.currentThread().isInterrupted()) throw new java.io.IOException();
                        digest.update(buffer, 0, read);
                    }
                }
                if (count != bytes.length || !MessageDigest.isEqual(digest.digest(), MessageDigest.getInstance("SHA-256").digest(bytes))) throw new java.io.IOException();
                Log.i(TRACE, "FILE_WRITE_SUCCESS bytes=" + count);
                activity.runOnUiThread(() -> {
                    try (Cursor cursor = activity.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) pendingName = cursor.getString(0);
                    } catch (RuntimeException ignored) {  }
                    finish(true, "系统文件管理器中刚选择的位置（" + Uri.decode(uri.getLastPathSegment()) + "）", "", uri);
                });
            } catch (Exception error) {
                Log.e(TRACE, "ERROR stage=FILE_WRITE type=" + error.getClass().getSimpleName());
                boolean removed = false;
                try { removed = DocumentsContract.deleteDocument(activity.getContentResolver(), uri); } catch (Exception ignored) {  }
                String message = error instanceof SecurityException ? "保存权限被拒绝，请重新选择允许写入的本地目录。" : "PPT 保存或读回校验失败，请检查存储空间并重新选择本地目录。";
                if (!removed) message += "若目录中出现未完成文件，请手动删除。";
                final String failure = message;
                activity.runOnUiThread(() -> finish(false, "", failure, null));
            }
        });
        return true;
    }

    private void finish(boolean ok, String location, String error, Uri uri) {
        if (closed || pendingId == null) return;
        String id = pendingId; String name = pendingName;
        pendingId = null; pendingName = null; pendingBytes = null;
        result.complete(id, ok, name == null ? "" : name, location, error, uri);
    }

    void destroy() {
        closed = true; pendingId = null; pendingBytes = null;
        if (executor instanceof ExecutorService) ((ExecutorService) executor).shutdownNow();
    }
}
