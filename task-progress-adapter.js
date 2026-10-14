(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TaskProgressAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE_TYPES = ['activity', 'customer', 'hospital', 'manual'];
  const STATUSES = ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'];
  const PRIORITIES = ['high', 'normal', 'low'];
  const SOURCE_LABELS = {
    activity: '活动',
    customer: '客户',
    hospital: '医院维护',
    manual: '自建'
  };
  const STATUS_LABELS = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    overdue: '已逾期',
    cancelled: '已取消'
  };
  const PRIORITY_LABELS = {
    high: '高',
    normal: '普通',
    low: '低'
  };
  const RECOMMENDATION_REASON_LABELS = {
    key_customer: '重点客户',
    long_time_no_visit: '长期未拜访',
    volume_decline: '近期掉量',
    upgrade_opportunity: '升级机会',
    post_activity_followup: '活动后跟进',
    development_stalled: '开发停滞',
    post_investment_observation: '资源投入后观察',
    no_followup_record: '暂无跟进记录',
    next_visit_cycle: '下一拜访周期',
    followup_overdue: '跟进已逾期',
    next_action_due: '下一步动作到期',
    activity_followup: '活动后跟进',
    resource_followup: '资源投入后观察'
  };
  function text(value) {
    return String(value ?? '').trim();
  }
  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function dateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function dueValue(task) {
    const values = [text(task?.dueDate), text(task?.due)].filter(Boolean);
    return values.find(value => value.includes('T')) || values[0] || '';
  }
  function localDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return new Date(value);
    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour || 0), Number(minute || 0), Number(second || 0));
    return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day) ? date : new Date(NaN);
  }
  function dueKey(task) {
    return dueValue(task).slice(0, 10);
  }
  function sourceType(task) {
    return SOURCE_TYPES.includes(task?.sourceType) ? task.sourceType : 'manual';
  }
  function priority(task) {
    if (PRIORITIES.includes(task?.priority)) return task.priority;
    return task?.urgent ? 'high' : 'normal';
  }
  function baseStatus(task) {
    if (task?.status === 'cancelled') return 'cancelled';
    if (task?.status === 'completed' || task?.completedAt || finite(task?.progress) >= 100) return 'completed';
    if (task?.status === 'overdue') return 'overdue';
    if (task?.status === 'in_progress' || finite(task?.progress) > 0) return 'in_progress';
    return 'pending';
  }
  function effectiveStatus(task, now = new Date()) {
    const base = baseStatus(task);
    if (base === 'completed' || base === 'cancelled' || base === 'overdue') return base;
    const deadline = dueKey(task);
    return deadline && deadline < dateKey(now) ? 'overdue' : base;
  }
  function isUnfinished(task) {
    return !['completed', 'cancelled'].includes(baseStatus(task));
  }
  function sourceId(task) {
    const type = sourceType(task);
    return text(task?.sourceId || (type === 'activity' ? task?.activityId : type === 'customer' ? task?.customerId : type === 'hospital' ? task?.hospitalId : ''));
  }
  function defaultTaskType(task) {
    const type = sourceType(task);
    if (type === 'customer') return 'customer_visit';
    if (type === 'hospital') return 'hospital_maintenance';
    if (type === 'activity') return 'activity_task';
    return 'manual_other';
  }
  function taskType(task) {
    return text(task?.taskType) || defaultTaskType(task);
  }
  function normalizeReasons(value) {
    const values = Array.isArray(value) ? value : text(value).split(/[、,，;；|]/);
    return [...new Set(values.map(text).filter(Boolean))];
  }
  function recommendationReasonLabels(value) {
    return normalizeReasons(value).map(reason => RECOMMENDATION_REASON_LABELS[reason] || reason);
  }
  function visitPlan(item = {}, now = new Date()) {
    const potential = text(item.customerPotential || item.potential);
    const difficulty = text(item.developmentDifficulty);
    const regionType = text(item.regionType);
    const inputs = {
      potential,
      difficulty,
      regionType,
      customerStage: text(item.developmentStatus || item.customerStage),
      hospitalImportance: text(item.hospitalImportance),
      lastVisit: text(item.lastVisit || item.lastFollowUpAt),
      followUpStatus: text(item.followUpStatus)
    };
    const high = /^(高|高潜|高潜力|HIGH)$/i.test(potential);
    const low = /^(低|低潜|低潜力|LOW)$/i.test(potential);
    const hard = /^(高|高难|高难度|HIGH)$/i.test(difficulty);
    const knownDifficulty = /^(低|中|高|低难度|中难度|高难度|LOW|MEDIUM|HIGH)$/i.test(difficulty);
    const knownRegion = ['省会', '地级市', '其他'].includes(regionType);
    let interval = null;
    let reason = '资料不足，待判断拜访周期';
    if ((high || low) && knownDifficulty && knownRegion) {
      interval = low ? 45 : hard ? 30 : regionType === '省会' ? 14 : regionType === '地级市' ? 21 : 30;
      reason = low || hard ? '低潜或高难度，建议维护观察并降低频率' : regionType === '省会' ? '高潜省会客户，建议高频推进' : '结合出差周期安排拜访';
      if (/^(LOST|流失|暂缓)$/i.test(inputs.customerStage)) {
        interval = Math.max(interval, 45);
        reason += '；流失/暂缓阶段先维护观察';
      }
      if (/^(HIGH|高|重点)$/i.test(inputs.hospitalImportance) && high && !hard) {
        interval = Math.min(interval, 14);
        reason += '；重点医院优先推进';
      }
      if (/^(OVERDUE|逾期)$/i.test(inputs.followUpStatus)) {
        interval = Math.min(interval, 7);
        reason += '；已记录跟进逾期，优先安排';
      }
    }
    const edited = Number(item.visitIntervalDays);
    if (Number.isInteger(edited) && edited >= 1 && edited <= 365) {
      interval = edited;
      reason = '用户确认的拜访周期';
    }
    const anchor = new Date(/^\d{4}-\d{2}-\d{2}$/.test(inputs.lastVisit) ? `${inputs.lastVisit}T12:00:00` : inputs.lastVisit || now);
    let from = '';
    if (interval && !Number.isNaN(anchor.getTime())) {
      anchor.setDate(anchor.getDate() + interval);
      from = dateKey(anchor) < dateKey(now) ? dateKey(now) : dateKey(anchor);
    }
    const end = from ? new Date(`${from}T12:00:00`) : null;
    if (end) end.setDate(end.getDate() + 6);
    return {
      recommendationType: 'CUSTOMER_VISIT_PLAN_RECOMMENDATION',
      recommendedVisitInterval: interval,
      recommendedNextWindow: from ? {
        from,
        to: dateKey(end)
      } : null,
      reason,
      evidence: inputs,
      strategy: reason,
      suggestedInterval: interval
    };
  }
  function normalizeTask(task = {}, now = new Date()) {
    const type = sourceType(task);
    const status = effectiveStatus(task, now);
    const description = text(task.description || task.notes);
    return {
      ...task,
      id: text(task.id),
      title: text(task.title) || '未命名任务',
      description,
      sourceType: type,
      sourceLabel: SOURCE_LABELS[type],
      sourceId: sourceId(task),
      taskType: taskType(task),
      priority: priority(task),
      priorityLabel: PRIORITY_LABELS[priority(task)],
      status,
      statusLabel: STATUS_LABELS[status],
      dueDate: dueValue(task),
      progress: Math.max(0, Math.min(100, finite(task.progress))),
      hospitalId: text(task.hospitalId),
      departmentId: text(task.departmentId),
      customerId: text(task.customerId),
      activityId: text(task.activityId),
      hospital: text(task.hospital || task.hospitalName),
      department: text(task.department || task.departmentName),
      customer: text(task.customer || task.customerName),
      activity: text(task.activity || task.activityName),
      autoGenerated: type !== 'manual' ? task.autoGenerated !== false : Boolean(task.autoGenerated),
      recommendationReason: normalizeReasons(task.recommendationReason),
      missingFields: normalizeReasons(task.missingFields),
      createdAt: text(task.createdAt),
      updatedAt: text(task.updatedAt),
      completedAt: text(task.completedAt)
    };
  }
  function systemTaskKey(task) {
    const type = sourceType(task);
    const id = sourceId(task);
    const kind = taskType(task);
    return type !== 'manual' && id && kind ? `${type}\u001f${id}\u001f${kind}` : '';
  }
  function isDuplicateSystemTask(existingTasks, candidate) {
    const key = systemTaskKey(candidate);
    return Boolean(key && (existingTasks || []).some(task => systemTaskKey(task) === key));
  }
  function hasOpenCustomerVisit(existingTasks, customer) {
    const customerId = text(customer?.customerId || customer?.sourceId);
    const customerName = text(customer?.customerName || customer?.customer);
    return (existingTasks || []).some(raw => {
      const task = normalizeTask(raw);
      if (task.sourceType !== 'customer' || task.taskType !== 'customer_visit' || !isUnfinished(task)) return false;
      return customerId && (task.customerId === customerId || task.sourceId === customerId) || !customerId && customerName && task.customer === customerName;
    });
  }
  function createCustomerVisitTask(recommendation, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const customerId = text(recommendation.customerId || recommendation.sourceId);
    const customerName = text(recommendation.customerName || recommendation.customer);
    if (!customerId && !customerName) throw new Error('推荐客户缺少稳定标识或姓名');
    const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const createdAt = now.toISOString();
    const reason = normalizeReasons(recommendation.recommendationReason);
    return {
      id: idFactory(),
      title: text(recommendation.taskTitle) || `拜访${customerName || '客户'}`,
      description: text(recommendation.recommendationExplanation || recommendation.description),
      notes: text(recommendation.recommendationExplanation || recommendation.description),
      sourceType: 'customer',
      sourceId: customerId || customerName,
      taskType: 'customer_visit',
      priority: PRIORITIES.includes(recommendation.priority) ? recommendation.priority : 'normal',
      status: 'pending',
      dueDate: text(recommendation.dueDate),
      due: text(recommendation.dueDate),
      progress: 0,
      hospitalId: text(recommendation.hospitalId),
      departmentId: text(recommendation.departmentId),
      customerId,
      hospital: text(recommendation.hospitalName || recommendation.hospital),
      department: text(recommendation.departmentName || recommendation.department),
      customer: customerName,
      product: text(recommendation.product),
      customerGrade: text(recommendation.customerGrade || recommendation.grade),
      recommendationReason: reason,
      recommendationExplanation: text(recommendation.recommendationExplanation),
      lastFollowUpAt: text(recommendation.lastFollowUpAt),
      visitGoal: text(recommendation.visitGoal),
      category: '客户拜访',
      autoGenerated: true,
      urgent: recommendation.priority === 'high',
      longTerm: true,
      createdAt,
      updatedAt: createdAt
    };
  }
  function addCustomerRecommendations(existingTasks, recommendations, selectedIds, options = {}) {
    const selected = new Set((selectedIds || []).map(text));
    const additions = [];
    const skipped = [];
    (recommendations || []).forEach(recommendation => {
      const recommendationId = text(recommendation.id || recommendation.recommendationId || recommendation.customerId || recommendation.customerName);
      if (!selected.has(recommendationId)) return;
      if (hasOpenCustomerVisit([...existingTasks, ...additions], recommendation)) {
        skipped.push({
          recommendation,
          reason: 'duplicate_open_task'
        });
        return;
      }
      additions.push(createCustomerVisitTask(recommendation, options));
    });
    return {
      additions,
      skipped
    };
  }
  function startOfWeek(now) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return date;
  }
  function endOfWeek(now) {
    const date = startOfWeek(now);
    date.setDate(date.getDate() + 6);
    return date;
  }
  function periodRange(period, now = new Date()) {
    const current = now instanceof Date ? now : new Date(now);
    if (period === 'week') return {
      from: dateKey(startOfWeek(current)),
      to: dateKey(endOfWeek(current))
    };
    if (period === 'month') {
      const from = new Date(current.getFullYear(), current.getMonth(), 1);
      const to = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      return {
        from: dateKey(from),
        to: dateKey(to)
      };
    }
    const today = dateKey(current);
    return {
      from: today,
      to: today
    };
  }
  function matchesPeriod(task, period, now = new Date()) {
    const key = dueKey(task);
    if (!key) return period === 'today' && isUnfinished(task);
    if (period === 'today' && effectiveStatus(task, now) === 'overdue') return true;
    const range = periodRange(period, now);
    return key >= range.from && key <= range.to;
  }
  function filterTasks(tasks, filters = {}, now = new Date()) {
    return (tasks || []).map(task => normalizeTask(task, now)).filter(task => {
      if (filters.period && !matchesPeriod(task, filters.period, now)) return false;
      if (filters.sourceType && filters.sourceType !== 'all' && task.sourceType !== filters.sourceType) return false;
      if (filters.status && filters.status !== 'all' && task.status !== filters.status) return false;
      return true;
    });
  }
  function sortTasks(tasks) {
    const statusOrder = {
      overdue: 0,
      pending: 1,
      in_progress: 2,
      completed: 3,
      cancelled: 4
    };
    const priorityOrder = {
      high: 0,
      normal: 1,
      low: 2
    };
    return [...tasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || priorityOrder[a.priority] - priorityOrder[b.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.title.localeCompare(b.title, 'zh-CN'));
  }
  function todayMustDo(tasks, now = new Date()) {
    const today = dateKey(now);
    return sortTasks((tasks || []).map(task => normalizeTask(task, now)).filter(task => isUnfinished(task) && dueKey(task) && dueKey(task) <= today));
  }
  function futureTasks(tasks, now = new Date()) {
    const today = dateKey(now);
    return sortTasks((tasks || []).map(task => normalizeTask(task, now)).filter(task => isUnfinished(task) && dueKey(task) > today));
  }
  function kpis(tasks, now = new Date()) {
    const normalized = (tasks || []).map(task => normalizeTask(task, now));
    const today = dateKey(now);
    const week = periodRange('week', now);
    const dueToday = normalized.filter(task => isUnfinished(task) && dueKey(task) === today).length;
    const dueThisWeek = normalized.filter(task => isUnfinished(task) && dueKey(task) >= week.from && dueKey(task) <= week.to).length;
    const overdue = normalized.filter(task => task.status === 'overdue').length;
    const weekPool = normalized.filter(task => dueKey(task) >= week.from && dueKey(task) <= week.to && task.status !== 'cancelled');
    const weekCompleted = weekPool.filter(task => task.status === 'completed').length;
    return {
      todayPending: dueToday,
      weekPending: dueThisWeek,
      overdue,
      weekCompleted,
      weekTotal: weekPool.length,
      weekCompletionRate: weekPool.length ? Math.round(weekCompleted / weekPool.length * 100) : 0
    };
  }
  function normalizeRecommendation(item = {}) {
    const plan = visitPlan(item, item.generatedAt || new Date());
    const stage = {
      CONTACTED: '初步接触',
      CULTIVATING: '培养中',
      AT_RISK: '待核验风险',
      LOST: '待核验流失',
      ACTIVE: '持续经营'
    };
    const reasons = normalizeReasons(item.recommendationReason);
    const strategy = reasons.includes('activity_followup') ? '活动后跟进' : reasons.includes('resource_followup') ? '资源效果复核' : reasons.includes('plan_upgrade') ? '升级计划推进' : '拜访与信息补齐';
    const evidence = item.recommendationEvidence || item.evidence || [];
    return {
      ...item,
      id: text(item.id || item.recommendationId || item.customerId || item.customerName),
      customerId: text(item.customerId),
      customerName: text(item.customerName || item.customer),
      hospitalName: text(item.hospitalName || item.hospital),
      departmentName: text(item.departmentName || item.department),
      customerGrade: item.gradeEvidenceAvailable === false ? '' : text(item.customerGrade || item.grade),
      recommendationReason: normalizeReasons(item.recommendationReason),
      recommendationExplanation: text(item.recommendationExplanation || item.description),
      dueDate: text(item.dueDate),
      customerStage: stage[text(item.developmentStatus).toUpperCase()] || '信息不足 / 待判断',
      potential: text(item.customerPotential || item.potential) || (item.gradeEvidenceAvailable !== false && /^[ABCD]$/.test(text(item.customerGrade)) ? '客户分层 ' + item.customerGrade + '（非医院潜力结论）' : '信息不足 / 待判断'),
      developmentDifficulty: text(item.developmentDifficulty) || '信息不足 / 待判断',
      strategyType: strategy,
      analysisEvidence: evidence,
      ...plan,
      recommendedTimeWindow: plan.recommendedNextWindow ? `${plan.recommendedNextWindow.from}～${plan.recommendedNextWindow.to}` : '待判断'
    };
  }
  function normalizeHospitalMaintenance(item = {}) {
    return {
      ...item,
      id: text(item.id || item.taskId || item.hospitalId || item.hospitalName),
      hospitalId: text(item.hospitalId),
      hospitalName: text(item.hospitalName || item.hospital),
      completeness: item.completeness === '' || item.completeness == null ? null : Math.max(0, Math.min(100, finite(item.completeness))),
      informationStatus: text(item.informationStatus),
      missingFields: normalizeReasons(item.missingFields),
      dueDate: text(item.dueDate)
    };
  }
  function activityTaskCandidates(activities = []) {
    const phases = [['activity_prepare', '活动准备', 'prepareDueDate'], ['activity_execute', '活动执行', 'executeDueDate'], ['activity_followup', '活动复盘/后续跟进', 'followupDueDate']];
    return (activities || []).flatMap(activity => {
      const activityId = text(activity.activityId || activity.id);
      if (!activityId) return [];
      return phases.filter(([,, dueField]) => text(activity[dueField])).map(([kind, label, dueField]) => ({
        title: `${text(activity.title || activity.name) || '活动'} · ${label}`,
        description: text(activity.description),
        sourceType: 'activity',
        sourceId: activityId,
        taskType: kind,
        priority: PRIORITIES.includes(activity.priority) ? activity.priority : 'normal',
        status: 'pending',
        dueDate: text(activity[dueField]),
        due: text(activity[dueField]),
        activityId,
        activity: text(activity.title || activity.name),
        hospitalId: text(activity.hospitalId),
        hospital: text(activity.hospitalName || activity.hospital),
        departmentId: text(activity.departmentId),
        department: text(activity.departmentName || activity.department),
        category: '活动申请',
        progress: 0,
        autoGenerated: true
      }));
    });
  }
  function upsertSystemTasks(existingTasks, candidates, options = {}) {
    const idFactory = options.idFactory || (() => globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const additions = [];
    const skipped = [];
    (candidates || []).forEach(candidate => {
      if (sourceType(candidate) === 'manual' || !systemTaskKey(candidate)) {
        skipped.push({
          candidate,
          reason: 'invalid_system_identity'
        });
        return;
      }
      if (isDuplicateSystemTask([...existingTasks, ...additions], candidate)) {
        skipped.push({
          candidate,
          reason: 'duplicate_system_task'
        });
        return;
      }
      const timestamp = now.toISOString();
      additions.push({
        id: idFactory(),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...candidate
      });
    });
    return {
      additions,
      skipped
    };
  }
  return {
    SOURCE_TYPES,
    STATUSES,
    PRIORITIES,
    SOURCE_LABELS,
    STATUS_LABELS,
    PRIORITY_LABELS,
    RECOMMENDATION_REASON_LABELS,
    dateKey,
    localDate,
    dueValue,
    dueKey,
    sourceType,
    priority,
    baseStatus,
    effectiveStatus,
    isUnfinished,
    normalizeTask,
    normalizeReasons,
    recommendationReasonLabels,
    systemTaskKey,
    isDuplicateSystemTask,
    hasOpenCustomerVisit,
    createCustomerVisitTask,
    addCustomerRecommendations,
    periodRange,
    matchesPeriod,
    filterTasks,
    sortTasks,
    todayMustDo,
    futureTasks,
    kpis,
    normalizeRecommendation,
    visitPlan,
    normalizeHospitalMaintenance,
    activityTaskCandidates,
    upsertSystemTasks
  };
});
