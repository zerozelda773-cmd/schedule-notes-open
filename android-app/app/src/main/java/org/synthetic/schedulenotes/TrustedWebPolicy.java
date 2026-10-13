package org.synthetic.schedulenotes;

import android.net.Uri;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

final class TrustedWebPolicy {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String ENTRY = ORIGIN + "/assets/www/index.html";
    static boolean origin(Uri uri) { return uri != null && ORIGIN.equals(uri.toString()); }
    static boolean asset(Uri uri) {
        if (uri == null || !"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost())
            || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getQuery() != null) return false;
        String encoded = uri.getEncodedPath();
        if (encoded == null || encoded.contains("%") || encoded.contains("\\") || !encoded.startsWith("/assets/www/")) return false;
        for (String part : encoded.split("/")) if (part.equals(".") || part.equals("..")) return false;
        return true;
    }
    static boolean context(Uri origin, boolean mainFrame) { return mainFrame && origin(origin); }
    static void keys(JSONObject p, String... expected) {
        Set<String> actual = new HashSet<>(); p.keys().forEachRemaining(actual::add);
        if (!actual.equals(new HashSet<>(Arrays.asList(expected)))) throw new IllegalArgumentException("Invalid payload fields");
    }
    static String string(JSONObject p, String key, int max) throws Exception {
        Object v = p.get(key);
        if (!(v instanceof String) || ((String)v).length() > max) throw new IllegalArgumentException("Invalid " + key);
        return (String)v;
    }
    static boolean bool(JSONObject p, String key) throws Exception {
        Object v = p.get(key); if (!(v instanceof Boolean)) throw new IllegalArgumentException("Invalid " + key); return (Boolean)v;
    }
    static int integer(JSONObject p, String key, int max) throws Exception {
        Object v = p.get(key); if (!(v instanceof Integer) || (Integer)v < 0 || (Integer)v > max) throw new IllegalArgumentException("Invalid " + key); return (Integer)v;
    }
    static JSONObject validate(String raw) throws Exception {
        if (raw == null || raw.length() > 8 * 1024 * 1024) throw new IllegalArgumentException("Message too large");
        JSONObject m = new JSONObject(raw); keys(m, "id", "type", "payload");
        String id = string(m, "id", 64); if (!id.matches("[A-Za-z0-9_-]{1,64}")) throw new IllegalArgumentException("Invalid id");
        String type = string(m, "type", 64); JSONObject p = m.getJSONObject("payload");
        switch (type) {
            case "runtime.info": case "credential.read": case "credential.clear": case "credential.clearPassword":
            case "orientation.enterLandscape": case "orientation.restorePortrait": case "update.install":
            case "tts.briefing.start": case "tts.briefing.stop": keys(p); break;
            case "state.read": keys(p); break;
            case "state.save": keys(p,"snapshot"); string(p,"snapshot",7*1024*1024); break;
            case "credential.write":
                keys(p,"email","password","rememberAccount","rememberPassword");
                string(p,"email",320); string(p,"password",4096); bool(p,"rememberAccount"); bool(p,"rememberPassword"); break;
            case "ppt.begin":
                keys(p,"requestId","filename","totalChars"); string(p,"requestId",128); filename(p); integer(p,"totalChars",48*1024*1024); break;
            case "ppt.chunk":
                keys(p,"requestId","index","chunk"); string(p,"requestId",128); integer(p,"index",1024); String chunk=string(p,"chunk",65536);
                if (!chunk.matches("[A-Za-z0-9+/=]*")) throw new IllegalArgumentException("Invalid base64"); break;
            case "ppt.finish": case "ppt.cancel": keys(p,"requestId"); string(p,"requestId",128); break;
            case "activityDocument.begin":
                keys(p,"requestId","filename","totalChars");
                if (!string(p,"requestId",80).matches("[A-Za-z0-9_-]{1,80}")) throw new IllegalArgumentException("Invalid request ID");
                filename(p); String documentName = string(p,"filename",180);
                if (!documentName.endsWith(".docx") && !documentName.endsWith(".xlsx")) throw new IllegalArgumentException("Unsupported application document");
                int documentChars = integer(p,"totalChars",PptxTransferBuffer.MAX_ENCODED_CHARS);
                if (documentChars < 4) throw new IllegalArgumentException("Empty application document"); break;
            case "activityDocument.chunk":
                keys(p,"requestId","index","chunk");
                if (!string(p,"requestId",80).matches("[A-Za-z0-9_-]{1,80}")) throw new IllegalArgumentException("Invalid request ID");
                integer(p,"index",1024); String documentChunk = string(p,"chunk",65536);
                if (!documentChunk.matches("[A-Za-z0-9+/=]+")) throw new IllegalArgumentException("Invalid base64"); break;
            case "activityDocument.finish": case "activityDocument.cancel":
                keys(p,"requestId");
                if (!string(p,"requestId",80).matches("[A-Za-z0-9_-]{1,80}")) throw new IllegalArgumentException("Invalid request ID"); break;
            case "file.save":
                keys(p,"filename","content","mimeType"); filename(p); string(p,"content",7*1024*1024);
                if (!Arrays.asList("text/plain","text/csv","application/json","text/plain;charset=utf-8","text/csv;charset=utf-8","application/json;charset=utf-8").contains(string(p,"mimeType",80))) throw new IllegalArgumentException("Unsupported MIME"); break;
            case "update.download":
                keys(p,"manifest"); String manifest=string(p,"manifest",8192); JSONObject u=new JSONObject(manifest);
                keys(u,"versionCode","versionName","apkUrl","sha256","fileSize");
                integer(u,"versionCode",Integer.MAX_VALUE); string(u,"versionName",50); String url=string(u,"apkUrl",2048);
                if (!url.startsWith("https://") || !string(u,"sha256",64).matches("[A-Fa-f0-9]{64}")) throw new IllegalArgumentException("Invalid update");
                Object size=u.get("fileSize"); if (!(size instanceof Number) || ((Number)size).doubleValue() != ((Number)size).longValue() || ((Number)size).longValue()<=0 || ((Number)size).longValue()>1024L*1024*1024) throw new IllegalArgumentException("Invalid size"); break;
            default: throw new IllegalArgumentException("Unknown message type");
        }
        return m;
    }
    private static void filename(JSONObject p) throws Exception {
        String name=string(p,"filename",200);
        if (name.isEmpty() || name.equals(".") || name.equals("..") || name.matches(".*[\\\\/:*?\"<>|\\p{Cntrl}].*")) throw new IllegalArgumentException("Invalid filename");
    }
}
