(function attachActivityTaskAdapter(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ActivityTaskAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function activityTaskAdapterFactory() {
  'use strict';

  const ACTIVITY_TASK_TYPES = ['activity_prepare', 'activity_execute', 'activity_followup'];
  const ACTIVE_APPROVAL_STATUSES = new Set(['已提交', '审批中', '已通过', '有效', '生效', '已生效', '已批准']);
  const ACTIVE_LEGACY_STATUSES = new Set(['资料完整', '待执行', '执行中', '已完成', '已复盘', '已提交', '审批中', '已通过']);
  const CANCELLED_STATUSES = new Set(['已取消', '取消', '已删除', '删除', '暂停', '作废', '失效']);
  const DRAFT_STATUSES = new Set(['', '草稿', '未申请', '未提交']);
  const HISTORICAL_BACKFILL_DAYS = 7;
  const PREPARE_CHECKLIST = [{
    id: 'venue_time',
    label: '确认场地与时间'
  }, {
    id: 'participants_speaker',
    label: '确认参会人员与讲者'
  }, {
    id: 'materials_budget',
    label: '确认物料与预算'
  }];
  function text(value) {
    return String(value ?? '').trim();
  }
  function taskFingerprint(task) {
    return JSON.stringify(task, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  }
  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function boolean(value) {
    return value === true || value === 1 || value === '1' || value === 'true' || value === '是' || value === '已完成';
  }
  function dateKey(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${match[1]}-${match[2]}-${match[3]}` : '';
  }
  function shiftDateKey(value, days) {
    const key = dateKey(value);
    if (!key) return '';
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  function timeKey(value) {
    const match = text(value).match(/^(?:T)?([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/);
    return match ? `${match[1]}:${match[2]}${match[3] ? `:${match[3]}` : ''}` : '';
  }
  function timeFromDateTime(value) {
    const match = text(value).match(/T(\d{2}:\d{2}(?::\d{2})?)/);
    return match ? timeKey(match[1]) : '';
  }
  function dueAt(date, time) {
    const day = dateKey(date);
    const clock = timeKey(time);
    return day && clock ? `${day}T${clock}` : day;
  }
  function activityIdentity(activity = {}) {
    return text(activity.id || activity.activityId);
  }
  function activityApprovalStatus(activity = {}) {
    return text(activity.approvalStatus || activity.applicationStatus);
  }
  function activityLegacyStatus(activity = {}) {
    return text(activity.status || activity.executionStatus);
  }
  function normalizeActivity(activity = {}) {
    const id = activityIdentity(activity);
    const activityDate = dateKey(activity.activityDate || activity.date || activity.startDate);
    const endDate = dateKey(activity.endDate || activity.activityEndDate) || activityDate;
    const approvalStatus = activityApprovalStatus(activity);
    const status = activityLegacyStatus(activity);
    return {
      ...activity,
      id,
      activityId: id,
      type: text(activity.type || activity.activityType || activity.name),
      activityDate,
      endDate,
      startTime: timeKey(activity.startTime || activity.activityStartTime || activity.activityTime || activity.time) || timeFromDateTime(activity.activityDate || activity.date || activity.startDate),
      endTime: timeKey(activity.endTime || activity.activityEndTime) || timeFromDateTime(activity.endDate || activity.activityEndDate),
      approvalStatus,
      status,
      hospitalId: text(activity.hospitalId || activity.hospitalCode),
      hospitalName: text(activity.hospitalName || activity.hospital),
      departmentId: text(activity.departmentId),
      departmentIds: [...new Set([...(activity.departmentIds || []), activity.departmentId].filter(Boolean))],
      departmentName: text(activity.departmentName || activity.department),
      applicantId: text(activity.applicantId || activity.employeeId),
      applicantName: text(activity.applicantName || activity.applicant || activity.employee),
      office: text(activity.office)
    };
  }
  function isCancelledActivity(activity = {}) {
    const normalized = normalizeActivity(activity);
    return CANCELLED_STATUSES.has(normalized.approvalStatus) || CANCELLED_STATUSES.has(normalized.status) || activity.deleted === true || Boolean(activity.deletedAt);
  }
  function shouldGenerateActivityTasks(activity = {}) {
    const normalized = normalizeActivity(activity);
    if (!normalized.id || !normalized.activityDate || !normalized.type || isCancelledActivity(normalized)) return false;
    if (normalized.approvalStatus) return ACTIVE_APPROVAL_STATUSES.has(normalized.approvalStatus);
    if (DRAFT_STATUSES.has(normalized.status)) return false;
    return ACTIVE_LEGACY_STATUSES.has(normalized.status);
  }
  function resolveActivitySchedule(activity = {}) {
    const normalized = normalizeActivity(activity);
    return {
      prepareDueDate: shiftDateKey(normalized.activityDate, -1),
      executeDueDate: dueAt(normalized.activityDate, normalized.startTime),
      followupDueDate: dueAt(shiftDateKey(normalized.endDate, 2), normalized.endTime)
    };
  }
  function explicitChecklistCompletion(activity, key) {
    const direct = {
      venue_time: ['venueTimeConfirmed', 'venueConfirmed', 'timeConfirmed'],
      participants_speaker: ['participantsSpeakerConfirmed', 'participantsConfirmed', 'speakerConfirmed'],
      materials_budget: ['materialsBudgetConfirmed', 'materialsConfirmed', 'budgetConfirmed']
    }[key] || [];
    if (direct.some(field => boolean(activity[field]))) return true;
    const source = Array.isArray(activity.prepareChecklist) ? activity.prepareChecklist : [];
    return source.some(item => text(item?.id || item?.key || item?.label) === key && boolean(item?.completed));
  }
  function prepareChecklist(activity) {
    return PREPARE_CHECKLIST.map(item => ({
      ...item,
      completed: explicitChecklistCompletion(activity, item.id)
    }));
  }
  function taskTitle(type, activityType) {
    const prefix = {
      activity_prepare: '活动准备',
      activity_execute: '执行活动',
      activity_followup: '活动复盘'
    }[type];
    return `${prefix} · ${activityType}`;
  }
  function deterministicTaskId(activityId, taskType) {
    return `activity-task:${activityId}:${taskType}`;
  }
  function taskKey(task = {}) {
    const source = text(task.sourceType);
    const sourceId = text(task.sourceId || task.activityId);
    const type = text(task.taskType);
    return source === 'activity' && sourceId && ACTIVITY_TASK_TYPES.includes(type) ? `${source}\u001f${sourceId}\u001f${type}` : '';
  }
  function baseTaskStatus(task = {}) {
    if (task.status === 'completed' || task.completedAt || number(task.progress) >= 100) return 'completed';
    if (task.status === 'cancelled') return 'cancelled';
    if (task.status === 'in_progress' || number(task.progress) > 0) return 'in_progress';
    return 'pending';
  }
  function taskSnapshot(normalized) {
    return {
      hospitalId: normalized.hospitalId,
      hospitalName: normalized.hospitalName,
      departmentId: normalized.departmentId,
      departmentIds: normalized.departmentIds,
      departmentName: normalized.departmentName,
      activityType: normalized.type,
      activityDate: normalized.activityDate,
      startTime: normalized.startTime,
      endDate: normalized.endDate,
      endTime: normalized.endTime,
      applicantId: normalized.applicantId,
      applicantName: normalized.applicantName,
      approvalStatus: normalized.approvalStatus,
      executionStatus: normalized.status
    };
  }
  function buildActivityTasks(activity = {}, options = {}) {
    const normalized = normalizeActivity(activity);
    if (!shouldGenerateActivityTasks(normalized)) return [];
    const schedule = resolveActivitySchedule(normalized);
    const createdAt = options.now instanceof Date ? options.now.toISOString() : text(options.now) || new Date().toISOString();
    return ACTIVITY_TASK_TYPES.map(taskType => {
      const due = {
        activity_prepare: schedule.prepareDueDate,
        activity_execute: schedule.executeDueDate,
        activity_followup: schedule.followupDueDate
      }[taskType];
      return {
        id: deterministicTaskId(normalized.id, taskType),
        title: taskTitle(taskType, normalized.type),
        description: text(normalized.topic || normalized.remarks),
        notes: text(normalized.topic || normalized.remarks),
        category: '活动申请',
        sourceType: 'activity',
        sourceId: normalized.id,
        activityId: normalized.id,
        taskType,
        autoGenerated: true,
        activity: normalized.type,
        activityType: normalized.type,
        dueDate: due,
        due,
        status: 'pending',
        progress: 0,
        priority: taskType === 'activity_execute' ? 'high' : 'normal',
        urgent: taskType === 'activity_execute',
        hospitalId: normalized.hospitalId,
        hospital: normalized.hospitalName,
        hospitalName: normalized.hospitalName,
        departmentId: normalized.departmentId,
        departmentIds: normalized.departmentIds,
        department: normalized.departmentName,
        departmentName: normalized.departmentName,
        applicantId: normalized.applicantId,
        applicant: normalized.applicantName,
        activitySnapshot: taskSnapshot(normalized),
        checklist: taskType === 'activity_prepare' ? prepareChecklist(normalized) : [],
        createdAt,
        updatedAt: createdAt
      };
    });
  }
  function mergeChecklist(existing = [], candidate = []) {
    if (!Array.isArray(candidate) || candidate.length === 0) return Array.isArray(existing) ? existing : [];
    const byId = new Map((Array.isArray(existing) ? existing : []).map(item => [text(item?.id || item?.key || item?.label), item]));
    return (Array.isArray(candidate) ? candidate : []).map(item => {
      const prior = byId.get(text(item.id || item.key || item.label));
      return prior ? {
        ...item,
        ...prior,
        id: item.id,
        label: item.label,
        completed: Boolean(prior.completed || item.completed)
      } : item;
    });
  }
  function mergeCandidate(existing, candidate, now) {
    if (baseTaskStatus(existing) === 'completed' || existing.archivedAt) return existing;
    const restored = existing.status === 'cancelled' && existing.cancelledByActivity;
    const status = restored ? ['pending', 'in_progress'].includes(existing.statusBeforeActivityCancel) ? existing.statusBeforeActivityCancel : 'pending' : existing.status;
    const next = {
      ...existing,
      ...candidate,
      id: existing.id || candidate.id,
      createdAt: existing.createdAt || candidate.createdAt,
      updatedAt: existing.updatedAt || now,
      status: ['pending', 'in_progress', 'cancelled'].includes(status) ? status : 'pending',
      progress: number(existing.progress),
      checklist: mergeChecklist(existing.checklist, candidate.checklist)
    };
    if (restored) {
      delete next.cancelledAt;
      delete next.cancelledByActivity;
      delete next.cancellationReason;
      delete next.statusBeforeActivityCancel;
    }
    next.activitySnapshot = {
      ...(existing.activitySnapshot || {}),
      ...(next.activitySnapshot || {})
    };
    if (taskFingerprint(next) === taskFingerprint(existing)) return existing;
    next.updatedAt = now;
    return next;
  }
  function canonicalTask(rows) {
    return [...rows].sort((a, b) => Number(baseTaskStatus(b) === 'completed') - Number(baseTaskStatus(a) === 'completed') || text(a.createdAt).localeCompare(text(b.createdAt)))[0];
  }
  function dedupeActivityTasks(tasks = []) {
    const groups = new Map();
    const passthrough = [];
    tasks.forEach(task => {
      const key = taskKey(task);
      if (!key) {
        passthrough.push(task);
        return;
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    });
    groups.forEach(rows => passthrough.push(canonicalTask(rows)));
    return passthrough;
  }
  function cancelActivityTasks(activityOrId, tasks = [], options = {}) {
    const id = typeof activityOrId === 'object' ? activityIdentity(activityOrId) : text(activityOrId);
    const reason = text(options.reason) || (typeof activityOrId === 'object' && (activityOrId.deleted || activityOrId.deletedAt) ? 'activity_deleted' : 'activity_cancelled');
    const now = options.now instanceof Date ? options.now.toISOString() : text(options.now) || new Date().toISOString();
    let changed = false;
    const next = tasks.map(task => {
      if (text(task.sourceType) !== 'activity' || text(task.sourceId || task.activityId) !== id || baseTaskStatus(task) === 'completed' || task.status === 'cancelled' && task.cancelledByActivity) return task;
      changed = true;
      return {
        ...task,
        statusBeforeActivityCancel: baseTaskStatus(task),
        status: 'cancelled',
        cancelledAt: now,
        cancelledByActivity: true,
        cancellationReason: reason,
        updatedAt: now
      };
    });
    const deduped = dedupeActivityTasks(next);
    if (deduped.length !== next.length) changed = true;
    return {
      tasks: deduped,
      changed,
      cancelled: deduped.filter(task => text(task.sourceId || task.activityId) === id && task.cancelledByActivity).length
    };
  }
  function syncActivityTasks(activity = {}, tasks = [], options = {}) {
    const normalized = normalizeActivity(activity);
    const nowDate = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const now = nowDate.toISOString();
    if (!normalized.id || !shouldGenerateActivityTasks(normalized)) return cancelActivityTasks(normalized.id, tasks, {
      ...options,
      now,
      reason: isCancelledActivity(normalized) ? 'activity_cancelled' : 'activity_draft'
    });
    const candidates = buildActivityTasks(normalized, {
      now
    });
    const keyed = new Map();
    const other = [];
    tasks.forEach(task => {
      const key = taskKey(task);
      if (!key || text(task.sourceId || task.activityId) !== normalized.id) {
        other.push(task);
        return;
      }
      if (!keyed.has(key)) keyed.set(key, []);
      keyed.get(key).push(task);
    });
    let changed = false;
    let added = 0;
    let updated = 0;
    let restored = 0;
    const synced = candidates.map(candidate => {
      const rows = keyed.get(taskKey(candidate)) || [];
      if (!rows.length) {
        if (options.allowCreate === false) return null;
        changed = true;
        added += 1;
        return candidate;
      }
      const existing = canonicalTask(rows);
      const next = mergeCandidate(existing, candidate, now);
      if (existing.status === 'cancelled' && existing.cancelledByActivity && next.status !== 'cancelled') restored += 1;
      if (taskFingerprint(next) !== taskFingerprint(existing) || rows.length > 1) {
        changed = true;
        updated += 1;
      }
      return next;
    }).filter(Boolean);
    return {
      tasks: [...other, ...synced],
      changed,
      added,
      updated,
      restored,
      cancelled: 0
    };
  }
  function historicalBackfillEligible(activity, options = {}) {
    const normalized = normalizeActivity(activity);
    const today = dateKey(options.now instanceof Date ? options.now.toISOString() : options.now || new Date().toISOString());
    if (!normalized.endDate || !today) return false;
    return normalized.endDate >= shiftDateKey(today, -(Number.isFinite(options.backfillDays) ? options.backfillDays : HISTORICAL_BACKFILL_DAYS));
  }
  function syncAllActivityTasks(activities = [], tasks = [], options = {}) {
    let next = dedupeActivityTasks(tasks);
    let changed = next.length !== tasks.length;
    let added = 0;
    let updated = 0;
    let restored = 0;
    let cancelled = 0;
    const normalizedActivities = (activities || []).map(normalizeActivity).filter(activity => activity.id);
    const activityIds = new Set(normalizedActivities.map(activity => activity.id));
    normalizedActivities.forEach(activity => {
      const hasExisting = next.some(task => text(task.sourceType) === 'activity' && text(task.sourceId || task.activityId) === activity.id && ACTIVITY_TASK_TYPES.includes(text(task.taskType)));
      const allowCreate = historicalBackfillEligible(activity, options);
      if (shouldGenerateActivityTasks(activity) && !hasExisting && !allowCreate) return;
      const result = syncActivityTasks(activity, next, {
        ...options,
        allowCreate
      });
      next = result.tasks;
      changed = changed || result.changed;
      added += result.added || 0;
      updated += result.updated || 0;
      restored += result.restored || 0;
      cancelled += result.cancelled || 0;
    });
    const orphanIds = [...new Set(next.filter(task => text(task.sourceType) === 'activity' && ACTIVITY_TASK_TYPES.includes(text(task.taskType)) && !activityIds.has(text(task.sourceId || task.activityId))).map(task => text(task.sourceId || task.activityId)))];
    orphanIds.forEach(id => {
      const result = cancelActivityTasks(id, next, {
        ...options,
        reason: 'activity_deleted'
      });
      next = result.tasks;
      changed = changed || result.changed;
      cancelled += result.cancelled || 0;
    });
    return {
      tasks: next,
      changed,
      added,
      updated,
      restored,
      cancelled
    };
  }
  return {
    ACTIVITY_TASK_TYPES,
    HISTORICAL_BACKFILL_DAYS,
    PREPARE_CHECKLIST,
    dateKey,
    shiftDateKey,
    normalizeActivity,
    isCancelledActivity,
    shouldGenerateActivityTasks,
    resolveActivitySchedule,
    buildActivityTasks,
    taskKey,
    deterministicTaskId,
    cancelActivityTasks,
    syncActivityTasks,
    historicalBackfillEligible,
    syncAllActivityTasks
  };
});
