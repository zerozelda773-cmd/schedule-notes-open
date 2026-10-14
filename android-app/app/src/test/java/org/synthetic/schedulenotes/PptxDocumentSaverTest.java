package org.synthetic.schedulenotes;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
import android.app.Activity;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.util.Base64;
import java.io.File;
import java.io.FileNotFoundException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipFile;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowContentResolver;


@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 35})
public class PptxDocumentSaverTest {
    private Activity activity;
    private PptxDocumentSaver saver;
    private Provider provider;
    private final List<Boolean> results = new ArrayList<>();
    private final List<String> messages = new ArrayList<>();

    public static class Provider extends ContentProvider {
        File root; boolean deny; boolean corrupt; boolean diskFull; int opens;
        public boolean onCreate() { return true; }
        File file(Uri uri) { return new File(root, uri.getLastPathSegment()); }
        public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
            opens++;
            if (deny) throw new SecurityException("Denied");
            if (diskFull && mode.contains("w")) throw new FileNotFoundException("No space");
            if (corrupt && mode.equals("r")) {
                try { Files.write(file(uri).toPath(), new byte[]{1, 2, 3}); } catch (Exception error) { throw new FileNotFoundException(); }
            }
            return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.parseMode(mode));
        }
        public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
            MatrixCursor cursor = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME});
            cursor.addRow(new Object[]{uri.getLastPathSegment()}); return cursor;
        }
        public String getType(Uri uri) { return PptxDocumentSaver.MIME; }
        public Uri insert(Uri uri, ContentValues values) { return uri; }
        public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }
        public int delete(Uri uri, String selection, String[] args) { return file(uri).delete() ? 1 : 0; }
    }

    @Before public void setup() throws Exception {
        activity = Robolectric.buildActivity(Activity.class).setup().get();
        provider = new Provider();
        android.content.pm.ProviderInfo info = new android.content.pm.ProviderInfo();
        info.authority = "ppt-save-test"; info.exported = true; info.grantUriPermissions = true;
        provider.attachInfo(RuntimeEnvironment.getApplication(), info);
        provider.root = Files.createTempDirectory("ppt-save-test-").toFile();
        assertTrue(provider.root.mkdirs() || provider.root.isDirectory());
        ShadowContentResolver.registerProviderInternal("ppt-save-test", provider);
        saver = new PptxDocumentSaver(activity, (id, ok, name, location, error, uri) -> { results.add(ok); messages.add(ok ? name + location : error); System.out.println("Native save result: " + ok + " " + error); }, Runnable::run);
    }

    private byte[] fixture(String id) throws Exception { return Files.readAllBytes(new File(System.getProperty("pptFixtures"), id + ".pptx").toPath()); }
    private String start(String id) throws Exception {
        String name = new String(Files.readAllBytes(new File(System.getProperty("pptFixtures"), id + ".txt").toPath()), StandardCharsets.UTF_8);
        saver.start("request_" + System.nanoTime(), name, Base64.encodeToString(fixture(id), Base64.NO_WRAP));
        Intent picker = shadowOf(activity).getNextStartedActivityForResult().intent;
        assertEquals(Intent.ACTION_CREATE_DOCUMENT, picker.getAction());
        assertEquals(PptxDocumentSaver.MIME, picker.getType());
        assertTrue(picker.hasCategory(Intent.CATEGORY_OPENABLE));
        assertTrue(picker.getBooleanExtra(Intent.EXTRA_LOCAL_ONLY, false));
        return picker.getStringExtra(Intent.EXTRA_TITLE);
    }
    private Uri chosen(String name) { return new Uri.Builder().scheme("content").authority("ppt-save-test").appendPath(name).build(); }

    @Test public void bothProductsSaveTwiceWithoutOverwriteAndReopen() throws Exception {
        provider.root = new File(System.getProperty("pptSaved"), "api" + android.os.Build.VERSION.SDK_INT);
        assertTrue(provider.root.mkdirs() || provider.root.isDirectory());
        for (String id : new String[]{"Primary Product A", "Primary Product B"}) {
            String previous = null;
            for (int i = 0; i < 2; i++) {
                String name = start(id);
                assertNotEquals(previous, name); previous = name;
                assertTrue(name.contains("FY2030-Q3") && name.contains("2030-06-30") && name.endsWith(".pptx"));
                int before = results.size();
                Uri uri = chosen(name);
                assertTrue(saver.onActivityResult(PptxDocumentSaver.REQUEST_CODE, Activity.RESULT_OK, new Intent().setData(uri)));
                assertEquals(before + 1, results.size());
                assertTrue(messages.toString(), results.get(before));
                byte[] saved = Files.readAllBytes(provider.file(uri).toPath());
                assertTrue(saved.length > 20000);
                assertArrayEquals(fixture(id), saved);
                try (ZipFile zip = new ZipFile(provider.file(uri))) {
                    assertNotNull(zip.getEntry("[Content_Types].xml"));
                    assertNotNull(zip.getEntry("ppt/presentation.xml"));
                    assertTrue(zip.stream().filter(entry -> entry.getName().matches("ppt/slides/slide[0-9]+.xml")).count() >= 30);
                }
            }
        }
    }

    @Test public void cancellationDoesNotReportSuccessAndAllowsRetry() throws Exception {
        start("Primary Product A"); saver.onActivityResult(PptxDocumentSaver.REQUEST_CODE, Activity.RESULT_CANCELED, null);
        assertFalse(results.get(0)); assertTrue(messages.get(0).contains("已取消"));
        assertNotNull(start("Primary Product B"));
    }
    @Test public void permissionDenialIsExplicit() throws Exception {
        String name = start("Primary Product A"); provider.deny = true;
        saver.onActivityResult(PptxDocumentSaver.REQUEST_CODE, Activity.RESULT_OK, new Intent().setData(chosen(name)));
        assertFalse(results.get(0)); assertTrue(messages.get(0).contains("权限被拒绝"));
        assertEquals(1, provider.opens);
    }
    @Test public void writeFailureIsExplicit() throws Exception {
        String name = start("Primary Product A"); provider.diskFull = true;
        saver.onActivityResult(PptxDocumentSaver.REQUEST_CODE, Activity.RESULT_OK, new Intent().setData(chosen(name)));
        assertFalse(results.get(0)); assertTrue(messages.get(0).contains("存储空间"));
        assertEquals(1, provider.opens);
    }
    @Test public void corruptReadbackMustFail() throws Exception {
        String name = start("Primary Product A"); provider.corrupt = true;
        saver.onActivityResult(PptxDocumentSaver.REQUEST_CODE, Activity.RESULT_OK, new Intent().setData(chosen(name)));
        assertFalse(results.get(0)); assertTrue(messages.get(0).contains("校验失败"));
        assertEquals(2, provider.opens);
    }
    @Test public void invalidBytesDoNotOpenPicker() {
        saver.start("invalid", "report.pptx", "aW52YWxpZA==");
        assertFalse(results.get(0)); assertNull(shadowOf(activity).getNextStartedActivityForResult());
    }
}
