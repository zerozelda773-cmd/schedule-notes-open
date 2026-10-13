(function () {
  const CONFIG_KEY = 'work-progress-cloud-config-v1';
  const SESSION_KEY = 'work-progress-cloud-session-v1';
  const MANUAL_OFFLINE_KEY = 'work-progress-cloud-manual-offline-v1';
  const DIAGNOSTIC_KEY = 'work-progress-cloud-diagnostics-v1';
  const HEALTH_STATE_KEY = 'work-progress-supabase-health-v1';
  const HEALTH_CHECK_KEY = 'lastSupabaseHealthCheckAt';
  const SUCCESS_ACTIVITY_KEY = 'lastSupabaseSuccessfulActivityAt';
  const HEALTH_STATUS = Object.freeze({
    ONLINE: 'ONLINE',
    DEGRADED: 'DEGRADED',
    OFFLINE: 'OFFLINE',
    PAUSED_OR_UNRESOLVED: 'PAUSED_OR_UNRESOLVED',
    AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
    UNKNOWN: 'UNKNOWN'
  });
  const publicRuntime = window.WORK_PROGRESS_PUBLIC_RUNTIME || {};
  const AUTH_ERROR_MESSAGES = {
    AUTH_FAILURE: '账号或密码不正确，请检查后重试',
    NETWORK_FAILURE: '网络连接失败，请检查网络后重试；本机数据不受影响',
    SYNC_FAILURE: '登录正常，但云端数据同步失败；可继续使用本机数据并稍后重试',
    TOKEN_EXPIRED: '登录状态已过期，请重新登录',
    SERVER_UNAVAILABLE: '云服务暂时不可用，请稍后重试；本机数据不受影响'
  };
  class CloudSyncError extends Error {
    constructor(code, message = '', details = {}) {
      super(message || AUTH_ERROR_MESSAGES[code] || '云服务请求失败');
      this.name = 'CloudSyncError';
      this.code = code;
      this.status = details.status || 0;
      this.retriable = Boolean(details.retriable);
    }
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const diagnostic = (event, details = {}) => {
    const allowed = ['endpoint', 'endpointHost', 'requestId', 'networkType', 'onlineStatus', 'status', 'httpStatus', 'healthStatus', 'duration', 'errorType', 'stage'];
    const entry = {
      event,
      at: new Date().toISOString()
    };
    allowed.forEach(key => {
      if (details[key] !== undefined && details[key] !== null) entry[key] = String(details[key]).slice(0, 180);
    });
    try {
      const rows = JSON.parse(localStorage.getItem(DIAGNOSTIC_KEY) || '[]');
      localStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify([...rows.slice(-79), entry]));
    } catch {}
    console.info('[cloud-diagnostic]', entry);
    try {
      window.recordSafeDiagnostic?.(event, entry);
    } catch {}
    return entry;
  };
  const safeJson = (value, fallback = null) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const stamp = value => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const localDay = value => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const pad = part => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const stableJson = value => JSON.stringify(value, (key, item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return item;
    return Object.keys(item).sort().reduce((sorted, name) => {
      sorted[name] = item[name];
      return sorted;
    }, {});
  });
  function normalizeEndpoint(value) {
    const raw = String(value || '').trim();
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('连接服务配置无效，请联系管理员或在开发者选项中恢复默认设置');
    }
    if (parsed.protocol !== 'https:') throw new Error('连接服务配置不安全，必须使用 HTTPS');
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      throw new Error('连接服务地址格式无效，请只填写 HTTPS 站点地址');
    }
    return parsed.origin;
  }
  function decodeJwtPayload(value) {
    try {
      const encoded = value.split('.')[1];
      const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }
  function isPublicClientKey(value) {
    const key = String(value || '').trim();
    if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) return true;
    return key.split('.').length === 3 && decodeJwtPayload(key)?.role === 'anon';
  }
  function isPreflightClientKey(value) {
    return /^sb_publishable_preflight_only_[A-Za-z0-9_-]*$/.test(String(value || '').trim());
  }
  function remoteConfigField(source, names) {
    const match = String(source || '').match(new RegExp(`(?:${names.join('|')})\\s*:\\s*(['"])([^'"\\r\\n]+)\\1`));
    return match?.[2] || '';
  }
  function parsePublicRemoteConfig(source) {
    const text = String(source || '');
    if (/service_role|sb_secret_|BEGIN [A-Z ]*PRIVATE KEY|(?:password|token)\s*:/i.test(text)) {
      throw new Error('在线连接配置不安全，请联系管理员');
    }
    const url = normalizeEndpoint(remoteConfigField(text, ['url']));
    const anonKey = remoteConfigField(text, ['anonKey', 'publishableKey']);
    if (!isPublicClientKey(anonKey)) throw new Error('在线连接配置无效，请联系管理员');
    return {
      url,
      anonKey
    };
  }
  function mergeLatest(localItems = [], remoteItems = [], keyName, timeNames) {
    const map = new Map();
    [...remoteItems, ...localItems].forEach(item => {
      const key = item?.[keyName];
      if (!key) return;
      const existing = map.get(key);
      const itemTime = Math.max(...timeNames.map(name => stamp(item[name])));
      const existingTime = existing ? Math.max(...timeNames.map(name => stamp(existing[name]))) : -1;
      if (!existing || itemTime >= existingTime) map.set(key, item);
    });
    return [...map.values()];
  }
  function mergeTombstones(local = [], remote = []) {
    return mergeLatest(local, remote, 'key', ['deletedAt']);
  }
  function mergeTasks(localItems = [], remoteItems = []) {
    const merged = mergeLatest(localItems, remoteItems, 'id', ['updatedAt', 'completedAt', 'cancelledAt', 'createdAt']);
    const completedById = new Map();
    [...remoteItems, ...localItems].filter(task => task?.id && (task.sourceType === 'customer' && task.taskType === 'customer_visit' || task.sourceType === 'hospital' && task.taskType === 'hospital_profile_maintenance') && (task.status === 'completed' || task.completedAt || Number(task.progress) >= 100)).forEach(task => {
      const previous = completedById.get(task.id);
      if (!previous || Math.max(stamp(task.updatedAt), stamp(task.completedAt), stamp(task.createdAt)) >= Math.max(stamp(previous.updatedAt), stamp(previous.completedAt), stamp(previous.createdAt))) completedById.set(task.id, task);
    });
    return merged.map(task => {
      const completed = completedById.get(task.id);
      if (!completed) return task;
      const completedAt = Math.max(stamp(completed.updatedAt), stamp(completed.completedAt), stamp(completed.createdAt));
      if (stamp(task.reopenedAt) > completedAt) return task;
      return completed;
    });
  }
  function mergeDirectoryOverrides(local = {}, remote = {}) {
    const mergeBucket = (left = {}, right = {}) => {
      const ids = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
      const merged = {};
      ids.forEach(id => {
        const localItem = left[id];
        const remoteItem = right[id];
        if (!localItem) merged[id] = remoteItem;else if (!remoteItem) merged[id] = localItem;else merged[id] = stamp(localItem.updatedAt) >= stamp(remoteItem.updatedAt) ? localItem : remoteItem;
      });
      return merged;
    };
    return {
      hospitals: mergeBucket(local.hospitals, remote.hospitals),
      departments: mergeBucket(local.departments, remote.departments),
      updatedAt: stamp(local.updatedAt) >= stamp(remote.updatedAt) ? local.updatedAt || '' : remote.updatedAt || ''
    };
  }
  function recordKey(record) {
    return record.id || ['date', 'office', 'employee', 'product', 'hospital', 'department', 'address', 'orderBoxes', 'activityId'].map(key => record[key] || '').join('\u001f');
  }
  function mergeRecords(local = [], remote = [], clearedAt = '') {
    const map = new Map();
    [...remote, ...local].forEach(record => map.set(recordKey(record), record));
    const clearedTime = stamp(clearedAt);
    return [...map.values()].filter(record => {
      if (!clearedTime) return true;
      const created = stamp(record.importedAt || record.createdAt);
      return created > clearedTime;
    });
  }
  function mergeSettings(local = {}, remote = {}) {
    const localTime = stamp(local.settingsUpdatedAt);
    const remoteTime = stamp(remote.settingsUpdatedAt);
    const newer = localTime >= remoteTime ? local : remote;
    const older = newer === local ? remote : local;
    const localTemplateTime = stamp(local.activityTemplateUpdatedAt || local.activityTemplate?.importedAt);
    const remoteTemplateTime = stamp(remote.activityTemplateUpdatedAt || remote.activityTemplate?.importedAt);
    const selectedTemplate = localTemplateTime >= remoteTemplateTime ? local.activityTemplate : remote.activityTemplate;
    const activityTemplate = selectedTemplate ? Object.fromEntries(Object.entries(selectedTemplate).filter(([key]) => key !== 'dataBase64')) : selectedTemplate;
    const activityTemplateUpdatedAt = [local.activityTemplateUpdatedAt, remote.activityTemplateUpdatedAt, local.activityTemplate?.importedAt, remote.activityTemplate?.importedAt].filter(Boolean).sort().at(-1) || '';
    const activityLedgerSnapshotAt = {
      ...(remote.activityLedgerSnapshotAt || {})
    };
    Object.entries(local.activityLedgerSnapshotAt || {}).forEach(([fiscalYear, updatedAt]) => {
      if (stamp(updatedAt) >= stamp(activityLedgerSnapshotAt[fiscalYear])) activityLedgerSnapshotAt[fiscalYear] = updatedAt;
    });
    return {
      ...older,
      ...newer,
      importedSources: [...new Set([...(remote.importedSources || []), ...(local.importedSources || [])])],
      sourceSummaries: {
        ...(remote.sourceSummaries || {}),
        ...(local.sourceSummaries || {})
      },
      allRecordsClearedAt: [local.allRecordsClearedAt, remote.allRecordsClearedAt].filter(Boolean).sort().at(-1) || '',
      activityTemplate,
      activityTemplateUpdatedAt,
      activityLedgerSnapshotAt,
      hospitalDirectoryOverrides: mergeDirectoryOverrides(local.hospitalDirectoryOverrides, remote.hospitalDirectoryOverrides)
    };
  }
  function mergeActivityLedgerEntries(localRows = [], remoteRows = [], localSettings = {}, remoteSettings = {}) {
    const fiscalYears = new Set([...localRows.map(row => Number(row.fiscalYear)), ...remoteRows.map(row => Number(row.fiscalYear)), ...Object.keys(localSettings.activityLedgerSnapshotAt || {}).map(Number), ...Object.keys(remoteSettings.activityLedgerSnapshotAt || {}).map(Number)].filter(Boolean));
    const result = mergeLatest(localRows.filter(row => !Number(row.fiscalYear)), remoteRows.filter(row => !Number(row.fiscalYear)), 'id', ['snapshotAt', 'importedAt']);
    fiscalYears.forEach(fiscalYear => {
      const localTime = stamp(localSettings.activityLedgerSnapshotAt?.[fiscalYear]);
      const remoteTime = stamp(remoteSettings.activityLedgerSnapshotAt?.[fiscalYear]);
      const localFiscalRows = localRows.filter(row => Number(row.fiscalYear) === fiscalYear);
      const remoteFiscalRows = remoteRows.filter(row => Number(row.fiscalYear) === fiscalYear);
      if (localTime > remoteTime) result.push(...localFiscalRows);else if (remoteTime > localTime) result.push(...remoteFiscalRows);else result.push(...mergeLatest(localFiscalRows, remoteFiscalRows, 'id', ['snapshotAt', 'importedAt']));
    });
    return result;
  }
  function mergeWorkState(local = {}, remote = {}) {
    const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
    const deletedTasks = new Set(tombstones.filter(item => item.kind === 'task').map(item => item.id));
    const deletedCustomerPlans = new Set(tombstones.filter(item => item.kind === 'customerUpgradePlan').map(item => item.id));
    const deletedActivities = new Set(tombstones.filter(item => item.kind === 'activity').map(item => item.id));
    const deletedCustomers = new Set(tombstones.filter(item => item.kind === 'customer').map(item => item.id));
    const deletedCustomerFollowUps = new Set(tombstones.filter(item => item.kind === 'customerFollowUp').map(item => item.id));
    const settings = mergeSettings(local.settings, remote.settings);
    return {
      tasks: mergeTasks(local.tasks, remote.tasks).filter(task => !deletedTasks.has(task.id)),
      reviews: mergeLatest(local.reviews, remote.reviews, 'week', ['createdAt']),
      records: mergeRecords(local.records, remote.records, settings.allRecordsClearedAt),
      customerUpgradePlans: mergeLatest(local.customerUpgradePlans, remote.customerUpgradePlans, 'id', ['updatedAt', 'importedAt']).filter(item => !deletedCustomerPlans.has(item.id)),
      employeePlanRecords: mergeLatest(local.employeePlanRecords, remote.employeePlanRecords, 'id', ['updatedAt', 'importedAt']),
      activities: mergeLatest(local.activities, remote.activities, 'id', ['updatedAt', 'importedAt', 'createdAt']).filter(item => !deletedActivities.has(item.id)),
      activityLedgerEntries: mergeActivityLedgerEntries(local.activityLedgerEntries, remote.activityLedgerEntries, local.settings || {}, remote.settings || {}),
      customers: mergeLatest(local.customers, remote.customers, 'customerId', ['updatedAt', 'createdAt']).filter(item => !deletedCustomers.has(item.customerId)),
      customerFollowUps: mergeLatest(local.customerFollowUps, remote.customerFollowUps, 'followUpId', ['updatedAt', 'followUpAt', 'createdAt']).filter(item => !deletedCustomerFollowUps.has(item.followUpId)),
      customerDevelopmentRecords: mergeLatest(local.customerDevelopmentRecords, remote.customerDevelopmentRecords, 'customerId', ['updatedAt']),
      customerDevelopmentHistory: mergeLatest(local.customerDevelopmentHistory, remote.customerDevelopmentHistory, 'eventId', ['changedAt']),
      customerMasterEvents: mergeLatest(local.customerMasterEvents, remote.customerMasterEvents, 'eventId', ['changedAt']),
      tombstones,
      settings,
      meta: {
        updatedAt: new Date(Math.max(stamp(local.meta?.updatedAt), stamp(remote.meta?.updatedAt), Date.now())).toISOString()
      }
    };
  }
  class CloudSyncClient {
    constructor({
      getState,
      applyState,
      onStatus,
      onHealth,
      getRememberedCredentials,
      retryDelays,
      requestTimeout,
      now
    }) {
      this.getState = getState;
      this.applyState = applyState;
      this.onStatus = onStatus;
      this.onHealth = onHealth;
      this.getRememberedCredentials = getRememberedCredentials || (() => ({}));
      this.now = typeof now === 'function' ? now : () => new Date();
      this.retryDelays = Array.isArray(retryDelays) ? retryDelays : [1000, 3000, 8000];
      this.requestTimeout = Number(requestTimeout) > 0 ? Number(requestTimeout) : 12000;
      this.config = this.loadConfig();
      this.session = safeJson(localStorage.getItem(SESSION_KEY));
      this.manualOffline = true;
      localStorage.setItem(MANUAL_OFFLINE_KEY, '1');
      this.syncTimer = null;
      this.syncing = false;
      this.syncAgain = false;
      this.healthTimer = null;
      this.health = {
        status: HEALTH_STATUS.UNKNOWN,
        lastCheckAt: localStorage.getItem(HEALTH_CHECK_KEY) || '',
        lastSuccessAt: localStorage.getItem(SUCCESS_ACTIVITY_KEY) || '',
        ...(safeJson(localStorage.getItem(HEALTH_STATE_KEY), {}) || {})
      };
    }
    loadConfig() {
      const builtIn = window.WORK_PROGRESS_CLOUD || {};
      const saved = safeJson(localStorage.getItem(CONFIG_KEY), {}) || {};
      const url = saved.url || builtIn.url || publicRuntime.defaultEndpoint || '';
      const builtInMatches = builtIn.url && String(builtIn.url).replace(/\/+$/, '') === String(url).replace(/\/+$/, '');
      const publicRuntimeMatches = publicRuntime.defaultEndpoint && String(publicRuntime.defaultEndpoint).replace(/\/+$/, '') === String(url).replace(/\/+$/, '');
      const publicClientKey = publicRuntimeMatches && isPublicClientKey(publicRuntime.publicClientKey) ? publicRuntime.publicClientKey : '';
      return {
        url,
        anonKey: saved.anonKey || (builtInMatches ? builtIn.anonKey : '') || publicClientKey || ''
      };
    }
    configured() {
      try {
        return Boolean(normalizeEndpoint(this.config.url) && isPublicClientKey(this.config.anonKey));
      } catch {
        return false;
      }
    }
    signedIn() {
      return Boolean(this.session?.access_token && this.session?.user?.id);
    }
    userEmail() {
      return this.session?.user?.email || '';
    }
    online() {
      return typeof navigator === 'undefined' || navigator.onLine !== false;
    }
    defaultEndpoint() {
      try {
        return normalizeEndpoint(publicRuntime.defaultEndpoint);
      } catch {
        return '';
      }
    }
    currentTime() {
      return new Date(this.now()).toISOString();
    }
    networkType() {
      return this.online() ? navigator.connection?.effectiveType || 'online' : 'offline';
    }
    endpointHost() {
      try {
        return new URL(this.config.url || this.defaultEndpoint()).host;
      } catch {
        return '';
      }
    }
    healthSnapshot(extra = {}) {
      return {
        ...this.health,
        ...extra
      };
    }
    emitHealth(extra = {}) {
      const snapshot = this.healthSnapshot(extra);
      this.onHealth?.(snapshot);
      return snapshot;
    }
    saveHealth(status, details = {}) {
      this.health = {
        ...this.health,
        status,
        endpointHost: this.endpointHost(),
        networkType: this.networkType(),
        ...details
      };
      try {
        localStorage.setItem(HEALTH_STATE_KEY, JSON.stringify(this.health));
      } catch {}
      diagnostic('SUPABASE_HEALTH', {
        endpointHost: this.health.endpointHost,
        duration: this.health.duration || 0,
        httpStatus: this.health.httpStatus || 0,
        healthStatus: status,
        networkType: this.health.networkType,
        stage: this.health.source || 'automatic'
      });
      return this.emitHealth();
    }
    checkedToday() {
      return localDay(this.health.lastCheckAt || localStorage.getItem(HEALTH_CHECK_KEY)) === localDay(this.now());
    }
    successfulActivityToday() {
      return localDay(this.health.lastSuccessAt || localStorage.getItem(SUCCESS_ACTIVITY_KEY)) === localDay(this.now());
    }
    recordSuccessfulActivity(source = 'supabase', details = {}) {
      const at = this.currentTime();
      this.health.lastSuccessAt = at;
      localStorage.setItem(SUCCESS_ACTIVITY_KEY, at);
      if (details.updateStatus !== false) this.saveHealth(HEALTH_STATUS.ONLINE, {
        ...details,
        source,
        lastSuccessAt: at
      });else {
        try {
          localStorage.setItem(HEALTH_STATE_KEY, JSON.stringify(this.health));
        } catch {}
        this.emitHealth({
          source
        });
      }
      return at;
    }
    async checkHealth({
      manual = false
    } = {}) {
      const checkedAt = this.currentTime();
      if (!this.online()) {
        this.health.lastCheckAt = checkedAt;
        localStorage.setItem(HEALTH_CHECK_KEY, checkedAt);
        return this.saveHealth(HEALTH_STATUS.OFFLINE, {
          lastCheckAt: checkedAt,
          source: manual ? 'manual' : 'automatic',
          duration: 0,
          httpStatus: 0
        });
      }
      if (!manual && (this.checkedToday() || this.successfulActivityToday())) return this.emitHealth({
        skipped: true,
        reason: 'already-active-today'
      });
      if (!manual && this.syncing) return this.emitHealth({
        skipped: true,
        reason: 'sync-in-progress'
      });
      const startedAt = Date.now();
      this.health.lastCheckAt = checkedAt;
      localStorage.setItem(HEALTH_CHECK_KEY, checkedAt);
      if (!this.configured()) return this.saveHealth(HEALTH_STATUS.UNKNOWN, {
        lastCheckAt: checkedAt,
        source: manual ? 'manual' : 'automatic',
        duration: 0,
        httpStatus: 0
      });
      if (/\.invalid$/i.test(this.endpointHost())) return this.saveHealth(HEALTH_STATUS.UNKNOWN, {
        lastCheckAt: checkedAt,
        source: manual ? 'manual' : 'automatic',
        duration: 0,
        httpStatus: 0
      });
      if (isPreflightClientKey(this.config.anonKey)) return this.saveHealth(HEALTH_STATUS.UNKNOWN, {
        lastCheckAt: checkedAt,
        source: manual ? 'manual' : 'automatic',
        duration: 0,
        httpStatus: 0
      });
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), this.requestTimeout) : null;
      const useRest = this.signedIn();
      const url = useRest ? `${this.config.url}/rest/v1/work_progress_data?select=version&limit=1` : `${this.config.url}/auth/v1/health`;
      const headers = {
        apikey: this.config.anonKey,
        Accept: 'application/json',
        ...(useRest ? {
          Authorization: `Bearer ${this.session.access_token}`
        } : {})
      };
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          cache: 'no-store',
          ...(controller ? {
            signal: controller.signal
          } : {})
        });
        const details = {
          lastCheckAt: checkedAt,
          source: manual ? 'manual' : 'automatic',
          duration: Date.now() - startedAt,
          httpStatus: response.status
        };
        if (response.ok) {
          this.recordSuccessfulActivity(useRest ? 'health-rest' : 'health-auth', {
            ...details,
            updateStatus: false
          });
          return this.saveHealth(HEALTH_STATUS.ONLINE, {
            ...details,
            lastSuccessAt: this.health.lastSuccessAt
          });
        }
        if (response.status === 401 || response.status === 403) return this.saveHealth(HEALTH_STATUS.AUTH_UNAVAILABLE, details);
        return this.saveHealth(response.status >= 500 ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.UNKNOWN, details);
      } catch (error) {
        const raw = `${error?.name || ''} ${error?.code || ''} ${error?.message || ''}`;
        const status = !this.online() ? HEALTH_STATUS.OFFLINE : /dns|name_not_resolved|err_name|resolve host|failed to fetch/i.test(raw) ? HEALTH_STATUS.PAUSED_OR_UNRESOLVED : error?.name === 'AbortError' ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.UNKNOWN;
        return this.saveHealth(status, {
          lastCheckAt: checkedAt,
          source: manual ? 'manual' : 'automatic',
          duration: Date.now() - startedAt,
          httpStatus: 0
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    scheduleDailyHealthCheck(delay = 1200) {
      clearTimeout(this.healthTimer);
      this.emitHealth();
      this.healthTimer = setTimeout(() => this.checkHealth().catch(() => {}), delay);
    }
    async ensureConfigured() {
      const endpoint = normalizeEndpoint(this.config.url || publicRuntime.defaultEndpoint);
      this.config.url = endpoint;
      if (this.config.anonKey && !isPublicClientKey(this.config.anonKey)) {
        throw new Error('本机保存的连接配置不安全，请在开发者选项中恢复默认设置');
      }
      if (isPublicClientKey(this.config.anonKey)) return true;
      if (endpoint !== this.defaultEndpoint()) {
        throw new Error('当前连接服务缺少公开客户端配置，请联系管理员或恢复默认设置');
      }
      if (publicRuntime.publicClientKey && publicRuntime.publicClientKey !== '__PUBLIC_CLIENT_KEY__') {
        if (!isPublicClientKey(publicRuntime.publicClientKey)) throw new Error('应用内公开客户端配置无效，请联系管理员');
        this.config.anonKey = publicRuntime.publicClientKey;
        return true;
      }
      let configSource;
      try {
        configSource = new URL(String(publicRuntime.configSource || ''));
        if (configSource.protocol !== 'https:' || configSource.username || configSource.password) throw new Error();
      } catch {
        throw new Error('同步服务尚未完成配置，请联系管理员');
      }
      let response;
      try {
        response = await fetch(configSource.href, {
          cache: 'no-store'
        });
      } catch {
        throw new Error('暂时无法连接同步服务，请检查网络后重试；本机数据不受影响');
      }
      if (!response.ok) throw new Error('同步服务配置暂不可用，请稍后重试；本机数据不受影响');
      const remote = parsePublicRemoteConfig(await response.text());
      if (remote.url !== endpoint) throw new Error('在线连接配置与当前服务不匹配，请联系管理员');
      this.config.anonKey = remote.anonKey;
      return true;
    }
    emit(state, message = '') {
      this.onStatus?.({
        state,
        message,
        configured: this.configured(),
        signedIn: this.signedIn(),
        email: this.userEmail(),
        offline: !this.online() || this.manualOffline,
        manualOffline: this.manualOffline
      });
    }
    setManualOffline(enabled) {
      this.manualOffline = Boolean(enabled);
      clearTimeout(this.syncTimer);
      if (this.manualOffline) {
        localStorage.setItem(MANUAL_OFFLINE_KEY, '1');
        this.emit('offline', '离线优先 · 修改仅保存在本机');
      } else {
        localStorage.removeItem(MANUAL_OFFLINE_KEY);
        if (!this.signedIn()) this.emit(this.configured() ? 'ready' : 'local', '已主动开启在线 · 登录后即可同步');else if (!this.online()) this.emit('offline', '网络仍未连接 · 正在使用本机数据');else {
          this.emit('syncing', '已主动开启在线 · 正在同步…');
          this.scheduleSync(100);
        }
      }
      return this.manualOffline;
    }
    saveEndpoint(url) {
      const cleanUrl = normalizeEndpoint(url);
      const projectChanged = this.config.url && this.config.url !== cleanUrl;
      if (projectChanged) this.clearSession();
      this.config = {
        url: cleanUrl,
        anonKey: projectChanged ? '' : this.config.anonKey
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        url: cleanUrl
      }));
      this.emit('ready', '连接服务地址已保存');
      return cleanUrl;
    }
    restoreDefaultEndpoint() {
      const endpoint = this.defaultEndpoint();
      if (!endpoint) throw new Error('应用未提供默认连接服务，请联系管理员');
      const projectChanged = this.config.url && this.config.url !== endpoint;
      if (projectChanged) this.clearSession();
      this.config = {
        url: endpoint,
        anonKey: isPublicClientKey(publicRuntime.publicClientKey) ? publicRuntime.publicClientKey : ''
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        url: endpoint
      }));
      this.emit('ready', '已恢复默认连接服务');
      return endpoint;
    }
    async testConnection(url = this.config.url) {
      const endpoint = normalizeEndpoint(url);
      if (endpoint === this.config.url && endpoint === this.defaultEndpoint()) await this.ensureConfigured();
      const headers = endpoint === this.config.url && isPublicClientKey(this.config.anonKey) ? {
        apikey: this.config.anonKey
      } : {};
      let response;
      try {
        response = await fetch(`${endpoint}/auth/v1/settings`, {
          headers,
          cache: 'no-store'
        });
      } catch {
        throw new Error('无法连接该服务，请检查网络和地址');
      }
      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && !headers.apikey) {
          throw new Error('服务地址可访问，但缺少该项目的公开客户端配置');
        }
        throw new Error(`连接测试失败（${response.status}）`);
      }
      if (endpoint === this.config.url) this.recordSuccessfulActivity('connection-test', {
        httpStatus: response.status
      });
      return '连接正常';
    }
    clearSession() {
      this.session = null;
      localStorage.removeItem(SESSION_KEY);
    }
    saveSession(session) {
      const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600);
      this.session = {
        ...session,
        expires_at: expiresAt
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    }
    async fetchWithRetry(url, options = {}, requestKind = 'sync') {
      let lastError;
      for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
        const requestId = `${requestKind}_${Date.now()}_${attempt}`;
        const endpoint = (() => {
          try {
            return new URL(url).origin;
          } catch {
            return '';
          }
        })();
        diagnostic(requestKind === 'auth' ? 'AUTH_REQUEST_START' : 'SYNC_REQUEST_START', {
          endpoint,
          requestId,
          networkType: navigator.connection?.effectiveType || 'unknown',
          onlineStatus: this.online(),
          stage: `attempt-${attempt + 1}`
        });
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeout = controller ? setTimeout(() => controller.abort(), this.requestTimeout) : null;
        try {
          const response = await fetch(url, {
            ...options,
            ...(controller ? {
              signal: controller.signal
            } : {})
          });
          diagnostic('HTTP_STATUS', {
            endpoint,
            requestId,
            status: response.status,
            stage: requestKind
          });
          if (response.status >= 500 || response.status === 429) {
            lastError = new CloudSyncError('SERVER_UNAVAILABLE', '', {
              status: response.status,
              retriable: true
            });
          } else return response;
        } catch (error) {
          lastError = new CloudSyncError('NETWORK_FAILURE', '', {
            retriable: true
          });
          lastError.cause = error;
          const raw = String(error?.message || error?.name || 'network error');
          const event = error?.name === 'AbortError' ? 'TIMEOUT' : /ssl|tls|certificate/i.test(raw) ? 'TLS_ERROR' : /dns|name_not_resolved|resolve host/i.test(raw) ? 'DNS_RESULT' : 'NETWORK_ERROR';
          diagnostic(event, {
            endpoint,
            requestId,
            errorType: error?.name || 'Error',
            stage: requestKind
          });
        } finally {
          if (timeout) clearTimeout(timeout);
        }
        if (attempt >= this.retryDelays.length || !lastError.retriable) throw lastError;
        this.emit('syncing', `${requestKind === 'auth' ? '登录服务连接' : '云同步'}暂时失败，${attempt + 1}/${this.retryDelays.length} 次重试…`);
        await wait(this.retryDelays[attempt]);
      }
      throw lastError;
    }
    async authRequest(path, body) {
      if (this.manualOffline) throw new CloudSyncError('NETWORK_FAILURE', '当前为离线使用，请先点击“主动在线同步”');
      if (!this.online()) throw new CloudSyncError('NETWORK_FAILURE', '当前无网络；首次登录或重新登录需要联网，已登录设备可直接离线使用');
      await this.ensureConfigured();
      const response = await this.fetchWithRetry(`${this.config.url}/auth/v1/${path}`, {
        method: 'POST',
        headers: {
          apikey: this.config.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }, 'auth');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const refresh = path.includes('refresh_token');
        const code = refresh && (response.status === 400 || response.status === 401) ? 'TOKEN_EXPIRED' : response.status === 400 || response.status === 401 || response.status === 403 ? 'AUTH_FAILURE' : 'SERVER_UNAVAILABLE';
        const serverMessage = data.msg || data.message || data.error_description || '';
        diagnostic(code === 'AUTH_FAILURE' || code === 'TOKEN_EXPIRED' ? 'AUTH_FAILURE' : 'NETWORK_ERROR', {
          endpoint: this.config.url,
          status: response.status,
          stage: refresh ? 'refresh' : 'password'
        });
        throw new CloudSyncError(code, code === 'AUTH_FAILURE' && /invalid login|credentials/i.test(serverMessage) ? AUTH_ERROR_MESSAGES.AUTH_FAILURE : serverMessage || AUTH_ERROR_MESSAGES[code], {
          status: response.status
        });
      }
      this.recordSuccessfulActivity('auth', {
        httpStatus: response.status
      });
      return data;
    }
    async signUp(email, password) {
      this.emit('syncing', '正在创建账号…');
      const data = await this.authRequest('signup', {
        email,
        password
      });
      if (data.access_token) {
        this.saveSession(data);
        try {
          await this.syncNow();
          return '账号已创建、登录并同步';
        } catch {
          return '账号已创建并登录；云同步暂不可用，可继续使用本机数据';
        }
      }
      this.emit('ready', '请到邮箱确认账号后再登录');
      return '确认邮件已发送，请完成邮箱验证';
    }
    async signIn(email, password) {
      this.emit('syncing', '正在登录…');
      const data = await this.authRequest('token?grant_type=password', {
        email,
        password
      });
      this.saveSession(data);
      diagnostic('AUTH_SUCCESS', {
        endpoint: this.config.url
      });
      try {
        await this.syncNow();
        return '登录成功，数据已同步';
      } catch {
        diagnostic('SYNC_FAILURE', {
          endpoint: this.config.url
        });
        return '登录成功；云同步暂不可用，可继续使用本机数据并稍后重试';
      }
    }
    async signOut() {
      if (this.signedIn()) {
        fetch(`${this.config.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${this.session.access_token}`
          }
        }).catch(() => {});
      }
      this.manualOffline = true;
      localStorage.setItem(MANUAL_OFFLINE_KEY, '1');
      this.clearSession();
      this.emit('offline', '已退出云账号 · 继续离线使用本机数据');
    }
    async ensureSession() {
      if (!this.signedIn()) throw new CloudSyncError('TOKEN_EXPIRED', '请先登录云账号');
      if (Number(this.session.expires_at || 0) * 1000 > Date.now() + 60000) return;
      try {
        if (!this.session.refresh_token) throw new CloudSyncError('TOKEN_EXPIRED');
        const data = await this.authRequest('token?grant_type=refresh_token', {
          refresh_token: this.session.refresh_token
        });
        this.saveSession(data);
        diagnostic('TOKEN_REFRESH', {
          endpoint: this.config.url,
          status: 'success'
        });
      } catch (error) {
        if (error.code !== 'TOKEN_EXPIRED' && error.code !== 'AUTH_FAILURE') throw error;
        const remembered = this.getRememberedCredentials?.() || {};
        if (!remembered.email || !remembered.password) {
          this.clearSession();
          throw new CloudSyncError('TOKEN_EXPIRED');
        }
        const data = await this.authRequest('token?grant_type=password', {
          email: remembered.email,
          password: remembered.password
        });
        this.saveSession(data);
      }
    }
    async api(path, options = {}) {
      await this.ensureConfigured();
      await this.ensureSession();
      const {
        sessionRetry = false,
        ...requestOptions
      } = options;
      const response = await this.fetchWithRetry(`${this.config.url}${path}`, {
        ...requestOptions,
        headers: {
          apikey: this.config.anonKey,
          Authorization: `Bearer ${this.session.access_token}`,
          'Content-Type': 'application/json',
          ...(requestOptions.headers || {})
        }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && !sessionRetry && this.session?.refresh_token) {
          this.session.expires_at = 0;
          await this.ensureSession();
          return this.api(path, {
            ...requestOptions,
            sessionRetry: true
          });
        }
        if (response.status === 401 || response.status === 403) throw new CloudSyncError('TOKEN_EXPIRED', data?.message || AUTH_ERROR_MESSAGES.TOKEN_EXPIRED, {
          status: response.status
        });
        throw new CloudSyncError('SYNC_FAILURE', data?.message || data?.hint || data?.error || `云同步错误 ${response.status}`, {
          status: response.status
        });
      }
      this.recordSuccessfulActivity('rest', {
        httpStatus: response.status
      });
      return data;
    }
    async fetchRemote() {
      const userId = encodeURIComponent(this.session.user.id);
      const rows = await this.api(`/rest/v1/work_progress_data?user_id=eq.${userId}&select=payload,version,updated_at`, {
        method: 'GET'
      });
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    }
    async compareAndSwap(payload, baseVersion) {
      return this.api('/rest/v1/rpc/sync_work_progress_data', {
        method: 'POST',
        body: JSON.stringify({
          p_payload: payload,
          p_base_version: baseVersion
        })
      });
    }
    async syncNow() {
      if (!this.signedIn()) {
        this.emit(this.configured() ? 'ready' : 'local', '尚未登录云账号');
        return null;
      }
      if (this.manualOffline) {
        this.emit('offline', '离线优先 · 修改仅保存在本机');
        return this.getState();
      }
      if (!this.online()) {
        this.emit('offline', '离线已登录 · 正在使用本机数据');
        return this.getState();
      }
      if (this.syncing) {
        this.syncAgain = true;
        return null;
      }
      this.syncing = true;
      this.emit('syncing', '正在同步…');
      try {
        let remote = await this.fetchRemote();
        let merged = mergeWorkState(await this.getState(), remote?.payload || {});
        let committed = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await this.compareAndSwap(merged, Number(remote?.version || 0));
          const row = Array.isArray(result) ? result[0] : result;
          if (stableJson(row?.payload) === stableJson(merged)) {
            committed = true;
            break;
          }
          remote = row;
          merged = mergeWorkState(merged, row?.payload || {});
        }
        if (!committed) throw new Error('多台设备同时更新频繁，请稍后再同步');
        await this.applyState(merged);
        diagnostic('SYNC_SUCCESS', {
          endpoint: this.config.url
        });
        this.emit('synced', `同步完成 · ${new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        })}`);
        return merged;
      } catch (error) {
        const cloudError = error instanceof CloudSyncError ? error : new CloudSyncError('SYNC_FAILURE', error.message);
        diagnostic('SYNC_FAILURE', {
          endpoint: this.config.url,
          status: cloudError.status || 0,
          errorType: cloudError.code,
          stage: 'sync'
        });
        if (!this.online() || cloudError.code === 'NETWORK_FAILURE') this.emit('offline', `${AUTH_ERROR_MESSAGES.NETWORK_FAILURE} · 修改将在联网后同步`);else if (cloudError.code === 'TOKEN_EXPIRED') this.emit('error', AUTH_ERROR_MESSAGES.TOKEN_EXPIRED);else this.emit('error', `${AUTH_ERROR_MESSAGES.SYNC_FAILURE}（${cloudError.message}）`);
        throw cloudError;
      } finally {
        this.syncing = false;
        if (this.syncAgain) {
          this.syncAgain = false;
          this.scheduleSync(300);
        }
      }
    }
    scheduleSync(delay = 1200) {
      if (!this.signedIn() || this.manualOffline) return;
      clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => this.syncNow().catch(() => {}), delay);
    }
    async restore() {
      diagnostic('SESSION_RESTORE', {
        endpoint: this.config.url,
        status: this.signedIn() ? 'session-present' : 'no-session',
        onlineStatus: this.online()
      });
      if (this.manualOffline) {
        diagnostic('OFFLINE_FALLBACK', {
          endpoint: this.config.url,
          status: this.signedIn() ? 'session-present' : 'no-session'
        });
        this.emit('offline', this.signedIn() ? '离线优先 · 已保留登录，可随时主动同步' : '离线优先 · 无需登录即可使用');
        return;
      }
      if (!this.configured()) {
        this.emit('local', '本地模式');
        return;
      }
      if (!this.signedIn()) {
        this.emit('ready', '已开启在线，请登录后同步');
        return;
      }
      if (!this.online()) {
        this.emit('offline', '离线已登录 · 正在使用本机数据');
        return;
      }
      try {
        await this.syncNow();
      } catch (error) {
        if (error.code === 'TOKEN_EXPIRED' || /过期|401|JWT/.test(error.message)) {
          this.clearSession();
          this.emit('ready', '登录已过期，请重新登录');
        }
      }
    }
  }
  window.CloudSyncClient = CloudSyncClient;
  window.CloudSyncError = CloudSyncError;
  window.SUPABASE_HEALTH_STATUS = HEALTH_STATUS;
  window.mergeWorkState = mergeWorkState;
  window.parsePublicRemoteConfig = parsePublicRemoteConfig;
})();
