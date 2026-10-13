package org.synthetic.schedulenotes;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
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
public class ActivityDocumentSaverTest {
    private Activity activity;
    private PptxDocumentSaver saver;
    private PptxDocumentSaverTest.Provider provider;
    private final List<Boolean> results = new ArrayList<>();
    @Before public void setup() throws Exception {
        activity = Robolectric.buildActivity(Activity.class).setup().get();
        provider = new PptxDocumentSaverTest.Provider();
        android.content.pm.ProviderInfo info = new android.content.pm.ProviderInfo();
        info.authority = "activity-document-test"; info.exported = true; info.grantUriPermissions = true;
        provider.attachInfo(RuntimeEnvironment.getApplication(), info);
        provider.root = Files.createTempDirectory("activity-document-").toFile();
        ShadowContentResolver.registerProviderInternal("activity-document-test", provider);
        saver = new PptxDocumentSaver(activity, (id, ok, name, location, error, uri) -> results.add(ok), Runnable::run, 4104, ".docx", ".xlsx");
    }
    private byte[] fixture(String filename) throws Exception {
        return Files.readAllBytes(new File(System.getProperty("activityTemplateFixtures"), filename).toPath());
    }
    @Test public void originalsSaveWithExactMimeAndByteIdenticalReadBack() throws Exception {
        for (String name : new String[]{"academic-request.docx", "department-meeting.xlsx"}) {
            byte[] bytes = fixture(name);
            saver.start("application_" + results.size(), name, Base64.encodeToString(bytes, Base64.NO_WRAP));
            Intent picker = shadowOf(activity).getNextStartedActivityForResult().intent;
            assertEquals(Intent.ACTION_CREATE_DOCUMENT, picker.getAction());
            assertEquals(PptxDocumentSaver.mimeForFilename(name), picker.getType());
            assertTrue(picker.getBooleanExtra(Intent.EXTRA_LOCAL_ONLY, false));
            Uri uri = new Uri.Builder().scheme("content").authority("activity-document-test").appendPath(picker.getStringExtra(Intent.EXTRA_TITLE)).build();
            assertTrue(saver.onActivityResult(4104, Activity.RESULT_OK, new Intent().setData(uri)));
            assertEquals(Boolean.TRUE, results.get(results.size() - 1));
            assertArrayEquals(bytes, Files.readAllBytes(provider.file(uri).toPath()));
        }
        assertEquals(2, results.size());
    }
    @Test public void wrongPackageAndExecutableSuffixAreRejectedBeforePicker() throws Exception {
        saver.start("wrong_package", "attachment.xlsx", Base64.encodeToString(fixture("academic-request.docx"), Base64.NO_WRAP));
        assertEquals(Boolean.FALSE, results.get(0));
        assertNull(shadowOf(activity).getNextStartedActivityForResult());
        saver.start("executable", "payload.apk", Base64.encodeToString(fixture("academic-request.docx"), Base64.NO_WRAP));
        assertEquals(Boolean.FALSE, results.get(1));
        assertNull(shadowOf(activity).getNextStartedActivityForResult());
    }
    @Test public void cancelledAndCorruptProviderNeverReportSuccess() throws Exception {
        byte[] bytes = fixture("academic-request.docx");
        saver.start("cancel", "申请.docx", Base64.encodeToString(bytes, Base64.NO_WRAP));
        shadowOf(activity).getNextStartedActivityForResult();
        saver.onActivityResult(4104, Activity.RESULT_CANCELED, null);
        assertEquals(Boolean.FALSE, results.get(0));
        saver.start("corrupt", "申请.docx", Base64.encodeToString(bytes, Base64.NO_WRAP));
        Intent picker = shadowOf(activity).getNextStartedActivityForResult().intent;
        provider.corrupt = true;
        Uri uri = new Uri.Builder().scheme("content").authority("activity-document-test").appendPath(picker.getStringExtra(Intent.EXTRA_TITLE)).build();
        saver.onActivityResult(4104, Activity.RESULT_OK, new Intent().setData(uri));
        assertEquals(Boolean.FALSE, results.get(1));
    }
    @Test public void unsafeZipEntryAndMacroTypeAreRejectedBeforePicker() throws Exception {
        for (String invalid : new String[]{"../outside.xml", "word/vbaProject.bin", "macroEnabled"}) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(out)) {
                zip.putNextEntry(new java.util.zip.ZipEntry("[Content_Types].xml"));
                String type = invalid.equals("macroEnabled") ? "application/vnd.ms-word.document.macroEnabled.main+xml" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
                zip.write(("<Types><Override ContentType=\"" + type + "\"/></Types>").getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
                zip.putNextEntry(new java.util.zip.ZipEntry("word/document.xml"));
                zip.write("<document/>".getBytes(java.nio.charset.StandardCharsets.UTF_8)); zip.closeEntry();
                if (!invalid.equals("macroEnabled")) {
                    zip.putNextEntry(new java.util.zip.ZipEntry(invalid)); zip.write(1); zip.closeEntry();
                }
            }
            saver.start("invalid_" + results.size(), "申请.docx", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            assertEquals(Boolean.FALSE, results.get(results.size() - 1));
            assertNull(shadowOf(activity).getNextStartedActivityForResult());
        }
    }
}
