(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ActivityDraftStore=api;})(globalThis,function(){
  'use strict';
  const KEY='activity-editor-drafts-v1',VERSION=1,MAX_BYTES=1024*1024;
  const copy=x=>JSON.parse(JSON.stringify(x)),plain=x=>x&&typeof x==='object'&&!Array.isArray(x),text=x=>String(x??'').trim();
  const uncertain=x=>['UNRESOLVED','PROBABLE','AMBIGUOUS','UNMATCHED','PENDING','FUZZY'].includes(text(x).toUpperCase());
  const ID_FIELDS=['customerId','hospitalId','departmentId','directorCustomerId','speakerCustomerId','employeeId'];
  const newId=()=> 'draft_ui_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  function normalize(record,options={}){
    if(!plain(record)||record.schemaVersion!==VERSION||!/^draft_ui_[A-Za-z0-9_-]+$/.test(text(record.draftId))||!['CREATE','EDIT'].includes(record.mode)||!plain(record.snapshot))throw Error('DRAFT_RECOVERY_UNAVAILABLE');
    if(record.mode==='CREATE'&&(record.sourceActivityId||record.snapshot.id||record.snapshot.activityId))throw Error('DRAFT_FORMAL_ID_FORBIDDEN');
    if(record.mode==='EDIT'&&!text(record.sourceActivityId))throw Error('DRAFT_EDIT_SOURCE_REQUIRED');
    if(!text(record.createdAt)||!text(record.updatedAt))throw Error('DRAFT_TIMESTAMPS_REQUIRED');
    const snapshot=copy(record.snapshot),references={},issues=[];
    for(const key of ID_FIELDS){const candidate=text(snapshot[key]),ref=record.reliableReferences?.[key];
      if(key==='customerId'&&uncertain(snapshot.customerMatchStatus)){snapshot[key]='';if(candidate)issues.push({field:key,state:snapshot.customerMatchStatus});continue;}
      const reliable=candidate&&ref?.id===candidate&&ref.status==='STABLE_ID'&&['SAVED_ACTIVITY','USER_SELECTED_STABLE_ID','STABLE_PLAN_REFERENCE'].includes(ref.evidence);
      const exists=!options.referenceExists||options.referenceExists(key,candidate,snapshot);
      if(reliable&&exists)references[key]={id:candidate,status:'STABLE_ID',evidence:ref.evidence};else {snapshot[key]='';if(candidate)issues.push({field:key,state:reliable?'STALE_REFERENCE':'UNCONFIRMED'});}
    }
    if(!snapshot.hospitalId){snapshot.departmentId='';snapshot.departmentIds=[];snapshot.directorCustomerId='';snapshot.speakerCustomerId='';for(const k of ['departmentId','directorCustomerId','speakerCustomerId'])delete references[k];}
    else if (Array.isArray(snapshot.departmentIds) && snapshot.departmentIds.length) {
      const ids=[...new Set(snapshot.departmentIds.map(text).filter(Boolean))],ref=record.reliableReferences?.departmentIds;
      const valid=ref?.status==='STABLE_ID'&&Array.isArray(ref.ids)&&ids.every(id=>ref.ids.includes(id)&&(!options.referenceExists||options.referenceExists('departmentId',id,snapshot)));
      if(valid){snapshot.departmentIds=ids;references.departmentIds={ids,status:'STABLE_ID',evidence:ref.evidence};}
      else snapshot.departmentIds=snapshot.departmentId?[snapshot.departmentId]:[];
    }
    // No matching, ID allocation, product inference or formal-store writes occur here.
    const result={draftId:record.draftId,schemaVersion:VERSION,mode:record.mode,...(record.mode==='EDIT'?{sourceActivityId:text(record.sourceActivityId)}:{}),snapshot,reliableReferences:references,createdAt:record.createdAt,updatedAt:record.updatedAt,identityIssues:issues};
    if(record.saveIntent){if(!plain(record.saveIntent)||!/^save_txn_[A-Za-z0-9_-]+$/.test(text(record.saveIntent.commitNonce))||record.saveIntent.activityId||!text(record.saveIntent.startedAt))throw Error('DRAFT_UNSAFE_SAVE_INTENT');result.saveIntent={commitNonce:text(record.saveIntent.commitNonce),startedAt:text(record.saveIntent.startedAt)};}
    return result;
  }
  function decode(raw,options={}){
    if(raw===null||raw===undefined)return {status:'EMPTY',records:[]};
    try {if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_BYTES)throw Error('DRAFT_SIZE_LIMIT');let parsed=JSON.parse(raw),migrated=false;
      if(parsed?.schemaVersion===0&&Array.isArray(parsed.records)) {if(parsed.records.some(r=>r.saveIntent))throw Error('DRAFT_LEGACY_INTENT_UNSAFE');parsed={schemaVersion:VERSION,records:parsed.records.map(r=>({...r,schemaVersion:VERSION,snapshot:r.editingSnapshot||r.snapshot}))};migrated=true;}
      if(!plain(parsed)||parsed.schemaVersion!==VERSION||!Array.isArray(parsed.records)||parsed.records.length>20)throw Error('DRAFT_VERSION_OR_SHAPE_UNSUPPORTED');
      const records=parsed.records.map(r=>normalize(r,options));if(new Set(records.map(r=>r.draftId)).size!==records.length)throw Error('DRAFT_DUPLICATE_ID');return {status:migrated?'MIGRATED':'READY',records};
    }catch{return {status:'RECOVERY_UNAVAILABLE',records:[],reason:'Unknown, corrupt or unsafe draft. Only explicit discard may remove the stored value.'};}
  }
  function create(options={}){
    const storage=options.storage||globalThis.WorkDeskPersistence?.storage||globalThis.localStorage,now=options.now||(()=>new Date().toISOString());if(!storage)throw Error('DRAFT_STORAGE_UNAVAILABLE');
    let tail=Promise.resolve(),lastError=null;
    const read=()=>decode(storage.getItem(KEY),options);
    function write(transform){const operation=tail.catch(()=>{}).then(async()=>{const before=read();if(before.status==='RECOVERY_UNAVAILABLE')throw Error('DRAFT_RECOVERY_UNAVAILABLE');const records=transform(before.records.map(copy));if(records.length>20)throw Error('DRAFT_COUNT_LIMIT');const payload=JSON.stringify({schemaVersion:VERSION,records});if(new TextEncoder().encode(payload).byteLength>MAX_BYTES)throw Error('DRAFT_SIZE_LIMIT');await storage.setItem(KEY,payload);lastError=null;return records.map(copy);});tail=operation;operation.catch(error=>{lastError=error.message;});return operation;}
    async function put(record){const value=normalize({...record,schemaVersion:VERSION,updatedAt:now()},options);const all=await write(records=>{const index=records.findIndex(r=>r.draftId===value.draftId);if(index<0)records.push(value);else {if(records[index].saveIntent)value.saveIntent=copy(records[index].saveIntent);records[index]=value;}return records;});return all.find(r=>r.draftId===value.draftId);}
    async function beginSave(draftId){let intent;await write(records=>{const record=records.find(r=>r.draftId===draftId);if(!record)throw Error('DRAFT_NOT_FOUND');if(!record.saveIntent)record.saveIntent={commitNonce:'save_txn_'+newId().slice('draft_ui_'.length),startedAt:now()};intent=copy(record.saveIntent);return records;});return intent;}
    async function discard(draftId){await write(records=>records.filter(r=>r.draftId!==draftId));}
    async function discardUnsafe(){await tail.catch(()=>{});await storage.removeItem(KEY);lastError=null;}
    return Object.freeze({newId,read,put,beginSave,discard,complete:discard,discardUnsafe,flush:()=>tail,status:()=>({lastError}),createRecord:(mode,snapshot,extra={})=>normalize({draftId:extra.draftId||newId(),schemaVersion:VERSION,mode,snapshot,...extra,createdAt:extra.createdAt||now(),updatedAt:now()},options)});
  }
  const formalCandidateId=nonce=>{if(!/^save_txn_[A-Za-z0-9_-]+$/.test(text(nonce)))throw Error('INVALID_SAVE_NONCE');return 'activity_'+nonce.slice('save_txn_'.length);};
  return Object.freeze({KEY,VERSION,newId,normalize,decode,create,formalCandidateId});
});
