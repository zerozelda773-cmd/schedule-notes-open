package org.synthetic.schedulenotes;
import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;


final class SharedStateStore extends SQLiteOpenHelper {
    static final Set<String> KEYS = new HashSet<>(Arrays.asList("work-progress-desk-v1","customer-profile-v1-local-notes","customer-profile-v1-1-master-data","customer-profile-v1-1-match-decisions","customer-profile-v1-1-match-queue","customer-profile-v1-2-followups","customer-profile-v1-2-insights","customer-profile-v1-2-development-history","customer-profile-v1-3-relationships","customer-profile-v1-3-layout","customer-profile-v1-3-professional-profiles","customer-profile-v1-4-recommendation-actions","customer-profile-v1-5-task-links","activity-editor-drafts-v1"));
    private static SharedStateStore instance;
    static synchronized SharedStateStore get(Context context) { if (instance == null) instance = new SharedStateStore(context.getApplicationContext()); return instance; }
    SharedStateStore(Context context) { super(context, "work-progress-state.db", null, 1); }
    @Override public void onConfigure(SQLiteDatabase db) { db.execSQL("PRAGMA synchronous=FULL"); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE app_state (state_key TEXT PRIMARY KEY, schema_version INTEGER NOT NULL, payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL, updated_at TEXT NOT NULL, migration_complete INTEGER NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int before,int after) { throw new IllegalStateException("Unsupported persistence schema upgrade"); }
    static String hash(String payload) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder(); for (byte b : digest) result.append(String.format(java.util.Locale.ROOT,"%02x",b & 255)); return result.toString();
    }
    static void validate(String payload) throws Exception {
        JSONObject entries = new JSONObject(payload);
        java.util.Iterator<String> keys = entries.keys();
        while (keys.hasNext()) {
            String key = keys.next(); Object value = entries.get(key);
            if (!KEYS.contains(key) || !(value instanceof String)) throw new IllegalArgumentException("Invalid persistence namespace");
            // Opaque draft text is quarantined by its versioned recovery UI, without blocking formal state.
            if (!key.equals("activity-editor-drafts-v1")) new JSONTokener((String)value).nextValue();
        }
        new JSONObject(entries.getString("work-progress-desk-v1")).getJSONArray("tasks");
    }


    private String readPayload(SQLiteDatabase db) {
        StringBuilder payload = new StringBuilder();
        final int chunk = 65536;
        for (int offset = 1; ; offset += chunk) {
            try (Cursor row = db.rawQuery("SELECT substr(payload_json,?,?) FROM app_state WHERE state_key=?",
                    new String[]{Integer.toString(offset),Integer.toString(chunk),"business-json"})) {
                if (!row.moveToFirst()) throw new IllegalStateException("Durable envelope missing");
                String part = row.getString(0);
                if (part == null) throw new IllegalStateException("Durable payload missing");
                if (part.isEmpty()) return payload.toString();
                payload.append(part);
            }
        }
    }
    synchronized JSONObject read() throws Exception {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor row = db.query("app_state",new String[]{"schema_version","payload_hash","updated_at","migration_complete"},"state_key=?",new String[]{"business-json"},null,null,null)) {
            if (!row.moveToFirst()) return new JSONObject().put("exists",false).put("schemaVersion",1).put("entries",new JSONObject()).put("migrationComplete",false);
            String payload = readPayload(db);
            String expected = row.getString(row.getColumnIndexOrThrow("payload_hash"));
            if (row.getInt(row.getColumnIndexOrThrow("schema_version")) != 1 || !hash(payload).equals(expected)
                    || row.getInt(row.getColumnIndexOrThrow("migration_complete")) != 1) throw new IllegalStateException("Durable envelope integrity failure");
            validate(payload);
            return new JSONObject().put("exists",true).put("schemaVersion",1).put("entries",new JSONObject(payload)).put("payloadHash",expected)
                .put("updatedAt",row.getString(row.getColumnIndexOrThrow("updated_at"))).put("migrationComplete",true);
        }
    }
    synchronized JSONObject save(String payload) throws Exception {
        validate(payload); String digest = hash(payload);
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            ContentValues values = new ContentValues(); values.put("state_key","business-json");values.put("schema_version",1);
            values.put("payload_json",payload);values.put("payload_hash",digest);values.put("updated_at",new java.text.SimpleDateFormat("yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX",java.util.Locale.ROOT).format(new java.util.Date()));values.put("migration_complete",0);
            if (db.insertWithOnConflict("app_state",null,values,SQLiteDatabase.CONFLICT_REPLACE) < 0) throw new IllegalStateException("State write failed");
            try (Cursor row = db.rawQuery("SELECT payload_hash FROM app_state WHERE state_key=?",new String[]{"business-json"})) {
                String restoredPayload = readPayload(db);
                if (!row.moveToFirst() || !payload.equals(restoredPayload) || !hash(restoredPayload).equals(row.getString(0))) throw new IllegalStateException("State read-back failed");
            }
            ContentValues marker = new ContentValues();marker.put("migration_complete",1);
            if (db.update("app_state",marker,"state_key=?",new String[]{"business-json"}) != 1) throw new IllegalStateException("Migration marker failed");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        JSONObject restored = read();
        if (!digest.equals(restored.getString("payloadHash"))) throw new IllegalStateException("Commit verification failed");
        return new JSONObject().put("committed",true).put("migrationComplete",true).put("payloadHash",digest);
    }
}
