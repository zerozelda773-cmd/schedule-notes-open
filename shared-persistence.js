(() => {
  'use strict';
  const PRIMARY = 'work-progress-desk-v1';
  const KEYS = Object.freeze(["work-progress-desk-v1", "customer-profile-v1-local-notes", "customer-profile-v1-1-master-data", "customer-profile-v1-1-match-decisions", "customer-profile-v1-1-match-queue", "customer-profile-v1-2-followups", "customer-profile-v1-2-insights", "customer-profile-v1-2-development-history", "customer-profile-v1-3-relationships", "customer-profile-v1-3-layout", "customer-profile-v1-3-professional-profiles", "customer-profile-v1-4-recommendation-actions", "customer-profile-v1-5-task-links","activity-editor-drafts-v1"]);
  const native = Boolean(window.AndroidBridge?.saveSharedState);
  let phase = native ? 'HYDRATING' : 'READY';
  let entries = Object.create(null), committed = Object.create(null), envelope = null;
  let tail = Promise.resolve(), pending = 0, initialized = false;
  function fail(error) {
    phase = 'FAILED';
    window.dispatchEvent?.(new CustomEvent('workdesk-persistence-failed'));
    return error;
  }
  function boundedCommit(snapshot) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Persistence commit timed out')), 15000);
      Promise.resolve().then(() => window.AndroidBridge.saveSharedState(snapshot))
        .then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }
  function validate(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid persistence envelope');
    for (const [key,value] of Object.entries(values)) {
      if (!KEYS.includes(key) || typeof value !== 'string') throw new Error('Invalid persistence key');
      // Draft corruption is isolated and handled by its own explicit recovery/discard UI.
      if (key !== 'activity-editor-drafts-v1') JSON.parse(value);
    }
    if (values[PRIMARY] && !Array.isArray(JSON.parse(values[PRIMARY]).tasks)) throw new Error('Invalid legacy business state');
  }
  function bootstrap(value) {
    if (!native || envelope) throw new Error('Unexpected persistence bootstrap');
    try {
      validate(value.entries); envelope = value;
      if (value.exists) {
        if (value.schemaVersion !== 1 || value.migrationComplete !== true) throw new Error('Incomplete durable state');
        entries = { ...value.entries }; committed = { ...value.entries };
      } else {
        for (const key of KEYS) { const raw = localStorage.getItem(key); if (raw !== null) entries[key] = raw; }
        validate(entries);
      }
    } catch (error) { throw fail(error); }
  }
  function queueCommit() {
    validate(entries); const snapshot = JSON.stringify(entries);
    pending++;
    const result = tail.catch(() => {}).then(() => {
      if (phase === 'FAILED') throw new Error('Persistence is not ready');
      return boundedCommit(snapshot);
    }).then(ack => {
      if (phase === 'FAILED') throw new Error('Persistence is not ready');
      if (ack?.committed !== true || ack.migrationComplete !== true) throw new Error('Missing durable commit ACK');
      committed = JSON.parse(snapshot); return ack;
    });
    tail = result;
    result.then(() => { pending--; }, error => { pending--; fail(error); console.error('Local state commit failed'); });
    return result;
  }
  const storage = {
    getItem(key) { return native && KEYS.includes(key) ? (entries[key] ?? null) : localStorage.getItem(key); },
    setItem(key,value) {
      if (!native || !KEYS.includes(key)) return localStorage.setItem(key,value);
      if (phase !== 'READY') throw new Error('Persistence is not ready');
      if (key !== 'activity-editor-drafts-v1') JSON.parse(String(value)); entries[key] = String(value); return queueCommit();
    },
    removeItem(key) {
      if (!native || !KEYS.includes(key)) return localStorage.removeItem(key);
      if (phase !== 'READY') throw new Error('Persistence is not ready');
      delete entries[key]; return queueCommit();
    }
  };
  async function initialize(state) {
    if (!native) return;
    if (phase === 'FAILED' || !envelope) throw fail(new Error('Persistence hydration failed'));
    if (initialized) return tail;
    initialized = true;
    try {
      entries[PRIMARY] = JSON.stringify(state);
      await queueCommit(); phase = 'READY';
    } catch (error) { initialized = false; throw fail(error); }
  }
  function saveState(state) {
    if (!native) { localStorage.setItem(PRIMARY,JSON.stringify(state)); return; }
    if (phase !== 'READY') throw new Error('Persistence is not ready');
    entries[PRIMARY] = JSON.stringify(state); return queueCommit();
  }
  // Local backup extends the existing primary-state format with the stores already owned here.
  // Preserve raw envelopes and evidence; restoring must never allocate or match entity IDs.
  function collectBackup(state) {
    const values = Object.create(null);
    for (const key of KEYS) {
      if (key === PRIMARY) continue;
      const raw = storage.getItem(key);
      if (raw !== null) values[key] = raw;
    }
    parseBackupEntries({localPersistence: {schemaVersion: 1, entries: values}});
    return {...state, localPersistence: {schemaVersion: 1, entries: values}};
  }
  function parseBackupEntries(backup) {
    if (!Object.prototype.hasOwnProperty.call(backup, 'localPersistence')) return null;
    const local = backup.localPersistence;
    if (!local || local.schemaVersion !== 1) throw new Error('Unsupported local backup version');
    validate(local.entries);
    if (Object.prototype.hasOwnProperty.call(local.entries, PRIMARY)) throw new Error('Duplicate primary backup state');
    const master = local.entries['customer-profile-v1-1-master-data'];
    if (master !== undefined) {
      const value = JSON.parse(master), rows = Array.isArray(value) ? value : value?.records;
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Invalid Customer master backup');
    }
    return {...local.entries};
  }
  async function restoreBackupEntries(values) {
    values = parseBackupEntries({localPersistence: {schemaVersion: 1, entries: values}});
    if (native) {
      if (phase !== 'READY') throw new Error('Persistence is not ready');
      // Existing native snapshot commit keeps this entity-store batch atomic and ACK-backed.
      entries = {...(entries[PRIMARY] !== undefined ? {[PRIMARY]: entries[PRIMARY]} : {}), ...values};
      await queueCommit(); return;
    }
    const previous = Object.create(null);
    for (const key of KEYS) if (key !== PRIMARY) previous[key] = localStorage.getItem(key);
    try {
      for (const key of KEYS) {
        if (key === PRIMARY) continue;
        if (Object.prototype.hasOwnProperty.call(values, key)) localStorage.setItem(key, values[key]);
        else localStorage.removeItem(key);
      }
    } catch (error) {
      for (const [key, raw] of Object.entries(previous)) {
        if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw);
      }
      throw error;
    }
  }
  function committedSyncState() {
    const primary = JSON.parse(committed[PRIMARY] || '{}');
    const read = key => JSON.parse(committed[key] || '{}') || {};
    const development = read('customer-profile-v1-2-development-history');
    const list = value => Array.isArray(value) ? value : [];
    const records = value => Array.isArray(value) ? value : list(value?.records);
    return { ...primary,
      customers: records(read('customer-profile-v1-1-master-data')),
      customerFollowUps: records(read('customer-profile-v1-2-followups')),
      customerDevelopmentRecords: list(development.records),
      customerDevelopmentHistory: Array.isArray(development) ? development : list(development.history),
      customerMasterEvents: list(development.masterEvents) };
  }
  window.WorkDeskPersistence = Object.freeze({ native, keys: KEYS, storage, bootstrap, initialize, saveState, fail,
    collectBackup, parseBackupEntries, restoreBackupEntries,
    flush: () => tail, committedSyncState, status: () => ({ phase, pending, migrationComplete: envelope?.migrationComplete === true || initialized && phase === 'READY' }) });
})();
