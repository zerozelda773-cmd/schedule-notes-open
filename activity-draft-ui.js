(function(root){'use strict';
  function attach(options){
    const {form,dialog,capture,restore,showToast,referenceExists}=options,store=ActivityDraftStore.create({storage:WorkDeskPersistence.storage,referenceExists});
    let active=null,latest=null,pending=null,suppress=false;
    const line=document.createElement('div');line.className='activity-draft-status';line.setAttribute('role','status');form.insertBefore(line,form.firstChild);
    const retry=document.createElement('button');retry.type='button';retry.textContent='重试保存编辑草稿';retry.dataset.retryActivityDraft='true';retry.hidden=true;line.append(retry);
    const status=document.createElement('span');line.prepend(status);
    const discard=document.createElement('button');discard.type='button';discard.textContent='丢弃未保存编辑';discard.dataset.discardActivityDraft='true';form.querySelector('.activity-editor-actions').prepend(discard);
    const prompt=document.createElement('dialog');prompt.id='activityDraftRecoveryDialog';
    const title=document.createElement('h2'),description=document.createElement('p'),recover=document.createElement('button'),drop=document.createElement('button');recover.type=drop.type='button';recover.dataset.restoreActivityDraft='true';drop.dataset.discardRecoveryDraft='true';prompt.append(title,description,recover,drop);document.body.append(prompt);
    function notify(message,failed=false){status.textContent=message;retry.hidden=!failed;}
    function activate(seed,record){suppress=true;try{
      const mode=options.existing(seed.id)?'EDIT':'CREATE';
      const previous=store.read().records.find(r=>r.draftId===active?.draftId&&r.mode==='CREATE');
      if(!record&&mode==='CREATE'&&!dialog.open&&Object.keys(seed).length<=1&&previous)queueMicrotask(showRecovery);
      if(record)active=record;
      else if(!active||active.mode!==mode||(mode==='EDIT'&&active.sourceActivityId!==seed.id))active={draftId:store.newId(),schemaVersion:1,mode,...(mode==='EDIT'?{sourceActivityId:seed.id}:{}),snapshot:{},reliableReferences:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      const button=form.querySelector('[data-save-intent="draft"]');button.textContent=mode==='CREATE'?'创建活动':'保存活动';
      notify(mode==='CREATE'?'编辑草稿自动保存到本机；创建活动前不进入活动列表。':'未保存编辑自动保存在本机；正式活动保持最后保存版本。');
    }finally{suppress=false;}}
    function autosave(){if(suppress||!active||!dialog.open)return Promise.resolve(null);const captured=capture(active);latest={...active,...captured,schemaVersion:1,updatedAt:new Date().toISOString()};notify('正在保存本机编辑草稿…');
      pending=store.put(latest).then(record=>{if(active?.draftId===record.draftId){active=record;notify(record.mode==='CREATE'?'本机编辑草稿已保存；尚未提交为活动。':'未保存编辑已保存在本机；原活动仍为最后保存版本。');}return record;},error=>{notify('编辑草稿保存失败，请重试并暂勿关闭页面。',true);showToast('编辑草稿保存失败，请重试');throw error;});pending.catch(()=>{});return pending;
    }
    for(const event of ['input','change'])form.addEventListener(event,e=>{if(e.target.matches('input,select,textarea'))autosave();});
    form.addEventListener('click',e=>{if(e.target.closest('[data-close-activity-editor],[data-open-activity-context]'))autosave();else if(e.target.closest('[role="option"],[data-confirm-departments]'))queueMicrotask(autosave);});
    retry.addEventListener('click',()=>autosave());
    async function discardActive(){if(!active)return;const record=active;await store.discard(record.draftId);active=null;latest=null;dialog.close();if(record.mode==='EDIT'){const saved=options.existing(record.sourceActivityId);if(saved)restore(saved,null);}notify('未保存编辑已明确丢弃；正式活动未被修改。');}
    discard.addEventListener('click',()=>discardActive().catch(()=>notify('丢弃失败，编辑草稿仍保留，请重试。',true)));
    async function prepareSave(){await autosave();await store.flush();if(!active)throw Error('DRAFT_NOT_READY');const mode=active.mode;
      if(mode==='EDIT'&&!options.existing(active.sourceActivityId))throw Error('DRAFT_EDIT_SOURCE_STALE');
      const intent=await store.beginSave(active.draftId);active=store.read().records.find(r=>r.draftId===active.draftId);return {draftId:active.draftId,mode,snapshot:active.snapshot,activityId:mode==='EDIT'?active.sourceActivityId:ActivityDraftStore.formalCandidateId(intent.commitNonce)};
    }
    async function completed(activity){const draft=active;active=null;latest=null;form.querySelector('#activityId').value=activity.id;options.onCommitted?.(activity);
      try{if(draft)await store.complete(draft.draftId);}catch{notify('活动已保存；编辑草稿清理未完成，恢复时不会重复创建。',true);showToast('活动已保存，草稿清理需重试');}
      // If export fails and the editor stays open, further changes are an EDIT working copy.
      active={draftId:store.newId(),schemaVersion:1,mode:'EDIT',sourceActivityId:activity.id,snapshot:{...activity},reliableReferences:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      form.querySelector('[data-save-intent="draft"]').textContent='保存活动';
    }
    function showRecovery(){const state=store.read();if(state.status==='EMPTY'||state.records.length===0&&state.status!=='RECOVERY_UNAVAILABLE')return;const unavailable=state.status==='RECOVERY_UNAVAILABLE',record=state.records.find(r=>r.mode==='EDIT'||!r.saveIntent||!options.existing(ActivityDraftStore.formalCandidateId(r.saveIntent.commitNonce)))||state.records[0],savedIntent=record?.mode==='CREATE'&&record?.saveIntent&&options.existing(ActivityDraftStore.formalCandidateId(record.saveIntent.commitNonce));
      title.textContent=unavailable?'无法恢复活动编辑草稿':record.mode==='EDIT'?'发现未保存的活动编辑':'发现未完成的新活动草稿';
      description.textContent=unavailable?'草稿版本未知、内容损坏或不安全。不会自动创建活动；可明确丢弃这份草稿。':savedIntent?'活动已经保存，编辑草稿清理未完成。恢复会打开同一个活动。':record.identityIssues?.length?'草稿中有引用已失效或未确认。恢复后需重新选择；不会自动绑定或创建活动。':'请选择恢复或明确丢弃；恢复不会自动保存、提交活动或创建任务。';
      recover.hidden=unavailable;recover.textContent=record?.mode==='EDIT'?'恢复未保存编辑':'恢复草稿';drop.textContent=record?.mode==='EDIT'?'使用最后保存版本':'丢弃草稿';
      recover.onclick=()=>{prompt.close();if(savedIntent){restore(savedIntent,null);store.complete(record.draftId).catch(()=>notify('清理未完成，活动仍为同一个对象。',true));return;}if(record.mode==='EDIT'&&!options.existing(record.sourceActivityId)){notify('原活动不存在，无法恢复编辑；请明确丢弃。',true);showRecovery();return;}active=record;restore({...record.snapshot,id:record.mode==='EDIT'?record.sourceActivityId:''},record);notify('编辑草稿已恢复；尚未保存为正式活动。');};
      drop.onclick=async()=>{try{if(unavailable)await store.discardUnsafe();else await store.discard(record.draftId);prompt.close();active=null;latest=null;if(dialog.open)dialog.close();if(record?.mode==='EDIT'){const saved=options.existing(record.sourceActivityId);if(saved)restore(saved,null);}showRecovery();}catch{description.textContent='丢弃未成功，草稿仍保留，请重试。';}};
      prompt.oncancel=e=>{e.preventDefault();prompt.close();};if(!prompt.open)prompt.showModal();
    }
    window.addEventListener('beforeunload',event=>{if(retry.hidden===false){event.preventDefault();event.returnValue='';}});
    queueMicrotask(showRecovery);
    return Object.freeze({activate,autosave,prepareSave,completed,discardActive,showRecovery,flush:()=>store.flush(),getRecord:()=>active,getStore:()=>store});
  }
  root.ActivityDraftUI=Object.freeze({attach});
})(globalThis);
