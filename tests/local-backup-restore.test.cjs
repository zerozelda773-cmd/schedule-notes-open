'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const Customer = require('../customer-profile/customer-profile.js');
const script = fs.readFileSync(require.resolve('../shared-persistence.js'), 'utf8');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const PRIMARY = 'work-progress-desk-v1', MASTER = Customer.MASTER_STORAGE_KEY;
const state = () => ({tasks: [{id: 'T_SYN_BACKUP', customerId: 'C_SYN_BACKUP_A'}], settings: {synthetic: true}, activities: [], records: []});
const rows = () => [{customerId: 'C_SYN_BACKUP_A', customerName: 'Synthetic Same Name', hospitalId: 'H_SYN_BACKUP', hospital: 'Synthetic Site', department: 'Synthetic Unit', source: 'LOCAL_MASTER', active: true,
  perceptionObservations: [{customerId: 'C_SYN_BACKUP_A', product: 'Primary Product A', value: 'R1'}, {customerId: 'C_SYN_BACKUP_A', product: 'Primary Product B', value: 'R4'}], createdAt: '2030-04-15T00:00:00Z'},
  {customerId: 'C_SYN_BACKUP_B', customerName: 'Synthetic Same Name', hospitalId: 'H_SYN_BACKUP', hospital: 'Synthetic Site', department: 'Synthetic Unit', source: 'LOCAL_MASTER', active: false},
  {customerId: '', customerName: 'Synthetic Unresolved', source: 'LEGACY_UNSCOPED', identityStatus: 'UNRESOLVED'}];
