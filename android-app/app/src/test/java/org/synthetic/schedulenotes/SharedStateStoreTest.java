package org.synthetic.schedulenotes;
import android.content.Context;
import android.database.Cursor;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk={28,35},manifest=Config.NONE)
public class SharedStateStoreTest {
 private Context context; private SharedStateStore store;
 @Before public void open(){context=RuntimeEnvironment.getApplication();context.deleteDatabase("work-progress-state.db");store=new SharedStateStore(context);}
 @After public void close(){store.close();}
 private String payload(String marker)throws Exception{return new JSONObject().put("work-progress-desk-v1",new JSONObject().put("tasks",new org.json.JSONArray().put(new JSONObject().put("id","same-task").put("status","completed"))).put("marker",marker).toString()).put("customer-profile-v1-1-master-data","{\"schemaVersion\":2,\"records\":[{\"customerId\":\"same-person\"}]}").toString();}
 @Test public void commitReadbackAndReopenRetainExactJsonAndHash()throws Exception{
  assertFalse(store.read().getBoolean("exists"));String raw=payload("same-id");JSONObject ack=store.save(raw);assertTrue(ack.getBoolean("committed"));assertTrue(ack.getBoolean("migrationComplete"));
  assertEquals(SharedStateStore.hash(raw),ack.getString("payloadHash"));store.close();store=new SharedStateStore(context);
  JSONObject restored=store.read();assertTrue(restored.getBoolean("migrationComplete"));assertEquals(new JSONObject(raw).toString(),restored.getJSONObject("entries").toString());
  try(Cursor q=store.getReadableDatabase().rawQuery("PRAGMA synchronous",null)){assertTrue(q.moveToFirst());assertEquals(2,q.getInt(0));}
 }
 @Test public void invalidInputAndTransactionFailurePreservePriorState()throws Exception{
  String first=payload("before");store.save(first);
  try{store.save("{\"unexpected-secret-key\":\"{}\"}");fail();}catch(Exception expected){}
  store.getWritableDatabase().execSQL("CREATE TRIGGER reject_write BEFORE INSERT ON app_state BEGIN SELECT RAISE(ABORT,'test failure'); END");
  try{store.save(payload("after"));fail();}catch(Exception expected){}
  assertEquals(SharedStateStore.hash(first),store.read().getString("payloadHash"));
 }
 @Test public void corruptionNeverFallsBackToEmpty()throws Exception{
  store.save(payload("before"));store.getWritableDatabase().execSQL("UPDATE app_state SET payload_hash='bad'");
  try{store.read();fail("Corrupt durable state accepted");}catch(IllegalStateException expected){}
 }
 @Test public void realisticLargeLegacyEnvelopeRetainsTasksActivitiesAndCustomers()throws Exception{
  JSONObject state=new JSONObject(new JSONObject(payload("legacy")).getString("work-progress-desk-v1"));
  org.json.JSONArray records=new org.json.JSONArray();
  for(int i=0;i<24000;i++) records.put(new JSONObject().put("id","legacy-record-"+i).put("hospital","迁移兼容医院").put("product","Primary Product A").put("salesAmount",200).put("notes","source import with \"quoted\" values and stable historical references"));
  state.put("records",records).put("activities",new org.json.JSONArray().put(new JSONObject().put("id","legacy-activity").put("approvalStatus","草稿")));
  JSONObject entries=new JSONObject(payload("legacy")).put("work-progress-desk-v1",state.toString());
  String raw=entries.toString();assertTrue(raw.length()>2*1024*1024);
  store.save(raw);store.close();store=new SharedStateStore(context);
  assertEquals(raw,new JSONObject(store.read().getJSONObject("entries").toString()).toString());
 }
 @Test public void incompleteMigrationNeverFallsBackOrOverwrites()throws Exception{
  String raw=payload("before");store.save(raw);store.getWritableDatabase().execSQL("UPDATE app_state SET migration_complete=0");
  try{store.read();fail("Incomplete migration accepted");}catch(IllegalStateException expected){}
  try(Cursor row=store.getReadableDatabase().rawQuery("SELECT payload_hash,migration_complete FROM app_state",null)){
   assertTrue(row.moveToFirst());assertEquals(SharedStateStore.hash(raw),row.getString(0));assertEquals(0,row.getInt(1));
  }
 }
 @Test public void separateDraftNamespaceSurvivesReopenWithoutFormalActivity()throws Exception{
  JSONObject entries=new JSONObject(payload("draft-boundary"));
  JSONObject primary=new JSONObject(entries.getString("work-progress-desk-v1"));primary.put("activities",new org.json.JSONArray());entries.put("work-progress-desk-v1",primary.toString());
  String draft="{\"schemaVersion\":1,\"records\":[{\"draftId\":\"draft_ui_synthetic\",\"schemaVersion\":1,\"mode\":\"CREATE\",\"snapshot\":{\"id\":\"\",\"topic\":\"Synthetic Native Draft\"},\"createdAt\":\"2030-04-15\",\"updatedAt\":\"2030-04-15\"}]}";
  entries.put("activity-editor-drafts-v1",draft);store.save(entries.toString());store.close();store=new SharedStateStore(context);
  JSONObject restored=store.read().getJSONObject("entries");assertEquals(draft,restored.getString("activity-editor-drafts-v1"));assertEquals(0,new JSONObject(restored.getString("work-progress-desk-v1")).getJSONArray("activities").length());
 }
 @Test public void corruptDraftDoesNotDestroyFormalStateAndExplicitDiscardIsAtomic()throws Exception{
  JSONObject entries=new JSONObject(payload("formal-retained"));String primary=entries.getString("work-progress-desk-v1");entries.put("activity-editor-drafts-v1","{broken");store.save(entries.toString());
  assertEquals(primary,store.read().getJSONObject("entries").getString("work-progress-desk-v1"));assertEquals("{broken",store.read().getJSONObject("entries").getString("activity-editor-drafts-v1"));
  entries.remove("activity-editor-drafts-v1");store.save(entries.toString());assertFalse(store.read().getJSONObject("entries").has("activity-editor-drafts-v1"));assertEquals(primary,store.read().getJSONObject("entries").getString("work-progress-desk-v1"));
 }
}
