(function attachWorkspaceNavigation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WorkspaceNavigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWorkspaceNavigationApi() {
  'use strict';

  const SCHEMA_VERSION = 1;
  const RELIABLE_MATCHES = new Set(['EXACT', 'CONFIRMED', 'HIGH', 'ACCEPTED', 'STABLE_ID', 'MANUAL_MAPPING']);
  const UNRELIABLE_MATCHES = new Set(['UNRESOLVED', 'PROBABLE', 'AMBIGUOUS', 'UNMATCHED', 'LOW', 'FUZZY', 'MEDIUM', 'PENDING', 'NONE']);
  const PRODUCT_LABELS = {
    primaryProductA: "Primary Product A",
    primaryProductB: "Primary Product B"
  };
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const text = value => String(value ?? '').trim();
  function copyPresent(source, keys) {
    const target = {};
    keys.forEach(key => {
      if (hasOwn(source, key)) target[key] = source[key] === null ? null : clone(source[key]);
    });
    return target;
  }
  function normalizeContext(context = {}) {
    const normalized = {};
    ['product', 'hospital', 'department', 'employee', 'customerId', 'period'].forEach(key => {
      if (!hasOwn(context, key)) return;
      if (context[key] === null) {
        normalized[key] = null;
        return;
      }
      if (key === 'product') normalized.product = copyPresent(context.product || {}, ['id', 'label']);else if (key === 'hospital') normalized.hospital = copyPresent(context.hospital || {}, ['id', 'name']);else if (key === 'department') normalized.department = copyPresent(context.department || {}, ['id', 'name', 'hospitalId']);else if (key === 'employee') normalized.employee = copyPresent(context.employee || {}, ['id', 'name']);else if (key === 'period') normalized.period = copyPresent(context.period || {}, ['fiscalYear', 'fiscalQuarter', 'month', 'cutoffDate']);else normalized.customerId = context.customerId === null ? null : text(context.customerId);
    });
    return normalized;
  }
  function normalizeContract(input = {}) {
    const source = input.source || {};
    const behavior = input.behavior || {};
    const destinations = ['sales-dashboard', 'customer-profile', 'hospital-context', 'task-progress', 'activity-application'];
    return {
      schemaVersion: SCHEMA_VERSION,
      destination: destinations.includes(input.destination) ? input.destination : 'sales-dashboard',
      source: {
        module: ['modules', 'task', 'activity', 'customer'].includes(source.module) ? source.module : 'modules',
        entityType: ['task', 'activity', 'customer', 'none'].includes(source.entityType) ? source.entityType : 'none',
        entityId: text(source.entityId),
        routeKey: text(source.routeKey)
      },
      context: normalizeContext(input.context || {}),
      behavior: {
        persistence: 'transient',
        customerMatch: behavior.customerMatch === 'exact-only' ? 'exact-only' : 'exact-only',
        fallback: behavior.fallback === 'broader-context' ? 'broader-context' : 'broader-context'
      }
    };
  }
  function customerMatchStatus(value = {}) {
    return text(value.matchType || value.customerMatchStatus || value.matchConfidence || value.confidenceLevel || value.resolvedBy).toUpperCase();
  }
  function isReliableCustomerMatch(value = {}) {
    if (!text(value.customerId)) return false;
    const statuses = [value.matchType, value.customerMatchStatus, value.matchConfidence, value.confidenceLevel, value.resolvedBy].map(item => text(item).toUpperCase()).filter(Boolean);
    if (statuses.some(status => UNRELIABLE_MATCHES.has(status))) return false;
    return statuses.some(status => RELIABLE_MATCHES.has(status));
  }
  function productLabel(product) {
    if (product === null) return null;
    const id = text(product?.id || product).toLowerCase();
    return PRODUCT_LABELS[id] || text(product?.label || product);
  }
  function resolvedFilterPatch(context = {}) {
    const patch = {};
    if (hasOwn(context, 'product')) patch.product = context.product === null ? null : productLabel(context.product);
    if (hasOwn(context, 'hospital')) {
      patch.hospitalId = context.hospital === null ? null : text(context.hospital?.id);
      patch.hospital = context.hospital === null ? null : text(context.hospital?.name);
    }
    if (hasOwn(context, 'department')) {
      patch.departmentId = context.department === null ? null : text(context.department?.id);
      patch.department = context.department === null ? null : text(context.department?.name);
      if (context.department !== null && hasOwn(context.department, 'hospitalId') && !hasOwn(context, 'hospital')) patch.hospitalId = text(context.department.hospitalId);
    }
    if (hasOwn(context, 'employee')) {
      patch.employeeId = context.employee === null ? null : text(context.employee?.id);
      patch.employee = context.employee === null ? null : text(context.employee?.name);
    }
    if (hasOwn(context, 'customerId')) patch.customerId = context.customerId;
    if (hasOwn(context, 'period')) {
      ['fiscalYear', 'fiscalQuarter', 'month', 'cutoffDate'].forEach(key => {
        if (context.period === null || hasOwn(context.period, key)) patch[key] = context.period === null ? null : context.period[key];
      });
    }
    return patch;
  }
  function create(options = {}) {
    const browserHistory = options.history || (typeof history !== 'undefined' ? history : null);
    const browserWindow = options.window || (typeof window !== 'undefined' ? window : null);
    const entries = new Map();
    let currentEntry = null;
    let sequence = 0;
    let edgeStart = null;
    function historyState(entry) {
      return {
        ...(browserHistory?.state || {}),
        workspaceNavigation: {
          schemaVersion: 1,
          type: 'workspace-context',
          destination: entry.contract.destination,
          entryId: entry.id
        }
      };
    }
    function showEntry(entry) {
      currentEntry = entry;
      (options.showEntry || options.showDashboard)?.(clone(entry));
    }
    function openContext(contractInput, metadata = {}) {
      const contract = normalizeContract(contractInput);
      const sourceWorkspace = metadata.sourceWorkspace || options.getCurrentWorkspace?.() || 'tasks';
      const entry = {
        id: `workspace-sales-${Date.now()}-${++sequence}`,
        contract,
        sourceWorkspace,
        sourceSnapshot: clone(metadata.sourceSnapshot ?? options.captureSnapshot?.(sourceWorkspace) ?? null),
        viewPayload: clone(metadata.viewPayload || null),
        title: text(metadata.title),
        meta: text(metadata.meta),
        notice: text(metadata.notice)
      };
      entries.set(entry.id, entry);
      showEntry(entry);
      const url = metadata.url || `#workspace/${contract.destination}`;
      if (metadata.historyMode !== 'replace' && browserHistory?.pushState) browserHistory.pushState(historyState(entry), '', url);else if (browserHistory?.replaceState) browserHistory.replaceState(historyState(entry), '', url);
      return clone(entry);
    }
    function openSales(contractInput, metadata = {}) {
      return openContext(contractInput, metadata);
    }
    function replaceContext(contractInput, metadata = {}) {
      if (!currentEntry) return openContext(contractInput, {
        ...metadata,
        historyMode: 'replace'
      });
      const entry = {
        ...currentEntry,
        contract: normalizeContract(contractInput),
        viewPayload: clone(metadata.viewPayload || null),
        title: text(metadata.title),
        meta: text(metadata.meta),
        notice: text(metadata.notice)
      };
      entries.set(entry.id, entry);
      showEntry(entry);
      const url = metadata.url || `#workspace/${entry.contract.destination}`;
      browserHistory?.replaceState?.(historyState(entry), '', url);
      return clone(entry);
    }
    function openModuleDashboard(metadata = {}) {
      return openSales({
        schemaVersion: 1,
        destination: 'sales-dashboard',
        source: {
          module: 'modules',
          entityType: 'none',
          entityId: '',
          routeKey: ''
        },
        context: {},
        behavior: {
          persistence: 'transient',
          customerMatch: 'exact-only',
          fallback: 'broader-context'
        }
      }, metadata);
    }
    function restoreSource(entry) {
      currentEntry = null;
      const snapshot = entry.sourceSnapshot;
      const wrapped = snapshot && (snapshot.workspace || snapshot.task || snapshot.activity || snapshot.customer) ? snapshot : entry.sourceWorkspace === 'activities' ? {
        workspace: 'activities',
        activity: snapshot || {}
      } : entry.sourceWorkspace === 'customers' ? {
        workspace: 'customers',
        customer: snapshot || {}
      } : {
        workspace: entry.sourceWorkspace,
        task: snapshot || {}
      };
      options.restoreSnapshot?.(entry.sourceWorkspace, clone(wrapped), clone(entry.contract));
    }
    function syncSourceSnapshot(workspace, snapshot) {
      if (currentEntry?.sourceWorkspace === workspace) currentEntry.sourceSnapshot = clone(snapshot);
      if (browserHistory?.replaceState && !currentEntry) browserHistory.replaceState({
        ...(browserHistory.state || {}),
        workspaceNavigationSourceSnapshot: clone(snapshot)
      }, '', browserWindow?.location?.href);
    }
    function handleBack(origin = 'page') {
      if (origin !== 'popstate' && origin !== 'context' && origin !== 'activity-editor') {
        const layer = options.closeTopLayer?.();
        if (layer && layer.scope !== 'context') return true;
      }
      if (!currentEntry) return Boolean(options.handleWorkspaceBack?.(origin));
      if (origin !== 'popstate' && browserHistory?.back) {
        browserHistory.back();
        return true;
      }
      restoreSource(currentEntry);
      return true;
    }
    function handlePopState(event) {
      const state = event?.state?.workspaceNavigation;
      if (event?.state?.workspaceNavigationLocalRoute && options.handlePopState?.(event)) return true;
      if (state?.type === 'workspace-context' && entries.has(state.entryId)) {
        showEntry(entries.get(state.entryId));
        return true;
      }
      if (currentEntry) return handleBack('popstate');
      return Boolean(options.handlePopState?.(event));
    }
    function edgeAllowed(event) {
      if (options.isNative?.() || !browserWindow) return false;
      const target = event.target;
      return !target?.closest?.('input, textarea, select, [contenteditable="true"], dialog[open], [data-kpi-id], .v2-chart-scroll, [data-horizontal-scroll], .date-navigator, #dateStrip, .activity-time-toolbar, #activityTypeChips, #activityStatusChips');
    }
    function onTouchStart(event) {
      const touch = event.touches?.[0];
      if (!touch || browserWindow.innerWidth - touch.clientX > 24 || !edgeAllowed(event)) {
        edgeStart = null;
        return;
      }
      edgeStart = {
        x: touch.clientX,
        y: touch.clientY
      };
    }
    function onTouchEnd(event) {
      const touch = event.changedTouches?.[0];
      const start = edgeStart;
      edgeStart = null;
      if (!touch || !start) return;
      const horizontal = start.x - touch.clientX;
      const vertical = Math.abs(start.y - touch.clientY);
      if (horizontal >= 72 && horizontal > vertical * 1.25) handleBack('edge-swipe');
    }
    function install() {
      browserWindow?.addEventListener?.('popstate', handlePopState);
      browserWindow?.addEventListener?.('touchstart', onTouchStart, {
        passive: true
      });
      browserWindow?.addEventListener?.('touchend', onTouchEnd, {
        passive: true
      });
      return controller;
    }
    function destroy() {
      browserWindow?.removeEventListener?.('popstate', handlePopState);
      browserWindow?.removeEventListener?.('touchstart', onTouchStart);
      browserWindow?.removeEventListener?.('touchend', onTouchEnd);
    }
    const controller = {
      openContext,
      replaceContext,
      openSales,
      openModuleDashboard,
      handleBack,
      handlePopState,
      syncSourceSnapshot,
      install,
      destroy,
      getCurrentEntry: () => clone(currentEntry)
    };
    return controller;
  }
  return {
    SCHEMA_VERSION,
    normalizeContext,
    normalizeContract,
    resolvedFilterPatch,
    customerMatchStatus,
    isReliableCustomerMatch,
    create
  };
});
