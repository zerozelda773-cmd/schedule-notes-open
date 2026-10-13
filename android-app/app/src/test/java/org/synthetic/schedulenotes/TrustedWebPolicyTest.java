package org.synthetic.schedulenotes;

import android.net.Uri;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public class TrustedWebPolicyTest {
    @Test public void trustedAssetsOnly() {
        assertTrue(TrustedWebPolicy.asset(Uri.parse(TrustedWebPolicy.ENTRY)));
        assertTrue(TrustedWebPolicy.asset(Uri.parse(TrustedWebPolicy.ORIGIN+"/assets/www/vendor/tesseract/worker.min.js")));
        for(String url:new String[]{"file:///sdcard/test.html","file:///data/local/tmp/test.html","content://provider/test","data:text/html,test",TrustedWebPolicy.ORIGIN+"/assets/www/../secret",TrustedWebPolicy.ORIGIN+"/assets/www/%2e%2e/secret",TrustedWebPolicy.ORIGIN+"/assets/www/%252e%252e/secret","https://example.invalid/",TrustedWebPolicy.ORIGIN+":443/assets/www/index.html"}) assertFalse(url,TrustedWebPolicy.asset(Uri.parse(url)));
    }
    @Test public void frameAndOriginIsolation() {
        Uri origin=Uri.parse(TrustedWebPolicy.ORIGIN);
        assertTrue(TrustedWebPolicy.context(origin,true));
        assertFalse(TrustedWebPolicy.context(origin,false));
        for(String url:new String[]{"https://example.invalid","file://","content://provider",TrustedWebPolicy.ORIGIN+".evil.invalid",TrustedWebPolicy.ORIGIN+"/"}) assertFalse(TrustedWebPolicy.context(Uri.parse(url),true));
    }
    private String message(String type,JSONObject payload) throws Exception {return new JSONObject().put("id","test_1").put("type",type).put("payload",payload).toString();}
    @Test public void exactProtocolAndBadInputs() throws Exception {
        for(String type:new String[]{"state.read","credential.read","update.install","orientation.enterLandscape","orientation.restorePortrait","tts.briefing.start","tts.briefing.stop"}) assertEquals(type,TrustedWebPolicy.validate(message(type,new JSONObject())).getString("type"));
        for(String raw:new String[]{"{",message("arbitrary.method",new JSONObject()),message("credential.read",new JSONObject().put("extra",true)),message("tts.briefing.start",new JSONObject().put("text","hidden data")),message("tts.briefing.stop",new JSONObject().put("text","hidden data")),message("credential.write",new JSONObject().put("email",42)),message("file.save",new JSONObject().put("filename","../bad").put("content","x").put("mimeType","text/plain")),message("ppt.chunk",new JSONObject().put("requestId","ppt").put("index",-1).put("chunk","xxx"))}) {
            try {TrustedWebPolicy.validate(raw); fail("Invalid message accepted");} catch(Exception expected) { }
        }
    }
    @Test public void persistenceHasAnExactTrustedProtocol() throws Exception {
        assertEquals("state.save", TrustedWebPolicy.validate(message("state.save",new JSONObject().put("snapshot","{}"))).getString("type"));
        for (JSONObject payload : new JSONObject[]{new JSONObject(),new JSONObject().put("snapshot",42),new JSONObject().put("snapshot","{}").put("path","/data/user/0/elsewhere")}) {
            try { TrustedWebPolicy.validate(message("state.save",payload)); fail("invalid state message"); } catch (Exception expected) { }
        }
    }
    @Test public void sizeBounded() throws Exception {
        String big=new String(new char[65537]).replace('\0','A');
        try {TrustedWebPolicy.validate(message("ppt.chunk",new JSONObject().put("requestId","ppt").put("index",0).put("chunk",big)));fail();} catch(IllegalArgumentException expected) { }
    }
    @Test public void privilegedUntrustedContextsRejected() {
        for(String type:new String[]{"state.read","credential.read","update.install","orientation.enterLandscape","tts.briefing.start","tts.briefing.stop","activityDocument.begin","activityDocument.chunk","activityDocument.finish","activityDocument.cancel"}) {
            assertFalse(type,TrustedWebPolicy.context(Uri.parse("https://example.invalid"),true));
            assertFalse(type,TrustedWebPolicy.context(Uri.parse(TrustedWebPolicy.ORIGIN),false));
        }
    }
    @Test public void applicationDocumentsHaveAnExactNarrowProtocol() throws Exception {
        for (String filename : new String[]{"申请.docx", "附件.xlsx"}) {
            JSONObject p = new JSONObject().put("requestId", "activity_1").put("filename", filename).put("totalChars", 8);
            assertEquals("activityDocument.begin", TrustedWebPolicy.validate(message("activityDocument.begin", p)).getString("type"));
        }
        for (String filename : new String[]{"payload.apk", "macro.docm", "macro.xlsm", "report.pptx", "../attachment.xlsx", "x.xlsx.exe"}) {
            try { TrustedWebPolicy.validate(message("activityDocument.begin", new JSONObject().put("requestId", "activity_1").put("filename", filename).put("totalChars", 8))); fail(filename); }
            catch (Exception expected) { }
        }
        for (JSONObject p : new JSONObject[]{
            new JSONObject().put("requestId", "activity_1").put("index", -1).put("chunk", "UEsD"),
            new JSONObject().put("requestId", "activity_1").put("index", 0).put("chunk", "A".repeat(65537)),
            new JSONObject().put("requestId", "activity_1").put("index", 0).put("chunk", "UEsD").put("path", "/sdcard/secret"),
            new JSONObject().put("requestId", "../wrong").put("index", 0).put("chunk", "UEsD")
        }) {
            try { TrustedWebPolicy.validate(message("activityDocument.chunk", p)); fail("invalid application chunk"); } catch (Exception expected) { }
        }
    }
}