function fixture(options = {}) {
  const map = new Map(Object.entries(options.entries || {})), writes = [], commits = [];
  let failOnce = false;
  const storage = {getItem: key => map.get(key) ?? null,
    setItem(key, value) {if (failOnce && key === MASTER) {failOnce = false; throw Error('Synthetic quota failure');} writes.push(key); map.set(key, String(value));},
    removeItem(key) {writes.push(key); map.delete(key);}};
  const window = {dispatchEvent() {}, ...(options.native ? {AndroidBridge: {saveSharedState: async raw => {
    const snapshot = JSON.parse(raw); commits.push(snapshot);
    if (options.denyCommit) throw Error('Synthetic native commit failure');
    return {committed: true, migrationComplete: true};
  }}} : {})};
  const context = vm.createContext({window, localStorage: storage, console: {error() {}}, setTimeout, clearTimeout, CustomEvent: class {}});
  vm.runInContext(script, context);
  return {persistence: window.WorkDeskPersistence, storage, map, writes, commits, context, failOnce: () => {failOnce = true;}};
}
function versioned(entries) {return {localPersistence: {schemaVersion: 1, entries}};}
function plain(value) {return JSON.parse(JSON.stringify(value));}
test('Backup collects exact supported raw envelopes without copying unrelated preferences or credentials', () => {
  const raw = JSON.stringify({schemaVersion: 1, records: rows(), originalMetadata: 'Synthetic retained'});
  const f = fixture({entries: {[MASTER]: raw, [PRIMARY]: JSON.stringify(state()), 'unregistered-credential': 'Synthetic not exported'}});
  const backup = f.persistence.collectBackup(state());
  assert.equal(backup.localPersistence.entries[MASTER], raw); assert.equal(backup.localPersistence.entries[PRIMARY], undefined);
  assert.equal(backup.localPersistence.entries['unregistered-credential'], undefined); assert.equal(f.writes.length, 0);
});
test('JSON serialization and fresh restore preserve distinct same-name IDs, inactive and unresolved rows, Hospital and scoped R', async () => {
  const source = fixture({entries: {[MASTER]: JSON.stringify({schemaVersion: 1, records: rows(), unknownMetadata: {synthetic: true}})}});
  const backup = plain(source.persistence.collectBackup(state())), target = fixture();
  await target.persistence.restoreBackupEntries(target.persistence.parseBackupEntries(backup));
  const store = Customer.createCustomerMasterStore({storage: target.storage});
  assert.deepEqual(store.serialize(), rows()); assert.equal(store.get('C_SYN_BACKUP_A').hospitalId, 'H_SYN_BACKUP');
  assert.equal(store.get('C_SYN_BACKUP_B').active, false); assert.equal(store.get(''), null);
  assert.equal(store.list().filter(row => row.customerName === 'Synthetic Same Name').length, 2);
  assert.deepEqual(store.serialize()[0].perceptionObservations, rows()[0].perceptionObservations);
  assert.deepEqual(JSON.parse(target.storage.getItem(MASTER)).unknownMetadata, {synthetic: true});
  const restarted = Customer.createCustomerMasterStore({storage: target.storage});
  assert.deepEqual(restarted.serialize(), rows()); assert.equal(restarted.get(backup.tasks[0].customerId).customerId, 'C_SYN_BACKUP_A');
});
test('New backup replaces registered side stores rather than merging and preserves primary until Task restoration', async () => {
  const f = fixture({entries: {[PRIMARY]: JSON.stringify(state()), [MASTER]: '[]', 'customer-profile-v1-3-relationships': '{"old":true}', 'unregistered-preference': 'Synthetic untouched'}});
  await f.persistence.restoreBackupEntries({[MASTER]: JSON.stringify(rows())});
  assert.equal(f.storage.getItem('customer-profile-v1-3-relationships'), null);
  assert.equal(f.storage.getItem(PRIMARY), JSON.stringify(state())); assert.equal(f.storage.getItem('unregistered-preference'), 'Synthetic untouched');
});
test('Duplicate restore keeps exact replacement rows without generating or duplicating identities', async () => {
  const f = fixture(), values = {[MASTER]: JSON.stringify(rows())};
  await f.persistence.restoreBackupEntries(values); await f.persistence.restoreBackupEntries(values);
  assert.deepEqual(Customer.createCustomerMasterStore({storage: f.storage}).serialize(), rows());
});
test('Legacy array Customer storage survives without converting or discarding its raw evidence', async () => {
  const raw = JSON.stringify(rows()), source = fixture({entries: {[MASTER]: raw}}), target = fixture();
  await target.persistence.restoreBackupEntries(source.persistence.parseBackupEntries(plain(source.persistence.collectBackup(state()))));
  assert.equal(target.storage.getItem(MASTER), raw); assert.ok(Array.isArray(JSON.parse(target.storage.getItem(MASTER))));
});
test('Every existing supported side-store key round-trips exactly through the shared backup surface', async () => {
  const source = fixture(), target = fixture();
  for (const key of source.persistence.keys) if (key !== PRIMARY) source.storage.setItem(key,
    key === MASTER ? JSON.stringify(rows()) : JSON.stringify({synthetic: true, evidence: key, version: 1}));
  const values = source.persistence.parseBackupEntries(plain(source.persistence.collectBackup(state())));
  await target.persistence.restoreBackupEntries(values);
  for (const key of source.persistence.keys) if (key !== PRIMARY) assert.equal(target.storage.getItem(key), source.storage.getItem(key));
});
test('Old-format backup is recognized without pretending absent entity bytes can be recovered', () => {
  const f = fixture({entries: {[MASTER]: JSON.stringify(rows())}});
  assert.equal(f.persistence.parseBackupEntries({exportedAt: '2030-04-15', ...state()}), null);
  assert.equal(f.writes.length, 0); assert.deepEqual(JSON.parse(f.storage.getItem(MASTER)), rows());
});
for (const invalid of [
  {localPersistence: null}, {localPersistence: {schemaVersion: 77, entries: {}}},
  versioned({unregistered: '{}'}), versioned({[PRIMARY]: JSON.stringify(state())}),
  versioned({[MASTER]: '{broken'}), versioned({[MASTER]: '{"records":{}}'}),
  versioned({[MASTER]: '{"records":[null]}'}), versioned({[MASTER]: {records: []}})
]) test('Invalid backup extension is rejected before any store mutation: ' + JSON.stringify(invalid), () => {
  const f = fixture(); assert.throws(() => f.persistence.parseBackupEntries(invalid)); assert.equal(f.writes.length, 0);
});
test('Corrupt Activity draft bytes retain the existing isolated recovery contract', async () => {
  const f = fixture(); await f.persistence.restoreBackupEntries({'activity-editor-drafts-v1': '{broken'});
  assert.equal(f.storage.getItem('activity-editor-drafts-v1'), '{broken');
});
test('Browser write failure restores original registered storage and leaves Task state untouched', async () => {
  const originals = {[MASTER]: JSON.stringify(rows()), [PRIMARY]: JSON.stringify(state()), 'customer-profile-v1-local-notes': '{"synthetic":true}'};
  const f = fixture({entries: originals}); f.failOnce();
  await assert.rejects(f.persistence.restoreBackupEntries({[MASTER]: '[]'}), /quota failure/);
  for (const [key, raw] of Object.entries(originals)) assert.equal(f.storage.getItem(key), raw);
});
test('Native entity restore is one existing atomic commit and precedes dependent primary-state commit', async () => {
  const f = fixture({native: true});
  f.persistence.bootstrap({exists: true, schemaVersion: 1, migrationComplete: true, entries: {[PRIMARY]: JSON.stringify({tasks: []})}});
  await f.persistence.initialize({tasks: []});
  await f.persistence.restoreBackupEntries({[MASTER]: JSON.stringify(rows())});
  assert.equal(f.commits.length, 2); assert.equal(JSON.parse(f.commits[1][PRIMARY]).tasks.length, 0);
  assert.equal(JSON.parse(f.commits[1][MASTER])[0].customerId, 'C_SYN_BACKUP_A');
  await f.persistence.saveState(state()); await f.persistence.flush();
  assert.equal(JSON.parse(f.commits[2][PRIMARY]).tasks[0].customerId, JSON.parse(f.commits[2][MASTER])[0].customerId);
});
test('Public import parser performs full validation before confirmation or mutation and keeps legacy import semantics', async () => {
  const f = fixture(), current = {tasks: []}, calls = [];
  Object.assign(f.context, {state: current, confirm: () => {calls.push('confirm'); return true;}, showToast: message => calls.push(message),
    syncTasksForAllActivities: () => calls.push('activity-sync'), syncHospitalMaintenanceTasks: () => calls.push('hospital-sync'),
    persist: () => f.persistence.saveState(current), render: () => calls.push('render'), location: {reload: () => calls.push('reload')}});
  vm.runInContext(app.slice(app.indexOf('async function importBackup(event)'), app.indexOf('function showToast(message)')), f.context);
  await f.context.importBackup({target: {files: [{text: async () => JSON.stringify({...state(), ...versioned({unregistered: '{}'})})}], value: 'Synthetic'}});
  assert.equal(calls.includes('confirm'), false); assert.equal(f.writes.length, 0);
  calls.length = 0;
  await f.context.importBackup({target: {files: [{text: async () => JSON.stringify(state())}], value: 'Synthetic'}});
  assert.ok(calls.includes('activity-sync')); assert.ok(calls.includes('hospital-sync')); assert.ok(calls.includes('render')); assert.ok(!calls.includes('reload'));
  assert.equal(current.tasks[0].customerId, 'C_SYN_BACKUP_A');
});
test('Public new-format import persists Customer before Task references and requests full existing-runtime hydration', async () => {
  const f = fixture(), current = {tasks: []}, seen = [];
  Object.assign(f.context, {state: current, confirm: () => true, showToast() {},
    persist: () => {seen.push(JSON.parse(f.storage.getItem(MASTER))[0].customerId); return f.persistence.saveState(current);},
    syncTasksForAllActivities: () => assert.fail('Do not reconcile against stale in-memory stores'),
    syncHospitalMaintenanceTasks: () => assert.fail('Do not reconcile against stale in-memory stores'),
    render: () => assert.fail('Do not render stale stores'), location: {reload: () => seen.push('reload')}});
  vm.runInContext(app.slice(app.indexOf('async function importBackup(event)'), app.indexOf('function showToast(message)')), f.context);
  await f.context.importBackup({target: {files: [{text: async () => JSON.stringify({...state(), ...versioned({[MASTER]: JSON.stringify(rows())})})}], value: 'Synthetic'}});
  assert.deepEqual(seen, ['C_SYN_BACKUP_A', 'reload']); assert.equal(current.tasks[0].customerId, 'C_SYN_BACKUP_A');
});
