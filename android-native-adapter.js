(() => {
  'use strict';
  if (location.origin !== 'https://appassets.androidplatform.net' || window !== window.top || !window.NativeMessage) return;
  const pending = new Map(); let counter = 0; let production = true;
  NativeMessage.onmessage = event => {
    let response; try { response = JSON.parse(event.data); } catch { return; }
    const request = pending.get(response.id); if (!request) return;
    pending.delete(response.id); clearTimeout(request.timer);
    if (response.ok === true) request.resolve(response.result);
    else request.reject(new Error(response.error || 'Native message rejected'));
  };
  function send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      if (pending.size >= 64) return reject(new Error('Native request queue full'));
      const id = `native_${++counter}`;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Native response timed out')); }, 15000);
      pending.set(id, { resolve, reject, timer });
      try { NativeMessage.postMessage(JSON.stringify({ id, type, payload })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  const fire = (type, payload) => { send(type,payload).catch(error => console.error('Native action failed', error.message)); };
  window.AndroidBridge = Object.freeze({
    isProductionBuild: () => production,
    readSharedState: () => send('state.read'),
    saveSharedState: snapshot => send('state.save', { snapshot }),
    loadSecureCredentials: () => send('credential.read'),
    saveSecureCredentials: (email,password,rememberAccount,rememberPassword) => send('credential.write',{email,password,rememberAccount,rememberPassword}),
    clearSecureCredentials: () => fire('credential.clear'),
    clearSecurePassword: () => fire('credential.clearPassword'),
    requestGraphLandscape: () => fire('orientation.enterLandscape'),
    restoreGraphOrientation: () => fire('orientation.restorePortrait'),
    startMorningBrief: () => send('tts.briefing.start'),
    stopMorningBrief: () => send('tts.briefing.stop'),
    beginPptxTransfer: (requestId,filename,totalChars) => send('ppt.begin',{requestId,filename,totalChars}),
    appendPptxChunk: (requestId,index,chunk) => send('ppt.chunk',{requestId,index,chunk}),
    finishPptxTransfer: requestId => send('ppt.finish',{requestId}),
    cancelPptxTransfer: requestId => fire('ppt.cancel',{requestId}),
    beginActivityDocumentTransfer: (requestId,filename,totalChars) => send('activityDocument.begin',{requestId,filename,totalChars}),
    appendActivityDocumentChunk: (requestId,index,chunk) => send('activityDocument.chunk',{requestId,index,chunk}),
    finishActivityDocumentTransfer: requestId => send('activityDocument.finish',{requestId}),
    cancelActivityDocumentTransfer: requestId => fire('activityDocument.cancel',{requestId}),
    saveTextFile: (filename,content,mimeType) => fire('file.save',{filename,content,mimeType}),
    downloadUpdate: manifest => fire('update.download',{manifest}),
    continueUpdateInstall: () => fire('update.install'),
  });
  send('runtime.info').then(info => { production = info.production !== false; }).catch(() => {});
})();
