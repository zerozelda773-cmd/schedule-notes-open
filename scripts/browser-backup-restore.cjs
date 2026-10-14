'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const allowed = new Set(JSON.parse(fs.readFileSync(path.join(root, 'build-files.json'))));
const launch = {headless: true, ...(process.env.CHROME_BIN ? {executablePath: process.env.CHROME_BIN} : {}), args: ['--no-sandbox']};
const results = [];
const PRIMARY = 'work-progress-desk-v1', MASTER = 'customer-profile-v1-1-master-data';
async function ready(page) { await page.waitForFunction(() => document.body.dataset.runtimeReady === 'true'); }
async function prepare(context, origin) {
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('dialog', dialog => dialog.accept());
  await page.goto(origin, {waitUntil: 'networkidle'}); await ready(page); return page;
}
async function seed(page, multiple = false) {
  return page.evaluate(multiple => {
    const storage = WorkDeskPersistence.storage;
    const store = CustomerProfileV1.createCustomerMasterStore({storage, now: () => '2030-04-15T12:00:00Z'});
    store.replace([]);
    const masters = [];
    for (const [index, active] of (multiple ? [[0, true], [1, true], [2, false]] : [[0, true]])) {
      masters.push(store.create({customerId: 'C_SYN_G3B_' + index, customerName: 'Synthetic Backup Same Name',
        hospitalId: 'H_SYN_004', hospital: 'Synthetic Hospital 4', departmentId: 'D_SYN_3_0',
        department: 'Synthetic Department Shared', source: 'LOCAL_MASTER', active,
        associatedProducts: ['Primary Product A', 'Primary Product B'], notes: 'Synthetic backup contract'}));
    }
    const raw = JSON.parse(storage.getItem(CustomerProfileV1.MASTER_STORAGE_KEY));
    raw.syntheticMetadata = {version: 1, purpose: 'Synthetic backup regression'};
    raw.records[0].perceptionObservations = [
      {customerId: masters[0].customerId, product: 'Primary Product A', value: 'R1', source: 'SYNTHETIC'},
      {customerId: masters[0].customerId, product: 'Primary Product B', value: 'R4', source: 'SYNTHETIC'}];
    if (multiple) raw.records.push({customerId: '', customerName: 'Synthetic Unresolved Same Name',
      hospital: 'Synthetic Hospital 4', department: 'Synthetic Department Shared', source: 'LEGACY_UNSCOPED',
      identityStatus: 'UNRESOLVED', rawEvidence: 'Synthetic retained evidence'});
    storage.setItem(CustomerProfileV1.MASTER_STORAGE_KEY, JSON.stringify(raw));
    state.tasks = masters.filter(row => row.active).map((row, index) => ({id: 'T_SYN_G3B_' + index,
      title: 'Synthetic Backup Bound Task', sourceType: 'customer', taskType: 'customer_visit',
      sourceId: row.customerId, customerId: row.customerId, customer: row.customerName,
      hospitalId: row.hospitalId, hospital: row.hospital, departmentId: row.departmentId,
      department: row.department, product: 'Primary Product A', status: 'pending', progress: 0,
      priority: 'normal', createdAt: '2030-04-15T12:00:00Z'}));
    if (multiple) state.tasks.push({...state.tasks[0], id: 'T_SYN_G3B_SHARED'});
    state.records = []; state.activities = []; state.activityLedgerEntries = []; state.employeePlanRecords = [];
    state.settings.hospitalDirectoryOverrides = {hospitals: {H_SYN_004: {hospitalId: 'H_SYN_004', hospitalCode: 'SYN_BACKUP_CODE'}}};
    storage.setItem('customer-profile-v1-3-relationships', JSON.stringify({schemaVersion: 1, records: [
      {id: 'REL_SYN_G3B', fromCustomerId: masters[0].customerId, toCustomerId: multiple ? masters[1].customerId : masters[0].customerId,
        hospitalId: 'H_SYN_004', synthetic: true}]}));
    persist(); return {masters: raw, tasks: JSON.parse(JSON.stringify(state.tasks))};
  }, multiple);
}
async function backup(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => exportBackup());
  const download = await downloadPromise;
  return JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
}
async function restore(page, payload) {
  const navigation = payload.localPersistence ? page.waitForEvent('framenavigated') : null;
  await page.locator('#importInput').setInputFiles({name: 'Synthetic-G3B-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload))});
  if (navigation) await navigation;
  await ready(page);
  await page.waitForFunction(id => state.tasks.some(row => row.id === id), payload.tasks[0].id);
}
async function snapshot(page) {
  return page.evaluate(() => ({masters: customerProfileV1App.getMasterRecords(),
    raw: JSON.parse(WorkDeskPersistence.storage.getItem(CustomerProfileV1.MASTER_STORAGE_KEY)),
    tasks: state.tasks, relationships: JSON.parse(WorkDeskPersistence.storage.getItem('customer-profile-v1-3-relationships'))}));
}
function verify(actual, expected) {
  assert.deepEqual(actual.raw, expected.masters, 'Customer master raw envelope, IDs, observations and metadata must restore exactly');
  for (const task of expected.tasks) {
    const restored = actual.tasks.find(row => row.id === task.id);
    assert.ok(restored, 'Original Task exists'); assert.equal(restored.customerId, task.customerId);
    const master = actual.masters.filter(row => row.customerId === restored.customerId);
    assert.equal(master.length, 1, 'Task must resolve the exact original Customer master');
    assert.equal(master[0].hospitalId, task.hospitalId);
  }
  assert.equal(actual.relationships.records[0].fromCustomerId, expected.tasks[0].customerId);
  assert.equal(actual.masters.filter(row => row.customerId === '').length, expected.masters.records.filter(row => row.customerId === '').length);
}
async function verifyTaskContext(page, expected) {
  const id = expected.tasks[0].id;
  const context = await page.evaluate(id => {
    const task = state.tasks.find(row => row.id === id);
    openCustomerFromTask(task.customerId, {taskId: task.id, sourceTask: task, product: task.product});
    const entry = WorkspaceNavigationController.getCurrentEntry();
    const profile = customerProfileV1App.getProfiles().find(row => row.customerId === task.customerId && row.product === task.product);
    return {customerId: entry.contract.context.customerId, hospitalId: profile.hospitalId, sourceId: entry.contract.source.entityId};
  }, id);
  assert.equal(context.customerId, expected.tasks[0].customerId);
  assert.equal(context.hospitalId, expected.tasks[0].hospitalId); assert.equal(context.sourceId, id);
  await page.evaluate(() => openPrimaryWorkspace('tasks', {replace: true}));
}
(async () => {
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
    if (!allowed.has(relative)) {res.writeHead(404); return res.end();}
    res.setHeader('Content-Type', ({'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html'})[path.extname(relative)] || 'application/octet-stream');
    res.end(fs.readFileSync(path.join(root, 'dist', relative)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(launch);
  let processPayload, processExpected;
  for (const multiple of [false, true]) {
    const contexts = [];
    try {
      const source = await browser.newContext(); contexts.push(source);
      const page = await prepare(source, origin); const expected = await seed(page, multiple);
      await page.reload({waitUntil: 'networkidle'}); await ready(page);
      const payload = await backup(page);
      const target = await browser.newContext(); contexts.push(target);
      await target.addInitScript(() => {window.syntheticStorageBeforeBoot = localStorage.length;});
      const restored = await prepare(target, origin);
      assert.equal(await restored.evaluate(() => syntheticStorageBeforeBoot), 0, 'Fresh storage must actually begin empty');
      await restore(restored, payload); verify(await snapshot(restored), expected);
      await verifyTaskContext(restored, expected);
      results.push({id: multiple ? 'G3B02' : 'G3B01', scenario: multiple ? 'Multiple same-name Customers, inactive record, multiple Tasks, Hospital, scoped R and unresolved evidence' : 'One manual Customer and one exact stable-ID Task in fresh storage', status: 'PASS'});
      for (let iteration = 1; iteration <= 2; iteration++) {
        await restored.reload({waitUntil: 'networkidle'}); await ready(restored); verify(await snapshot(restored), expected);
      }
      results.push({id: multiple ? 'G3B04' : 'G3B03', scenario: 'Two real reloads preserve complete referential integrity', status: 'PASS'});
      await restore(restored, payload); verify(await snapshot(restored), expected);
      assert.equal((await snapshot(restored)).tasks.filter(row => expected.tasks.some(t => t.id === row.id)).length, expected.tasks.length);
      results.push({id: multiple ? 'G3B06' : 'G3B05', scenario: 'Duplicate restore retains replace semantics and does not duplicate IDs', status: 'PASS'});
      processPayload = payload; processExpected = expected;
    } catch (error) {results.push({id: multiple ? 'G3B02' : 'G3B01', status: 'FAIL', reason: error.message.slice(0, 700)});}
    finally {for (const context of contexts) await context.close();}
  }
  {
    const contexts = [];
    try {
      const source = await browser.newContext(); contexts.push(source);
      const page = await prepare(source, origin); await seed(page);
      const nearby = await page.evaluate(async () => {
        state.activities = [{id: 'A_SYN_G3B_FORMAL', isDraft: false, type: '科室会',
          activityDate: '2030-04-15', topic: 'Synthetic Formal Backup', hospitalId: 'H_SYN_004',
          hospitalName: 'Synthetic Hospital 4', approvalStatus: '已通过', status: '待执行'}];
        state.records = [{id: 'S_SYN_G3B_FISCAL', hospitalId: 'H_SYN_004', hospital: 'Synthetic Hospital 4',
          product: 'Primary Product A', productId: 'P_SYN_PRIMARY_A', date: '2030-03-15', orderBoxes: 0, salesAmount: null}];
        state.settings.syntheticBackupSetting = 'Synthetic restored preference'; persist();
        const store = ActivityDraftStore.create({storage: WorkDeskPersistence.storage, now: () => '2030-04-15T12:00:00Z'});
        const draft = store.createRecord('CREATE', {id: '', topic: 'Synthetic Backup Unsaved Draft',
          customerId: '', customerMatchStatus: 'UNRESOLVED', hospitalId: '', actualMeal: null});
        await store.put(draft);
        return {draft: WorkDeskPersistence.storage.getItem(ActivityDraftStore.KEY), activity: state.activities[0], sale: state.records[0], setting: state.settings.syntheticBackupSetting};
      });
      const payload = await backup(page), target = await browser.newContext(); contexts.push(target);
      const restored = await prepare(target, origin); await restore(restored, payload);
      const actual = await restored.evaluate(() => ({draft: WorkDeskPersistence.storage.getItem(ActivityDraftStore.KEY),
        activity: state.activities.find(row => row.id === 'A_SYN_G3B_FORMAL'), sale: state.records.find(row => row.id === 'S_SYN_G3B_FISCAL'),
        setting: state.settings.syntheticBackupSetting, hospital: state.settings.hospitalDirectoryOverrides.hospitals.H_SYN_004}));
      assert.equal(actual.draft, nearby.draft); assert.equal(actual.activity.id, nearby.activity.id);
      assert.equal(actual.activity.isDraft, false); assert.equal(actual.activity.approvalStatus, nearby.activity.approvalStatus);
      assert.equal(actual.sale.id, nearby.sale.id); assert.equal(actual.sale.orderBoxes, 0); assert.equal(actual.sale.salesAmount, null);
      assert.equal(actual.setting, nearby.setting); assert.equal(actual.hospital.hospitalCode, 'SYN_BACKUP_CODE');
      results.push({id: 'G3B08', scenario: 'Nearby formal Activity, unsaved draft, Hospital, Fiscal zero/null and settings survive real backup restore', status: 'PASS'});
    } catch (error) {results.push({id: 'G3B08', status: 'FAIL', reason: error.message.slice(0, 700)});}
    finally {for (const context of contexts) await context.close();}
  }
  {
    let context;
    try {
      context = await browser.newContext(); const page = await prepare(context, origin);
      const old = {exportedAt: '2030-04-15T12:00:00Z', tasks: [{id: 'T_SYN_G3B_OLD', customerId: 'C_SYN_OLD_ABSENT',
        title: 'Synthetic old backup', sourceType: 'customer', taskType: 'customer_visit', sourceId: 'C_SYN_OLD_ABSENT', status: 'pending'}],
        activities: [], records: [], reviews: [], settings: {syntheticBackupSetting: 'Synthetic old preference'}};
      const before = await page.evaluate(() => WorkDeskPersistence.storage.getItem(CustomerProfileV1.MASTER_STORAGE_KEY));
      await restore(page, old);
      assert.equal(await page.evaluate(() => WorkDeskPersistence.storage.getItem(CustomerProfileV1.MASTER_STORAGE_KEY)), before);
      assert.equal(await page.evaluate(() => state.tasks.find(row => row.id === 'T_SYN_G3B_OLD').customerId), 'C_SYN_OLD_ABSENT');
      assert.equal(await page.evaluate(() => customerProfileV1App.getMasterRecords().some(row => row.customerId === 'C_SYN_OLD_ABSENT')), false);
      results.push({id: 'G3B09', scenario: 'Representative legacy state-only backup imports with declared absent-Customer limitation; no invented identity', status: 'PASS'});
    } catch (error) {results.push({id: 'G3B09', status: 'FAIL', reason: error.message.slice(0, 700)});}
    finally {await context?.close();}
  }
  if (processPayload) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-backup-restart-'));
    let persistent;
    try {
      persistent = await chromium.launchPersistentContext(profile, launch);
      let page = await prepare(persistent, origin); await restore(page, processPayload);
      verify(await snapshot(page), processExpected); await persistent.close(); persistent = null;
      persistent = await chromium.launchPersistentContext(profile, launch);
      page = await prepare(persistent, origin); verify(await snapshot(page), processExpected);
      results.push({id: 'G3B07', scenario: 'Actual Chromium process restart reopens restored entity plus references', status: 'PASS'});
    } catch (error) {results.push({id: 'G3B07', status: 'FAIL', reason: error.message.slice(0, 700)});}
    finally {await persistent?.close();}
  }
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  const failed = results.filter(row => row.status === 'FAIL').length;
  console.log(JSON.stringify({status: failed ? 'FAIL' : 'PASS', pass: results.length - failed, fail: failed, results,
    scope: 'Public backup download/import plus authoritative Customer store; synthetic only; fresh contexts, actual reload and process restart'}));
  if (failed) process.exitCode = 1;
})().catch(error => {console.error(error.message); process.exitCode = 1;});
