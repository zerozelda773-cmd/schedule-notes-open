(function customerProfileModule(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.CustomerProfileV1 = api;
})(typeof window !== 'undefined' ? window : globalThis, function createCustomerProfileApi() {
  'use strict';

  const Departments = typeof module === 'object' && module.exports ? require('../department-identity.js') : globalThis.DepartmentIdentity;
  const Deletion = typeof module === 'object' && module.exports ? require('../deletion-policy.js') : globalThis.DeletionPolicy;
  const PRODUCTS = ["Primary Product A", "Primary Product B", "Auxiliary Product A", "Auxiliary Product B"];
  const CUSTOMER_NAVIGATION_SNAPSHOT_VERSION = 2;
  const CUSTOMER_NAVIGATION_MODES = ['overview', 'monitor', 'hospitals', 'relationships', 'intelligence'];
  const CUSTOMER_NAVIGATION_RELIABLE_IDENTITIES = new Set(['STABLE_ID', 'EXACT', 'CONFIRMED', 'MANUAL_MAPPING', 'ACCEPTED', 'HIGH']);
  const CUSTOMER_NAVIGATION_PANELS = ['master', 'import', 'matches'];
  const CUSTOMER_NAVIGATION_RELATIONSHIP_VIEWS = ['horizon', 'planet'];
  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }
  function navigationText(value, maximum = 160) {
    return String(value ?? '').slice(0, maximum);
  }
  function navigationNumber(value, fallback, minimum, maximum) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }
  function navigationProduct(value) {
    if (value === null) return null;
    return PRODUCTS.includes(value) ? value : null;
  }
  function normalizeGeneralNavigationFilters(input = {}) {
    const source = isPlainRecord(input) ? input : {};
    return {
      office: navigationText(source.office || 'all'),
      employee: navigationText(source.employee || 'all'),
      hospital: navigationText(source.hospital || 'all'),
      department: navigationText(source.department || 'all'),
      grade: ['all', 'A', 'B', 'C', 'D'].includes(source.grade) ? source.grade : 'all',
      status: navigationText(source.status || 'all'),
      month: /^\d{4}-\d{2}$/.test(source.month || '') ? source.month : '',
      resource: Boolean(source.resource),
      targetIncomplete: Boolean(source.targetIncomplete),
      noPlan: Boolean(source.noPlan)
    };
  }
  function normalizeRelationshipNavigationFilters(input = {}) {
    const source = isPlainRecord(input) ? input : {};
    const selected = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(item => allowed.includes(item)))] : [];
    return {
      hospital: navigationText(source.hospital || 'all'),
      department: navigationText(source.department || 'all'),
      grades: selected(source.grades, ['A', 'B', 'C', 'D']),
      perceptionLevels: selected(source.perceptionLevels, ['R1', 'R2', 'R3', 'R4']),
      developmentStatus: navigationText(source.developmentStatus || 'all'),
      currentStatus: navigationText(source.currentStatus || 'all'),
      relationshipScope: ['all', 'IN_HOSPITAL', 'OUTSIDE_HOSPITAL'].includes(source.relationshipScope) ? source.relationshipScope : 'all',
      hasRelationship: ['all', 'yes', 'no'].includes(source.hasRelationship) ? source.hasRelationship : 'all',
      importantOnly: Boolean(source.importantOnly),
      primaryOnly: Boolean(source.primaryOnly)
    };
  }
  function normalizeIntelligenceNavigationFilters(input = {}) {
    const source = isPlainRecord(input) ? input : {};
    const selected = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter(item => allowed.includes(item)))] : [];
    return {
      customerId: navigationText(source.customerId || 'all'),
      product: !hasOwn(source, 'product') || source.product === 'all' ? 'all' : navigationProduct(source.product),
      hospital: navigationText(source.hospital || 'all'),
      department: navigationText(source.department || 'all'),
      priorities: selected(source.priorities, ['P0', 'P1', 'P2', 'P3']),
      signalType: navigationText(source.signalType || 'all'),
      grades: selected(source.grades, ['A', 'B', 'C', 'D']),
      perceptionLevels: selected(source.perceptionLevels, ['R1', 'R2', 'R3', 'R4']),
      developmentStatus: navigationText(source.developmentStatus || 'all'),
      currentStatus: navigationText(source.currentStatus || 'all'),
      overdue: ['all', 'yes', 'no'].includes(source.overdue) ? source.overdue : 'all',
      hasRelationship: ['all', 'yes', 'no'].includes(source.hasRelationship) ? source.hasRelationship : 'all',
      keyInfluencer: ['all', 'yes', 'no'].includes(source.keyInfluencer) ? source.keyInfluencer : 'all',
      recommendationStatus: navigationText(source.recommendationStatus || 'all')
    };
  }
  function selectedKeyParts(value) {
    const text = navigationText(value, 320);
    const separator = text.lastIndexOf('::');
    if (separator < 1) return {
      customerId: '',
      product: null
    };
    return {
      customerId: text.slice(0, separator),
      product: navigationProduct(text.slice(separator + 2))
    };
  }
  function normalizeCustomerModuleContext(input = {}) {
    const source = isPlainRecord(input) ? input : {};
    const reliability = navigationText(source.reliability || source.matchType || source.resolvedBy || '').toUpperCase();
    return {
      schemaVersion: CUSTOMER_NAVIGATION_SNAPSHOT_VERSION,
      customerId: navigationText(source.customerId),
      reliability,
      product: hasOwn(source, 'product') ? navigationProduct(source.product) : null,
      hospitalId: navigationText(source.hospitalId),
      departmentId: navigationText(source.departmentId),
      focus: ['detail', 'followup', 'relationship', 'hospital'].includes(source.focus) ? source.focus : 'detail',
      taskId: navigationText(source.taskId),
      recommendationKey: navigationText(source.recommendationKey, 320)
    };
  }
  function normalizeCustomerNavigationSnapshot(input = {}) {
    const source = isPlainRecord(input) ? input : {};
    const current = Number(source.schemaVersion) === CUSTOMER_NAVIGATION_SNAPSHOT_VERSION && isPlainRecord(source.view);
    const legacyKey = selectedKeyParts(source.selectedKey);
    const legacyRelationship = isPlainRecord(source.relationship) ? source.relationship : {
      viewMode: source.relationshipViewMode,
      zoom: source.relationshipZoom,
      panX: source.relationshipPanX,
      panY: source.relationshipPanY,
      filters: source.relationshipFilters,
      selectedCustomerId: source.selectedGraphCustomerId
    };
    const legacyHospital = isPlainRecord(source.hospitalFocus) ? source.hospitalFocus : {};
    const view = current ? source.view : source;
    const selection = current ? source.selection : {
      customerId: source.selectedCustomerId || legacyKey.customerId,
      product: hasOwn(source, 'selectedProduct') ? source.selectedProduct : legacyKey.product,
      reliability: source.selectedCustomerId || legacyKey.customerId ? 'STABLE_ID' : '',
      hospitalId: legacyHospital.hospitalId,
      departmentId: legacyHospital.departmentId
    };
    const relationship = current && isPlainRecord(source.relationship) ? source.relationship : legacyRelationship;
    const intelligence = current && isPlainRecord(source.intelligence) ? source.intelligence : {
      filters: source.intelligenceFilters
    };
    const ui = current && isPlainRecord(source.ui) ? source.ui : {
      panel: source.panel,
      detailScrollTop: source.detailScrollTop,
      expandedInsightCustomerId: source.expandedInsightCustomerId
    };
    const normalizedContext = normalizeCustomerModuleContext(selection);
    const product = hasOwn(view, 'product') ? navigationProduct(view.product) : null;
    const pan = isPlainRecord(relationship.pan) ? relationship.pan : relationship;
    return {
      schemaVersion: CUSTOMER_NAVIGATION_SNAPSHOT_VERSION,
      module: 'customer',
      view: {
        page: CUSTOMER_NAVIGATION_MODES.includes(view.page || view.mode) ? view.page || view.mode : 'overview',
        product,
        search: navigationText(view.search, 240),
        filters: normalizeGeneralNavigationFilters(view.filters),
        monitorCategory: navigationText(view.monitorCategory || 'attention'),
        trendRange: ['6', 'fiscal'].includes(view.trendRange) ? view.trendRange : '6',
        timelineFilter: navigationText(view.timelineFilter || 'all'),
        visibleCount: Math.round(navigationNumber(view.visibleCount, 40, 20, 500))
      },
      selection: normalizedContext,
      hospital: {
        hospitalId: navigationText((current ? source.hospital : legacyHospital)?.hospitalId || normalizedContext.hospitalId),
        departmentId: navigationText((current ? source.hospital : legacyHospital)?.departmentId || normalizedContext.departmentId)
      },
      relationship: {
        viewMode: CUSTOMER_NAVIGATION_RELATIONSHIP_VIEWS.includes(relationship.viewMode) ? relationship.viewMode : 'horizon',
        zoom: navigationNumber(relationship.zoom, 1, .65, 1.8),
        pan: {
          x: navigationNumber(pan.x ?? pan.panX, 0, -100000, 100000),
          y: navigationNumber(pan.y ?? pan.panY, 0, -100000, 100000)
        },
        filters: normalizeRelationshipNavigationFilters(relationship.filters),
        selectedCustomerId: navigationText(relationship.selectedCustomerId)
      },
      intelligence: {
        filters: normalizeIntelligenceNavigationFilters(intelligence?.filters)
      },
      ui: {
        panel: CUSTOMER_NAVIGATION_PANELS.includes(ui?.panel) ? ui.panel : null,
        expandedInsightCustomerId: navigationText(ui?.expandedInsightCustomerId),
        detailScrollTop: navigationNumber(ui?.detailScrollTop, 0, 0, 1000000)
      }
    };
  }
  const SALES_GRADE_ORDER = {
    D: 0,
    C: 1,
    B: 2,
    A: 3
  };
  const STATUS = {
    ACTIVE: {
      label: '稳定',
      tone: 'stable'
    },
    GROWING: {
      label: '增长',
      tone: 'good'
    },
    DECLINING: {
      label: '掉量',
      tone: 'warn'
    },
    UPGRADED: {
      label: '升级',
      tone: 'good'
    },
    DOWNGRADED: {
      label: '降级',
      tone: 'warn'
    },
    NEW: {
      label: '新增',
      tone: 'info'
    },
    STAGNANT: {
      label: '停滞',
      tone: 'muted'
    },
    AT_RISK: {
      label: '流失风险',
      tone: 'danger'
    },
    LOST: {
      label: '流失',
      tone: 'danger'
    },
    RECOVERED: {
      label: '已恢复',
      tone: 'good'
    },
    PAUSED: {
      label: '暂停',
      tone: 'muted'
    },
    INSUFFICIENT_DATA: {
      label: '数据不足',
      tone: 'muted'
    }
  };
  const NOTE_TAGS = ['拜访', '问题', '反馈', '机会', '竞争', '活动', '其他'];
  const STORAGE_KEY = 'customer-profile-v1-local-notes';
  const MASTER_STORAGE_KEY = 'customer-profile-v1-1-master-data';
  const MATCH_DECISIONS_KEY = 'customer-profile-v1-1-match-decisions';
  const MATCH_QUEUE_KEY = 'customer-profile-v1-1-match-queue';
  const MASTER_SCHEMA_VERSION = 2;
  const FOLLOWUP_STORAGE_KEY = 'customer-profile-v1-2-followups';
  const INSIGHT_STORAGE_KEY = 'customer-profile-v1-2-insights';
  const DEVELOPMENT_HISTORY_KEY = 'customer-profile-v1-2-development-history';
  const V12_SCHEMA_VERSION = 1;
  const RELATIONSHIP_STORAGE_KEY = 'customer-profile-v1-3-relationships';
  const RELATIONSHIP_LAYOUT_KEY = 'customer-profile-v1-3-layout';
  const RELATIONSHIP_LAYOUT_SCHEMA_VERSION = 2;
  const RELATIONSHIP_LAYOUT_PRIMARY_AXIS = 'horizontal';
  const PROFESSIONAL_PROFILE_STORAGE_KEY = 'customer-profile-v1-3-professional-profiles';
  const CUSTOMER_IMAGE_DB_NAME = 'customer-profile-v1-3-customer-images';
  const CUSTOMER_IMAGE_STORE_NAME = 'customer-images';
  const V13_SCHEMA_VERSION = 1;
  const RECOMMENDATION_ACTIONS_STORAGE_KEY = 'customer-profile-v1-4-recommendation-actions';
  const V14_SCHEMA_VERSION = 1;
  const TASK_LINK_STORAGE_KEY = 'customer-profile-v1-5-task-links';
  const V15_SCHEMA_VERSION = 1;
  const TASK_LINK_STATES = {
    ACTIVE: '进行中',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  };
  const VISIT_CYCLE_DAYS = Object.freeze({
    A: 14,
    B: 21,
    C: 30,
    D: 45
  });
  const CUSTOMER_VISIT_CANCEL_COOLDOWN_DAYS = 7;
  const CUSTOMER_VISIT_REASONS = Object.freeze({
    key_customer: {
      label: '重点客户',
      weight: 35
    },
    long_time_no_visit: {
      label: '长期未拜访',
      weight: 50
    },
    followup_overdue: {
      label: '跟进已逾期',
      weight: 120,
      high: true
    },
    next_action_due: {
      label: '下一步动作到期',
      weight: 115,
      high: true
    },
    activity_followup: {
      label: '活动后跟进',
      weight: 110,
      high: true
    },
    upgrade_opportunity: {
      label: '升级机会',
      weight: 80
    },
    resource_followup: {
      label: '资源投入后观察',
      weight: 75
    },
    development_stalled: {
      label: '开发停滞',
      weight: 65
    },
    no_followup_record: {
      label: '暂无跟进记录',
      weight: 20
    },
    next_visit_cycle: {
      label: '下一拜访周期',
      weight: 25
    }
  });
  const OPERATING_PROVIDER_MODE = 'LOCAL_DETERMINISTIC';
  const OPERATING_SIGNAL_TYPES = {
    VISIT_CADENCE: '拜访节奏',
    PRIORITY_CUSTOMER: '重点客户',
    RELATIONSHIP_GAP: '关系薄弱',
    FOLLOWUP_OVERDUE: '跟进逾期',
    HIGH_VALUE_WEAK_RELATIONSHIP: '高价值但关系不足',
    HIGH_RISK_CUSTOMER: '高风险',
    KEY_INFLUENCER: '关键关系人',
    COVERAGE_GAP: '覆盖缺口',
    RECOVERY_OPPORTUNITY: '可恢复客户',
    UPGRADE_OPPORTUNITY: '升级机会',
    STAGNANT_CUSTOMER: '长期停滞',
    RESOURCE_REVIEW: '资源投入复核'
  };
  const OPERATING_PRIORITIES = {
    P0: {
      label: '紧急',
      order: 0
    },
    P1: {
      label: '高',
      order: 1
    },
    P2: {
      label: '中',
      order: 2
    },
    P3: {
      label: '普通',
      order: 3
    }
  };
  const RECOMMENDATION_STATUSES = {
    NEW: '待确认',
    CONFIRMED: '已确认',
    DISMISSED: '已忽略',
    SNOOZED: '稍后提醒'
  };
  const OPERATING_ACTION_TYPES = {
    FOLLOW_UP: '安排跟进',
    BUILD_RELATIONSHIP: '建立第二关系',
    VERIFY_STATUS: '核实状态',
    RECOVERY: '流失恢复',
    UPGRADE: '升级推进',
    EXPAND_DEPARTMENT: '科室扩面',
    REVIEW_RESOURCE: '复核资源投入',
    COMPLETE_PROFILE: '完善客户资料',
    CHECK_SALES_DROP: '核查掉量原因',
    OTHER: '其他'
  };
  const OPERATING_RULES = Object.freeze({
    severeOverdueDays: 14,
    longFollowUpDays: 45,
    salesDropRatio: 0.25,
    weakRelationshipMaximum: 1,
    keyInfluencerConnections: 4,
    keyInfluencerStrongConnections: 2,
    resourceReviewDays: 30,
    coverageRelationshipRatio: 0.5
  });
  const RELATIONSHIP_SCOPES = {
    IN_HOSPITAL: '院内关系',
    OUTSIDE_HOSPITAL: '院外关系'
  };
  const RELATIONSHIP_TYPES = {
    COLLEAGUE: '同事',
    SUPERIOR_SUBORDINATE: '上下级',
    MENTOR: '师承',
    ACADEMIC: '学术',
    REFERRAL: '转诊',
    INFLUENCE: '影响',
    COOPERATION: '合作',
    OTHER: '其他'
  };
  const RELATIONSHIP_STRENGTHS = {
    WEAK: '弱',
    NORMAL: '一般',
    STRONG: '强'
  };
  const DEVELOPMENT_STATUS = {
    UNDEVELOPED: {
      label: '未开发',
      tone: 'muted'
    },
    CONTACTED: {
      label: '初步接触',
      tone: 'info'
    },
    CULTIVATING: {
      label: '培养中',
      tone: 'info'
    },
    PRIORITY: {
      label: '重点推进',
      tone: 'good'
    },
    STABLE: {
      label: '稳定使用',
      tone: 'stable'
    },
    AT_RISK: {
      label: '风险',
      tone: 'warn'
    },
    PAUSED: {
      label: '暂停',
      tone: 'muted'
    },
    LOST: {
      label: '流失',
      tone: 'danger'
    },
    RECOVERABLE: {
      label: '可恢复',
      tone: 'good'
    }
  };
  const FOLLOW_UP_TYPES = {
    VISIT: '拜访',
    PHONE_WECHAT: '电话/微信',
    DEPARTMENT_MEETING: '科会',
    CASE_DISCUSSION: '病例讨论',
    ACADEMIC_ACTIVITY: '学术活动',
    DAILY_COMMUNICATION: '日常沟通',
    OTHER: '其他'
  };
  const INSIGHT_FIELDS = ['communicationPreference', 'keyConcerns', 'expressedObjections', 'decisionPattern', 'currentDifficulty', 'recommendedApproach', 'nextConversationSuggestion'];
  const INSIGHT_FIELD_LABELS = {
    communicationPreference: '沟通偏好',
    keyConcerns: '关注重点',
    expressedObjections: '已表达顾虑',
    decisionPattern: '决策/推进特征',
    currentDifficulty: '当前推进难点',
    recommendedApproach: '建议沟通方式',
    nextConversationSuggestion: '下次沟通建议'
  };
  const IMPORT_FIELD_ALIASES = {
    customerName: ['客户姓名', '客户', '姓名', 'customerName'],
    aliases: ['客户别名', '别名', 'aliases'],
    hospital: ['医院', 'Synthetic Hospital Example', 'hospital'],
    hospitalAliases: ['医院别名', 'hospitalAliases'],
    department: ['科室', '科室名称', 'department'],
    departmentAliases: ['科室别名', 'departmentAliases'],
    employee: ['负责人', '员工', '负责人/员工', 'employee', 'owner'],
    perceptionLevel: ['R1-R4', '观念等级', '认知等级', 'perceptionLevel'],
    developmentStatus: ['开发状态', 'developmentStatus'],
    currentObstacle: ['当前阻碍', '问题分析', 'currentObstacle'],
    nextAction: ['下一步动作', '后续跟进方案', 'nextAction'],
    nextFollowUpDate: ['下次跟进时间', '下次跟进日期', 'nextFollowUpDate'],
    notes: ['备注', 'notes']
  };
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]);
  }
  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  function pct(value) {
    return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';
  }
  function defaultGradeResolver(value) {
    const boxes = finite(value);
    if (boxes > 30) return 'A';
    if (boxes >= 20) return 'B';
    if (boxes >= 10) return 'C';
    return 'D';
  }
  function safeGradeResolver(resolver) {
    return typeof resolver === 'function' ? resolver : defaultGradeResolver;
  }
  function stableId(parts) {
    const source = parts.map(part => String(part || '').trim().toLowerCase()).join('|');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `cus_${(hash >>> 0).toString(36)}`;
  }
  function profileKey(profile) {
    return `${profile.customerId || profile.sourceProjectionKey || 'unbound'}::${profile.product}`;
  }
  function shiftMonth(month, offset) {
    const [year, monthNumber] = String(month).split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  function monthLabel(month) {
    const [, number] = String(month || '').split('-');
    return number ? `${Number(number)}月` : '—';
  }
  function gradeForMonth(profile, month, resolver) {
    const history = (profile.gradeHistory || []).find(item => item.month === month);
    if (history?.grade) return history.grade;
    const actual = (profile.monthlyActuals || []).find(item => item.month === month);
    return actual ? safeGradeResolver(resolver)(actual.value) : null;
  }
  function gradeDistances(value, resolver) {
    const resolve = safeGradeResolver(resolver);
    const boxes = Math.max(0, finite(value));
    const currentGrade = resolve(boxes);
    const currentRank = SALES_GRADE_ORDER[currentGrade] ?? 0;
    let nextThreshold = null;
    for (let candidate = Math.floor(boxes) + 1; candidate <= 10000; candidate += 1) {
      if ((SALES_GRADE_ORDER[resolve(candidate)] ?? 0) > currentRank) {
        nextThreshold = candidate;
        break;
      }
    }
    let lowerBoundary = Math.floor(boxes);
    while (lowerBoundary > 0 && resolve(lowerBoundary - 1) === currentGrade) lowerBoundary -= 1;
    return {
      currentGrade,
      toUpgrade: nextThreshold === null ? null : Math.max(0, nextThreshold - boxes),
      downgradeSafety: currentGrade === 'D' ? null : Math.max(0, boxes - lowerBoundary)
    };
  }
  function actualFor(profile, month) {
    const point = (profile.monthlyActuals || []).find(item => item.month === month);
    return point ? finite(point.value) : null;
  }
  function targetFor(profile, month) {
    const point = (profile.monthlyTargets || []).find(item => item.month === month);
    return point && point.value !== '' && point.value !== null && point.value !== undefined ? finite(point.value) : null;
  }
  function streak(values, direction) {
    if (values.length < 2) return 0;
    let count = 0;
    for (let index = values.length - 1; index > 0; index -= 1) {
      const delta = values[index] - values[index - 1];
      if (direction === 'down' && delta < 0 || direction === 'up' && delta > 0) count += 1;else break;
    }
    return count;
  }
  function defaultObservationMonth(profiles = [], asOfDate = new Date().toISOString().slice(0, 10)) {
    const currentMonth = String(asOfDate).slice(0, 7);
    const months = profiles.flatMap(profile => profile.monthlyActuals || []).filter(item => /^\d{4}-\d{2}$/.test(item.month || '') && item.month < currentMonth && item.value !== null && item.value !== undefined && item.value !== '' && Number.isFinite(Number(item.value))).map(item => item.month).sort();
    return months.at(-1) || shiftMonth(currentMonth, -1);
  }
  function profileMetrics(profile, month, resolver) {
    const current = actualFor(profile, month);
    const previousMonth = shiftMonth(month, -1);
    const previous = actualFor(profile, previousMonth);
    const target = targetFor(profile, month);
    const actuals = (profile.monthlyActuals || []).filter(item => item.month <= month && item.value !== null && item.value !== undefined && item.value !== '' && Number.isFinite(Number(item.value))).sort((a, b) => a.month.localeCompare(b.month));
    const values = actuals.map(item => finite(item.value));
    const recent = values.slice(-3);
    const distances = gradeDistances(current ?? 0, resolver);
    const grade = gradeForMonth(profile, month, resolver) || (current === null ? profile.currentSalesGrade || null : distances.currentGrade);
    const previousGrade = gradeForMonth(profile, previousMonth, resolver);
    const quarterStart = shiftMonth(month, -2);
    const quarterGrades = (profile.gradeHistory || []).filter(item => item.month >= quarterStart && item.month <= month).map(item => item.grade).filter(Boolean);
    let consecutiveGradeMonths = 0;
    for (let index = (profile.gradeHistory || []).length - 1; index >= 0; index -= 1) {
      const item = profile.gradeHistory[index];
      if (item.month > month) continue;
      if (item.grade !== grade) break;
      consecutiveGradeMonths += 1;
    }
    const changes = (profile.gradeHistory || []).map((item, index, rows) => ({
      ...item,
      previous: rows[index - 1]?.grade
    })).filter(item => item.previous && item.previous !== item.grade);
    const upgrades = changes.filter(item => SALES_GRADE_ORDER[item.grade] > SALES_GRADE_ORDER[item.previous]);
    const downgrades = changes.filter(item => SALES_GRADE_ORDER[item.grade] < SALES_GRADE_ORDER[item.previous]);
    return {
      current,
      previous,
      delta: current === null || previous === null ? null : current - previous,
      target,
      completion: target ? (current || 0) / target : null,
      grade,
      previousGrade,
      quarterHigh: quarterGrades.sort((a, b) => SALES_GRADE_ORDER[b] - SALES_GRADE_ORDER[a])[0] || grade,
      quarterLow: quarterGrades.sort((a, b) => SALES_GRADE_ORDER[a] - SALES_GRADE_ORDER[b])[0] || grade,
      consecutiveGradeMonths,
      lastUpgrade: upgrades.at(-1)?.month || null,
      lastDowngrade: downgrades.at(-1)?.month || null,
      toUpgrade: distances.toUpgrade,
      downgradeSafety: distances.downgradeSafety,
      average3: recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null,
      downStreak: streak(values, 'down'),
      upStreak: streak(values, 'up')
    };
  }
  function normalizedAlias(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s·・（）()\-]/g, '').replace(/科室$/u, '科').replace(/医院$/u, '院');
  }
  function aliasesFor(profile, field) {
    const direct = field === 'hospital' ? profile.hospitalName : field === 'department' ? profile.departmentName : profile.canonicalName;
    const aliases = field === 'hospital' ? profile.hospitalAliases : field === 'department' ? profile.departmentAliases : profile.aliases;
    return [direct, ...(aliases || [])].filter(Boolean).map(normalizedAlias);
  }
  const customerEntityMatcher = {
    match(input, candidates) {
      const query = {
        hospital: normalizedAlias(input?.hospital),
        department: normalizedAlias(input?.department),
        name: normalizedAlias(input?.name)
      };
      const scored = (candidates || []).map(profile => {
        const exactHospital = query.hospital && aliasesFor(profile, 'hospital').includes(query.hospital);
        const exactDepartment = query.department && aliasesFor(profile, 'department').includes(query.department);
        const nameAliases = aliasesFor(profile, 'name');
        const canonicalName = normalizedAlias(profile.canonicalName);
        const exactName = query.name && (query.name === canonicalName || query.name.length >= 2 && nameAliases.includes(query.name));
        const probableName = query.name && nameAliases.some(name => name.startsWith(query.name) || query.name.startsWith(name));
        const confidence = (exactHospital ? 0.5 : 0) + (exactDepartment ? 0.3 : 0) + (exactName ? 0.2 : probableName ? 0.14 : 0);
        return {
          profile,
          confidence,
          exact: Boolean(exactHospital && exactDepartment && exactName)
        };
      }).filter(item => item.confidence >= 0.64).sort((a, b) => b.confidence - a.confidence);
      if (!scored.length) return {
        matchType: 'UNMATCHED',
        confidence: 0,
        candidates: []
      };
      if (scored[0].exact && (scored[1]?.confidence || 0) < scored[0].confidence) return {
        matchType: 'EXACT',
        confidence: scored[0].confidence,
        customerId: scored[0].profile.customerId,
        candidates: [scored[0].profile]
      };
      const tied = scored.filter(item => Math.abs(item.confidence - scored[0].confidence) < 0.02);
      if (tied.length > 1) return {
        matchType: 'AMBIGUOUS',
        confidence: scored[0].confidence,
        candidates: tied.map(item => item.profile)
      };
      return {
        matchType: 'PROBABLE',
        confidence: scored[0].confidence,
        customerId: scored[0].profile.customerId,
        candidates: [scored[0].profile]
      };
    }
  };
  function readStoredJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage?.getItem(key) || 'null');
      return value === null ? fallback : globalThis.HospitalIdentity?.migrate(value) || value;
    } catch {
      return fallback;
    }
  }
  function splitList(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split(/[、,，;；\n]/).map(item => item.trim()).filter(Boolean);
  }
  function uniqueValues(values) {
    const seen = new Set();
    return (values || []).filter(value => {
      const normalized = normalizedAlias(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }
  function normalizeAssociatedProducts(value, legacyProduct = null) {
    const supplied = value === undefined ? [] : splitList(value);
    const legacy = value === undefined && PRODUCTS.includes(String(legacyProduct || '').trim()) ? [String(legacyProduct).trim()] : [];
    return [...new Set([...supplied, ...legacy].filter(product => PRODUCTS.includes(product)))];
  }
  function normalizePerceptionLevel(value) {
    const level = String(value || '').trim().toUpperCase();
    return /^R[1-4]$/.test(level) ? level : '';
  }
  const TRUSTED_CUSTOMER_ORIGINS = new Set(['LOCAL_MASTER','EXCEL_IMPORT','HUMAN_REVIEW','TASK_ENTRY','ACTIVITY_APPLICATION_DRAFT','LOCAL_FOLLOWUP','MANUAL_STATUS']);
  function customerMasterIdentity(record = {}, records = []) {
    const original = String(record.customerId || '');
    const bad = !original || original !== original.trim() || record.active === false || !TRUSTED_CUSTOMER_ORIGINS.has(record.source) || ['UNRESOLVED','CANDIDATE','LEGACY_UNSCOPED'].includes(record.identityStatus) || records.filter(row => String(row.customerId || '') === original).length !== 1;
    return {status:bad?'UNRESOLVED':'RESOLVED',customerId:bad?null:original,originalCustomerId:original,source:record.source || 'LEGACY_UNSCOPED'};
  }
  function resolveCustomerIdentity(record = {}, masters = [], decisions = {}) {
    const original = String(record.originalCustomerId ?? record.customerId ?? '');
    const result = {status:'UNKNOWN',originalCustomerId:original,resolvedCustomerId:null,reasonCodes:[],candidateIds:[]};
    const uncertain = [record.identityStatus,record.customerMatchStatus,record.matchType,record.masterMatch?.matchType].some(v=>['UNRESOLVED','CANDIDATE','LEGACY_UNSCOPED','PROBABLE','AMBIGUOUS','UNMATCHED','PENDING','FUZZY'].includes(v));
    const mapping = decisions[matchSignature({hospital:record.hospital || record.hospitalName,department:record.department || record.departmentName,name:record.customer || record.canonicalName})];
    if (!original) { if(mapping){result.status='CANDIDATE';result.candidateIds=[mapping];} result.reasonCodes.push('NO_ORIGINAL_BINDING'); return result; }
    const match = masters.filter(row => String(row.customerId || '') === original);
    if (uncertain || original !== original.trim() || match.length !== 1 || customerMasterIdentity(match[0],masters).status !== 'RESOLVED' || mapping && mapping !== original) {result.status='UNRESOLVED';result.reasonCodes.push('MASTER_OR_BINDING_UNRELIABLE');return result;}
    const binding=record.identitySource || record;
    const native=binding.sourceType==='customer' && binding.taskType==='customer_visit' && String(binding.sourceId || '')===original && String(binding.customerId || '')===original;
    const direct=record.customerName !== undefined && record.source === match[0].source;
    if (!native && !direct) {result.status='UNRESOLVED';result.reasonCodes.push('ORIGINAL_SOURCE_NOT_VERIFIED');return result;}
    result.status='RESOLVED';result.resolvedCustomerId=original;return result;
  }
  function projectPerception(observations = [], identity, product, masters = [], decisions = {}) {
    const kept=JSON.parse(JSON.stringify(observations));const out={status:'UNKNOWN',value:null,product:PRODUCTS.includes(product)?product:null,observations:kept,reasonCodes:[]};
    if (identity?.status !== 'RESOLVED') {out.status=identity?.status==='UNRESOLVED'?'UNRESOLVED':'UNKNOWN';out.reasonCodes.push('IDENTITY_UNRESOLVED');return out;}
    if (!out.product) {out.reasonCodes.push('PRODUCT_UNRESOLVED');return out;}
    const scoped=kept.filter(row=>row.structured && row.product===out.product && row.sourceKind!=='LEGACY_MASTER' && resolveCustomerIdentity(row,masters,decisions).resolvedCustomerId===identity.resolvedCustomerId);
    const levels=new Set(scoped.map(row=>normalizePerceptionLevel(row.value)).filter(Boolean));
    if (levels.size>1) {out.status='UNRESOLVED';out.reasonCodes.push('CONFLICTING_OBSERVATIONS');}
    else if(levels.size===1) {out.status='CANDIDATE';out.reasonCodes.push('R_FIELD_AUTHORITY_UNVERIFIED');}
    else out.reasonCodes.push('NO_SCOPED_OBSERVATION');
    return out;
  }
  function permanentCustomerId(idFactory) {
    if (typeof idFactory === 'function') return idFactory();
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `cus_${crypto.randomUUID()}`;
    return `cus_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function normalizeMasterRecord(input = {}, options = {}) {
    const now = options.now || new Date().toISOString();
    const customerName = String(input.customerName || input.canonicalName || input.customer || '').trim();
    const hospital = String(input.hospital || input.hospitalName || '').trim();
    const department = String(input.department || input.departmentName || input.departmentRoom || '').trim();
    const employee = String(input.employee || input.owner || input.employeeName || '').trim();
    const hospitalId = String(globalThis.HospitalIdentity?.resolve(input.hospitalId || '', hospital) || input.hospitalId || stableId(['hospital', hospital]));
    const departmentIds = Departments.idsOf(input);
    const departmentIdentity = departmentIds.length > 1 ? {
      departmentId: '',
      legacyIds: input.legacyDepartmentIds || [],
      provenance: input.departmentProvenance,
      sourceDepartmentId: ''
    } : Departments.normalize({
      hospitalId,
      department,
      departmentId: input.departmentId,
      departmentAliases: input.departmentAliases,
      legacyIds: input.legacyDepartmentIds,
      sourceDepartmentId: input.sourceDepartmentId,
      provenance: input.departmentProvenance
    });
    return {
      // Loading an existing record never invents authority. Explicit create allocates the ID.
      customerId: String(input.customerId || ''),
      ...(input.identityStatus ? {identityStatus:String(input.identityStatus)} : {}),
      customerName,
      aliases: uniqueValues(splitList(input.aliases || input.customerAliases).filter(alias => normalizedAlias(alias) !== normalizedAlias(customerName))),
      hospital,
      hospitalId,
      hospitalAliases: uniqueValues(splitList(input.hospitalAliases).filter(alias => normalizedAlias(alias) !== normalizedAlias(hospital))),
      department,
      departmentId: departmentIdentity.departmentId,
      departmentIds: departmentIds.length > 1 ? departmentIds : departmentIdentity.departmentId ? [departmentIdentity.departmentId] : [],
      departmentBindingEvidence: input.departmentBindingEvidence || null,
      sourceDepartmentId: departmentIdentity.sourceDepartmentId,
      legacyDepartmentIds: departmentIdentity.legacyIds,
      departmentProvenance: departmentIdentity.provenance,
      departmentAliases: uniqueValues(splitList(input.departmentAliases).filter(alias => normalizedAlias(alias) !== normalizedAlias(department))),
      employee,
      employeeId: String(input.employeeId || stableId(['employee', employee])),
      owner: String(input.owner || employee),
      associatedProducts: normalizeAssociatedProducts(input.associatedProducts ?? input.productIds ?? input.products, input.product),
      perceptionLevel: normalizePerceptionLevel(input.perceptionLevel),
      developmentStatus: String(input.developmentStatus || '').trim(),
      currentObstacle: String(input.currentObstacle || '').trim(),
      customerPotential: String(input.customerPotential || input.potential || '').trim(),
      developmentDifficulty: String(input.developmentDifficulty || '').trim(),
      regionType: ['省会', '地级市', '其他'].includes(input.regionType) ? input.regionType : '',
      hospitalImportance: String(input.hospitalImportance || '').trim(),
      followUpStatus: String(input.followUpStatus || '').trim(),
      nextAction: String(input.nextAction || '').trim(),
      nextFollowUpDate: String(input.nextFollowUpDate || '').slice(0, 10),
      notes: String(input.notes || '').trim(),
      createdAt: String(input.createdAt || now),
      updatedAt: String(input.updatedAt || now),
      source: String(input.source || 'LEGACY_UNSCOPED'),
      active: input.active !== false
    };
  }
  function seedMasterRecords(profiles = [], options = {}) {
    const byId = new Map();
    (profiles || []).forEach(profile => {
      if (!profile?.customerId) return;
      const candidate = normalizeMasterRecord({
        customerId: profile.customerId,
        customerName: profile.canonicalName,
        aliases: profile.aliases,
        employee: profile.employeeName,
        employeeId: profile.employeeId,
        hospital: profile.hospitalName,
        hospitalId: profile.hospitalId,
        hospitalAliases: profile.hospitalAliases,
        department: profile.departmentName,
        departmentId: profile.departmentId,
        departmentAliases: profile.departmentAliases,
        perceptionLevel: profile.perceptionLevel,
        createdAt: profile.createdAt || profile.lastUpdatedAt,
        updatedAt: profile.lastUpdatedAt,
        source: 'MIGRATED_V1',
        active: true
      }, options);
      const current = byId.get(candidate.customerId);
      if (!current) {
        byId.set(candidate.customerId, candidate);
        return;
      }
      current.aliases = uniqueValues([...current.aliases, ...candidate.aliases]);
      current.hospitalAliases = uniqueValues([...current.hospitalAliases, ...candidate.hospitalAliases]);
      current.departmentAliases = uniqueValues([...current.departmentAliases, ...candidate.departmentAliases]);
      current.associatedProducts = normalizeAssociatedProducts([...current.associatedProducts, ...candidate.associatedProducts]);
      if (!current.perceptionLevel && candidate.perceptionLevel) current.perceptionLevel = candidate.perceptionLevel;
    });
    return [...byId.values()];
  }
  function validateMasterRecord(record) {
    const errors = [];
    if (!record.customerId || record.customerId !== record.customerId.trim()) errors.push('需要明确有效的客户身份');
    if (!record.customerName) errors.push('客户姓名不能为空');
    if (!record.hospital) errors.push('医院不能为空');
    if (!record.department) errors.push('科室不能为空');
    if (record.perceptionLevel && !/^R[1-4]$/.test(record.perceptionLevel)) errors.push('观念等级必须是 R1-R4');
    return errors;
  }
  function createCustomerMasterStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const stored = readStoredJson(storage, MASTER_STORAGE_KEY, null);
    const storedRecords = Array.isArray(stored) ? stored : Array.isArray(stored?.records) ? stored.records : null;
    const originalRows = new WeakMap();
    const loadRows = rows => rows.map(raw => {const row=normalizeMasterRecord(raw,{now:raw.updatedAt || now()});originalRows.set(row,JSON.parse(JSON.stringify(raw)));return row;});
    let records = loadRows(storedRecords || options.seedRecords || []);
    const serialize = () => records.map(row=>JSON.parse(JSON.stringify(originalRows.get(row) || row)));
    function persist(persistOptions = {}) {
      const payload=Array.isArray(stored)?serialize():{...(stored || {schemaVersion:MASTER_SCHEMA_VERSION}),records:serialize()};
      const encoded=JSON.stringify(payload);let equal=false;try{equal=JSON.stringify(JSON.parse(storage?.getItem(MASTER_STORAGE_KEY)))===encoded;}catch{}
      if(!equal)storage?.setItem(MASTER_STORAGE_KEY,encoded);
      if (!persistOptions.silent) options.onChange?.();
    }
    if (!stored && options.seedRecords?.length && records.length) persist();
    function list(listOptions = {}) {
      const includeInactive = listOptions.includeInactive !== false;
      return records.filter(record => includeInactive || record.active).map(record => ({
        ...record,
        aliases: [...record.aliases],
        hospitalAliases: [...record.hospitalAliases],
        departmentAliases: [...record.departmentAliases],
        associatedProducts: [...record.associatedProducts]
      }));
    }
    function get(customerId) {
      if (!String(customerId || '').trim()) return null;
      const matches=list().filter(record=>record.customerId===customerId);
      return matches.length===1?matches[0]:null;
    }
    function create(input, createOptions = {}) {
      if (input.perceptionLevel && !/^R[1-4]$/i.test(String(input.perceptionLevel).trim())) throw new Error('观念等级必须是 R1-R4');
      const record = normalizeMasterRecord({
        ...input,
        customerId: input.customerId || permanentCustomerId(options.idFactory),
        source: input.source || createOptions.source || 'LOCAL_MASTER'
      }, {
        now: now(),
        idFactory: options.idFactory
      });
      const errors = validateMasterRecord(record);
      if (errors.length) throw new Error(errors.join('；'));
      if (records.some(item => item.customerId === record.customerId)) throw new Error('customerId 已存在');
      records.push(record);
      persist();
      return get(record.customerId);
    }
    function update(customerId, patch, updateOptions = {}) {
      const index = records.findIndex(record => record.customerId === customerId);
      if (index < 0) throw new Error('客户不存在');
      if (patch.perceptionLevel && !/^R[1-4]$/i.test(String(patch.perceptionLevel).trim())) throw new Error('观念等级必须是 R1-R4');
      const previous = records[index];
      const nextInput = {
        ...previous,
        ...patch,
        customerId: previous.customerId,
        createdAt: previous.createdAt,
        updatedAt: now(),
        source: updateOptions.source || patch.source || previous.source
      };
      nextInput.aliases = uniqueValues([...previous.aliases, ...splitList(patch.aliases)]);
      nextInput.hospitalAliases = uniqueValues([...previous.hospitalAliases, ...splitList(patch.hospitalAliases)]);
      nextInput.departmentAliases = uniqueValues([...previous.departmentAliases, ...splitList(patch.departmentAliases)]);
      if (patch.customerName && normalizedAlias(patch.customerName) !== normalizedAlias(previous.customerName)) nextInput.aliases = uniqueValues([previous.customerName, ...nextInput.aliases]);
      if (patch.hospital && normalizedAlias(patch.hospital) !== normalizedAlias(previous.hospital)) {
        nextInput.hospitalAliases = uniqueValues([previous.hospital, ...nextInput.hospitalAliases]);
        nextInput.hospitalId = globalThis.HospitalIdentity?.resolve(patch.hospitalId || '', patch.hospital) || patch.hospitalId || stableId(['hospital', patch.hospital]);
      }
      if (patch.department && normalizedAlias(patch.department) !== normalizedAlias(previous.department)) {
        nextInput.departmentAliases = uniqueValues([previous.department, ...nextInput.departmentAliases]);
        nextInput.departmentId = patch.departmentId || previous.departmentId;
      }
      if (patch.employee && normalizedAlias(patch.employee) !== normalizedAlias(previous.employee)) nextInput.employeeId = patch.employeeId || stableId(['employee', patch.employee]);
      const next = normalizeMasterRecord(nextInput, {
        now: nextInput.updatedAt,
        idFactory: options.idFactory
      });
      next.customerId = previous.customerId;
      next.createdAt = previous.createdAt;
      const errors = validateMasterRecord(next);
      if (errors.length) throw new Error(errors.join('；'));
      originalRows.set(next,{...(originalRows.get(previous) || {}),...next});
      records[index] = next;
      persist();
      return get(customerId);
    }
    function setActive(customerId, active) {
      return update(customerId, {
        active: Boolean(active)
      }, {
        source: 'LOCAL_MASTER'
      });
    }
    function remove(customerId, context) {
      const record = get(customerId);
      if (!record) return false;
      if (!context || Deletion.decide('customer', record, context).action !== 'DELETE') throw new Error('存在业务引用，请归档客户并保留历史');
      records = records.filter(item => item.customerId !== customerId);
      persist();
      return true;
    }
    function seed(seedRecords = []) {
      if (records.length || !seedRecords.length) return false;
      records = loadRows(seedRecords);
      persist();
      return true;
    }
    function replace(nextRecords = [], replaceOptions = {}) {
      records = loadRows(nextRecords);
      persist({
        silent: Boolean(replaceOptions.silent)
      });
      return list();
    }
    return {
      list,
      get,
      create,
      update,
      setActive,
      remove,
      seed,
      replace,
      persist,
      serialize,
      storageKey: MASTER_STORAGE_KEY,
      schemaVersion: MASTER_SCHEMA_VERSION
    };
  }
  function matcherProfileFromMaster(record) {
    return {
      customerId: record.customerId,
      canonicalName: record.customerName,
      aliases: record.aliases,
      hospitalName: record.hospital,
      hospitalAliases: record.hospitalAliases,
      departmentName: record.department,
      departmentAliases: record.departmentAliases,
      employeeName: record.employee
    };
  }
  function matchSignature(input = {}) {
    return [normalizedAlias(input.hospital), normalizedAlias(input.department), normalizedAlias(input.name || input.customerName)].join('|');
  }
  function matchEvidence(input, match) {
    if (match.resolvedBy === 'MANUAL_MAPPING') return ['已复用人工确认映射', `稳定客户ID ${match.customerId}`];
    const candidate = match.candidates?.[0];
    if (!candidate) return ['未找到满足医院、科室与姓名权重的候选'];
    const evidence = [];
    if (aliasesFor(candidate, 'hospital').includes(normalizedAlias(input.hospital))) evidence.push('医院或医院别名一致');
    if (aliasesFor(candidate, 'department').includes(normalizedAlias(input.department))) evidence.push('科室或科室别名一致');
    const queryName = normalizedAlias(input.name || input.customerName);
    const names = aliasesFor(candidate, 'name');
    if (names.includes(queryName)) evidence.push('客户姓名或别名一致');else if (names.some(name => name.startsWith(queryName) || queryName.startsWith(name))) evidence.push('客户姓名为简称或同姓候选');
    if (match.matchType === 'AMBIGUOUS') evidence.push(`存在 ${match.candidates.length} 个同分候选，必须人工选择`);
    return evidence;
  }
  function matchMasterRecord(input, masterRecords = [], decisions = {}) {
    const signature = matchSignature(input);
    const mappedCustomerId = decisions?.[signature];
    const activeRecords = masterRecords.filter(record => record.active !== false);
    const mapped = activeRecords.find(record => record.customerId === mappedCustomerId);
    if (mapped) {
      return {
        matchType: 'EXACT',
        confidence: 1,
        customerId: mapped.customerId,
        candidates: [matcherProfileFromMaster(mapped)],
        resolvedBy: 'MANUAL_MAPPING',
        evidence: ['已复用人工确认映射', `稳定客户ID ${mapped.customerId}`]
      };
    }
    const result = customerEntityMatcher.match({
      hospital: input.hospital,
      department: input.department,
      name: input.name || input.customerName
    }, activeRecords.map(matcherProfileFromMaster));
    return {
      ...result,
      resolvedBy: 'MATCHER',
      evidence: matchEvidence(input, result)
    };
  }
  function rowValue(row, aliases) {
    const key = aliases.find(alias => Object.prototype.hasOwnProperty.call(row || {}, alias));
    return key ? row[key] : '';
  }
  function mapImportRow(row = {}) {
    const mapped = {};
    Object.entries(IMPORT_FIELD_ALIASES).forEach(([field, aliases]) => {
      mapped[field] = rowValue(row, aliases);
    });
    mapped.aliases = splitList(mapped.aliases);
    mapped.hospitalAliases = splitList(mapped.hospitalAliases);
    mapped.departmentAliases = splitList(mapped.departmentAliases);
    mapped.customerName = String(mapped.customerName || '').trim();
    mapped.hospital = String(mapped.hospital || '').trim();
    mapped.department = String(mapped.department || '').trim();
    mapped.employee = String(mapped.employee || '').trim();
    mapped.perceptionLevel = String(mapped.perceptionLevel || '').trim().toUpperCase();
    mapped.nextFollowUpDate = String(mapped.nextFollowUpDate || '').slice(0, 10);
    return mapped;
  }
  function analyzeCustomerImport(rows = [], masterRecords = [], decisions = {}) {
    const signatures = new Map();
    const recognizedFields = Object.entries(IMPORT_FIELD_ALIASES).filter(([, aliases]) => rows.some(row => aliases.some(alias => Object.prototype.hasOwnProperty.call(row || {}, alias)))).map(([field]) => field);
    const items = rows.map((sourceRecord, index) => {
      const record = mapImportRow(sourceRecord);
      const signature = matchSignature(record);
      const validationErrors = [];
      if (!record.customerName) validationErrors.push('缺少客户姓名');
      if (!record.hospital) validationErrors.push('缺少医院');
      if (!record.department) validationErrors.push('缺少科室');
      if (record.perceptionLevel && !/^R[1-4]$/.test(record.perceptionLevel)) validationErrors.push('R等级必须是 R1-R4');
      const firstRow = signatures.get(signature);
      const duplicateWithinFile = Boolean(signature.replace(/\|/g, '') && firstRow);
      if (!firstRow) signatures.set(signature, index + 2);
      if (duplicateWithinFile) validationErrors.push(`Excel内部重复，第${firstRow}行已出现`);
      const match = matchMasterRecord({
        hospital: record.hospital,
        department: record.department,
        name: record.customerName
      }, masterRecords, decisions);
      const defaultAction = validationErrors.length ? 'skip' : match.matchType === 'EXACT' ? 'link' : null;
      return {
        queueId: `import_${Date.now().toString(36)}_${index + 2}_${stableId([signature, index]).slice(4)}`,
        source: 'EXCEL_IMPORT',
        rowNumber: index + 2,
        sourceRecord,
        record,
        signature,
        ...match,
        validationErrors,
        duplicateWithinFile,
        requiresConfirmation: Boolean(validationErrors.length || match.matchType !== 'EXACT'),
        recommendedAction: match.matchType === 'UNMATCHED' ? 'create' : match.matchType === 'EXACT' ? 'link' : 'review',
        action: defaultAction,
        selectedCustomerId: defaultAction === 'link' ? match.customerId : ''
      };
    });
    return {
      recognizedFields,
      totalRows: rows.length,
      items
    };
  }
  function parseCustomerWorkbook(data, xlsx) {
    if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) throw new Error('Excel 解析组件未加载');
    const workbook = xlsx.read(data, {
      type: data instanceof ArrayBuffer ? 'array' : undefined,
      cellDates: true
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel 中没有工作表');
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });
    if (!rows.length) throw new Error('Excel 中没有可导入的客户记录');
    return {
      sheetName,
      rows
    };
  }
  function importPatch(record) {
    return Object.fromEntries(Object.entries({
      customerName: record.customerName,
      aliases: record.aliases,
      hospital: record.hospital,
      hospitalAliases: record.hospitalAliases,
      department: record.department,
      departmentAliases: record.departmentAliases,
      employee: record.employee,
      owner: record.employee,
      perceptionLevel: record.perceptionLevel,
      developmentStatus: record.developmentStatus,
      currentObstacle: record.currentObstacle,
      nextAction: record.nextAction,
      nextFollowUpDate: record.nextFollowUpDate,
      notes: record.notes
    }).filter(([, value]) => Array.isArray(value) ? value.length : String(value || '').trim()));
  }
  function commitCustomerImport(analysis, masterStore, options = {}) {
    const report = {
      total: analysis.items.length,
      created: 0,
      updated: 0,
      exact: 0,
      probable: 0,
      ambiguous: 0,
      unmatched: 0,
      skipped: 0,
      errors: 0,
      pending: 0,
      rowResults: []
    };
    const queued = [];
    analysis.items.forEach(item => {
      const typeKey = item.matchType?.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(report, typeKey)) report[typeKey] += 1;
      try {
        if (item.validationErrors.length && item.action !== 'create') {
          report.errors += 1;
          report.skipped += 1;
          report.rowResults.push({
            rowNumber: item.rowNumber,
            status: 'ERROR',
            reason: item.validationErrors.join('；')
          });
          return;
        }
        if (item.action === 'skip') {
          report.skipped += 1;
          report.rowResults.push({
            rowNumber: item.rowNumber,
            status: 'SKIPPED',
            reason: item.validationErrors.join('；') || '用户跳过'
          });
          return;
        }
        if (item.action === 'link' && item.selectedCustomerId) {
          masterStore.update(item.selectedCustomerId, importPatch(item.record), {
            source: 'EXCEL_IMPORT'
          });
          if (item.matchType !== 'EXACT' || item.resolvedBy === 'MANUAL_MAPPING') options.saveDecision?.(item.signature, item.selectedCustomerId);
          report.updated += 1;
          report.rowResults.push({
            rowNumber: item.rowNumber,
            status: 'UPDATED',
            customerId: item.selectedCustomerId
          });
          return;
        }
        if (item.action === 'create') {
          const created = masterStore.create({
            ...item.record,
            source: 'EXCEL_IMPORT'
          });
          options.saveDecision?.(item.signature, created.customerId);
          report.created += 1;
          report.rowResults.push({
            rowNumber: item.rowNumber,
            status: 'CREATED',
            customerId: created.customerId
          });
          return;
        }
        queued.push(item);
        report.pending += 1;
        report.skipped += 1;
        report.rowResults.push({
          rowNumber: item.rowNumber,
          status: 'PENDING',
          reason: '等待人工匹配确认'
        });
      } catch (error) {
        report.errors += 1;
        report.rowResults.push({
          rowNumber: item.rowNumber,
          status: 'ERROR',
          reason: error.message
        });
      }
    });
    options.enqueue?.(queued);
    return report;
  }
  function hydrateProfilesFromMaster(profiles = [], masterRecords = [], decisions = {}, options = {}) {
    const byId = new Map(masterRecords.map(record => [record.customerId, record]));
    const hydrated = profiles.map(profile => {
      const identity=resolveCustomerIdentity(profile,masterRecords,decisions);
      const master=identity.status==='RESOLVED'?byId.get(identity.resolvedCustomerId):null;
      const match={matchType:identity.status==='RESOLVED'?'EXACT':([profile.customerMatchStatus,profile.matchType,profile.masterMatch?.matchType].find(v=>['UNRESOLVED','PROBABLE','AMBIGUOUS','UNMATCHED','PENDING','FUZZY'].includes(v)) || identity.status),customerId:identity.resolvedCustomerId || profile.customerId || '',resolvedBy:identity.status==='RESOLVED'?'STABLE_ID':'UNCONFIRMED'};
      const observations=[...(profile.perceptionObservations || []),{...profile,value:normalizePerceptionLevel(profile.perceptionLevel),structured:Boolean(normalizePerceptionLevel(profile.perceptionLevel)),sourceKind:'SOURCE_RECORD'},...(master?.perceptionLevel?[{customerId:master.customerId,product:null,value:master.perceptionLevel,structured:true,sourceKind:'LEGACY_MASTER'}]:[])];
      const perceptionProjection=projectPerception(observations,identity,profile.product,masterRecords,decisions);
      profile={...profile,identityProjection:identity,perceptionProjection,perceptionLevel:perceptionProjection.value || ''};
      if (!master) return {
        ...profile,
        masterMatch: match,
        masterActive: true
      };
      return {
        ...profile,
        customerId: master.customerId,
        canonicalName: master.customerName,
        aliases: master.aliases,
        employeeId: master.employeeId,
        employeeName: master.employee,
        hospitalId: master.hospitalId,
        hospitalName: master.hospital,
        hospitalAliases: master.hospitalAliases,
        departmentId: master.departmentId,
        departmentName: master.department,
        departmentAliases: master.departmentAliases,
        // A legacy master-level R is not a product-scoped observation.
        perceptionLevel: profile.perceptionLevel || '',
        masterData: master,
        masterMatch: match || {
          matchType: 'EXACT',
          confidence: 1,
          customerId: master.customerId,
          resolvedBy: 'STABLE_ID'
        },
        masterActive: master.active
      };
    });
    if (options.includeUnrepresented !== true) return hydrated;
    const represented = new Set(hydrated.map(profile => profile.customerId));
    for (const master of masterRecords) {
      if (represented.has(master.customerId) || customerMasterIdentity(master,masterRecords).status !== 'RESOLVED') continue;
      const products = master.associatedProducts?.length ? master.associatedProducts : [null];
      for (const product of products) hydrated.push({
        customerId: master.customerId,
        canonicalName: master.customerName,
        aliases: master.aliases || [],
        hospitalId: master.hospitalId,
        hospitalName: master.hospital,
        hospitalAliases: master.hospitalAliases || [],
        departmentId: master.departmentId,
        departmentName: master.department,
        departmentAliases: master.departmentAliases || [],
        employeeId: master.employeeId,
        employeeName: master.employee,
        product,
        perceptionLevel: '',
        perceptionProjection:{status:'UNKNOWN',value:null,product,observations:master.perceptionLevel?[{customerId:master.customerId,value:master.perceptionLevel,product:null,sourceKind:'LEGACY_MASTER'}]:[],reasonCodes:['NO_SCOPED_OBSERVATION']},
        currentStatus: 'UNKNOWN',
        monthlyActuals: [],
        monthlyTargets: [],
        gradeHistory: [],
        plans: [],
        resourceInvestments: [],
        activityRefs: [],
        quickNotes: [],
        customerEvents: [],
        riskFlags: [],
        lastActiveMonth: null,
        lastUpdatedAt: master.updatedAt,
        masterData: master,
        masterActive: master.active,
        masterMatch: {
          matchType: 'EXACT',
          confidence: 1,
          customerId: master.customerId,
          resolvedBy: 'STABLE_ID'
        }
      });
    }
    return hydrated;
  }
  function createCustomerPlanProvider(source = []) {
    return {
      getCustomerPlans(customerId, context = {}) {
        return (source || []).filter(plan => plan.customerId === customerId && (!context.product || plan.product === context.product) && (!context.month || plan.targetMonth === context.month));
      }
    };
  }
  function createResourceInvestmentProvider(source = []) {
    return {
      getResourceInvestments(customerId, context = {}) {
        return (source || []).filter(item => item.customerId === customerId && (!context.product || item.product === context.product));
      }
    };
  }
  function permanentRecordId(prefix, idFactory) {
    const value = typeof idFactory === 'function' ? String(idFactory()) : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    return value.startsWith(`${prefix}_`) ? value : `${prefix}_${value}`;
  }
  function normalizeDevelopmentStatus(value) {
    const input = String(value || '').trim();
    const upper = input.toUpperCase();
    if (DEVELOPMENT_STATUS[upper]) return upper;
    const direct = Object.entries(DEVELOPMENT_STATUS).find(([, item]) => item.label === input)?.[0];
    if (direct) return direct;
    if (/重点|推进/.test(input)) return 'PRIORITY';
    if (/培养|开发中/.test(input)) return 'CULTIVATING';
    if (/初步|接触/.test(input)) return 'CONTACTED';
    if (/稳定|已开发|使用/.test(input)) return 'STABLE';
    if (/可恢复|恢复机会/.test(input)) return 'RECOVERABLE';
    if (/风险/.test(input)) return 'AT_RISK';
    if (/暂停/.test(input)) return 'PAUSED';
    if (/流失/.test(input)) return 'LOST';
    return 'UNDEVELOPED';
  }
  function suggestedDevelopmentStatus(profile = {}) {
    const map = {
      ACTIVE: 'STABLE',
      GROWING: 'PRIORITY',
      UPGRADED: 'PRIORITY',
      NEW: 'CONTACTED',
      STAGNANT: 'CULTIVATING',
      DECLINING: 'AT_RISK',
      DOWNGRADED: 'AT_RISK',
      AT_RISK: 'AT_RISK',
      LOST: 'RECOVERABLE',
      RECOVERED: 'CULTIVATING',
      PAUSED: 'PAUSED',
      INSUFFICIENT_DATA: 'UNDEVELOPED'
    };
    const status = map[profile.currentStatus] || 'UNDEVELOPED';
    const rationale = profile.currentStatus === 'LOST' ? '销量经营状态显示流失，仅建议评估可恢复性，不自动修改人工开发状态。' : `根据当前销量经营状态“${statusFor(profile).label}”生成，仅供人工参考。`;
    return {
      status,
      rationale,
      source: 'SALES_STATUS_SUGGESTION',
      applied: false
    };
  }
  function createDevelopmentStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const raw = storage?.getItem(DEVELOPMENT_HISTORY_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const initialRecords = Array.isArray(parsed?.records) ? parsed.records : [];
    let records = new Map(initialRecords.filter(item => item?.customerId).map(item => [String(item.customerId), {
      customerId: String(item.customerId),
      status: normalizeDevelopmentStatus(item.status || item.developmentStatus),
      updatedAt: String(item.updatedAt || now()),
      operator: String(item.operator || ''),
      source: String(item.source || 'MIGRATED_V12'),
      legacyStatus: String(item.legacyStatus || '')
    }]));
    let history = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.history) ? parsed.history : [];
    let masterEvents = Array.isArray(parsed?.masterEvents) ? parsed.masterEvents : [];
    (options.masterRecords || []).forEach(master => {
      if (!master?.customerId || records.has(String(master.customerId))) return;
      const rawStatus = String(master.developmentStatus || '');
      records.set(String(master.customerId), {
        customerId: String(master.customerId),
        status: normalizeDevelopmentStatus(rawStatus),
        updatedAt: String(master.updatedAt || now()),
        operator: String(master.employee || ''),
        source: rawStatus ? 'MIGRATED_V1_1' : 'V12_DEFAULT',
        legacyStatus: rawStatus
      });
    });
    function persist(persistOptions = {}) {
      storage?.setItem(DEVELOPMENT_HISTORY_KEY, JSON.stringify({
        schemaVersion: V12_SCHEMA_VERSION,
        records: [...records.values()],
        history,
        masterEvents
      }));
      if (!persistOptions.silent) options.onChange?.();
    }
    if (corrupted || !parsed || Array.isArray(parsed) || (options.masterRecords || []).some(master => master?.customerId && !initialRecords.some(item => item.customerId === master.customerId))) persist();
    function get(customerId) {
      const item = records.get(String(customerId));
      return item ? {
        ...item
      } : {
        customerId: String(customerId || ''),
        status: 'UNDEVELOPED',
        updatedAt: '',
        operator: '',
        source: 'V12_DEFAULT',
        legacyStatus: ''
      };
    }
    function setStatus(customerId, newStatus, meta = {}) {
      if (!customerId) throw new Error('developmentStatus 必须绑定 customerId');
      const normalized = normalizeDevelopmentStatus(newStatus);
      const previous = get(customerId);
      const changedAt = String(meta.changedAt || now());
      if (previous.status === normalized && records.has(String(customerId))) return {
        record: previous,
        event: null
      };
      const record = {
        customerId: String(customerId),
        status: normalized,
        updatedAt: changedAt,
        operator: String(meta.operator || ''),
        source: String(meta.source || 'MANUAL_STATUS'),
        legacyStatus: previous.legacyStatus || ''
      };
      records.set(String(customerId), record);
      const event = {
        eventId: permanentRecordId('dev', options.idFactory),
        customerId: String(customerId),
        previousStatus: previous.status || '',
        newStatus: normalized,
        changedAt,
        operator: record.operator,
        source: record.source,
        reason: String(meta.reason || '人工调整开发状态')
      };
      history = [event, ...history];
      persist();
      return {
        record: {
          ...record
        },
        event: {
          ...event
        }
      };
    }
    function recordMasterChange(customerId, previous = {}, next = {}, meta = {}) {
      const ignored = new Set(['updatedAt', 'source']);
      const fields = [...new Set([...Object.keys(previous || {}), ...Object.keys(next || {})])].filter(field => !ignored.has(field) && JSON.stringify(previous?.[field]) !== JSON.stringify(next?.[field]));
      if (!fields.length) return null;
      const event = {
        eventId: permanentRecordId('mst', options.idFactory),
        customerId: String(customerId),
        changedAt: String(meta.changedAt || now()),
        operator: String(meta.operator || next.employee || ''),
        source: String(meta.source || 'LOCAL_MASTER'),
        fields
      };
      masterEvents = [event, ...masterEvents];
      persist();
      return {
        ...event,
        fields: [...fields]
      };
    }
    function exportState() {
      return {
        records: [...records.values()].map(item => ({
          ...item
        })),
        history: history.map(item => ({
          ...item
        })),
        masterEvents: masterEvents.map(item => ({
          ...item,
          fields: [...(item.fields || [])]
        }))
      };
    }
    function replace(nextState = {}, replaceOptions = {}) {
      records = new Map((nextState.records || []).filter(item => item?.customerId).map(item => [String(item.customerId), {
        ...item,
        customerId: String(item.customerId),
        status: normalizeDevelopmentStatus(item.status || item.developmentStatus)
      }]));
      history = (nextState.history || []).map(item => ({
        ...item
      }));
      masterEvents = (nextState.masterEvents || []).map(item => ({
        ...item,
        fields: [...(item.fields || [])]
      }));
      persist({
        silent: Boolean(replaceOptions.silent)
      });
      return exportState();
    }
    return {
      get,
      setStatus,
      recordMasterChange,
      listHistory(customerId) {
        return history.filter(item => !customerId || item.customerId === customerId).map(item => ({
          ...item
        }));
      },
      listMasterEvents(customerId) {
        return masterEvents.filter(item => !customerId || item.customerId === customerId).map(item => ({
          ...item,
          fields: [...(item.fields || [])]
        }));
      },
      exportState,
      replace,
      persist,
      storageKey: DEVELOPMENT_HISTORY_KEY,
      schemaVersion: V12_SCHEMA_VERSION
    };
  }
  function normalizeFollowUp(input = {}, options = {}) {
    const now = String(options.now || new Date().toISOString());
    const product = PRODUCTS.includes(String(input.product || '').trim()) ? String(input.product).trim() : null;
    const followUpType = FOLLOW_UP_TYPES[input.followUpType] ? input.followUpType : 'OTHER';
    return {
      followUpId: String(input.followUpId || permanentRecordId('fup', options.idFactory)),
      customerId: String(input.customerId || ''),
      product,
      followUpType,
      followUpAt: String(input.followUpAt || now),
      employeeId: String(input.employeeId || input.owner || ''),
      owner: String(input.owner || input.employeeId || ''),
      content: String(input.content || '').trim(),
      customerFeedback: String(input.customerFeedback || '').trim(),
      currentObstacle: String(input.currentObstacle || '').trim(),
      nextAction: String(input.nextAction || '').trim(),
      nextFollowUpDate: String(input.nextFollowUpDate || '').slice(0, 10),
      createdAt: String(input.createdAt || now),
      updatedAt: String(input.updatedAt || now),
      source: String(input.source || 'LOCAL_FOLLOWUP'),
      sourceNoteId: String(input.sourceNoteId || ''),
      sourceTaskId: String(input.sourceTaskId || ''),
      deletedAt: input.deletedAt ? String(input.deletedAt) : null
    };
  }
  function validateFollowUp(record) {
    const errors = [];
    if (!record.customerId) errors.push('跟进记录必须绑定 customerId');
    if (!FOLLOW_UP_TYPES[record.followUpType]) errors.push('跟进类型无效');
    if (!record.followUpAt || Number.isNaN(new Date(record.followUpAt).getTime())) errors.push('跟进时间无效');
    if (!record.content) errors.push('跟进内容不能为空');
    if (record.product && !PRODUCTS.includes(record.product)) errors.push('产品必须为空或为已配置产品');
    return errors;
  }
  function createFollowUpStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const raw = storage?.getItem(FOLLOWUP_STORAGE_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const sourceRecords = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
    let records = sourceRecords.map(item => normalizeFollowUp(item, {
      now: item.updatedAt || now(),
      idFactory: options.idFactory
    }));
    function persist(persistOptions = {}) {
      storage?.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify({
        schemaVersion: V12_SCHEMA_VERSION,
        records
      }));
      if (!persistOptions.silent) options.onChange?.();
    }
    if (corrupted || Array.isArray(parsed)) persist();
    function clone(item) {
      return item ? {
        ...item
      } : null;
    }
    function get(followUpId) {
      return clone(records.find(item => item.followUpId === followUpId));
    }
    function list(listOptions = {}) {
      return records.filter(item => {
        if (!listOptions.includeDeleted && item.deletedAt) return false;
        if (listOptions.customerId && item.customerId !== listOptions.customerId) return false;
        if (Object.prototype.hasOwnProperty.call(listOptions, 'product') && item.product !== listOptions.product) return false;
        return true;
      }).map(clone).sort((a, b) => String(b.followUpAt).localeCompare(String(a.followUpAt)));
    }
    function create(input) {
      const record = normalizeFollowUp({
        ...input,
        source: input.source || 'LOCAL_FOLLOWUP'
      }, {
        now: now(),
        idFactory: options.idFactory
      });
      const errors = validateFollowUp(record);
      if (errors.length) throw new Error(errors.join('；'));
      if (records.some(item => item.followUpId === record.followUpId)) throw new Error('followUpId 已存在');
      records.push(record);
      persist();
      return clone(record);
    }
    function update(followUpId, patch = {}) {
      const index = records.findIndex(item => item.followUpId === followUpId);
      if (index < 0) throw new Error('跟进记录不存在');
      const previous = records[index];
      const record = normalizeFollowUp({
        ...previous,
        ...patch,
        followUpId: previous.followUpId,
        customerId: previous.customerId,
        createdAt: previous.createdAt,
        updatedAt: now()
      }, {
        now: now(),
        idFactory: options.idFactory
      });
      const errors = validateFollowUp(record);
      if (errors.length) throw new Error(errors.join('；'));
      records[index] = record;
      persist();
      return clone(record);
    }
    function softDelete(followUpId) {
      return update(followUpId, {
        deletedAt: now(),
        source: 'LOCAL_FOLLOWUP_DELETE'
      });
    }
    function restore(followUpId) {
      return update(followUpId, {
        deletedAt: null,
        source: 'LOCAL_FOLLOWUP_RESTORE'
      });
    }
    function replace(nextRecords = [], replaceOptions = {}) {
      records = nextRecords.map(item => normalizeFollowUp(item, {
        now: item.updatedAt || now(),
        idFactory: options.idFactory
      }));
      persist({
        silent: Boolean(replaceOptions.silent)
      });
      return list({
        includeDeleted: true
      });
    }
    return {
      list,
      get,
      create,
      update,
      softDelete,
      restore,
      replace,
      persist,
      storageKey: FOLLOWUP_STORAGE_KEY,
      schemaVersion: V12_SCHEMA_VERSION
    };
  }
  function convertQuickNoteToFollowUp(note, input, followUpStore) {
    if (!note || !followUpStore?.create) throw new Error('快速记录或跟进仓库不可用');
    return followUpStore.create({
      ...input,
      customerId: input?.customerId || note.customerId,
      product: Object.prototype.hasOwnProperty.call(input || {}, 'product') ? input.product : note.product,
      followUpAt: input?.followUpAt || note.date,
      content: input?.content || note.detail,
      source: 'QUICK_NOTE_CONVERSION',
      sourceNoteId: note.id
    });
  }
  function dateOnly(value) {
    const text = String(value || '');
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
  }
  function isFollowUpOverdue(nextFollowUpDate, followUps = [], referenceDate = new Date()) {
    const due = dateOnly(nextFollowUpDate);
    const today = dateOnly(referenceDate instanceof Date ? referenceDate.toISOString() : referenceDate);
    if (!due || !today || due >= today) return false;
    return !(followUps || []).some(item => !item.deletedAt && [item.followUpAt, item.updatedAt].map(dateOnly).some(value => value && value >= due));
  }
  function insightRecordText(record = {}) {
    return [record.content, record.customerFeedback, record.currentObstacle, record.nextAction, record.detail].map(item => String(item || '').trim()).filter(Boolean).join('；');
  }
  function normalizeEvidence(items = []) {
    return (Array.isArray(items) ? items : splitList(items)).map((item, index) => typeof item === 'string' ? {
      recordId: `evidence_${index + 1}`,
      quote: item.trim().slice(0, 160),
      recordedAt: '',
      source: 'USER_RECORD'
    } : {
      recordId: String(item.recordId || `evidence_${index + 1}`),
      quote: String(item.quote || item.text || '').trim().slice(0, 160),
      recordedAt: String(item.recordedAt || item.followUpAt || ''),
      source: String(item.source || 'USER_RECORD')
    }).filter(item => item.quote);
  }
  function normalizeInsight(input = {}, options = {}) {
    const now = String(options.now || new Date().toISOString());
    const insight = {
      customerId: String(input.customerId || ''),
      ...Object.fromEntries(INSIGHT_FIELDS.map(field => [field, String(input[field] || '').trim()])),
      evidence: normalizeEvidence(input.evidence),
      generatedAt: String(input.generatedAt || now),
      updatedAt: String(input.updatedAt || now),
      source: String(input.source || 'LOCAL_DETERMINISTIC_PROVIDER'),
      reviewStatus: input.reviewStatus === 'HUMAN_CONFIRMED' ? 'HUMAN_CONFIRMED' : 'AI_SUGGESTED',
      providerMode: String(input.providerMode || 'LOCAL_MOCK')
    };
    return insight;
  }
  function validateInsightOutput(input = {}) {
    const sensitivePattern = /(精神病|抑郁症|人格障碍|双相障碍|性别推断|民族推断|宗教信仰|政治倾向|医疗诊断)/i;
    const text = INSIGHT_FIELDS.map(field => String(input[field] || '')).join('|');
    if (sensitivePattern.test(text)) throw new Error('洞察包含禁止的敏感属性或医疗诊断推断');
    const hasContent = INSIGHT_FIELDS.some(field => String(input[field] || '').trim());
    if (hasContent && !normalizeEvidence(input.evidence).length) throw new Error('沟通洞察必须包含来自实际记录的依据');
    return true;
  }
  function createLocalCustomerInsightProvider(options = {}) {
    const now = options.now || (() => new Date().toISOString());
    return {
      providerId: 'local-deterministic-v1',
      providerMode: 'LOCAL_MOCK',
      label: '本地规则建议（非线上 AI）',
      async generateInsights(customerId, records = [], context = {}) {
        const usable = (records || []).map((record, index) => ({
          ...record,
          recordId: record.followUpId || record.id || `record_${index + 1}`,
          text: insightRecordText(record)
        })).filter(record => record.text);
        if (!usable.length) throw new Error('请先输入或保存至少一条客户沟通记录');
        const latest = usable[0];
        const channelCounts = usable.reduce((counts, record) => {
          const key = record.followUpType || 'OTHER';
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {});
        const primaryType = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const objection = usable.find(record => /(顾虑|担心|暂不|拒绝|价格|流程|库存|竞品|不确定)/.test(record.text));
        const obstacle = usable.find(record => record.currentObstacle)?.currentObstacle || context.currentObstacle || '';
        const nextAction = usable.find(record => record.nextAction)?.nextAction || context.nextAction || '';
        const evidence = normalizeEvidence(usable.slice(0, 4).map(record => ({
          recordId: record.recordId,
          quote: record.text,
          recordedAt: record.followUpAt || record.date,
          source: record.source || 'USER_RECORD'
        })));
        const result = normalizeInsight({
          customerId,
          communicationPreference: primaryType ? `现有记录以“${FOLLOW_UP_TYPES[primaryType] || '其他沟通'}”为主，建议继续使用已验证的沟通渠道。` : '沟通渠道记录不足，建议继续补充实际互动。',
          keyConcerns: latest.customerFeedback || latest.currentObstacle || latest.text,
          expressedObjections: objection ? objection.text : '当前记录中尚未发现明确顾虑，需在下次沟通中直接确认。',
          decisionPattern: usable.some(record => ['DEPARTMENT_MEETING', 'CASE_DISCUSSION'].includes(record.followUpType)) ? '记录显示科室讨论或病例讨论是当前推进节点。' : '现有记录不足以形成稳定推进特征，建议继续记录关键决策节点。',
          currentDifficulty: obstacle || '当前记录未明确推进难点，建议下次沟通直接确认。',
          recommendedApproach: nextAction || '围绕已记录的关注点逐项确认，不扩大到未记录的个人属性。',
          nextConversationSuggestion: nextAction || `从“${latest.text.slice(0, 60)}”继续追问具体条件和下一步。`,
          evidence,
          generatedAt: now(),
          updatedAt: now(),
          source: 'LOCAL_DETERMINISTIC_PROVIDER',
          reviewStatus: 'AI_SUGGESTED',
          providerMode: 'LOCAL_MOCK'
        }, {
          now: now()
        });
        validateInsightOutput(result);
        return result;
      }
    };
  }
  function createCustomerInsightStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const raw = storage?.getItem(INSIGHT_STORAGE_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const sourceRecords = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : parsed && !parsed.schemaVersion ? Object.values(parsed) : [];
    let records = sourceRecords.filter(item => item?.customerId).map(item => normalizeInsight(item, {
      now: item.updatedAt || now()
    }));
    function persist() {
      storage?.setItem(INSIGHT_STORAGE_KEY, JSON.stringify({
        schemaVersion: V12_SCHEMA_VERSION,
        records
      }));
    }
    if (corrupted || Array.isArray(parsed) || parsed && !parsed.schemaVersion) persist();
    function get(customerId) {
      const item = records.find(record => record.customerId === customerId);
      return item ? {
        ...item,
        evidence: item.evidence.map(evidence => ({
          ...evidence
        }))
      } : null;
    }
    function upsert(input, updateOptions = {}) {
      const previous = get(input.customerId);
      const normalized = normalizeInsight({
        ...previous,
        ...input,
        generatedAt: input.generatedAt || previous?.generatedAt || now(),
        updatedAt: now(),
        reviewStatus: updateOptions.reviewStatus || input.reviewStatus || previous?.reviewStatus
      }, {
        now: now()
      });
      if (!normalized.customerId) throw new Error('沟通洞察必须绑定 customerId');
      validateInsightOutput(normalized);
      records = [...records.filter(record => record.customerId !== normalized.customerId), normalized];
      persist();
      return get(normalized.customerId);
    }
    return {
      get,
      upsert,
      list: () => records.map(item => get(item.customerId)),
      persist,
      storageKey: INSIGHT_STORAGE_KEY,
      schemaVersion: V12_SCHEMA_VERSION
    };
  }
  function normalizeRelationship(input = {}, options = {}) {
    const now = String(options.now || new Date().toISOString());
    return {
      relationshipId: String(input.relationshipId || permanentRecordId('rel', options.idFactory)),
      sourceCustomerId: String(input.sourceCustomerId || ''),
      targetCustomerId: String(input.targetCustomerId || ''),
      relationshipScope: RELATIONSHIP_SCOPES[input.relationshipScope] ? input.relationshipScope : 'IN_HOSPITAL',
      relationshipType: RELATIONSHIP_TYPES[input.relationshipType] ? input.relationshipType : 'OTHER',
      strength: RELATIONSHIP_STRENGTHS[input.strength] ? input.strength : 'NORMAL',
      description: String(input.description || '').trim(),
      directed: input.directed !== false,
      source: String(input.source || 'LOCAL_RELATIONSHIP'),
      createdAt: String(input.createdAt || now),
      updatedAt: String(input.updatedAt || now),
      active: input.active !== false && !input.deletedAt,
      deletedAt: input.deletedAt ? String(input.deletedAt) : null
    };
  }
  function relationshipFingerprint(input = {}) {
    const directed = input.directed !== false;
    const endpoints = directed ? [input.sourceCustomerId, input.targetCustomerId] : [input.sourceCustomerId, input.targetCustomerId].sort();
    return [...endpoints, input.relationshipScope, input.relationshipType, directed ? 'directed' : 'undirected'].join('|');
  }
  function validateRelationship(record, customerExists = () => true) {
    const errors = [];
    if (!record.sourceCustomerId || !record.targetCustomerId) errors.push('关系必须选择两个客户');
    if (record.sourceCustomerId && record.sourceCustomerId === record.targetCustomerId) errors.push('不能与自己建立关系');
    if (record.sourceCustomerId && !customerExists(record.sourceCustomerId)) errors.push('来源客户不存在');
    if (record.targetCustomerId && !customerExists(record.targetCustomerId)) errors.push('目标客户不存在');
    if (!RELATIONSHIP_SCOPES[record.relationshipScope]) errors.push('关系范围无效');
    if (!RELATIONSHIP_TYPES[record.relationshipType]) errors.push('关系类型无效');
    if (!RELATIONSHIP_STRENGTHS[record.strength]) errors.push('关系强度无效');
    return errors;
  }
  function createRelationshipStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const customerIds = new Set((options.customers || []).map(item => String(item.customerId || item)));
    const customerExists = typeof options.customerExists === 'function' ? options.customerExists : customerId => customerIds.has(String(customerId));
    const raw = storage?.getItem(RELATIONSHIP_STORAGE_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const sourceRecords = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : options.seedRecords || [];
    let records = sourceRecords.filter(item => item?.sourceCustomerId && item?.targetCustomerId).map(item => normalizeRelationship(item, {
      now: item.updatedAt || now(),
      idFactory: options.idFactory
    }));
    function clone(item) {
      return item ? {
        ...item
      } : null;
    }
    function persist() {
      storage?.setItem(RELATIONSHIP_STORAGE_KEY, JSON.stringify({
        schemaVersion: V13_SCHEMA_VERSION,
        records
      }));
    }
    if (corrupted || Array.isArray(parsed) || !raw && records.length) persist();
    function get(relationshipId) {
      return clone(records.find(item => item.relationshipId === relationshipId));
    }
    function list(listOptions = {}) {
      return records.filter(item => {
        if (!listOptions.includeDeleted && item.deletedAt) return false;
        if (listOptions.customerId && ![item.sourceCustomerId, item.targetCustomerId].includes(listOptions.customerId)) return false;
        if (listOptions.relationshipScope && item.relationshipScope !== listOptions.relationshipScope) return false;
        return true;
      }).map(clone).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }
    function duplicateOf(record, excludingId = '') {
      return records.find(item => item.relationshipId !== excludingId && relationshipFingerprint(item) === relationshipFingerprint(record));
    }
    function create(input) {
      const record = normalizeRelationship(input, {
        now: now(),
        idFactory: options.idFactory
      });
      const errors = validateRelationship(record, customerExists);
      if (errors.length) throw new Error(errors.join('；'));
      if (records.some(item => item.relationshipId === record.relationshipId)) throw new Error('relationshipId 已存在');
      if (duplicateOf(record)) throw new Error('完全重复关系已存在；如已删除，请恢复原关系');
      records.push(record);
      persist();
      return clone(record);
    }
    function update(relationshipId, patch = {}) {
      const index = records.findIndex(item => item.relationshipId === relationshipId);
      if (index < 0) throw new Error('关系不存在');
      const previous = records[index];
      const record = normalizeRelationship({
        ...previous,
        ...patch,
        relationshipId: previous.relationshipId,
        createdAt: previous.createdAt,
        updatedAt: now()
      }, {
        now: now(),
        idFactory: options.idFactory
      });
      const errors = validateRelationship(record, customerExists);
      if (errors.length) throw new Error(errors.join('；'));
      if (duplicateOf(record, relationshipId)) throw new Error('完全重复关系已存在');
      records[index] = record;
      persist();
      return clone(record);
    }
    function softDelete(relationshipId) {
      return update(relationshipId, {
        active: false,
        deletedAt: now(),
        source: 'LOCAL_RELATIONSHIP_DELETE'
      });
    }
    function restore(relationshipId) {
      return update(relationshipId, {
        active: true,
        deletedAt: null,
        source: 'LOCAL_RELATIONSHIP_RESTORE'
      });
    }
    function seed(seedRecords = []) {
      if (records.length || !seedRecords.length) return false;
      records = seedRecords.map(item => normalizeRelationship(item, {
        now: item.updatedAt || now(),
        idFactory: options.idFactory
      }));
      persist();
      return true;
    }
    return {
      list,
      get,
      create,
      update,
      softDelete,
      restore,
      seed,
      persist,
      storageKey: RELATIONSHIP_STORAGE_KEY,
      schemaVersion: V13_SCHEMA_VERSION
    };
  }
  function createRelationshipLayoutStore(options = {}) {
    const storage = options.storage;
    const raw = storage?.getItem(RELATIONSHIP_LAYOUT_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const compatible = parsed?.schemaVersion === RELATIONSHIP_LAYOUT_SCHEMA_VERSION && parsed?.primaryAxis === RELATIONSHIP_LAYOUT_PRIMARY_AXIS;
    let model = {
      schemaVersion: RELATIONSHIP_LAYOUT_SCHEMA_VERSION,
      primaryAxis: RELATIONSHIP_LAYOUT_PRIMARY_AXIS,
      positions: compatible ? {
        horizon: {
          ...(parsed?.positions?.horizon || {})
        },
        planet: {
          ...(parsed?.positions?.planet || {})
        }
      } : {
        horizon: {},
        planet: {}
      },
      viewState: parsed?.viewState && typeof parsed.viewState === 'object' ? {
        ...parsed.viewState
      } : {}
    };
    function persist() {
      storage?.setItem(RELATIONSHIP_LAYOUT_KEY, JSON.stringify(model));
    }
    if (corrupted || raw && !compatible) persist();
    function position(viewMode, customerId) {
      const point = model.positions[viewMode]?.[customerId];
      return point ? {
        x: finite(point.x),
        y: finite(point.y)
      } : null;
    }
    function setPosition(viewMode, customerId, point) {
      if (!['horizon', 'planet'].includes(viewMode) || !customerId) throw new Error('布局位置缺少视图或 customerId');
      model.positions[viewMode][customerId] = {
        x: Math.round(finite(point.x)),
        y: Math.round(finite(point.y))
      };
      persist();
      return position(viewMode, customerId);
    }
    function reset(viewMode) {
      if (!['horizon', 'planet'].includes(viewMode)) return;
      model.positions[viewMode] = {};
      persist();
    }
    function getPositions(viewMode) {
      return JSON.parse(JSON.stringify(model.positions[viewMode] || {}));
    }
    function saveViewState(viewState = {}) {
      model.viewState = {
        ...model.viewState,
        ...viewState
      };
      persist();
      return getViewState();
    }
    function getViewState() {
      return JSON.parse(JSON.stringify(model.viewState));
    }
    return {
      position,
      setPosition,
      reset,
      getPositions,
      saveViewState,
      getViewState,
      persist,
      storageKey: RELATIONSHIP_LAYOUT_KEY,
      schemaVersion: RELATIONSHIP_LAYOUT_SCHEMA_VERSION,
      primaryAxis: RELATIONSHIP_LAYOUT_PRIMARY_AXIS
    };
  }
  function normalizeProfessionalTitle(input = {}, options = {}) {
    const now = String(options.now || new Date().toISOString());
    return {
      titleId: String(input.titleId || permanentRecordId('title', options.idFactory)),
      title: String(input.title || '').trim(),
      organization: String(input.organization || '').trim(),
      level: String(input.level || 'OTHER').trim().toUpperCase(),
      source: String(input.source || 'MANUAL'),
      verifiedAt: String(input.verifiedAt || '').slice(0, 10),
      notes: String(input.notes || '').trim(),
      createdAt: String(input.createdAt || now),
      updatedAt: String(input.updatedAt || now)
    };
  }
  function createProfessionalProfileStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const raw = storage?.getItem(PROFESSIONAL_PROFILE_STORAGE_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const sourceRecords = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
    let records = sourceRecords.filter(item => item?.customerId).map(item => ({
      customerId: String(item.customerId),
      administrativeTitles: (item.administrativeTitles || []).map(title => normalizeProfessionalTitle(title, {
        now: title.updatedAt || now(),
        idFactory: options.idFactory
      })),
      academicTitles: (item.academicTitles || []).map(title => normalizeProfessionalTitle(title, {
        now: title.updatedAt || now(),
        idFactory: options.idFactory
      })),
      updatedAt: String(item.updatedAt || now()),
      source: String(item.source || 'MANUAL')
    }));
    function persist() {
      storage?.setItem(PROFESSIONAL_PROFILE_STORAGE_KEY, JSON.stringify({
        schemaVersion: V13_SCHEMA_VERSION,
        records
      }));
    }
    if (corrupted || Array.isArray(parsed)) persist();
    function clone(record) {
      return record ? {
        ...record,
        administrativeTitles: record.administrativeTitles.map(item => ({
          ...item
        })),
        academicTitles: record.academicTitles.map(item => ({
          ...item
        }))
      } : null;
    }
    function get(customerId) {
      return clone(records.find(item => item.customerId === customerId)) || {
        customerId: String(customerId || ''),
        administrativeTitles: [],
        academicTitles: [],
        updatedAt: '',
        source: 'MANUAL'
      };
    }
    function upsert(input = {}) {
      const customerId = String(input.customerId || '');
      if (!customerId) throw new Error('职业信息必须绑定 customerId');
      const previous = get(customerId);
      const normalizeTitles = items => (items || []).map(item => normalizeProfessionalTitle(item, {
        now: item.updatedAt || now(),
        idFactory: options.idFactory
      })).filter(item => item.title);
      const record = {
        customerId,
        administrativeTitles: normalizeTitles(input.administrativeTitles ?? previous.administrativeTitles),
        academicTitles: normalizeTitles(input.academicTitles ?? previous.academicTitles),
        updatedAt: now(),
        source: String(input.source || 'MANUAL')
      };
      records = [...records.filter(item => item.customerId !== customerId), record];
      persist();
      return get(customerId);
    }
    return {
      get,
      upsert,
      list: () => records.map(clone),
      persist,
      storageKey: PROFESSIONAL_PROFILE_STORAGE_KEY,
      schemaVersion: V13_SCHEMA_VERSION
    };
  }
  function createCustomerProfessionalProfileProvider(options = {}) {
    return {
      providerId: 'local-professional-placeholder-v1',
      providerMode: 'LOCAL_PLACEHOLDER',
      label: '手工录入（未接入在线查询）',
      async lookup(customer, context = {}) {
        return {
          customerId: String(customer?.customerId || ''),
          administrativeTitles: context.administrativeTitles || [],
          academicTitles: context.academicTitles || [],
          providerMode: 'LOCAL_PLACEHOLDER',
          source: 'MANUAL_OR_LOCAL',
          verified: false
        };
      }
    };
  }
  function createCustomerImageStore(options = {}) {
    const databaseName = options.databaseName || CUSTOMER_IMAGE_DB_NAME;
    const storeName = options.storeName || CUSTOMER_IMAGE_STORE_NAME;
    const maxBytes = options.maxBytes || 1_600_000;
    const indexedDb = options.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    const memory = options.memory || new Map();
    let databasePromise = null;
    function openDatabase() {
      if (!indexedDb) return Promise.resolve(null);
      if (databasePromise) return databasePromise;
      databasePromise = new Promise(resolve => {
        try {
          const request = indexedDb.open(databaseName, V13_SCHEMA_VERSION);
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, {
              keyPath: 'customerId'
            });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      return databasePromise;
    }
    function requestResult(mode, action) {
      return openDatabase().then(database => {
        if (!database) return null;
        return new Promise(resolve => {
          try {
            const request = action(database.transaction(storeName, mode).objectStore(storeName));
            request.onsuccess = () => resolve(request.result ?? true);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      });
    }
    async function put(customerId, blob) {
      const id = String(customerId || '');
      if (!id) throw new Error('客户图片必须绑定 customerId');
      if (!blob || !/^image\/(jpeg|png|webp)$/.test(String(blob.type || ''))) throw new Error('仅支持 JPG、PNG 或 WebP 图片');
      if (finite(blob.size) > maxBytes) throw new Error('压缩后的客户图片仍然过大');
      const record = {
        customerId: id,
        blob,
        type: blob.type,
        updatedAt: new Date().toISOString(),
        schemaVersion: V13_SCHEMA_VERSION
      };
      memory.set(id, record);
      await requestResult('readwrite', store => store.put(record));
      return {
        ...record
      };
    }
    async function get(customerId) {
      const id = String(customerId || '');
      if (memory.has(id)) return {
        ...memory.get(id)
      };
      const result = await requestResult('readonly', store => store.get(id));
      if (result) memory.set(id, result);
      return result ? {
        ...result
      } : null;
    }
    async function remove(customerId) {
      const id = String(customerId || '');
      memory.delete(id);
      await requestResult('readwrite', store => store.delete(id));
      return true;
    }
    return {
      put,
      get,
      remove,
      databaseName,
      storeName,
      schemaVersion: V13_SCHEMA_VERSION,
      maxBytes
    };
  }
  async function prepareCustomerImage(file, options = {}) {
    const maxInputBytes = options.maxInputBytes || 8_000_000;
    const maxOutputBytes = options.maxOutputBytes || 1_600_000;
    const maxDimension = options.maxDimension || 640;
    if (!file || !/^image\/(jpeg|png|webp)$/.test(String(file.type || ''))) throw new Error('请选择 JPG、PNG 或 WebP 图片');
    if (finite(file.size) > maxInputBytes) throw new Error('原图不能超过 8 MB');
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
      if (finite(file.size) > maxOutputBytes) throw new Error('当前环境无法压缩此图片，请选择更小文件');
      return file;
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
    if (!blob || blob.size > maxOutputBytes) throw new Error('图片压缩失败或压缩后仍然过大');
    return blob;
  }
  function professionalLevelWeight(level) {
    return {
      NATIONAL: 5,
      PROVINCIAL: 4,
      CITY: 3,
      HOSPITAL: 2,
      DEPARTMENT: 1,
      OTHER: 1
    }[String(level || '').toUpperCase()] || 1;
  }
  function calculateCustomerImportance(customer = {}, relationships = [], professional = {}, context = {}) {
    const administrative = professional.administrativeTitles || [];
    const academic = professional.academicTitles || [];
    const grade = String(customer.salesGrade || customer.grade || customer.currentSalesGrade || 'D');
    const perception = String(customer.perceptionLevel || 'R1');
    const degree = (relationships || []).filter(item => !item.deletedAt && [item.sourceCustomerId, item.targetCustomerId].includes(customer.customerId)).length;
    const adminWeight = administrative.reduce((max, item) => Math.max(max, professionalLevelWeight(item.level)), 0);
    const academicWeight = academic.reduce((max, item) => Math.max(max, professionalLevelWeight(item.level)), 0);
    const risk = ['AT_RISK', 'LOST', 'DECLINING', 'DOWNGRADED'].includes(customer.currentStatus) || context.overdue;
    const score = adminWeight * 12 + academicWeight * 8 + (SALES_GRADE_ORDER[grade] || 0) * 7 + (Number(perception.slice(1)) || 1) * 4 + (customer.developmentStatus === 'PRIORITY' ? 16 : 0) + Math.min(15, degree * 3) + (risk ? 5 : 0);
    const reasons = [];
    if (administrative.length) reasons.push(`行政职务：${administrative[0].title}`);
    if (academic.length) reasons.push(`学术任职：${academic[0].title}`);
    if (grade) reasons.push(`销量等级 ${grade}`);
    if (perception) reasons.push(`观念等级 ${perception}`);
    if (customer.developmentStatus === 'PRIORITY') reasons.push('人工标记重点推进');
    if (degree) reasons.push(`连接 ${degree} 位客户`);
    if (risk) reasons.push('当前经营或跟进风险');
    return {
      customerId: customer.customerId,
      importanceScore: score,
      importanceLevel: score >= 68 ? 'HIGH' : score >= 36 ? 'MEDIUM' : 'NORMAL',
      reasons
    };
  }
  function sortCustomersByImportance(customers = [], relationships = [], professionalProfiles = [], contextByCustomer = {}) {
    const profiles = new Map((professionalProfiles || []).map(item => [item.customerId, item]));
    return customers.map(customer => ({
      ...customer,
      importance: calculateCustomerImportance(customer, relationships, profiles.get(customer.customerId) || {}, contextByCustomer[customer.customerId] || {})
    })).sort((a, b) => b.importance.importanceScore - a.importance.importanceScore || String(a.customerName || '').localeCompare(String(b.customerName || ''), 'zh-CN'));
  }
  function filterRelationshipGraph(customers = [], relationships = [], filters = {}) {
    const selected = (value, allowed) => !Array.isArray(allowed) || !allowed.length || allowed.includes(value);
    const scopeRelations = relationships.filter(item => !item.deletedAt && (!filters.relationshipScope || filters.relationshipScope === 'all' || item.relationshipScope === filters.relationshipScope) && (!filters.primaryOnly || item.strength === 'STRONG'));
    const connected = new Set(scopeRelations.flatMap(item => [item.sourceCustomerId, item.targetCustomerId]));
    const visibleCustomers = customers.filter(customer => {
      if (filters.hospital && filters.hospital !== 'all' && ![customer.hospitalId, customer.hospital].includes(filters.hospital)) return false;
      if (filters.department && filters.department !== 'all' && ![customer.departmentId, customer.department].includes(filters.department)) return false;
      if (!selected(customer.salesGrade, filters.grades)) return false;
      if (!selected(customer.perceptionLevel, filters.perceptionLevels)) return false;
      if (filters.developmentStatus && filters.developmentStatus !== 'all' && customer.developmentStatus !== filters.developmentStatus) return false;
      if (filters.currentStatus && filters.currentStatus !== 'all' && customer.currentStatus !== filters.currentStatus) return false;
      if (filters.hasRelationship === 'yes' && !connected.has(customer.customerId)) return false;
      if (filters.hasRelationship === 'no' && connected.has(customer.customerId)) return false;
      if (filters.importantOnly && customer.importance?.importanceLevel !== 'HIGH') return false;
      return true;
    });
    const visibleIds = new Set(visibleCustomers.map(item => item.customerId));
    return {
      customers: visibleCustomers,
      relationships: scopeRelations.filter(item => visibleIds.has(item.sourceCustomerId) && visibleIds.has(item.targetCustomerId))
    };
  }
  function createRelationshipLayout(customers = [], relationships = [], viewMode = 'horizon', options = {}) {
    const stored = options.storedPositions || {};
    const positions = {};
    const groups = [];
    const byHospital = new Map();
    customers.forEach(customer => {
      const key = customer.hospitalId || customer.hospital || 'unknown';
      if (!byHospital.has(key)) byHospital.set(key, {
        hospitalId: key,
        hospital: customer.hospital || '未填写医院',
        customers: []
      });
      byHospital.get(key).customers.push(customer);
    });
    const hospitals = [...byHospital.values()];
    let cursorX = 40;
    let height = viewMode === 'horizon' ? 420 : 440;
    hospitals.forEach((group, hospitalIndex) => {
      if (viewMode === 'horizon') {
        const departments = new Map();
        group.customers.forEach(customer => {
          const key = customer.departmentId || customer.department || 'unknown';
          if (!departments.has(key)) departments.set(key, {
            departmentId: key,
            department: customer.department || '未填写科室',
            customers: []
          });
          departments.get(key).customers.push(customer);
        });
        let departmentX = cursorX + 28;
        const departmentGroups = [];
        [...departments.values()].forEach(departmentGroup => {
          const columns = Math.max(1, Math.ceil(departmentGroup.customers.length / 2));
          const departmentWidth = Math.max(252, columns * 132 + 54);
          departmentGroup.customers.forEach((customer, index) => {
            positions[customer.customerId] = stored[customer.customerId] || {
              x: departmentX + 78 + Math.floor(index / 2) * 132,
              y: 180 + index % 2 * 82
            };
          });
          departmentGroups.push({
            ...departmentGroup,
            x: departmentX,
            y: 112,
            width: departmentWidth,
            height: 224
          });
          departmentX += departmentWidth + 16;
        });
        const groupWidth = Math.max(340, departmentX - cursorX + 12);
        groups.push({
          ...group,
          departments: departmentGroups,
          x: cursorX,
          y: 54,
          width: groupWidth,
          height: 310
        });
        cursorX += groupWidth + 28;
      } else {
        const columns = Math.max(1, Math.ceil(group.customers.length / 2));
        const groupWidth = Math.max(600, columns * 142 + 170);
        const groupX = cursorX;
        const groupY = 40;
        group.customers.forEach((customer, index) => {
          const nodeColumn = Math.floor(index / 2);
          const nodeRow = index % 2;
          const offset = nodeRow ? 22 : 0;
          positions[customer.customerId] = stored[customer.customerId] || {
            x: groupX + 78 + nodeColumn * 142 + offset,
            y: groupY + 112 + nodeRow * 92
          };
        });
        groups.push({
          ...group,
          departments: [],
          x: groupX,
          y: groupY,
          width: groupWidth,
          height: 330
        });
        cursorX += groupWidth + 28;
      }
    });
    const width = Math.max(900, cursorX + 40);
    return {
      positions,
      groups,
      width,
      height,
      relationshipCount: relationships.length,
      primaryAxis: 'horizontal'
    };
  }
  function seedRelationshipRecords(customers = []) {
    const groups = new Map();
    customers.forEach(customer => {
      const key = customer.hospitalId || customer.hospital;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(customer);
    });
    const records = [];
    [...groups.values()].forEach((items, groupIndex) => {
      items.slice(1, 6).forEach((customer, index) => records.push({
        relationshipId: `rel_demo_in_${groupIndex}_${index}`,
        sourceCustomerId: items[0].customerId,
        targetCustomerId: customer.customerId,
        relationshipScope: 'IN_HOSPITAL',
        relationshipType: index % 2 ? 'ACADEMIC' : 'COLLEAGUE',
        strength: index < 2 ? 'STRONG' : 'NORMAL',
        directed: index % 2 === 1,
        source: 'ANONYMOUS_DEMO'
      }));
    });
    const leaders = [...groups.values()].map(items => items[0]).filter(Boolean);
    leaders.slice(1).forEach((customer, index) => records.push({
      relationshipId: `rel_demo_out_${index}`,
      sourceCustomerId: leaders[index].customerId,
      targetCustomerId: customer.customerId,
      relationshipScope: 'OUTSIDE_HOSPITAL',
      relationshipType: 'ACADEMIC',
      strength: 'STRONG',
      directed: true,
      source: 'ANONYMOUS_DEMO'
    }));
    return records;
  }
  function getImportantCustomers(customers = [], relationships = [], professionalProfiles = []) {
    return sortCustomersByImportance(customers, relationships, professionalProfiles).filter(item => item.importance.importanceLevel === 'HIGH');
  }
  function getRelationshipRisks(customers = [], relationships = []) {
    const byId = new Map(customers.map(item => [item.customerId, item]));
    const risks = [];
    relationships.filter(item => !item.deletedAt).forEach(item => {
      const source = byId.get(item.sourceCustomerId);
      const target = byId.get(item.targetCustomerId);
      if (!source || !target) risks.push({
        relationshipId: item.relationshipId,
        type: 'MISSING_CUSTOMER',
        label: '关系包含缺失客户'
      });else if (!source.active || !target.active) risks.push({
        relationshipId: item.relationshipId,
        type: 'INACTIVE_CUSTOMER',
        label: '关系包含已停用客户'
      });
    });
    return risks;
  }
  function getCustomersNeedingFollowUp(customers = [], followUps = [], referenceDate = new Date()) {
    return customers.filter(customer => isFollowUpOverdue(customer.nextFollowUpDate, followUps.filter(item => item.customerId === customer.customerId), referenceDate) || ['AT_RISK', 'LOST', 'DECLINING'].includes(customer.currentStatus));
  }
  function operatingDate(value) {
    const timestamp = new Date(value || '').getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  function operatingDaysBetween(earlier, later) {
    const start = operatingDate(earlier);
    const end = operatingDate(later);
    return start === null || end === null ? null : Math.max(0, Math.floor((end - start) / 86400000));
  }
  function operatingProduct(value) {
    const product = String(value || '').trim();
    return PRODUCTS.includes(product) ? product : null;
  }
  function operatingEvidence(input = {}) {
    const sourceId = String(input.sourceId || 'unknown');
    const type = String(input.type || 'BUSINESS_FACT');
    return {
      evidenceId: String(input.evidenceId || `evi_${stableId([type, sourceId]).slice(4)}`),
      type,
      label: String(input.label || '').trim(),
      value: String(input.value ?? '').trim(),
      sourceId,
      sourceType: String(input.sourceType || 'LOCAL_READ_ONLY'),
      observedAt: String(input.observedAt || '')
    };
  }
  function operatingRecommendationKey(input = {}) {
    const identities = (input.evidence || []).map(item => `${item.type}:${item.sourceId}`).sort().join('|');
    return `rec_${stableId([input.customerId, input.product || '__customer__', input.signalType, identities]).slice(4)}`;
  }
  function shiftVisitDate(value, days) {
    const key = dateOnly(value);
    if (!key) return '';
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function customerVisitTaskStatus(task = {}) {
    if (task.status === 'completed' || task.completedAt || Number(task.progress) >= 100) return 'completed';
    if (task.status === 'cancelled' || task.status === 'canceled' || task.cancelledAt || task.deletedAt) return 'cancelled';
    return task.status === 'in_progress' || Number(task.progress) > 0 ? 'in_progress' : 'pending';
  }
  function buildCustomerVisitTaskRecommendations(customers = [], options = {}) {
    const now = dateOnly(options.now instanceof Date ? options.now.toISOString() : options.now || new Date().toISOString());
    const tasks = options.tasks || [];
    const followUps = (options.followUps || []).filter(item => item && !item.deletedAt);
    const activities = (options.activities || []).filter(item => item && !item.deletedAt && !item.deleted);
    const profiles = options.profiles || [];
    const gradeRank = {
      A: 4,
      B: 3,
      C: 2,
      D: 1
    };
    const activeTaskFor = customerId => tasks.some(task => task?.sourceType === 'customer' && task?.taskType === 'customer_visit' && [String(task.customerId || task.sourceId || ''), String(task.sourceRecommendationCustomerId || '')].includes(customerId) && ['pending', 'in_progress'].includes(customerVisitTaskStatus(task)));
    const latestCancellationFor = customerId => [...tasks].filter(task => task?.sourceType === 'customer' && task?.taskType === 'customer_visit' && String(task.customerId || task.sourceId || '') === customerId && customerVisitTaskStatus(task) === 'cancelled' && !['activity', 'recommendation_withdrawal'].includes(task.cancelledBy)).sort((left, right) => String(right.customerVisitCancelledAt || right.cancelledAt || right.updatedAt || '').localeCompare(String(left.customerVisitCancelledAt || left.cancelledAt || left.updatedAt || '')))[0];
    const results = [];
    customers.forEach(customer => {
      const customerId = String(customer.customerId || customer.id || '');
      if (!customerId || customer.active === false || activeTaskFor(customerId)) return;
      const customerProfiles = profiles.filter(profile => String(profile.customerId || '') === customerId);
      const profile = [...customerProfiles].sort((left, right) => (gradeRank[String(right.salesGrade || right.currentSalesGrade || '').toUpperCase()] || 0) - (gradeRank[String(left.salesGrade || left.currentSalesGrade || '').toUpperCase()] || 0))[0] || {};
      const gradeEvidenceAvailable = Boolean(profile.salesGrade || profile.currentSalesGrade || customer.salesGrade || customer.currentSalesGrade);
      const grade = String(profile.salesGrade || profile.currentSalesGrade || customer.salesGrade || customer.currentSalesGrade || 'D').toUpperCase();
      const customerGrade = VISIT_CYCLE_DAYS[grade] ? grade : 'D';
      const cycle = VISIT_CYCLE_DAYS[customerGrade];
      const product = operatingProduct(profile.product);
      const relevantFollowUps = followUps.filter(item => String(item.customerId || '') === customerId && (!product || !item.product || item.product === product));
      const latestFollowUp = [...relevantFollowUps].sort((left, right) => String(right.followUpAt || right.updatedAt || right.createdAt || '').localeCompare(String(left.followUpAt || left.updatedAt || left.createdAt || '')))[0];
      const completedVisit = [...tasks].filter(task => task.customerId === customerId && (!product || task.product === product) && customerVisitTaskStatus(task) === 'completed').sort((a, b) => String(b.completedAt || b.updatedAt).localeCompare(String(a.completedAt || a.updatedAt)))[0];
      const lastFollowUpAt = [dateOnly(latestFollowUp?.followUpAt || customer.lastFollowUpAt), dateOnly(completedVisit?.completedAt || completedVisit?.updatedAt)].filter(Boolean).sort().at(-1) || '';
      const daysSince = operatingDaysBetween(lastFollowUpAt, now);
      const nextAction = String(latestFollowUp?.nextAction || customer.nextAction || '');
      const nextActionDate = dateOnly(latestFollowUp?.nextFollowUpDate || customer.nextFollowUpDate || customer.nextActionDate);
      const reasons = [];
      const addReason = (code, value, sourceId, sourceType, observedAt = '') => {
        const meta = CUSTOMER_VISIT_REASONS[code];
        if (!meta || reasons.some(item => item.code === code)) return;
        reasons.push({
          code,
          ...meta,
          evidence: operatingEvidence({
            type: code.toUpperCase(),
            label: meta.label,
            value,
            sourceId,
            sourceType,
            observedAt
          })
        });
      };
      if (!lastFollowUpAt) addReason('no_followup_record', '尚无真实跟进记录', `customer:${customerId}`, 'CUSTOMER_MASTER', customer.updatedAt || now);else if (daysSince >= cycle) addReason('long_time_no_visit', `距上次跟进 ${daysSince} 天`, latestFollowUp?.followUpId || `followup:${customerId}:${lastFollowUpAt}`, latestFollowUp ? 'FOLLOW_UP' : 'CUSTOMER_MASTER', lastFollowUpAt);
      if (completedVisit?.longTerm && completedVisit.visitIntervalDays) addReason('next_visit_cycle', `已完成上次拜访，计划每 ${completedVisit.visitIntervalDays} 天跟踪`, completedVisit.id, 'NATIVE_TASK', lastFollowUpAt);
      if (customerGrade === 'A') addReason('key_customer', `A 级客户，标准周期 ${cycle} 天`, `grade:${customerId}:${product || 'customer'}:${customerGrade}`, 'CUSTOMER_PROFILE', now);
      if (nextActionDate && nextActionDate < now) addReason('followup_overdue', `跟进原定 ${nextActionDate}`, latestFollowUp?.followUpId || `followup-due:${customerId}:${nextActionDate}`, latestFollowUp ? 'FOLLOW_UP' : 'CUSTOMER_MASTER', nextActionDate);
      if (nextAction && nextActionDate && nextActionDate <= now) addReason('next_action_due', `下一步动作原定 ${nextActionDate}`, latestFollowUp?.followUpId || `next-action:${customerId}:${nextActionDate}`, latestFollowUp ? 'FOLLOW_UP' : 'CUSTOMER_MASTER', nextActionDate);
      const plans = customerProfiles.flatMap(item => item.plans || []);
      const currentRank = gradeRank[customerGrade] || 1;
      const upgrade = plans.find(plan => plan.upgradeOpportunity === true || (gradeRank[String(plan.targetGrade || '').toUpperCase()] || 0) > currentRank);
      if (upgrade) addReason('upgrade_opportunity', upgrade.targetGrade ? `已设 ${String(upgrade.targetGrade).toUpperCase()} 级升级目标` : '已明确记录升级机会', upgrade.id || `plan:${customerId}:${product || 'customer'}`, 'READ_ONLY_UPGRADE_PLAN', upgrade.nextReviewDate || upgrade.targetMonth || upgrade.updatedAt);
      const activity = [...activities].filter(item => {
        if (String(item.customerId || '') !== customerId) return false;
        if (/草稿|取消|删除|作废|失效|暂停/.test(String(item.approvalStatus || item.status || ''))) return false;
        const endedAt = dateOnly(item.endDate || item.activityDate || item.date);
        const age = operatingDaysBetween(endedAt, now);
        return endedAt && endedAt <= now && age !== null && age <= 30 && (!lastFollowUpAt || lastFollowUpAt < endedAt);
      }).sort((left, right) => dateOnly(right.endDate || right.activityDate || right.date).localeCompare(dateOnly(left.endDate || left.activityDate || left.date)))[0];
      if (activity) addReason('activity_followup', `${String(activity.type || activity.activityType || activity.title || '关联活动')}后尚未跟进`, activity.id || activity.activityId || `activity:${customerId}`, 'ACTIVITY_APPLICATION', activity.endDate || activity.activityDate || activity.date);
      const developmentStatus = String(customer.developmentStatus || profile.developmentStatus || '').toUpperCase();
      if (['CONTACTED', 'CULTIVATING'].includes(developmentStatus) && (daysSince === null || daysSince >= cycle)) addReason('development_stalled', `开发状态为${developmentStatus === 'CONTACTED' ? '初步接触' : '培养中'}，尚待推进`, `development:${customerId}:${developmentStatus}`, 'CUSTOMER_MASTER', customer.updatedAt || now);
      const resources = customerProfiles.flatMap(item => item.resourceInvestments || item.resources || []);
      const resource = [...resources].filter(item => {
        const executedAt = dateOnly(item.executedAt || item.appliedAt);
        const age = operatingDaysBetween(executedAt, now);
        return executedAt && age !== null && age <= 30 && !String(item.result || '').trim() && (!lastFollowUpAt || lastFollowUpAt < executedAt);
      }).sort((left, right) => dateOnly(right.executedAt || right.appliedAt).localeCompare(dateOnly(left.executedAt || left.appliedAt)))[0];
      if (resource) addReason('resource_followup', `${String(resource.project || '资源投入')}后尚未记录结果`, resource.id || `resource:${customerId}:${product || 'customer'}`, 'READ_ONLY_RESOURCE_PROVIDER', resource.executedAt || resource.appliedAt);
      let selectedReasons = reasons.sort((left, right) => right.weight - left.weight || left.code.localeCompare(right.code)).slice(0, 3);
      if (daysSince !== null && daysSince < cycle && selectedReasons.every(item => item.code === 'key_customer')) return;
      const cancellation = latestCancellationFor(customerId);
      const cancelledAt = dateOnly(cancellation?.customerVisitCancelledAt || cancellation?.cancelledAt || cancellation?.updatedAt);
      const cancellationAge = operatingDaysBetween(cancelledAt, now);
      const coolingDown = cancellationAge !== null && cancellationAge < CUSTOMER_VISIT_CANCEL_COOLDOWN_DAYS;
      if (coolingDown) selectedReasons = selectedReasons.filter(item => item.high);
      if (!selectedReasons.length) return;
      const evidence = selectedReasons.map(item => item.evidence);
      const highPriority = selectedReasons.some(item => item.high);
      const recommendationKey = `visit_${stableId([customerId, product || '__customer__', ...selectedReasons.map(item => `${item.code}:${item.evidence.sourceId}`)]).slice(4)}`;
      const dueDate = nextActionDate || (completedVisit?.longTerm && completedVisit.visitIntervalDays ? shiftVisitDate(lastFollowUpAt || now, completedVisit.visitIntervalDays) : shiftVisitDate(now, highPriority ? 1 : 7));
      results.push({
        id: recommendationKey,
        recommendationId: recommendationKey,
        recommendationKey,
        signalType: 'VISIT_CADENCE',
        customerId,
        customerName: String(customer.customerName || customer.canonicalName || customer.name || profile.canonicalName || ''),
        hospital: String(customer.hospital || profile.hospitalName || ''),
        hospitalName: String(customer.hospital || profile.hospitalName || ''),
        hospitalId: String(customer.hospitalId || profile.hospitalId || ''),
        department: String(customer.department || profile.departmentName || ''),
        departmentName: String(customer.department || profile.departmentName || ''),
        departmentId: String(customer.departmentId || profile.departmentId || ''),
        product,
        customerGrade,
        gradeEvidenceAvailable,
        salesGrade: customerGrade,
        developmentStatus,
        currentDevelopmentStatus: developmentStatus,
        customerPotential: customer.customerPotential || customer.potential || profile.customerPotential || profile.potential || '',
        developmentDifficulty: customer.developmentDifficulty || profile.developmentDifficulty || '',
        regionType: customer.regionType || profile.regionType || '',
        hospitalImportance: customer.hospitalImportance || profile.hospitalImportance || '',
        followUpStatus: latestFollowUp?.status || customer.followUpStatus || '',
        priority: highPriority ? 'P0' : 'P2',
        sourcePriority: highPriority ? 'P0' : 'P2',
        dueDate,
        owner: String(customer.employee || customer.owner || profile.employeeName || ''),
        title: `建议拜访${String(customer.customerName || profile.canonicalName || '客户')}`,
        summary: selectedReasons.map(item => item.evidence.value).filter(Boolean).join('；'),
        recommendationReason: selectedReasons.map(item => item.code),
        recommendationEvidence: evidence.map((item, index) => ({
          ...item,
          code: selectedReasons[index].code
        })),
        recommendationExplanation: selectedReasons.map(item => `${item.label}：${item.evidence.value}`).join('；'),
        evidence,
        recommendedActions: [{
          actionId: `visit_action_${recommendationKey}`,
          actionType: 'FOLLOW_UP',
          title: `拜访${String(customer.customerName || profile.canonicalName || '客户')}`,
          reason: '依据已展示的拜访节奏与业务事实，由用户确认后建立任务。',
          suggestedBy: OPERATING_PROVIDER_MODE,
          relatedCustomerId: customerId,
          product,
          suggestedDate: dueDate,
          evidenceIds: evidence.map(item => item.evidenceId)
        }],
        generatedAt: `${now}T00:00:00`,
        source: OPERATING_PROVIDER_MODE,
        lastFollowUpAt,
        nextAction,
        nextActionDate,
        visitGoal: nextAction || selectedReasons[0].evidence.value,
        coolingDown: Boolean(coolingDown),
        recommended: true,
        autoGenerated: false
      });
    });
    const limit = Number.isFinite(Number(options.limit)) ? Math.max(0, Number(options.limit)) : 20;
    return results.sort((left, right) => (left.priority === 'P0' ? 0 : 1) - (right.priority === 'P0' ? 0 : 1) || (gradeRank[right.customerGrade] || 0) - (gradeRank[left.customerGrade] || 0) || left.dueDate.localeCompare(right.dueDate) || left.customerId.localeCompare(right.customerId)).slice(0, limit);
  }
  function operatingAction(signalType, customerId, product, evidence, context = {}) {
    const catalog = {
      FOLLOWUP_OVERDUE: [['FOLLOW_UP', '安排正式跟进', '跟进日期已到期，先补充真实沟通结果。']],
      HIGH_VALUE_WEAK_RELATIONSHIP: [['BUILD_RELATIONSHIP', '补充第二关系人', '降低关键客户仅依赖单一或弱关系的覆盖风险。'], ['FOLLOW_UP', '安排正式跟进', '先核实当前关系与推进状态。']],
      RELATIONSHIP_GAP: [['BUILD_RELATIONSHIP', '完善院内关系覆盖', '补充科室内第二关系人，并核验关系方向与强度。']],
      HIGH_RISK_CUSTOMER: [['VERIFY_STATUS', '核实经营状态', '复核掉量、暂停或风险事实，不把相关性当作原因。'], ['CHECK_SALES_DROP', '核查掉量原因', '结合后续沟通确认变化背景。']],
      KEY_INFLUENCER: [['FOLLOW_UP', '维护关键关系节点', '连接度与公开职业信息提示需要保持正式跟进。']],
      COVERAGE_GAP: [['EXPAND_DEPARTMENT', '补充科室覆盖', '在现有客户与关系之外核验覆盖缺口。']],
      RECOVERY_OPPORTUNITY: [['RECOVERY', '复核恢复机会', '历史经营和当前状态支持复核，但不代表必然可以恢复。']],
      UPGRADE_OPPORTUNITY: [['UPGRADE', '复核升级推进', '核对升级计划、目标差额和最近实际动作。']],
      STAGNANT_CUSTOMER: [['VERIFY_STATUS', '核实长期停滞状态', '确认当前阶段与下一步动作是否仍然有效。']],
      RESOURCE_REVIEW: [['REVIEW_RESOURCE', '复核投入效果', '资源投入后的变化仅为时间相关，需要结合跟进与后续数据确认。']],
      PRIORITY_CUSTOMER: [['FOLLOW_UP', '确认本期优先动作', '依据已展示的经营与关系事实安排下一步。']]
    };
    return (catalog[signalType] || [['OTHER', '查看建议', '结合证据人工确认下一步。']]).map(([actionType, title, reason], index) => ({
      actionId: `act_${stableId([customerId, product || '__customer__', signalType, actionType, index]).slice(4)}`,
      actionType,
      title,
      reason,
      suggestedBy: OPERATING_PROVIDER_MODE,
      relatedCustomerId: customerId,
      product: operatingProduct(product),
      suggestedDate: String(context.suggestedDate || '').slice(0, 10),
      evidenceIds: evidence.map(item => item.evidenceId)
    }));
  }
  function normalizeRecommendation(input = {}, context = {}) {
    const evidence = (input.evidence || []).map(operatingEvidence).filter(item => item.label && item.sourceId);
    if (!input.customerId || !OPERATING_SIGNAL_TYPES[input.signalType] || !OPERATING_PRIORITIES[input.priority] || !evidence.length) return null;
    const recommendationKey = String(input.recommendationKey || operatingRecommendationKey({
      ...input,
      evidence
    }));
    return {
      recommendationId: recommendationKey,
      recommendationKey,
      customerId: String(input.customerId),
      customerName: String(input.customerName || ''),
      hospital: String(input.hospital || ''),
      hospitalId: String(input.hospitalId || ''),
      department: String(input.department || ''),
      departmentId: String(input.departmentId || ''),
      product: operatingProduct(input.product),
      signalType: input.signalType,
      priority: input.priority,
      title: String(input.title || OPERATING_SIGNAL_TYPES[input.signalType]),
      summary: String(input.summary || evidence.slice(0, 2).map(item => `${item.label}${item.value ? `：${item.value}` : ''}`).join('；')),
      evidence,
      recommendedActions: Array.isArray(input.recommendedActions) && input.recommendedActions.length ? input.recommendedActions.map(item => ({
        ...item,
        product: operatingProduct(item.product),
        evidenceIds: [...(item.evidenceIds || [])]
      })) : operatingAction(input.signalType, String(input.customerId), input.product, evidence, context),
      generatedAt: String(input.generatedAt || context.generatedAt || new Date().toISOString()),
      source: String(input.source || OPERATING_PROVIDER_MODE),
      importance: ['HIGH', 'MEDIUM', 'NORMAL'].includes(input.importance) ? input.importance : 'NORMAL',
      importanceScore: finite(input.importanceScore),
      importanceReasons: [...(input.importanceReasons || [])],
      salesGrade: String(input.salesGrade || ''),
      perceptionLevel: String(input.perceptionLevel || ''),
      developmentStatus: String(input.developmentStatus || ''),
      currentStatus: String(input.currentStatus || ''),
      overdue: Boolean(input.overdue),
      hasRelationship: Boolean(input.hasRelationship),
      keyInfluencer: Boolean(input.keyInfluencer),
      active: input.active !== false,
      profileKey: String(input.profileKey || ''),
      scopeType: String(input.scopeType || 'CUSTOMER'),
      scopeId: String(input.scopeId || input.customerId),
      coverage: input.coverage ? {
        ...input.coverage
      } : null
    };
  }
  function calculateOperatingImportance(customer = {}, relationshipStats = {}, professional = {}, context = {}) {
    const administrative = professional.administrativeTitles || [];
    const academic = professional.academicTitles || [];
    const grade = String(context.salesGrade || customer.salesGrade || customer.currentSalesGrade || '');
    const perception = String(customer.perceptionLevel || context.perceptionLevel || '');
    const adminWeight = administrative.reduce((max, item) => Math.max(max, professionalLevelWeight(item.level)), 0);
    const academicWeight = academic.reduce((max, item) => Math.max(max, professionalLevelWeight(item.level)), 0);
    const risk = ['AT_RISK', 'LOST', 'DECLINING', 'DOWNGRADED'].includes(context.currentStatus || customer.currentStatus) || context.overdue;
    const score = adminWeight * 12 + academicWeight * 8 + (SALES_GRADE_ORDER[grade] || 0) * 7 + (/^R[1-4]$/.test(perception) ? Number(perception.slice(1)) * 4 : 0) + ((context.developmentStatus || customer.developmentStatus) === 'PRIORITY' ? 16 : 0) + Math.min(15, finite(relationshipStats.degree) * 3) + (risk ? 5 : 0) + (context.upgradeOpportunity ? 4 : 0);
    const reasons = [];
    if (administrative.length) reasons.push(`行政职务：${administrative[0].title}`);
    if (academic.length) reasons.push(`学术任职：${academic[0].title}`);
    if (grade) reasons.push(`${grade}类客户`);
    if (/^R[1-4]$/.test(perception)) reasons.push(`观念等级 ${perception}`);
    if ((context.developmentStatus || customer.developmentStatus) === 'PRIORITY') reasons.push('当前重点推进');
    if (relationshipStats.degree) reasons.push(`连接 ${relationshipStats.degree} 位客户`);
    if (risk) reasons.push('当前经营或跟进风险');
    if (context.upgradeOpportunity) reasons.push('存在升级机会依据');
    return {
      importance: score >= 68 ? 'HIGH' : score >= 36 ? 'MEDIUM' : 'NORMAL',
      importanceScore: score,
      importanceReasons: reasons
    };
  }
  function normalizeRecommendationAction(input = {}, now = new Date().toISOString()) {
    const status = RECOMMENDATION_STATUSES[input.status] ? input.status : 'NEW';
    const snoozeUntil = status === 'SNOOZED' ? String(input.snoozeUntil || '').slice(0, 10) : '';
    return {
      recommendationKey: String(input.recommendationKey || ''),
      status,
      note: String(input.note || '').trim().slice(0, 1200),
      snoozeUntil,
      visitIntervalDays: Number.isInteger(Number(input.visitIntervalDays)) && Number(input.visitIntervalDays) >= 1 && Number(input.visitIntervalDays) <= 365 ? Number(input.visitIntervalDays) : null,
      updatedAt: String(input.updatedAt || now)
    };
  }
  function createRecommendationActionStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const raw = storage?.getItem(RECOMMENDATION_ACTIONS_STORAGE_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const legacyRecords = Array.isArray(parsed) ? parsed : parsed?.records;
    let records = (Array.isArray(legacyRecords) ? legacyRecords : []).map(item => normalizeRecommendationAction(item, now())).filter(item => item.recommendationKey);
    function persist() {
      storage?.setItem(RECOMMENDATION_ACTIONS_STORAGE_KEY, JSON.stringify({
        schemaVersion: V14_SCHEMA_VERSION,
        records
      }));
    }
    function expireSnoozes() {
      const today = String(now()).slice(0, 10);
      let changed = false;
      records = records.map(item => {
        if (item.status !== 'SNOOZED' || !item.snoozeUntil || item.snoozeUntil > today) return item;
        changed = true;
        return {
          ...item,
          status: 'NEW',
          snoozeUntil: '',
          updatedAt: now()
        };
      });
      if (changed) persist();
    }
    if (corrupted || raw && (Array.isArray(parsed) || parsed?.schemaVersion !== V14_SCHEMA_VERSION)) persist();
    function list() {
      expireSnoozes();
      return records.map(item => ({
        ...item
      }));
    }
    function get(recommendationKey) {
      return list().find(item => item.recommendationKey === recommendationKey) || null;
    }
    function setStatus(recommendationKey, status, meta = {}) {
      if (!recommendationKey) throw new Error('recommendationKey 不能为空');
      if (!RECOMMENDATION_STATUSES[status]) throw new Error('建议状态无效');
      if (status === 'SNOOZED' && !String(meta.snoozeUntil || '').slice(0, 10)) throw new Error('稍后提醒必须选择日期');
      const next = normalizeRecommendationAction({
        ...get(recommendationKey),
        recommendationKey,
        status,
        ...meta,
        updatedAt: now()
      }, now());
      const index = records.findIndex(item => item.recommendationKey === recommendationKey);
      if (index < 0) records.push(next);else records[index] = next;
      persist();
      return {
        ...next
      };
    }
    function cleanup(validKeys = []) {
      const allowed = new Set(validKeys);
      const next = records.filter(item => item.status === 'DISMISSED' || item.visitIntervalDays || allowed.has(item.recommendationKey));
      const removed = records.length - next.length;
      if (removed) {
        records = next;
        persist();
      }
      return removed;
    }
    return {
      list,
      get,
      setStatus,
      cleanup,
      persist,
      storageKey: RECOMMENDATION_ACTIONS_STORAGE_KEY,
      schemaVersion: V14_SCHEMA_VERSION
    };
  }
  function taskPriorityFromRecommendation(priority) {
    if (priority === 'P0' || priority === 'P1') return 'high';
    if (priority === 'P3') return 'low';
    return 'normal';
  }
  function taskDraftDate(recommendation = {}, action = {}, customer = {}, now = new Date().toISOString()) {
    const explicit = [action.suggestedDate, recommendation.nextFollowUpDate, customer.nextFollowUpDate].map(dateOnly).find(Boolean);
    if (explicit) return explicit;
    const date = new Date(now);
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  }
  function buildTaskDraft(recommendation = {}, context = {}) {
    if (!recommendation.recommendationKey || !recommendation.customerId) throw new Error('经营建议缺少稳定 recommendationKey 或 customerId');
    const action = context.action || recommendation.recommendedActions?.[0] || {};
    const customer = context.customer || {};
    const evidenceSnapshot = (recommendation.evidence || []).slice(0, 5).map(item => ({
      evidenceId: String(item.evidenceId || ''),
      type: String(item.type || ''),
      label: String(item.label || ''),
      value: String(item.value || ''),
      sourceId: String(item.sourceId || ''),
      sourceType: String(item.sourceType || ''),
      observedAt: String(item.observedAt || '')
    })).filter(item => item.label && item.sourceId);
    if (!evidenceSnapshot.length) throw new Error('没有可追溯证据，不能生成任务草稿');
    const sourcePriority = String(recommendation.priority || 'P2');
    const title = String(action.title || recommendation.title || '客户跟进').trim();
    return {
      draftId: String(context.draftId || permanentRecordId('draft', context.idFactory)),
      recommendationKey: String(recommendation.recommendationKey),
      recommendationId: String(recommendation.recommendationId || recommendation.recommendationKey),
      customerId: String(recommendation.customerId),
      customerName: String(recommendation.customerName || customer.customerName || ''),
      hospital: String(recommendation.hospital || customer.hospital || ''),
      department: String(recommendation.department || customer.department || ''),
      product: operatingProduct(recommendation.product),
      taskType: 'customer_visit',
      title,
      description: String(context.description || `${recommendation.summary || recommendation.title || ''}\n建议动作：${action.reason || action.title || '请结合证据人工确认。'}`).trim(),
      owner: String(context.owner ?? recommendation.owner ?? customer.owner ?? customer.employee ?? '').trim(),
      employeeId: String(recommendation.employeeId || customer.employeeId || ''),
      dueDate: String(context.dueDate || taskDraftDate(recommendation, action, customer, context.now || new Date().toISOString())).slice(0, 10),
      priority: taskPriorityFromRecommendation(sourcePriority),
      sourcePriority,
      recommendedActionType: String(action.actionType || 'OTHER'),
      evidenceSnapshot,
      recommendationReason: [...(recommendation.recommendationReason || [])].slice(0, 3),
      recommendationEvidence: [...(recommendation.recommendationEvidence || recommendation.evidence || [])].slice(0, 3).map(item => ({
        ...item
      })),
      recommendationExplanation: String(recommendation.recommendationExplanation || recommendation.summary || ''),
      customerGrade: String(recommendation.customerGrade || recommendation.salesGrade || ''),
      lastFollowUpAt: String(recommendation.lastFollowUpAt || ''),
      currentDevelopmentStatus: String(recommendation.currentDevelopmentStatus || recommendation.developmentStatus || ''),
      nextAction: String(recommendation.nextAction || ''),
      nextActionDate: String(recommendation.nextActionDate || ''),
      visitGoal: String(recommendation.visitGoal || ''),
      sourceType: 'customer',
      sourceId: String(recommendation.customerId),
      recommended: true,
      autoGenerated: false,
      sourceRecommendationKey: String(recommendation.recommendationKey),
      sourceRecommendationId: String(recommendation.recommendationId || recommendation.recommendationKey),
      sourceSignalType: String(recommendation.signalType || ''),
      generatedAt: String(recommendation.generatedAt || context.now || new Date().toISOString()),
      confirmed: false
    };
  }
  function normalizeTaskLink(input = {}, now = new Date().toISOString(), idFactory) {
    const state = TASK_LINK_STATES[input.state] ? input.state : 'ACTIVE';
    return {
      linkId: String(input.linkId || permanentRecordId('tasklink', idFactory)),
      recommendationKey: String(input.recommendationKey || input.sourceRecommendationKey || ''),
      recommendationId: String(input.recommendationId || input.recommendationKey || ''),
      taskId: String(input.taskId || input.id || ''),
      customerId: String(input.customerId || ''),
      product: operatingProduct(input.product),
      createdAt: String(input.createdAt || now),
      updatedAt: String(input.updatedAt || input.createdAt || now),
      completedAt: input.completedAt ? String(input.completedAt) : null,
      cancelledAt: input.cancelledAt ? String(input.cancelledAt) : null,
      state,
      orphaned: Boolean(input.orphaned),
      recommendationMissing: Boolean(input.recommendationMissing)
    };
  }
  function createTaskLinkStore(options = {}) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const raw = storage?.getItem(TASK_LINK_STORAGE_KEY);
    let parsed = null;
    let corrupted = false;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      corrupted = true;
    }
    const source = Array.isArray(parsed) ? parsed : parsed?.records;
    let records = (Array.isArray(source) ? source : []).map(item => normalizeTaskLink(item, item.updatedAt || now(), options.idFactory)).filter(item => item.recommendationKey && item.taskId && item.customerId);
    function persist() {
      storage?.setItem(TASK_LINK_STORAGE_KEY, JSON.stringify({
        schemaVersion: V15_SCHEMA_VERSION,
        records
      }));
    }
    if (corrupted || raw && (Array.isArray(parsed) || parsed?.schemaVersion !== V15_SCHEMA_VERSION)) persist();
    function clone(item) {
      return item ? {
        ...item
      } : null;
    }
    function list(listOptions = {}) {
      return records.filter(item => !listOptions.recommendationKey || item.recommendationKey === listOptions.recommendationKey).map(clone);
    }
    function getByTaskId(taskId) {
      return clone(records.find(item => item.taskId === taskId));
    }
    function getLatest(recommendationKey) {
      return clone(records.filter(item => item.recommendationKey === recommendationKey).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]);
    }
    function create(input = {}) {
      const record = normalizeTaskLink(input, now(), options.idFactory);
      if (!record.recommendationKey || !record.taskId || !record.customerId) throw new Error('任务链接缺少 recommendationKey、taskId 或 customerId');
      const active = records.find(item => item.recommendationKey === record.recommendationKey && item.state === 'ACTIVE');
      if (active) return clone(active);
      records.push(record);
      persist();
      return clone(record);
    }
    function reconcile(taskBridge, validRecommendationKeys = null) {
      if (!taskBridge?.getTask) return list();
      const hasRecommendationSnapshot = Array.isArray(validRecommendationKeys);
      const valid = new Set(validRecommendationKeys || []);
      let changed = false;
      records = records.map(item => {
        const task = taskBridge.getTask(item.taskId);
        const status = taskBridge.getTaskStatus?.(item.taskId) || (task?.completedAt || Number(task?.progress) >= 100 ? 'completed' : task ? 'active' : 'not_found');
        const recommendationMissing = hasRecommendationSnapshot && !valid.has(item.recommendationKey);
        let state = item.state;
        let completedAt = item.completedAt;
        let cancelledAt = item.cancelledAt;
        let orphaned = false;
        if (!task || status === 'not_found' || status === 'cancelled') {
          state = 'CANCELLED';
          cancelledAt ||= now();
          orphaned = !task;
        } else if (status === 'completed') {
          state = 'COMPLETED';
          completedAt = task.completedAt || item.completedAt || now();
          cancelledAt = null;
        } else {
          state = 'ACTIVE';
          completedAt = null;
          cancelledAt = null;
        }
        const next = {
          ...item,
          state,
          completedAt,
          cancelledAt,
          orphaned,
          recommendationMissing,
          updatedAt: state !== item.state || orphaned !== item.orphaned || recommendationMissing !== item.recommendationMissing ? now() : item.updatedAt
        };
        if (JSON.stringify(next) !== JSON.stringify(item)) changed = true;
        return next;
      });
      if (changed) persist();
      return list();
    }
    return {
      list,
      getByTaskId,
      getLatest,
      create,
      reconcile,
      persist,
      storageKey: TASK_LINK_STORAGE_KEY,
      schemaVersion: V15_SCHEMA_VERSION
    };
  }
  function filterOperatingRecommendations(recommendations = [], filters = {}) {
    const selected = (value, choices) => !Array.isArray(choices) || !choices.length || choices.includes(value);
    return recommendations.filter(item => {
      if (filters.customerId && filters.customerId !== 'all' && item.customerId !== filters.customerId) return false;
      if (filters.product && filters.product !== 'all' && (filters.product === '__customer__' ? item.product !== null : item.product !== filters.product)) return false;
      if (filters.hospital && filters.hospital !== 'all' && ![item.hospitalId, item.hospital].includes(filters.hospital)) return false;
      if (filters.department && filters.department !== 'all' && ![item.departmentId, item.department].includes(filters.department)) return false;
      if (!selected(item.priority, filters.priorities)) return false;
      if (filters.signalType && filters.signalType !== 'all' && item.signalType !== filters.signalType) return false;
      if (!selected(item.salesGrade, filters.grades)) return false;
      if (!selected(item.perceptionLevel, filters.perceptionLevels)) return false;
      if (filters.developmentStatus && filters.developmentStatus !== 'all' && item.developmentStatus !== filters.developmentStatus) return false;
      if (filters.currentStatus && filters.currentStatus !== 'all' && item.currentStatus !== filters.currentStatus) return false;
      if (filters.overdue === 'yes' && !item.overdue) return false;
      if (filters.overdue === 'no' && item.overdue) return false;
      if (filters.hasRelationship === 'yes' && !item.hasRelationship) return false;
      if (filters.hasRelationship === 'no' && item.hasRelationship) return false;
      if (filters.keyInfluencer === 'yes' && !item.keyInfluencer) return false;
      if (filters.keyInfluencer === 'no' && item.keyInfluencer) return false;
      if (filters.recommendationStatus && filters.recommendationStatus !== 'all' && (item.recommendationStatus || 'NEW') !== filters.recommendationStatus) return false;
      return true;
    }).sort((left, right) => (OPERATING_PRIORITIES[left.priority]?.order ?? 9) - (OPERATING_PRIORITIES[right.priority]?.order ?? 9) || finite(right.importanceScore) - finite(left.importanceScore) || String(right.generatedAt).localeCompare(String(left.generatedAt)));
  }
  class CustomerOperatingIntelligenceProvider {
    constructor(options = {}) {
      this.providerMode = OPERATING_PROVIDER_MODE;
      this.label = '本地确定性经营规则（非线上 AI）';
      this.rules = {
        ...OPERATING_RULES,
        ...(options.rules || {})
      };
      this.now = options.now || (() => new Date().toISOString());
      this.cache = null;
    }
    analyze(context = {}) {
      const generatedAt = String(context.generatedAt || this.now());
      const customersInput = Array.isArray(context.customers) ? context.customers : [];
      const profileInput = Array.isArray(context.profiles) && context.profiles.length ? context.profiles : customersInput.filter(item => item.product || item.monthlyActuals);
      const relationships = (context.relationships || []).filter(item => !item.deletedAt && item.active !== false);
      const followUps = (context.followUps || []).filter(item => !item.deletedAt);
      const professionals = context.professionalProfiles || [];
      const plans = context.plans || [];
      const resources = context.resources || [];
      const fingerprint = context.cacheKey || JSON.stringify([generatedAt.slice(0, 10), customersInput.map(item => [item.customerId, item.customerName || item.canonicalName, item.hospitalId || item.hospital, item.departmentId || item.department, item.updatedAt, item.active, item.developmentStatus, item.currentStatus, item.nextFollowUpDate]), profileInput.map(item => [item.customerId, item.product, item.currentStatus, item.updatedAt || item.lastUpdatedAt, item.monthlyActuals || [], item.plans || [], item.resourceInvestments || []]), relationships.map(item => [item.relationshipId, item.sourceCustomerId, item.targetCustomerId, item.relationshipScope, item.relationshipType, item.strength, item.directed, item.active, item.updatedAt, item.deletedAt]), followUps.map(item => [item.followUpId, item.customerId, item.product, item.followUpAt, item.updatedAt, item.deletedAt, item.nextFollowUpDate]), professionals.map(item => [item.customerId, item.updatedAt, item.administrativeTitles || [], item.academicTitles || []]), plans.map(item => [item.id, item.customerId, item.product, item.updatedAt, item.targetMonth, item.targetGrade, item.executionStatus]), resources.map(item => [item.id, item.customerId, item.product, item.updatedAt, item.executedAt, item.appliedAt, item.project])]);
      if (this.cache?.fingerprint === fingerprint) return JSON.parse(JSON.stringify(this.cache.result));
      const masterById = new Map();
      [...customersInput, ...profileInput].forEach(item => {
        if (!item?.customerId) return;
        const previous = masterById.get(String(item.customerId)) || {};
        masterById.set(String(item.customerId), {
          ...item,
          ...previous,
          customerId: String(item.customerId),
          customerName: previous.customerName || item.customerName || item.canonicalName || '',
          hospital: previous.hospital || item.hospital || item.hospitalName || '',
          department: previous.department || item.department || item.departmentName || ''
        });
      });
      const profileByKey = new Map();
      profileInput.forEach(profile => {
        if (!profile?.customerId) return;
        const product = operatingProduct(profile.product);
        const key = `${profile.customerId}::${product || '__customer__'}`;
        if (!profileByKey.has(key)) profileByKey.set(key, {
          ...profile,
          product
        });
      });
      masterById.forEach((customer, customerId) => {
        if (!profileByKey.has(`${customerId}::__customer__`)) profileByKey.set(`${customerId}::__customer__`, {
          ...customer,
          product: null
        });
      });
      const professionalByCustomer = new Map(professionals.map(item => [String(item.customerId), item]));
      const followUpsByCustomer = new Map();
      followUps.forEach(item => {
        const id = String(item.customerId || '');
        if (!followUpsByCustomer.has(id)) followUpsByCustomer.set(id, []);
        followUpsByCustomer.get(id).push(item);
      });
      const relationByCustomer = new Map();
      relationships.forEach(item => [item.sourceCustomerId, item.targetCustomerId].forEach(id => {
        const key = String(id || '');
        if (!relationByCustomer.has(key)) relationByCustomer.set(key, []);
        relationByCustomer.get(key).push(item);
      }));
      const relationStats = new Map();
      masterById.forEach((customer, customerId) => {
        const attached = relationByCustomer.get(customerId) || [];
        const connectedIds = new Set();
        const departments = new Set();
        const hospitals = new Set();
        let strong = 0;
        let weak = 0;
        let inHospital = 0;
        let incomingInfluence = 0;
        let inactiveConnections = 0;
        attached.forEach(item => {
          const otherId = item.sourceCustomerId === customerId ? item.targetCustomerId : item.sourceCustomerId;
          const other = masterById.get(String(otherId));
          connectedIds.add(String(otherId));
          if (item.strength === 'STRONG') strong += 1;
          if (item.strength === 'WEAK') weak += 1;
          if (item.relationshipScope === 'IN_HOSPITAL') inHospital += 1;
          if (item.targetCustomerId === customerId && ['INFLUENCE', 'REFERRAL'].includes(item.relationshipType)) incomingInfluence += 1;
          if (other?.departmentId || other?.department) departments.add(other.departmentId || other.department);
          if (other?.hospitalId || other?.hospital) hospitals.add(other.hospitalId || other.hospital);
          if (!other || other.active === false) inactiveConnections += 1;
        });
        relationStats.set(customerId, {
          degree: connectedIds.size,
          strong,
          weak,
          inHospital,
          incomingInfluence,
          departments: departments.size,
          hospitals: hospitals.size,
          inactiveConnections,
          relationshipIds: attached.map(item => item.relationshipId)
        });
      });
      const recommendations = [];
      const add = input => {
        const normalized = normalizeRecommendation(input, {
          generatedAt,
          suggestedDate: generatedAt
        });
        if (normalized) recommendations.push(normalized);
      };
      const referenceDate = generatedAt;
      const today = generatedAt.slice(0, 10);
      const enrichedEntities = [];
      profileByKey.forEach(profile => {
        const customerId = String(profile.customerId);
        const master = masterById.get(customerId) || profile;
        const product = operatingProduct(profile.product);
        const actuals = (profile.monthlyActuals || []).filter(item => operatingDate(`${item.month || ''}-01`) !== null).sort((a, b) => String(a.month).localeCompare(String(b.month)));
        const latestActual = actuals.at(-1);
        const previousActual = actuals.at(-2);
        const latestValue = latestActual ? finite(latestActual.value) : null;
        const previousValue = previousActual ? finite(previousActual.value) : null;
        const salesGrade = String(profile.salesGrade || profile.currentSalesGrade || (latestValue === null ? '' : defaultGradeResolver(latestValue)));
        const customerFollowUps = followUpsByCustomer.get(customerId) || [];
        const applicableFollowUps = customerFollowUps.filter(item => product ? operatingProduct(item.product) === product : !item.product);
        const latestFollowUp = [...applicableFollowUps].sort((a, b) => String(b.followUpAt || b.updatedAt || '').localeCompare(String(a.followUpAt || a.updatedAt || '')))[0] || null;
        const nextFollowUpDate = latestFollowUp?.nextFollowUpDate || (product === null ? master.nextFollowUpDate : '') || '';
        const overdue = isFollowUpOverdue(nextFollowUpDate, applicableFollowUps, referenceDate);
        const overdueDays = overdue ? operatingDaysBetween(nextFollowUpDate, today) : 0;
        const lastFollowUpDays = latestFollowUp ? operatingDaysBetween(latestFollowUp.followUpAt || latestFollowUp.updatedAt, referenceDate) : null;
        const stats = relationStats.get(customerId) || {
          degree: 0,
          strong: 0,
          weak: 0,
          inHospital: 0,
          incomingInfluence: 0,
          departments: 0,
          hospitals: 0,
          inactiveConnections: 0,
          relationshipIds: []
        };
        const customerPlans = [...(profile.plans || []), ...plans.filter(item => item.customerId === customerId && operatingProduct(item.product) === product)];
        const customerResources = [...(profile.resourceInvestments || []), ...resources.filter(item => item.customerId === customerId && operatingProduct(item.product) === product)];
        const developmentStatus = normalizeDevelopmentStatus(master.developmentStatus || profile.developmentStatus);
        const currentStatus = String(profile.currentStatus || master.currentStatus || 'INSUFFICIENT_DATA');
        const latestPlan = customerPlans.sort((a, b) => String(b.targetMonth || b.updatedAt || '').localeCompare(String(a.targetMonth || a.updatedAt || '')))[0] || null;
        const upgradeOpportunity = Boolean(latestPlan && !/完成|已完成/.test(String(latestPlan.executionStatus || ''))) || latestValue !== null && gradeDistances(latestValue).toUpgrade !== null && gradeDistances(latestValue).toUpgrade <= 3 && ['CULTIVATING', 'PRIORITY'].includes(developmentStatus);
        const importance = calculateOperatingImportance({
          ...master,
          perceptionLevel: profile.perceptionProjection?.value || ''
        }, stats, professionalByCustomer.get(customerId) || {}, {
          salesGrade,
          currentStatus,
          developmentStatus,
          overdue,
          upgradeOpportunity
        });
        const keyInfluencer = stats.degree >= this.rules.keyInfluencerConnections || stats.strong >= this.rules.keyInfluencerStrongConnections || stats.incomingInfluence >= 2;
        const entity = {
          ...profile,
          ...master,
          customerId,
          customerName: master.customerName || profile.canonicalName || '',
          hospital: master.hospital || profile.hospitalName || '',
          hospitalId: master.hospitalId || profile.hospitalId || '',
          department: master.department || profile.departmentName || '',
          departmentId: master.departmentId || profile.departmentId || '',
          product,
          salesGrade,
          perceptionLevel: profile.perceptionProjection?.value || '',
          developmentStatus,
          currentStatus,
          active: master.active !== false,
          profileKey: product ? `${customerId}::${product}` : '',
          latestValue,
          previousValue,
          latestMonth: latestActual?.month || '',
          previousMonth: previousActual?.month || '',
          salesDropRatio: previousValue > 0 && latestValue !== null ? (previousValue - latestValue) / previousValue : null,
          overdue,
          overdueDays,
          lastFollowUpDays,
          latestFollowUp,
          nextFollowUpDate,
          relationStats: stats,
          hasRelationship: stats.degree > 0,
          keyInfluencer,
          customerPlans,
          customerResources,
          latestPlan,
          upgradeOpportunity,
          ...importance
        };
        enrichedEntities.push(entity);
      });
      const baseFields = entity => ({
        customerId: entity.customerId,
        customerName: entity.customerName,
        hospital: entity.hospital,
        hospitalId: entity.hospitalId,
        department: entity.department,
        departmentId: entity.departmentId,
        product: entity.product,
        salesGrade: entity.salesGrade,
        perceptionLevel: entity.perceptionLevel,
        developmentStatus: entity.developmentStatus,
        currentStatus: entity.currentStatus,
        importance: entity.importance,
        importanceScore: entity.importanceScore,
        importanceReasons: entity.importanceReasons,
        overdue: entity.overdue,
        hasRelationship: entity.hasRelationship,
        keyInfluencer: entity.keyInfluencer,
        active: entity.active,
        profileKey: entity.profileKey
      });
      enrichedEntities.filter(entity => entity.active).forEach(entity => {
        const common = baseFields(entity);
        const evidenceForImportance = entity.importanceReasons.slice(0, 4).map((reason, index) => operatingEvidence({
          type: 'IMPORTANCE',
          label: reason,
          value: '',
          sourceId: `importance:${entity.customerId}:${entity.product || 'customer'}:${index}`,
          sourceType: 'DERIVED_BUSINESS_RULE',
          observedAt: generatedAt
        }));
        const highValue = entity.importance === 'HIGH' || ['A', 'B'].includes(entity.salesGrade) || entity.developmentStatus === 'PRIORITY';
        const risk = ['AT_RISK', 'LOST', 'DECLINING', 'DOWNGRADED'].includes(entity.currentStatus) || entity.developmentStatus === 'AT_RISK';
        if (highValue && evidenceForImportance.length) add({
          ...common,
          signalType: 'PRIORITY_CUSTOMER',
          priority: risk || entity.overdue && entity.overdueDays >= this.rules.severeOverdueDays ? 'P0' : 'P1',
          title: '当前优先关注客户',
          evidence: evidenceForImportance
        });
        if (entity.overdue) {
          const evidence = [operatingEvidence({
            type: 'FOLLOWUP_DUE',
            label: '下次跟进已逾期',
            value: `${entity.overdueDays} 天`,
            sourceId: entity.latestFollowUp?.followUpId || `master-followup:${entity.customerId}`,
            sourceType: entity.latestFollowUp ? 'FOLLOW_UP' : 'CUSTOMER_MASTER',
            observedAt: entity.nextFollowUpDate
          })];
          if (highValue) evidence.push(...evidenceForImportance.slice(0, 1));
          add({
            ...common,
            signalType: 'FOLLOWUP_OVERDUE',
            priority: entity.overdueDays >= this.rules.severeOverdueDays || highValue ? 'P0' : 'P1',
            title: '正式跟进已逾期',
            evidence
          });
        }
        if (risk) {
          const evidence = [operatingEvidence({
            type: 'CURRENT_STATUS',
            label: '当前经营状态',
            value: STATUS[entity.currentStatus]?.label || DEVELOPMENT_STATUS[entity.developmentStatus]?.label || entity.currentStatus,
            sourceId: `status:${entity.customerId}:${entity.product || 'customer'}`,
            sourceType: entity.product ? 'PRODUCT_PROFILE' : 'CUSTOMER_MASTER',
            observedAt: generatedAt
          })];
          if (entity.salesDropRatio !== null && entity.salesDropRatio >= this.rules.salesDropRatio) evidence.push(operatingEvidence({
            type: 'SALES_CHANGE',
            label: '本期较上期下降',
            value: `${Math.round(entity.salesDropRatio * 100)}%`,
            sourceId: `sales:${entity.customerId}:${entity.product}:${entity.latestMonth}`,
            sourceType: 'READ_ONLY_SALES_PROFILE',
            observedAt: entity.latestMonth
          }));
          add({
            ...common,
            signalType: 'HIGH_RISK_CUSTOMER',
            priority: highValue || entity.salesDropRatio >= this.rules.salesDropRatio ? 'P0' : 'P1',
            title: '高风险客户需核实',
            evidence
          });
        }
        if (highValue && (entity.relationStats.degree <= this.rules.weakRelationshipMaximum || entity.relationStats.strong === 0 || entity.relationStats.inHospital === 0)) {
          const evidence = [...evidenceForImportance.slice(0, 2)];
          evidence.push(operatingEvidence({
            type: 'RELATIONSHIP_COVERAGE',
            label: entity.relationStats.degree === 0 ? '暂无有效客户关系' : entity.relationStats.strong === 0 ? '缺少强关系' : '无院内关键连接',
            value: `${entity.relationStats.degree} 条有效连接`,
            sourceId: `relationship-coverage:${entity.customerId}`,
            sourceType: 'RELATIONSHIP_GRAPH',
            observedAt: generatedAt
          }));
          add({
            ...common,
            signalType: 'HIGH_VALUE_WEAK_RELATIONSHIP',
            priority: risk ? 'P0' : 'P1',
            title: '高价值关系薄弱',
            evidence
          });
        }
        if (entity.keyInfluencer && entity.product === null) {
          const evidence = [operatingEvidence({
            type: 'RELATIONSHIP_CENTRALITY',
            label: '关系连接度',
            value: `${entity.relationStats.degree} 位客户，${entity.relationStats.strong} 条强关系`,
            sourceId: `centrality:${entity.customerId}`,
            sourceType: 'RELATIONSHIP_GRAPH',
            observedAt: generatedAt
          })];
          if (entity.relationStats.departments > 1 || entity.relationStats.hospitals > 1) evidence.push(operatingEvidence({
            type: 'NETWORK_REACH',
            label: '网络覆盖',
            value: `${entity.relationStats.hospitals} 家医院 / ${entity.relationStats.departments} 个科室`,
            sourceId: `network-reach:${entity.customerId}`,
            sourceType: 'RELATIONSHIP_GRAPH',
            observedAt: generatedAt
          }));
          evidence.push(...evidenceForImportance.filter(item => /行政|学术/.test(item.label)).slice(0, 1));
          add({
            ...common,
            product: null,
            profileKey: '',
            signalType: 'KEY_INFLUENCER',
            priority: entity.lastFollowUpDays !== null && entity.lastFollowUpDays >= this.rules.longFollowUpDays ? 'P0' : 'P1',
            title: '关键关系节点',
            evidence
          });
        }
        if (['LOST', 'AT_RISK', 'RECOVERABLE'].includes(entity.currentStatus) || ['LOST', 'RECOVERABLE'].includes(entity.developmentStatus)) {
          const historicalPeak = Math.max(0, ...(entity.monthlyActuals || []).map(item => finite(item.value)));
          const evidence = [operatingEvidence({
            type: 'RECOVERY_STATUS',
            label: '当前状态支持复核恢复机会',
            value: STATUS[entity.currentStatus]?.label || DEVELOPMENT_STATUS[entity.developmentStatus]?.label || entity.currentStatus,
            sourceId: `recovery-status:${entity.customerId}:${entity.product || 'customer'}`,
            sourceType: entity.product ? 'PRODUCT_PROFILE' : 'CUSTOMER_MASTER',
            observedAt: generatedAt
          })];
          if (historicalPeak > 0) evidence.push(operatingEvidence({
            type: 'HISTORICAL_SALES',
            label: '历史最高销量',
            value: `${historicalPeak} 盒`,
            sourceId: `historical-sales:${entity.customerId}:${entity.product}`,
            sourceType: 'READ_ONLY_SALES_PROFILE',
            observedAt: entity.latestMonth
          }));
          add({
            ...common,
            signalType: 'RECOVERY_OPPORTUNITY',
            priority: highValue ? 'P1' : 'P2',
            title: '建议复核恢复机会',
            summary: '现有状态与历史事实提示可进行人工复核，并不代表一定可以恢复。',
            evidence
          });
        }
        if (entity.upgradeOpportunity) {
          const evidence = [];
          if (entity.latestPlan) evidence.push(operatingEvidence({
            type: 'UPGRADE_PLAN',
            label: '已有升级计划',
            value: entity.latestPlan.executionStatus || entity.latestPlan.targetGrade || '待推进',
            sourceId: entity.latestPlan.id || `plan:${entity.customerId}:${entity.product}`,
            sourceType: 'READ_ONLY_UPGRADE_PLAN',
            observedAt: entity.latestPlan.targetMonth || entity.latestPlan.updatedAt
          }));
          if (entity.latestValue !== null && gradeDistances(entity.latestValue).toUpgrade !== null && gradeDistances(entity.latestValue).toUpgrade <= 3) evidence.push(operatingEvidence({
            type: 'UPGRADE_DISTANCE',
            label: '接近下一销量等级',
            value: `还差 ${gradeDistances(entity.latestValue).toUpgrade} 盒`,
            sourceId: `upgrade-distance:${entity.customerId}:${entity.product}:${entity.latestMonth}`,
            sourceType: 'READ_ONLY_SALES_PROFILE',
            observedAt: entity.latestMonth
          }));
          add({
            ...common,
            signalType: 'UPGRADE_OPPORTUNITY',
            priority: entity.developmentStatus === 'PRIORITY' ? 'P1' : 'P2',
            title: '升级机会待推进',
            evidence
          });
        }
        const stagnant = entity.currentStatus === 'STAGNANT' || entity.lastFollowUpDays !== null && entity.lastFollowUpDays >= this.rules.longFollowUpDays && !risk;
        if (stagnant) {
          const evidence = [operatingEvidence({
            type: 'STAGNANT_STATUS',
            label: entity.currentStatus === 'STAGNANT' ? '经营状态长期停滞' : '长期无正式跟进',
            value: entity.lastFollowUpDays === null ? STATUS[entity.currentStatus]?.label || '停滞' : `${entity.lastFollowUpDays} 天`,
            sourceId: entity.latestFollowUp?.followUpId || `stagnant:${entity.customerId}:${entity.product || 'customer'}`,
            sourceType: entity.latestFollowUp ? 'FOLLOW_UP' : 'PRODUCT_PROFILE',
            observedAt: entity.latestFollowUp?.followUpAt || generatedAt
          })];
          add({
            ...common,
            signalType: 'STAGNANT_CUSTOMER',
            priority: 'P2',
            title: '客户长期停滞待核实',
            evidence
          });
        }
        const latestResource = [...entity.customerResources].sort((a, b) => String(b.executedAt || b.appliedAt || '').localeCompare(String(a.executedAt || a.appliedAt || '')))[0];
        const resourceAge = latestResource ? operatingDaysBetween(latestResource.executedAt || latestResource.appliedAt, referenceDate) : null;
        const followedAfterResource = latestResource && entity.latestFollowUp && String(entity.latestFollowUp.followUpAt || '') >= String(latestResource.executedAt || latestResource.appliedAt || '');
        if (latestResource && resourceAge !== null && resourceAge >= this.rules.resourceReviewDays && !followedAfterResource) {
          const evidence = [operatingEvidence({
            type: 'RESOURCE_INVESTMENT',
            label: '存在资源投入记录',
            value: latestResource.project || '资源投入',
            sourceId: latestResource.id || `resource:${entity.customerId}:${entity.product}`,
            sourceType: 'READ_ONLY_RESOURCE_PROVIDER',
            observedAt: latestResource.executedAt || latestResource.appliedAt
          }), operatingEvidence({
            type: 'NO_POST_RESOURCE_FOLLOWUP',
            label: '投入后尚无正式跟进记录',
            value: `${resourceAge} 天`,
            sourceId: `resource-followup:${entity.customerId}:${entity.product}`,
            sourceType: 'DERIVED_BUSINESS_RULE',
            observedAt: generatedAt
          })];
          add({
            ...common,
            signalType: 'RESOURCE_REVIEW',
            priority: highValue ? 'P1' : 'P2',
            title: '建议复核投入效果',
            summary: '资源投入后尚无正式跟进；仅表示时间上相关，需要人工复核效果。',
            evidence
          });
        }
      });
      const customerLevelEntities = [...new Map(enrichedEntities.map(item => [item.customerId, item])).values()].filter(item => item.active);
      customerLevelEntities.forEach(entity => {
        const stats = entity.relationStats;
        const gapFacts = [];
        if (stats.degree === 0) gapFacts.push('暂无有效客户关系');else if (stats.degree === 1) gapFacts.push('仅有单一客户关系');
        if (stats.degree && stats.weak === stats.degree) gapFacts.push('仅有弱关系');
        if (stats.inHospital === 0) gapFacts.push('缺少院内关系');
        if (entity.importance === 'HIGH' && stats.degree < 3) gapFacts.push('关键客户周边网络单薄');
        if (entity.importance !== 'NORMAL' && stats.degree > 0 && stats.departments <= 1) gapFacts.push('跨科室关系缺失');
        if (stats.inactiveConnections > 0) gapFacts.push('关联停用或缺失节点');
        if (gapFacts.length) {
          const evidence = gapFacts.map((label, index) => operatingEvidence({
            type: 'RELATIONSHIP_GAP',
            label,
            value: `${stats.degree} 条有效连接`,
            sourceId: `relationship-gap:${entity.customerId}:${index}`,
            sourceType: 'RELATIONSHIP_GRAPH',
            observedAt: generatedAt
          }));
          add({
            ...baseFields(entity),
            product: null,
            profileKey: '',
            signalType: 'RELATIONSHIP_GAP',
            priority: entity.importance === 'HIGH' ? 'P1' : 'P2',
            title: '客户关系覆盖待完善',
            evidence
          });
        }
      });
      const coverageSignals = [];
      const activeByProduct = enrichedEntities.filter(item => item.active && item.product);
      const coverageGroups = new Map();
      activeByProduct.forEach(entity => {
        [['HOSPITAL', entity.hospitalId || entity.hospital, entity.hospital], ['DEPARTMENT', entity.departmentId || entity.department, entity.department]].forEach(([scopeType, scopeId, scopeName]) => {
          if (!scopeId) return;
          const key = `${entity.product}|${scopeType}|${scopeId}`;
          if (!coverageGroups.has(key)) coverageGroups.set(key, {
            product: entity.product,
            scopeType,
            scopeId,
            scopeName,
            entities: []
          });
          coverageGroups.get(key).entities.push(entity);
        });
      });
      coverageGroups.forEach(group => {
        const unique = [...new Map(group.entities.map(item => [item.customerId, item])).values()];
        if (!unique.length) return;
        const related = unique.filter(item => item.hasRelationship).length;
        const abEntities = unique.filter(item => ['A', 'B'].includes(item.salesGrade));
        const ab = abEntities.length;
        const importantEntities = unique.filter(item => item.importance === 'HIGH');
        const important = importantEntities.length;
        const overdue = unique.filter(item => item.overdue).length;
        const longUnfollowed = unique.filter(item => item.lastFollowUpDays !== null ? item.lastFollowUpDays >= this.rules.longFollowUpDays : operatingDaysBetween(item.updatedAt, generatedAt) >= this.rules.longFollowUpDays).length;
        const risk = unique.filter(item => ['AT_RISK', 'LOST', 'DECLINING', 'DOWNGRADED'].includes(item.currentStatus)).length;
        const influencers = unique.filter(item => item.keyInfluencer).length;
        const resourceCustomers = unique.filter(item => item.customerResources.length).length;
        const abDepartments = new Set(abEntities.map(item => item.departmentId || item.department).filter(Boolean));
        const highValueIds = new Set([...abEntities, ...importantEntities].map(item => item.customerId));
        const neighborUse = new Map();
        unique.filter(item => highValueIds.has(item.customerId)).forEach(item => (relationByCustomer.get(item.customerId) || []).forEach(relationship => {
          const otherId = relationship.sourceCustomerId === item.customerId ? relationship.targetCustomerId : relationship.sourceCustomerId;
          neighborUse.set(otherId, (neighborUse.get(otherId) || 0) + 1);
        }));
        const concentratedOnOneNode = highValueIds.size > 1 && Math.max(0, ...neighborUse.values()) >= highValueIds.size;
        const relationshipRatio = related / unique.length;
        const valueConcentrated = group.scopeType === 'HOSPITAL' && ab >= 2 && abDepartments.size === 1;
        const hasGap = (ab || important) && (unique.length === 1 || relationshipRatio < this.rules.coverageRelationshipRatio || related <= 1 || valueConcentrated || concentratedOnOneNode) || resourceCustomers > 0 && related === 0 || longUnfollowed > 0;
        if (!hasGap) return;
        const anchor = [...unique].sort((a, b) => b.importanceScore - a.importanceScore)[0];
        const coverage = {
          customerCount: unique.length,
          abCustomerCount: ab,
          importantCustomerCount: important,
          relationshipCustomerRatio: relationshipRatio,
          noRelationshipCount: unique.length - related,
          overdueCount: overdue,
          longUnfollowedCount: longUnfollowed,
          highRiskCount: risk,
          keyInfluencerCount: influencers,
          resourceCustomerCount: resourceCustomers,
          valueConcentrated,
          concentratedOnOneNode
        };
        const evidence = [operatingEvidence({
          type: 'COVERAGE_METRIC',
          label: `${group.scopeType === 'HOSPITAL' ? '医院' : '科室'}客户覆盖`,
          value: `${unique.length} 位客户，关系覆盖 ${Math.round(relationshipRatio * 100)}%`,
          sourceId: `coverage:${group.product}:${group.scopeType}:${group.scopeId}`,
          sourceType: 'DERIVED_COVERAGE_INDEX',
          observedAt: generatedAt
        })];
        if (ab) evidence.push(operatingEvidence({
          type: 'HIGH_VALUE_DISTRIBUTION',
          label: 'A/B 客户数量',
          value: `${ab} 位`,
          sourceId: `coverage-ab:${group.product}:${group.scopeType}:${group.scopeId}`,
          sourceType: 'READ_ONLY_PRODUCT_PROFILE',
          observedAt: generatedAt
        }));
        if (valueConcentrated) evidence.push(operatingEvidence({
          type: 'VALUE_CONCENTRATION',
          label: 'A/B 客户集中在单一科室',
          value: `${ab} 位`,
          sourceId: `coverage-concentration:${group.product}:${group.scopeId}`,
          sourceType: 'DERIVED_COVERAGE_INDEX',
          observedAt: generatedAt
        }));
        if (concentratedOnOneNode) evidence.push(operatingEvidence({
          type: 'RELATIONSHIP_CONCENTRATION',
          label: '重点客户依赖同一关系节点',
          value: `${highValueIds.size} 位重点客户`,
          sourceId: `relationship-concentration:${group.product}:${group.scopeId}`,
          sourceType: 'RELATIONSHIP_GRAPH',
          observedAt: generatedAt
        }));
        if (longUnfollowed) evidence.push(operatingEvidence({
          type: 'FOLLOWUP_COVERAGE',
          label: '长期未跟进客户',
          value: `${longUnfollowed} 位`,
          sourceId: `coverage-followup:${group.product}:${group.scopeType}:${group.scopeId}`,
          sourceType: 'FOLLOW_UP',
          observedAt: generatedAt
        }));
        if (resourceCustomers && related === 0) evidence.push(operatingEvidence({
          type: 'RESOURCE_WITHOUT_GRAPH',
          label: '存在资源投入但关系图谱为空',
          value: `${resourceCustomers} 位客户`,
          sourceId: `coverage-resource:${group.product}:${group.scopeType}:${group.scopeId}`,
          sourceType: 'READ_ONLY_RESOURCE_PROVIDER',
          observedAt: generatedAt
        }));
        const recommendation = normalizeRecommendation({
          ...baseFields(anchor),
          signalType: 'COVERAGE_GAP',
          priority: ab || important ? 'P1' : 'P2',
          title: `${group.scopeName || (group.scopeType === 'HOSPITAL' ? '医院' : '科室')}覆盖缺口`,
          summary: `${group.scopeType === 'HOSPITAL' ? '医院' : '科室'}关系覆盖需人工复核；未将科室级销量归因到个人。`,
          scopeType: group.scopeType,
          scopeId: group.scopeId,
          coverage,
          evidence
        }, {
          generatedAt,
          suggestedDate: generatedAt
        });
        if (recommendation) {
          recommendations.push(recommendation);
          coverageSignals.push(recommendation);
        }
      });
      const deduplicated = [...new Map(recommendations.map(item => [item.recommendationKey, item])).values()];
      const sorted = filterOperatingRecommendations(deduplicated, {});
      const result = {
        recommendations: sorted,
        customerSignals: sorted.filter(item => item.signalType !== 'COVERAGE_GAP'),
        coverageSignals: sorted.filter(item => item.signalType === 'COVERAGE_GAP'),
        relationshipSignals: sorted.filter(item => ['RELATIONSHIP_GAP', 'HIGH_VALUE_WEAK_RELATIONSHIP', 'KEY_INFLUENCER'].includes(item.signalType)),
        generatedAt
      };
      this.cache = {
        fingerprint,
        result
      };
      return JSON.parse(JSON.stringify(result));
    }
  }
  function createCustomerOperatingIntelligenceProvider(options = {}) {
    return new CustomerOperatingIntelligenceProvider(options);
  }
  function operatingAnalysis(context = {}) {
    return (context.provider || createCustomerOperatingIntelligenceProvider(context.providerOptions)).analyze(context);
  }
  function getOperatingRecommendations(context = {}) {
    return operatingAnalysis(context).recommendations;
  }
  function getPriorityCustomers(context = {}) {
    return getOperatingRecommendations(context).filter(item => ['P0', 'P1'].includes(item.priority));
  }
  function getRelationshipGaps(context = {}) {
    return getOperatingRecommendations(context).filter(item => ['RELATIONSHIP_GAP', 'HIGH_VALUE_WEAK_RELATIONSHIP'].includes(item.signalType));
  }
  function getCoverageGaps(context = {}) {
    return getOperatingRecommendations(context).filter(item => item.signalType === 'COVERAGE_GAP');
  }
  function getRecoveryOpportunities(context = {}) {
    return getOperatingRecommendations(context).filter(item => item.signalType === 'RECOVERY_OPPORTUNITY');
  }
  function getSuggestedActions(context = {}) {
    return getOperatingRecommendations(context).flatMap(item => item.recommendedActions.map(action => ({
      ...action,
      recommendationKey: item.recommendationKey,
      priority: item.priority,
      signalType: item.signalType
    })));
  }
  function eventCategory(type) {
    if (type === 'FOLLOW_UP') return 'followup';
    if (type === 'QUICK_NOTE' || type === 'NOTE') return 'quick';
    if (type === 'DEVELOPMENT_STATUS' || type === 'MASTER_CHANGE' || ['SALE_CHANGE', 'GRADE_UP', 'GRADE_DOWN', 'RISK', 'LOSS', 'RECOVERY'].includes(type)) return 'status';
    if (type === 'PLAN' || type === 'PLAN_CREATED' || type === 'PLAN_UPDATED') return 'plan';
    if (type === 'INVESTMENT' || type === 'ACADEMIC_ACTIVITY' || type === 'RESOURCE') return 'investment';
    if (type === 'TASK_COMPLETED') return 'task';
    return 'status';
  }
  function collectCustomerEvents(profile = {}, options = {}) {
    const customerId = profile.customerId;
    const product = options.product || profile.product || null;
    const events = [];
    (options.notes || []).filter(item => item.customerId === customerId && (!item.product || !product || item.product === product)).forEach(item => events.push({
      ...item,
      eventId: item.id,
      at: item.date,
      type: 'QUICK_NOTE',
      category: 'quick',
      title: item.title || '快速记录',
      detail: item.detail || '',
      product: item.product || null,
      source: item.source || 'LOCAL_QUICK_NOTE'
    }));
    (options.followUps || []).filter(item => item.customerId === customerId && !item.deletedAt && (!item.product || !product || item.product === product)).forEach(item => events.push({
      ...item,
      eventId: item.followUpId,
      at: item.followUpAt,
      type: 'FOLLOW_UP',
      category: 'followup',
      title: FOLLOW_UP_TYPES[item.followUpType] || '跟进',
      detail: item.content,
      product: item.product || null
    }));
    (options.developmentHistory || []).filter(item => item.customerId === customerId).forEach(item => events.push({
      ...item,
      at: item.changedAt,
      type: 'DEVELOPMENT_STATUS',
      category: 'status',
      title: `${DEVELOPMENT_STATUS[item.previousStatus]?.label || '未设置'} → ${DEVELOPMENT_STATUS[item.newStatus]?.label || item.newStatus}`,
      detail: item.reason,
      product: null
    }));
    (options.masterEvents || []).filter(item => item.customerId === customerId).forEach(item => {
      const labels = {
        customerName: "Synthetic Customer Example",
        hospital: '医院',
        department: '科室',
        employee: '负责人',
        associatedProducts: '关联产品',
        perceptionLevel: '等级',
        developmentStatus: '开发状态',
        nextAction: '下一步动作',
        nextFollowUpDate: '下次跟进',
        notes: '备注',
        active: '启用状态'
      };
      const fields = [...new Set((item.fields || []).map(field => labels[field]).filter(Boolean))];
      const detail = fields.length ? `已更新：${fields.slice(0, 4).join('、')}${fields.length > 4 ? '等资料' : ''}` : '客户档案资料已更新';
      events.push({
        ...item,
        at: item.changedAt,
        type: 'MASTER_CHANGE',
        category: 'status',
        title: '客户主档案已更新',
        detail,
        product: null
      });
    });
    (options.plans || []).filter(item => !item.product || !product || item.product === product).forEach(item => events.push({
      eventId: `plan_${item.id || stableId([item.targetMonth, item.title, item.followUp])}`,
      at: item.updatedAt || item.targetMonth || item.nextReviewDate,
      type: 'PLAN',
      category: 'plan',
      title: item.title || '客户升级计划',
      detail: item.followUp || item.issues || '只读计划引用',
      product: item.product || product,
      source: 'READ_ONLY_PLAN_PROVIDER'
    }));
    (options.resources || []).filter(item => !item.product || !product || item.product === product).forEach(item => events.push({
      eventId: `investment_${item.id || stableId([item.executedAt, item.appliedAt, item.project])}`,
      at: item.executedAt || item.appliedAt,
      type: 'INVESTMENT',
      category: 'investment',
      title: item.project || '学术投入',
      detail: item.result || item.purpose || '只读资源引用',
      product: item.product || product,
      source: 'READ_ONLY_RESOURCE_PROVIDER'
    }));
    const tasksById = new Map((options.tasks || []).filter(Boolean).map(item => [String(item.taskId || item.id || ''), item]));
    (options.taskLinks || []).filter(item => item.customerId === customerId && (!item.product || !product || item.product === product)).forEach(link => {
      const task = tasksById.get(String(link.taskId));
      if (link.state !== 'COMPLETED' && !(task?.completedAt || Number(task?.progress) >= 100 || task?.status === 'completed')) return;
      events.push({
        eventId: `task_completed_${link.taskId}`,
        taskId: link.taskId,
        customerId,
        at: task?.completedAt || link.completedAt,
        type: 'TASK_COMPLETED',
        category: 'task',
        title: task?.title || '客户任务已完成',
        detail: `由经营建议转化的任务已完成`,
        product: link.product || null,
        sourceRecommendationKey: link.recommendationKey,
        source: 'DERIVED_TASK_BRIDGE'
      });
    });
    (profile.customerEvents || []).forEach((item, index) => events.push({
      ...item,
      eventId: item.id || `profile_${index}_${stableId([item.date, item.type, item.title])}`,
      at: item.date,
      category: eventCategory(item.type),
      product: item.product || product,
      source: item.source || 'READ_ONLY_PROFILE_EVENT'
    }));
    const seen = new Set();
    return events.filter(item => {
      const key = `${item.type}|${item.eventId || ''}|${item.at || ''}|${item.title || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }
  function monthPoints(values, targets, resolver) {
    return values.map((value, index) => ({
      month: `2026-${String(index + 3).padStart(2, '0')}`,
      value,
      target: targets?.[index] ?? null,
      grade: safeGradeResolver(resolver)(value)
    }));
  }
  function baseFixture(spec, resolver) {
    return {};
  }
  function buildFixtureProfiles(options = {}) {
    const provider=options.provider||globalThis.PUBLIC_SYNTHETIC_DATA;
    return buildProfilesFromAppData((provider?.records||[]).filter(row=>row.orderBoxes!==null&&row.orderBoxes!==undefined),[],options);
  }
  function buildProfilesFromAppData(records = [], tasks = [], options = {}) {
    const resolver = safeGradeResolver(options.gradeResolver);
    const groups = new Map();
    let observationSequence=0;
    function ensureProfile(source) {
      const projectionOrder=++observationSequence;
      const customer = String(source.customer || '').trim();
      const hospital = String(source.hospital || '').trim();
      const department = String(source.department || source.departmentRoom || '').trim();
      const employee = String(source.employee || '').trim();
      const product = String(source.product || '').trim();
      const hospitalId = String(globalThis.HospitalIdentity?.resolve(source.hospitalId || '', hospital) || source.hospitalId || stableId(['hospital', hospital]));
      const departmentIdentity = Departments.normalize({
        hospitalId,
        department,
        departmentId: source.departmentId,
        departmentAliases: source.departmentAliases,
        legacyIds: source.legacyDepartmentIds,
        sourceDepartmentId: source.sourceDepartmentId,
        provenance: source.departmentProvenance
      });
      const customerId = String(source.customerId || '');
      const observationKey = String(source.id || source.sourceRecordId || 'observation-'+(++observationSequence));
      const key = customerId ? `${customerId}::${product}` : `unbound:${observationKey}:${projectionOrder}::${product}`;
      if (!groups.has(key)) groups.set(key, {
        customerId,
        originalCustomerId: customerId,
        sourceRecordId: observationKey,
        sourceProjectionKey: customerId ? customerId : `unbound:${observationKey}:${projectionOrder}`,
        identitySource: JSON.parse(JSON.stringify(source)),
        perceptionObservations: [],
        canonicalName: customer,
        aliases: source.customerAliases || [],
        employeeId: source.employeeId || stableId(['employee', employee]),
        employeeName: employee,
        office: source.office || '',
        hospitalId,
        hospitalName: hospital,
        hospitalAliases: source.hospitalAliases || [],
        departmentId: departmentIdentity.departmentId,
        legacyDepartmentIds: departmentIdentity.legacyIds,
        departmentProvenance: departmentIdentity.provenance,
        departmentName: department,
        departmentAliases: source.departmentAliases || [],
        product,
        perceptionLevel: source.perceptionLevel || 'R?',
        monthlyActuals: [],
        monthlyTargets: [],
        gradeHistory: [],
        currentStatus: 'ACTIVE',
        plans: [],
        resourceInvestments: [],
        activityRefs: [],
        quickNotes: [],
        customerEvents: [],
        riskFlags: [],
        lastActiveMonth: null,
        lastUpdatedAt: source.importedAt || source.updatedAt || new Date().toISOString(),
        legacyProfile: {
          customerJobTitle: source.customerJobTitle || '',
          managedBeds: source.managedBeds ?? '',
          customerType: source.customerType || ''
        }
      });
      const profile=groups.get(key);
      if(source.sourceType==='customer' && source.taskType==='customer_visit' && String(source.sourceId || '')===customerId) profile.identitySource=JSON.parse(JSON.stringify(source));
      const explicit=normalizePerceptionLevel(source.perceptionLevel), heuristic=!explicit?String(source.awareness || source.notes || '').match(/R[1-4]/i)?.[0]?.toUpperCase() || '':'';
      if(explicit || heuristic)profile.perceptionObservations.push({...JSON.parse(JSON.stringify(source)),product,value:explicit || heuristic,structured:Boolean(explicit),sourceKind:'SOURCE_RECORD'});
      return {key,profile,product,customerId};
    }
    const rows = (records || []).filter(record => String(record.customer || '').trim() && PRODUCTS.includes(String(record.product || '').trim()));
    rows.forEach(record => {
      const {
        key,
        profile,
        product,
        customerId
      } = ensureProfile(record);
      const month = String(record.date || '').slice(0, 7);
      if (!month) return;
      const point = profile.monthlyActuals.find(item => item.month === month);
      if (point) point.value += finite(record.orderBoxes);else profile.monthlyActuals.push({
        month,
        value: finite(record.orderBoxes)
      });
      if (record.activityType || finite(record.activityCost)) profile.resourceInvestments.push({
        id: record.activityId || stableId([key, record.date, record.activityType]),
        customerId,
        product,
        project: record.activityType || '未命名学术投入',
        amount: finite(record.activityCost),
        applicant: profile.employeeName,
        appliedAt: record.date,
        executedAt: record.date,
        purpose: '来自现有只读销售记录',
        expectedGoal: '',
        result: ''
      });
    });
    (tasks || []).filter(task => String(task.customer || '').trim() && PRODUCTS.includes(String(task.product || '').trim())).forEach(task => {
      const {
        profile
      } = ensureProfile(task);
      const groupedOutputs = new Map();
      Object.entries(task.weeklyOutputs || {}).forEach(([period, value]) => {
        const month = String(period).slice(0, 7);
        if (month) groupedOutputs.set(month, (groupedOutputs.get(month) || 0) + finite(value));
      });
      groupedOutputs.forEach((value, month) => {
        if (!profile.monthlyActuals.some(item => item.month === month)) profile.monthlyActuals.push({
          month,
          value
        });
      });
      const perception = `${task.perceptionLevel || task.awareness || task.notes || ''}`.match(/R[1-4]/i)?.[0]?.toUpperCase();
      // Heuristic R text remains an observation, never operational authority.
      profile.legacyProfile = {
        customerJobTitle: task.customerJobTitle || profile.legacyProfile?.customerJobTitle || '',
        managedBeds: task.managedBeds ?? profile.legacyProfile?.managedBeds ?? '',
        customerType: task.customerType || profile.legacyProfile?.customerType || ''
      };
    });
    groups.forEach(profile => {
      profile.monthlyActuals.sort((a, b) => a.month.localeCompare(b.month));
      profile.gradeHistory = profile.monthlyActuals.map(item => ({
        month: item.month,
        grade: resolver(item.value)
      }));
      profile.currentSalesGrade = profile.gradeHistory.at(-1)?.grade || 'D';
      profile.lastActiveMonth = profile.monthlyActuals.filter(item => item.value > 0).at(-1)?.month || null;
      const recentValues = profile.monthlyActuals.map(item => item.value);
      const latestValue = recentValues.at(-1);
      const previousValue = recentValues.at(-2);
      const latestGrade = profile.gradeHistory.at(-1)?.grade;
      const previousGrade = profile.gradeHistory.at(-2)?.grade;
      if (!recentValues.length) profile.currentStatus = 'INSUFFICIENT_DATA';else if (latestValue === 0 && finite(previousValue) > 0) profile.currentStatus = 'AT_RISK';else if (previousGrade && SALES_GRADE_ORDER[latestGrade] > SALES_GRADE_ORDER[previousGrade]) profile.currentStatus = 'UPGRADED';else if (previousGrade && SALES_GRADE_ORDER[latestGrade] < SALES_GRADE_ORDER[previousGrade]) profile.currentStatus = 'DOWNGRADED';else if (streak(recentValues, 'down') >= 2) profile.currentStatus = 'DECLINING';else if (streak(recentValues, 'up') >= 2) profile.currentStatus = 'GROWING';
      const customerTasks = (tasks || []).filter(task => String(task.customer || '').trim() === profile.canonicalName && task.product === profile.product);
      const perception = customerTasks.map(task => `${task.perceptionLevel || task.awareness || task.notes || ''}`.match(/R[1-4]/i)?.[0]?.toUpperCase()).find(Boolean);
      // Group labels cannot create field-specific R authority.
    });
    return [...groups.values()];
  }
  function deriveRiskFlags(profile, month, resolver) {
    const metrics = profileMetrics(profile, month, resolver);
    const flags = [...(profile.riskFlags || [])];
    const add = (code, label, tone = 'warn') => {
      if (!flags.some(item => item.code === code)) flags.push({
        code,
        label,
        tone
      });
    };
    if (metrics.downStreak >= 2) add('CONTINUOUS_DECLINE', `连续下降${metrics.downStreak}个月`);
    if (metrics.current === 0 && (metrics.previous || 0) > 0) add('SUDDEN_ZERO', '销量突然归零', 'danger');
    if (metrics.target !== null && metrics.average3 && metrics.target < metrics.average3 * 0.65) add('LOW_TARGET', '目标明显低于近3月水平');
    const targets = (profile.monthlyTargets || []).filter(item => item.month <= month).slice(-3).map(item => item.value);
    if (targets.length === 3 && new Set(targets).size === 1) add('STATIC_TARGET', '目标连续3个月不变');
    const latestActualMonth = (profile.monthlyActuals || []).map(item => item.month).sort().at(-1);
    if (month === latestActualMonth && metrics.current !== null && profile.currentSalesGrade && safeGradeResolver(resolver)(metrics.current) !== profile.currentSalesGrade) add('GRADE_MISMATCH', '等级与销量不一致', 'danger');
    if (profile.resourceInvestments?.length && !profile.plans?.length) add('RESOURCE_WITHOUT_PLAN', '有学术投入但无计划');
    const monthPlan = (profile.plans || []).find(plan => plan.targetMonth === month);
    if (monthPlan && !monthPlan.followUp) add('PLAN_WITHOUT_FOLLOW_UP', '有计划但无跟进方案');
    if (['A', 'B'].includes(metrics.previousGrade) && (metrics.delta || 0) < -5) add('HIGH_GRADE_DROP', '高等级客户明显掉量', 'danger');
    if (['C', 'D'].includes(metrics.grade) && metrics.consecutiveGradeMonths >= 4 && metrics.upStreak === 0) add('LOW_GRADE_STAGNANT', '低等级长期无升级');
    return flags;
  }
  function statusFor(profile) {
    return STATUS[profile.currentStatus] || STATUS.INSUFFICIENT_DATA;
  }
  function formatDelta(value) {
    if (value === null || value === undefined) return '暂无上月';
    return `${value > 0 ? '↑ +' : value < 0 ? '↓ ' : '→ '}${finite(value)}盒`;
  }
  function diagnosis(profile, month, resolver) {
    const metrics = profileMetrics(profile, month, resolver);
    const values = (profile.monthlyActuals || []).filter(item => item.month <= month).slice(-3).map(item => finite(item.value));
    const items = [];
    if (values.length >= 2) {
      const direction = metrics.upStreak >= 2 ? '持续增长' : metrics.downStreak >= 2 ? '持续下降' : '存在波动';
      items.push(`近${values.length}个月销量：${values.join(' → ')}盒，${direction}。`);
    } else items.push('销量历史不足，暂不能判断趋势。');
    if (metrics.grade) items.push(metrics.toUpgrade === null ? `当前${metrics.grade}级，已处于最高销量等级。` : `当前${metrics.grade}级，距下一等级还差${metrics.toUpgrade}盒。`);
    if (metrics.target === null) items.push(`${monthLabel(month)}尚未设置客户目标。`);else items.push(`${monthLabel(month)}目标${metrics.target}盒，当前完成率${pct(metrics.completion)}。`);
    if (profile.resourceInvestments?.length) items.push('存在学术投入记录；投入后观察到销量变化，仍需用后续月份验证，不能直接认定因果。');
    const plan = (profile.plans || []).find(item => item.targetMonth === month);
    if (plan && !plan.followUp) items.push('已有客户计划，但跟进方案尚未补充。');
    return items.slice(0, 5);
  }
  function renderTrendChart(profile, month, range) {
    let actuals = (profile.monthlyActuals || []).filter(item => item.month <= month).sort((a, b) => a.month.localeCompare(b.month));
    if (range === '6') actuals = actuals.slice(-6);else {
      const [year, monthNumber] = month.split('-').map(Number);
      const fiscalStart = monthNumber >= 10 ? `${year}-10` : `${year - 1}-10`;
      actuals = actuals.filter(item => item.month >= fiscalStart);
    }
    const months = actuals.map(item => item.month);
    const targets = months.map(item => targetFor(profile, item));
    if (!actuals.length) return '<div class="cp-empty cp-chart-empty"><span>⌁</span><strong>尚无销量数据</strong><p>导入月度销量后可查看实际与目标趋势。</p></div>';
    const allValues = [...actuals.map(item => finite(item.value)), ...targets.filter(item => item !== null)];
    const max = Math.max(...allValues, 1);
    const min = Math.min(...allValues, 0);
    const width = 680;
    const height = 250;
    const left = 40;
    const top = 24;
    const innerWidth = width - 64;
    const innerHeight = height - 62;
    const x = index => left + (actuals.length === 1 ? innerWidth / 2 : index / (actuals.length - 1) * innerWidth);
    const y = value => top + (max === min ? innerHeight / 2 : (max - value) / (max - min) * innerHeight);
    const actualPoints = actuals.map((item, index) => `${x(index)},${y(finite(item.value))}`).join(' ');
    const targetPoints = targets.map((value, index) => value === null ? null : `${x(index)},${y(value)}`).filter(Boolean).join(' ');
    const peak = Math.max(...actuals.map(item => item.value));
    const low = Math.min(...actuals.map(item => item.value));
    return `<div class="cp-chart-wrap"><svg class="cp-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="客户月度销量趋势，实际销量实线，目标销量虚线">
      <line x1="${left}" y1="${top + innerHeight}" x2="${left + innerWidth}" y2="${top + innerHeight}" class="cp-axis"/>
      <line x1="${left}" y1="${top}" x2="${left}" y2="${top + innerHeight}" class="cp-axis"/>
      <polyline points="${actualPoints}" class="cp-line-actual"/><polyline points="${targetPoints}" class="cp-line-target"/>
      ${actuals.map((item, index) => `<g><circle cx="${x(index)}" cy="${y(item.value)}" r="5" class="cp-point ${item.value === peak ? 'peak' : item.value === low ? 'low' : ''}"/><text x="${x(index)}" y="${y(item.value) - 11}" text-anchor="middle" class="cp-chart-value">${item.value}</text><text x="${x(index)}" y="${height - 13}" text-anchor="middle" class="cp-chart-label">${monthLabel(item.month)}</text></g>`).join('')}
      ${targets.map((value, index) => value === null ? '' : `<circle cx="${x(index)}" cy="${y(value)}" r="3" class="cp-target-point"/>`).join('')}
    </svg><div class="cp-chart-legend"><span><i class="actual"></i>实际销量</span><span><i class="target"></i>目标销量</span><span>峰值 ${peak}盒</span><span>低点 ${low}盒</span></div></div>`;
  }
  function eventLabel(type) {
    return {
      SALE_CHANGE: '销量变化',
      GRADE_UP: '等级升级',
      GRADE_DOWN: '等级降级',
      PLAN_CREATED: '计划创建',
      PLAN_UPDATED: '计划更新',
      PLAN: '计划',
      VISIT: '拜访',
      FOLLOW_UP: '正式跟进',
      TASK_COMPLETED: '任务完成',
      ACADEMIC_ACTIVITY: '学术活动',
      RESOURCE: '资源投入',
      INVESTMENT: '学术投入',
      NOTE: '快速记录',
      QUICK_NOTE: '快速记录',
      DEVELOPMENT_STATUS: '开发状态变化',
      MASTER_CHANGE: '主档案变化',
      RISK: '风险提醒',
      LOSS: '流失追踪',
      RECOVERY: '恢复跟进'
    }[type] || '客户动态';
  }
  function readLocalNotes(storage) {
    try {
      return JSON.parse(storage?.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }
  function mount(config) {
    const root = config?.root;
    if (!root) throw new Error('CustomerProfileV1 requires a root element');
    const resolver = safeGradeResolver(config.gradeResolver);
    const storage = config.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const forcedDemo = Boolean(config.demo);
    const rawFixtureProfiles = buildFixtureProfiles({
      gradeResolver: resolver,
      count: config.fixtureCount || 500
    });
    let rawLiveProfiles = buildProfilesFromAppData(config.records || [], config.tasks || [], {
      gradeResolver: resolver
    });
    const seedProfiles = forcedDemo ? rawFixtureProfiles : rawLiveProfiles;
    const notifyDataChange = () => config.onDataChange?.();
    const notifyMasterChange = () => {
      notifyDataChange();
      config.onHospitalDirectoryChange?.();
    };
    const masterStore = createCustomerMasterStore({
      storage,
      seedRecords: (forcedDemo || globalThis.WORK_PROGRESS_PUBLIC_RUNTIME?.syntheticDemo === true) ? seedMasterRecords(rawFixtureProfiles).map(row=>({...row,source:'HUMAN_REVIEW'})) : [],
      onChange: notifyMasterChange
    });
    const developmentStore = createDevelopmentStore({
      storage,
      masterRecords: masterStore.list(),
      onChange: notifyDataChange
    });
    const followUpStore = createFollowUpStore({
      storage,
      onChange: notifyDataChange
    });
    const insightStore = createCustomerInsightStore({
      storage
    });
    const insightProvider = config.customerInsightProvider || createLocalCustomerInsightProvider();
    const professionalStore = createProfessionalProfileStore({
      storage
    });
    const professionalProvider = config.customerProfessionalProfileProvider || createCustomerProfessionalProfileProvider();
    const relationshipStore = createRelationshipStore({
      storage,
      customers: masterStore.list(),
      customerExists: customerId => Boolean(masterStore.get(customerId)),
      seedRecords: forcedDemo ? seedRelationshipRecords(masterStore.list().slice(0, 80)) : []
    });
    const relationshipLayoutStore = createRelationshipLayoutStore({
      storage
    });
    const customerImageStore = config.customerImageStore || createCustomerImageStore({
      indexedDB: config.indexedDB
    });
    const recommendationActionStore = createRecommendationActionStore({
      storage
    });
    const operatingProvider = config.customerOperatingIntelligenceProvider || createCustomerOperatingIntelligenceProvider();
    const taskBridge = config.taskBridge || (typeof window !== 'undefined' ? window.CustomerTaskBridge : null);
    const taskLinkStore = createTaskLinkStore({
      storage
    });
    if (forcedDemo && !professionalStore.list().length) {
      const sample = masterStore.list().slice(0, 4);
      if (sample[0]) professionalStore.upsert({
        customerId: sample[0].customerId,
        administrativeTitles: [{
          title: '科室主任',
          organization: sample[0].hospital,
          level: 'DEPARTMENT',
          source: 'ANONYMOUS_DEMO',
          notes: '匿名演示资料'
        }],
        academicTitles: [{
          title: '省级学组委员',
          organization: '匿名学术组织',
          level: 'PROVINCIAL',
          source: 'ANONYMOUS_DEMO'
        }],
        source: 'ANONYMOUS_DEMO'
      });
      if (sample[1]) professionalStore.upsert({
        customerId: sample[1].customerId,
        administrativeTitles: [{
          title: '医疗组长',
          organization: sample[1].hospital,
          level: 'DEPARTMENT',
          source: 'ANONYMOUS_DEMO'
        }],
        source: 'ANONYMOUS_DEMO'
      });
    }
    const savedRelationshipView = relationshipLayoutStore.getViewState();
    const imageUrls = new Map();
    const imageLoads = new Set();
    let matchDecisions = readStoredJson(storage, MATCH_DECISIONS_KEY, {});
    let matchQueue = readStoredJson(storage, MATCH_QUEUE_KEY, []);
    if (!Array.isArray(matchQueue)) matchQueue = [];
    let fixtureProfiles = hydrateProfilesFromMaster(rawFixtureProfiles, masterStore.list(), matchDecisions);
    let liveProfiles = hydrateProfilesFromMaster(rawLiveProfiles, masterStore.list(), matchDecisions, {
      includeUnrepresented: true
    });
    let observationMonthExplicit = false;
    const state = {
      mode: 'overview',
      product: "Primary Product A",
      search: '',
      selectedKey: null,
      monitorCategory: 'attention',
      trendRange: '6',
      visibleCount: 40,
      filters: {
        office: 'all',
        employee: 'all',
        hospital: 'all',
        department: 'all',
        grade: 'all',
        status: 'all',
        month: defaultObservationMonth(forcedDemo || !liveProfiles.length ? fixtureProfiles : liveProfiles),
        resource: false,
        targetIncomplete: false,
        noPlan: false
      },
      localNotes: readLocalNotes(storage),
      useDemo: forcedDemo || !liveProfiles.length,
      panel: null,
      masterSearch: '',
      masterActiveFilter: 'active',
      selectedMasterId: null,
      importAnalysis: null,
      importReport: null,
      importFileName: '',
      noteContextKey: null,
      timelineFilter: 'all',
      selectedFollowUpId: null,
      convertingNoteId: null,
      statusCustomerId: null,
      insightCustomerId: null,
      insightEditCustomerId: null,
      expandedInsightCustomerId: null,
      lastDeletedFollowUpId: null,
      insightError: '',
      relationshipViewMode: ['horizon', 'planet'].includes(savedRelationshipView.viewMode) ? savedRelationshipView.viewMode : 'horizon',
      relationshipZoom: Math.min(1.8, Math.max(.55, Number(savedRelationshipView.zoom) || 1)),
      relationshipPanX: finite(savedRelationshipView.panX),
      relationshipPanY: finite(savedRelationshipView.panY),
      graphFullscreen: false,
      relationshipFilters: {
        hospital: 'all',
        department: 'all',
        grades: [],
        perceptionLevels: [],
        developmentStatus: 'all',
        currentStatus: 'all',
        relationshipScope: 'all',
        hasRelationship: 'all',
        importantOnly: false,
        primaryOnly: false,
        ...(savedRelationshipView.filters || {})
      },
      selectedGraphCustomerId: String(savedRelationshipView.selectedCustomerId || ''),
      selectedRelationshipId: null,
      relationshipEditorSourceId: '',
      relationshipError: '',
      professionalCustomerId: '',
      professionalError: '',
      imageError: '',
      graphDrag: null,
      graphPan: null,
      intelligenceFilters: {
        customerId: 'all',
        product: 'all',
        hospital: 'all',
        department: 'all',
        priorities: [],
        signalType: 'all',
        grades: [],
        perceptionLevels: [],
        developmentStatus: 'all',
        currentStatus: 'all',
        overdue: 'all',
        hasRelationship: 'all',
        keyInfluencer: 'all',
        recommendationStatus: 'all'
      },
      selectedRecommendationKey: '',
      intelligenceError: '',
      taskDraft: null,
      taskDraftError: '',
      followUpSourceTaskId: '',
      followUpRecommendationKey: '',
      maintenanceHospitalId: ''
    };
    const relationshipWindow = typeof window !== 'undefined' ? window : null;
    const relationshipDocument = typeof document !== 'undefined' ? document : null;
    let relationshipViewingActive = false;
    let relationshipScrollTop = 0;
    let graphResizeFrame = 0;
    let graphFullscreenSnapshot = null;
    const relationshipViewportByMode = {
      horizon: {
        zoom: 1,
        panX: 0,
        panY: 0
      },
      planet: {
        zoom: 1,
        panX: 0,
        panY: 0
      }
    };
    relationshipViewportByMode[state.relationshipViewMode] = {
      zoom: state.relationshipZoom,
      panX: state.relationshipPanX,
      panY: state.relationshipPanY
    };
    function rememberGraphViewport(viewMode = state.relationshipViewMode) {
      relationshipViewportByMode[viewMode] = {
        zoom: state.relationshipZoom,
        panX: state.relationshipPanX,
        panY: state.relationshipPanY
      };
    }
    function restoreGraphViewport(viewMode = state.relationshipViewMode, source = relationshipViewportByMode) {
      const viewport = source[viewMode] || {
        zoom: 1,
        panX: 0,
        panY: 0
      };
      state.relationshipZoom = Math.min(1.8, Math.max(.65, Number(viewport.zoom) || 1));
      state.relationshipPanX = finite(viewport.panX);
      state.relationshipPanY = finite(viewport.panY);
    }
    function switchRelationshipViewMode(viewMode) {
      if (!['horizon', 'planet'].includes(viewMode) || viewMode === state.relationshipViewMode) return;
      rememberGraphViewport();
      state.relationshipViewMode = viewMode;
      restoreGraphViewport(viewMode);
      persistRelationshipView();
    }
    function relationshipViewportEvidence(source = 'browser') {
      return {
        source,
        width: relationshipWindow?.innerWidth || 0,
        height: relationshipWindow?.innerHeight || 0,
        orientation: (relationshipWindow?.innerWidth || 0) > (relationshipWindow?.innerHeight || 0) ? 'landscape' : 'portrait',
        viewMode: state.relationshipViewMode,
        displayMode: state.graphFullscreen ? 'fullscreen' : 'default'
      };
    }
    function publishRelationshipViewport(source = 'browser') {
      const evidence = relationshipViewportEvidence(source);
      if (relationshipDocument?.body) relationshipDocument.body.dataset.relationshipViewport = JSON.stringify(evidence);
      config.onRelationshipViewportChange?.(evidence);
      return evidence;
    }
    function syncGraphFullscreenClass() {
      const active = relationshipViewingActive && state.mode === 'relationships' && state.graphFullscreen;
      relationshipDocument?.body?.classList.toggle('cp-graph-fullscreen', active);
      relationshipDocument?.body?.classList.toggle('cp-relationship-landscape-active', active);
      if (!active) relationshipDocument?.body?.classList.remove('cp-relationship-landscape-fallback');
      if (relationshipDocument?.body) relationshipDocument.body.dataset.relationshipGraphDisplay = active ? 'fullscreen' : 'default';
      const nativeBridge = relationshipWindow?.AndroidBridge;
      if (typeof nativeBridge?.requestGraphLandscape === 'function') {
        if (active) nativeBridge.requestGraphLandscape();else nativeBridge.restoreGraphOrientation?.();
      } else if (active) {
        relationshipDocument.body.dataset.relationshipOrientationMode = 'web-landscape';
        Promise.resolve(relationshipWindow?.screen?.orientation?.lock?.('landscape')).catch(() => {}).then(() => {
          if (!state.graphFullscreen || !relationshipViewingActive) return;
          const needsFallback = relationshipViewportEvidence('web-fullscreen').orientation !== 'landscape';
          relationshipDocument.body.classList.toggle('cp-relationship-landscape-fallback', needsFallback);
          relationshipDocument.body.dataset.relationshipOrientationMode = needsFallback ? 'web-rotated-fallback' : 'web-landscape';
        });
      } else {
        relationshipWindow?.screen?.orientation?.unlock?.();
        if (relationshipDocument?.body) relationshipDocument.body.dataset.relationshipOrientationMode = 'portrait';
      }
    }
    function enterGraphFullscreen(options = {}) {
      if (state.mode !== 'relationships' || state.graphFullscreen) return false;
      rememberGraphViewport();
      graphFullscreenSnapshot = {
        horizon: {
          ...relationshipViewportByMode.horizon
        },
        planet: {
          ...relationshipViewportByMode.planet
        }
      };
      state.graphFullscreen = true;
      syncGraphFullscreenClass();
      if (options.pushHistory !== false && typeof history !== 'undefined' && String(location.hash) === '#customer-profile-v1/relationships') {
        history.pushState({
          ...(history.state || {}),
          workspaceNavigationLocalRoute: true,
          customerProfileV1GraphFullscreen: true
        }, '', '#customer-profile-v1/relationships/fullscreen');
      }
      publishRelationshipViewport('graph-fullscreen');
      renderResults();
      return true;
    }
    function collapseGraphFullscreen(options = {}) {
      if (!state.graphFullscreen) return false;
      if (!options.fromHistory && typeof history !== 'undefined' && String(location.hash) === '#customer-profile-v1/relationships/fullscreen') {
        history.back();
        return true;
      }
      rememberGraphViewport();
      state.graphFullscreen = false;
      if (graphFullscreenSnapshot) {
        Object.assign(relationshipViewportByMode.horizon, graphFullscreenSnapshot.horizon || {});
        Object.assign(relationshipViewportByMode.planet, graphFullscreenSnapshot.planet || {});
        restoreGraphViewport(state.relationshipViewMode, graphFullscreenSnapshot);
      }
      graphFullscreenSnapshot = null;
      syncGraphFullscreenClass();
      persistRelationshipView();
      publishRelationshipViewport('graph-default-restored');
      renderResults();
      return true;
    }
    function scheduleGraphViewportRender(source = 'resize') {
      if (!relationshipViewingActive || state.mode !== 'relationships' || !relationshipWindow) return;
      relationshipWindow.cancelAnimationFrame?.(graphResizeFrame);
      graphResizeFrame = relationshipWindow.requestAnimationFrame?.(() => {
        publishRelationshipViewport(source);
        renderResults();
      }) || 0;
    }
    function enterRelationshipViewingPlane() {
      if (!relationshipWindow || !relationshipDocument) return;
      const firstEntry = !relationshipViewingActive;
      relationshipViewingActive = true;
      if (firstEntry) relationshipScrollTop = relationshipWindow.scrollY || 0;
      syncGraphFullscreenClass();
      if (!firstEntry) {
        publishRelationshipViewport('existing-viewing-plane');
        return;
      }
      publishRelationshipViewport('portrait-graph');
    }
    function exitRelationshipViewingPlane() {
      if (!relationshipViewingActive || !relationshipDocument) return;
      relationshipViewingActive = false;
      relationshipDocument.body.classList.remove('cp-relationship-landscape-active', 'cp-relationship-landscape-fallback', 'cp-graph-fullscreen');
      delete relationshipDocument.body.dataset.relationshipOrientationMode;
      delete relationshipDocument.body.dataset.relationshipViewport;
      delete relationshipDocument.body.dataset.relationshipGraphDisplay;
      if (typeof relationshipWindow?.AndroidBridge?.restoreGraphOrientation === 'function') relationshipWindow.AndroidBridge.restoreGraphOrientation();else relationshipWindow?.screen?.orientation?.unlock?.();
      relationshipWindow?.requestAnimationFrame?.(() => relationshipWindow.scrollTo({
        top: relationshipScrollTop,
        behavior: 'auto'
      }));
    }
    function syncRelationshipViewingPlane(graphMode) {
      if (graphMode) void enterRelationshipViewingPlane();else exitRelationshipViewingPlane();
    }
    function openRelationshipView(options = {}) {
      state.mode = 'relationships';
      state.graphFullscreen = false;
      graphFullscreenSnapshot = null;
      state.selectedKey = null;
      persistRelationshipView();
      if (options.pushHistory && typeof history !== 'undefined' && !String(location.hash).startsWith('#customer-profile-v1/relationships')) {
        history.pushState({
          ...(history.state || {}),
          workspaceNavigationLocalRoute: true,
          customerProfileV1Graph: true
        }, '', '#customer-profile-v1/relationships');
      }
      render();
    }
    function leaveRelationshipView(options = {}) {
      if (state.mode !== 'relationships') return false;
      if (state.graphFullscreen) return collapseGraphFullscreen(options);
      if (!options.fromHistory && typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/relationships')) {
        history.back();
        return true;
      }
      state.mode = 'overview';
      state.selectedGraphCustomerId = '';
      render();
      return true;
    }
    function graphLocalPoint(event, viewport) {
      const rect = viewport.getBoundingClientRect();
      if (relationshipDocument?.body.classList.contains('cp-relationship-landscape-fallback')) {
        return {
          x: event.clientY - rect.top,
          y: rect.right - event.clientX
        };
      }
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
    function applyGraphZoom(nextZoom, localPoint) {
      const previousZoom = state.relationshipZoom;
      const zoom = Math.min(1.8, Math.max(.65, nextZoom));
      const point = localPoint || {
        x: 0,
        y: 0
      };
      const worldX = (point.x - state.relationshipPanX) / previousZoom;
      const worldY = (point.y - state.relationshipPanY) / previousZoom;
      state.relationshipPanX = point.x - worldX * zoom;
      state.relationshipPanY = point.y - worldY * zoom;
      state.relationshipZoom = zoom;
      persistRelationshipView();
      renderResults();
    }
    relationshipWindow?.addEventListener?.('resize', () => scheduleGraphViewportRender('resize'));
    if (relationshipWindow) relationshipWindow.CustomerRelationshipOrientation = {
      onNativeViewportChanged(width, height, orientation) {
        if (relationshipDocument?.body) {
          relationshipDocument.body.classList.remove('cp-relationship-landscape-fallback');
          relationshipDocument.body.dataset.relationshipOrientationMode = 'native-landscape';
          relationshipDocument.body.dataset.relationshipViewport = JSON.stringify({
            source: 'android-configuration',
            width,
            height,
            orientation,
            viewMode: state.relationshipViewMode
          });
        }
        scheduleGraphViewportRender('android-configuration');
      }
    };
    const planProvider = config.customerPlanProvider || createCustomerPlanProvider();
    const resourceProvider = config.resourceInvestmentProvider || createResourceInvestmentProvider();
    const allProfilesIncludingInactive = () => state.useDemo ? fixtureProfiles : liveProfiles;
    const allProfiles = () => allProfilesIncludingInactive().filter(profile => profile.masterActive !== false);
    function profileForKey(key) {
      const existing = allProfilesIncludingInactive().find(profile => profileKey(profile) === key);
      if (existing) return existing;
      const separator = String(key || '').lastIndexOf('::');
      if (separator < 0) return null;
      const customerId = String(key).slice(0, separator);
      const product = String(key).slice(separator + 2);
      const master = masterStore.get(customerId);
      if (!master || !PRODUCTS.includes(product)) return null;
      return {
        customerId: master.customerId,
        canonicalName: master.customerName,
        aliases: master.aliases,
        product,
        employeeId: master.employeeId,
        employeeName: master.employee,
        hospitalId: master.hospitalId,
        hospitalName: master.hospital,
        hospitalAliases: master.hospitalAliases,
        departmentId: master.departmentId,
        departmentName: master.department,
        departmentAliases: master.departmentAliases,
        perceptionLevel: 'R?',
        office: '',
        currentSalesGrade: 'D',
        currentStatus: 'INSUFFICIENT_DATA',
        monthlyActuals: [],
        monthlyTargets: [],
        gradeHistory: [],
        plans: [],
        resourceInvestments: [],
        customerEvents: [],
        masterData: master,
        masterActive: master.active,
        masterMatch: {
          matchType: 'EXACT',
          confidence: 1,
          customerId: master.customerId,
          resolvedBy: 'STABLE_ID'
        }
      };
    }
    const availableMonths = () => [...new Set(allProfiles().flatMap(profile => (profile.monthlyActuals || []).map(item => item.month)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    function persistDecisions() {
      storage?.setItem(MATCH_DECISIONS_KEY, JSON.stringify(matchDecisions));
    }
    function persistQueue() {
      storage?.setItem(MATCH_QUEUE_KEY, JSON.stringify(matchQueue));
    }
    function saveDecision(signature, customerId) {
      if (!signature || !customerId) return;
      matchDecisions[signature] = customerId;
      persistDecisions();
    }
    function enqueue(items) {
      (items || []).forEach(item => {
        if (!item?.queueId || matchQueue.some(queued => queued.queueId === item.queueId)) return;
        matchQueue.push(item);
      });
      persistQueue();
    }
    function refreshHydration() {
      const masters = masterStore.list();
      fixtureProfiles = hydrateProfilesFromMaster(rawFixtureProfiles, masters, matchDecisions, {
        includeUnrepresented: false
      });
      liveProfiles = hydrateProfilesFromMaster(rawLiveProfiles, masters, matchDecisions, {
        includeUnrepresented: true
      });
      state.useDemo = forcedDemo || !liveProfiles.length;
      if (!observationMonthExplicit) state.filters.month = defaultObservationMonth(state.useDemo ? fixtureProfiles : liveProfiles);
    }
    function effectivePlans(profile) {
      const provided = planProvider.getCustomerPlans?.(profile.customerId, {
        product: profile.product,
        month: state.filters.month,
        customerName: profile.canonicalName,
        hospital: profile.hospitalName,
        department: profile.departmentName,
        employee: profile.employeeName
      });
      return Array.isArray(provided) && provided.length ? provided : profile.plans || [];
    }
    function effectiveResources(profile) {
      const provided = resourceProvider.getResourceInvestments?.(profile.customerId, {
        product: profile.product,
        month: state.filters.month,
        customerName: profile.canonicalName,
        hospital: profile.hospitalName,
        department: profile.departmentName,
        employee: profile.employeeName
      });
      return Array.isArray(provided) && provided.length ? provided : profile.resourceInvestments || [];
    }
    function developmentFor(customerId) {
      return developmentStore.get(customerId);
    }
    function allLocalNotesForCustomer(customerId) {
      return Object.entries(state.localNotes).filter(([key]) => key.startsWith(`${customerId}::`)).flatMap(([, items]) => Array.isArray(items) ? items : []);
    }
    function noteById(noteId) {
      return Object.values(state.localNotes).flatMap(items => Array.isArray(items) ? items : []).find(item => item.id === noteId) || null;
    }
    function followUpsForProfile(profile, options = {}) {
      return followUpStore.list({
        customerId: profile.customerId,
        includeDeleted: Boolean(options.includeDeleted)
      }).filter(item => !item.product || item.product === profile.product);
    }
    function latestFollowUpForProfile(profile) {
      return followUpsForProfile(profile)[0] || null;
    }
    function currentFollowUpFields(profile) {
      const master = masterStore.get(profile.customerId) || {};
      const latest = latestFollowUpForProfile(profile) || {};
      const nextFollowUpDate = latest.nextFollowUpDate || master.nextFollowUpDate || '';
      return {
        latest,
        currentObstacle: latest.currentObstacle || master.currentObstacle || '',
        nextAction: latest.nextAction || master.nextAction || '',
        nextFollowUpDate,
        overdue: isFollowUpOverdue(nextFollowUpDate, followUpsForProfile(profile), new Date())
      };
    }
    function persistRelationshipView() {
      rememberGraphViewport();
      relationshipLayoutStore.saveViewState({
        viewMode: state.relationshipViewMode,
        zoom: state.relationshipZoom,
        panX: state.relationshipPanX,
        panY: state.relationshipPanY,
        filters: state.relationshipFilters,
        selectedCustomerId: state.selectedGraphCustomerId
      });
    }
    function graphCustomers() {
      const profiles = allProfilesIncludingInactive().filter(profile => profile.product === state.product);
      const profileByCustomer = new Map(profiles.map(profile => [profile.customerId, profile]));
      const relationships = relationshipStore.list();
      const professionals = professionalStore.list();
      const rows = masterStore.list().map(master => {
        const profile = profileByCustomer.get(master.customerId) || {
          customerId: master.customerId,
          canonicalName: master.customerName,
          hospitalId: master.hospitalId,
          hospitalName: master.hospital,
          departmentId: master.departmentId,
          departmentName: master.department,
          perceptionLevel: 'R?',
          currentSalesGrade: 'D',
          currentStatus: 'INSUFFICIENT_DATA',
          product: state.product,
          monthlyActuals: [],
          monthlyTargets: [],
          gradeHistory: [],
          plans: [],
          resourceInvestments: [],
          customerEvents: []
        };
        const metrics = profileMetrics(profile, state.filters.month, resolver);
        const development = developmentFor(master.customerId);
        const followFields = currentFollowUpFields(profile);
        return {
          customerId: master.customerId,
          customerName: master.customerName || profile.canonicalName,
          aliases: master.aliases,
          hospitalId: master.hospitalId,
          hospital: master.hospital || profile.hospitalName,
          departmentId: master.departmentId,
          department: master.department || profile.departmentName,
          employee: master.employee || profile.employeeName,
          perceptionLevel: profile.perceptionProjection?.value || '' || 'R?',
          salesGrade: metrics.grade || profile.currentSalesGrade || 'D',
          developmentStatus: development.status,
          currentStatus: profile.currentStatus || 'INSUFFICIENT_DATA',
          active: master.active !== false,
          nextFollowUpDate: followFields.nextFollowUpDate,
          overdue: followFields.overdue,
          latestFollowUp: followFields.latest,
          profileKey: profileKey(profile),
          product: state.product
        };
      });
      return sortCustomersByImportance(rows, relationships, professionals, Object.fromEntries(rows.map(row => [row.customerId, {
        overdue: row.overdue
      }])));
    }
    function graphData() {
      return filterRelationshipGraph(graphCustomers(), relationshipStore.list(), state.relationshipFilters);
    }
    function initialsFor(customer) {
      const text = String(customer?.customerName || '客').trim();
      return esc(text.slice(Math.max(0, text.length - 2)) || '客');
    }
    function customerAvatarHtml(customer, size = 'normal') {
      const url = imageUrls.get(customer.customerId);
      return `<span class="cp-customer-avatar ${size === 'large' ? 'is-large' : ''}" data-cp-avatar="${esc(customer.customerId)}"><span data-cp-avatar-fallback>${initialsFor(customer)}</span>${url ? `<img src="${esc(url)}" alt="${esc(customer.customerName)}头像" data-cp-avatar-image>` : ''}</span>`;
    }
    function requestCustomerImages(customers = []) {
      const pending = customers.map(customer => customer.customerId).filter(customerId => customerId && !imageUrls.has(customerId) && !imageLoads.has(customerId));
      if (!pending.length) return;
      pending.forEach(customerId => imageLoads.add(customerId));
      let foundImage = false;
      Promise.all(pending.map(async customerId => {
        try {
          const record = await customerImageStore.get(customerId);
          if (record?.blob) foundImage = true;
          imageUrls.set(customerId, record?.blob && typeof URL !== 'undefined' ? URL.createObjectURL(record.blob) : null);
        } catch {
          imageUrls.set(customerId, null);
        } finally {
          imageLoads.delete(customerId);
        }
      })).then(() => {
        if (foundImage && state.mode === 'relationships') renderResults();
      });
    }
    function updateMasterFromFollowUp(record) {
      const master = masterStore.get(record.customerId);
      if (!master) return;
      const patch = Object.fromEntries(Object.entries({
        currentObstacle: record.currentObstacle,
        nextAction: record.nextAction,
        nextFollowUpDate: record.nextFollowUpDate
      }).filter(([, value]) => String(value || '').trim()));
      if (!Object.keys(patch).length) return;
      const updated = masterStore.update(record.customerId, patch, {
        source: 'LOCAL_FOLLOWUP'
      });
      developmentStore.recordMasterChange(record.customerId, master, updated, {
        operator: record.owner,
        source: 'LOCAL_FOLLOWUP'
      });
      refreshHydration();
    }
    function markQuickNoteConverted(noteId, followUpId) {
      Object.entries(state.localNotes).some(([, items]) => {
        const note = Array.isArray(items) ? items.find(item => item.id === noteId) : null;
        if (!note) return false;
        note.convertedToFollowUpId = followUpId;
        return true;
      });
      storage?.setItem(STORAGE_KEY, JSON.stringify(state.localNotes));
    }
    function decorate(profile) {
      const plans = effectivePlans(profile);
      const resources = effectiveResources(profile);
      const providerPerception = plans.map(plan => plan.perceptionLevel).find(level => /^R[1-4]$/.test(level));
      const copy = {
        ...profile,
        perceptionLevel: profile.perceptionLevel === 'R?' && providerPerception ? providerPerception : profile.perceptionLevel,
        plans,
        resourceInvestments: resources
      };
      return {
        profile: copy,
        metrics: profileMetrics(copy, state.filters.month, resolver),
        risks: deriveRiskFlags(copy, state.filters.month, resolver)
      };
    }
    function filteredProfiles() {
      const query = normalizedAlias(state.search);
      return allProfiles().filter(profile => profile.product === state.product || profile.product === null).map(decorate).filter(({
        profile,
        metrics
      }) => {
        const searchable = [profile.canonicalName, profile.hospitalName, profile.departmentName, profile.employeeName, ...(profile.aliases || []), ...(profile.hospitalAliases || []), ...(profile.departmentAliases || [])].map(normalizedAlias).join('|');
        if (query && !searchable.includes(query)) return false;
        if (state.filters.office !== 'all' && profile.office !== state.filters.office) return false;
        if (state.filters.employee !== 'all' && profile.employeeName !== state.filters.employee) return false;
        if (state.filters.hospital !== 'all' && profile.hospitalName !== state.filters.hospital) return false;
        if (state.filters.department !== 'all' && profile.departmentName !== state.filters.department) return false;
        if (state.filters.grade !== 'all' && metrics.grade !== state.filters.grade) return false;
        if (state.filters.status !== 'all' && profile.currentStatus !== state.filters.status) return false;
        if (state.filters.resource && !profile.resourceInvestments?.length) return false;
        if (state.filters.targetIncomplete && !(metrics.target && (metrics.completion || 0) < 1)) return false;
        if (state.filters.noPlan && profile.plans?.length) return false;
        return true;
      }).sort((left, right) => (right.metrics.current ?? -1) - (left.metrics.current ?? -1));
    }
    function operatingContext() {
      const profiles = allProfilesIncludingInactive().map(profile => ({
        ...profile,
        plans: effectivePlans(profile),
        resourceInvestments: effectiveResources(profile)
      }));
      const customers = masterStore.list().map(master => ({
        ...master,
        developmentStatus: developmentFor(master.customerId).status
      }));
      return {
        customers,
        profiles,
        relationships: relationshipStore.list({
          includeDeleted: true
        }),
        followUps: followUpStore.list({
          includeDeleted: true
        }),
        professionalProfiles: professionalStore.list(),
        generatedAt: new Date().toISOString(),
        month: state.filters.month
      };
    }
    function operatingSnapshot() {
      const analysis = operatingProvider.analyze(operatingContext());
      recommendationActionStore.cleanup(analysis.recommendations.map(item => item.recommendationKey));
      taskLinkStore.reconcile(taskBridge, analysis.recommendations.map(item => item.recommendationKey));
      const actionByKey = new Map(recommendationActionStore.list().map(item => [item.recommendationKey, item]));
      const linkByKey = new Map(taskLinkStore.list().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(item => [item.recommendationKey, item]));
      const recommendations = analysis.recommendations.map(item => {
        const action = actionByKey.get(item.recommendationKey);
        return {
          ...item,
          recommendationStatus: action?.status || 'NEW',
          recommendationNote: action?.note || '',
          snoozeUntil: action?.snoozeUntil || '',
          actionUpdatedAt: action?.updatedAt || '',
          taskLink: linkByKey.get(item.recommendationKey) || null
        };
      });
      return {
        ...analysis,
        recommendations
      };
    }
    function taskRecommendationSnapshot(context = {}) {
      const source = operatingContext();
      return buildCustomerVisitTaskRecommendations(source.customers, {
        profiles: source.profiles,
        followUps: source.followUps,
        tasks: context.tasks || [],
        activities: context.activities || [],
        now: context.now || new Date().toISOString(),
        limit: context.limit || 20
      }).filter(item => recommendationActionStore.get(item.recommendationKey)?.status !== 'DISMISSED').map(item => {
        const action = recommendationActionStore.get(item.recommendationKey);
        return {
          ...item,
          visitIntervalDays: action?.visitIntervalDays || null,
          recommendationStatus: 'CANDIDATE'
        };
      });
    }
    function confirmTaskRecommendations(recommendations = [], selectedIds = [], options = {}) {
      if (!taskBridge?.createTaskFromRecommendation) throw new Error('当前任务桥接不可用，未写入任何任务');
      const selected = new Set(selectedIds.map(String));
      let added = 0;
      let skipped = 0;
      recommendations.forEach(recommendation => {
        const recommendationId = String(recommendation.id || recommendation.recommendationId || recommendation.recommendationKey || '');
        if (!selected.has(recommendationId)) return;
        const customer = masterStore.get(recommendation.customerId) || {};
        const draft = buildTaskDraft(recommendation, {
          customer,
          now: new Date().toISOString()
        });
        const duplicate = taskBridge.isDuplicateTask?.(draft);
        if (duplicate) {
          taskLinkStore.create({
            recommendationKey: draft.recommendationKey,
            recommendationId: draft.recommendationId,
            taskId: duplicate.taskId || duplicate.id,
            customerId: draft.customerId,
            product: draft.product,
            createdAt: duplicate.createdAt,
            updatedAt: duplicate.updatedAt
          });
          skipped += 1;
          return;
        }
        const plan = typeof globalThis.TaskProgressAdapter?.visitPlan === 'function' ? globalThis.TaskProgressAdapter.visitPlan(recommendation) : {};
        const dueDate = options.nativeVisitEditor === true ? plan.recommendedNextWindow?.from || '' : recommendation.dueDate || draft.dueDate;
        const task = taskBridge.createTaskFromRecommendation({
          ...draft,
          ...plan,
          visitIntervalDays: recommendation.visitIntervalDays || plan.recommendedVisitInterval,
          dueDate,
          hospitalId: customer.hospitalId || '',
          departmentId: customer.departmentId || '',
          nativeVisitEditor: options.nativeVisitEditor === true,
          confirmed: true
        });
        taskLinkStore.create({
          recommendationKey: draft.recommendationKey,
          recommendationId: draft.recommendationId,
          taskId: task.taskId || task.id,
          customerId: draft.customerId,
          product: draft.product,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        });
        added += 1;
      });
      render();
      return {
        added,
        skipped
      };
    }
    function recommendationProfileKey(recommendation) {
      if (!recommendation) return '';
      const preferred = recommendation.product ? profileForKey(`${recommendation.customerId}::${recommendation.product}`) : null;
      const fallback = allProfilesIncludingInactive().find(profile => profile.customerId === recommendation.customerId && profile.product === state.product) || allProfilesIncludingInactive().find(profile => profile.customerId === recommendation.customerId);
      return preferred ? profileKey(preferred) : fallback ? profileKey(fallback) : '';
    }
    function activeFilterCount() {
      return Object.entries(state.filters).filter(([key, value]) => key !== 'month' && value !== 'all' && value !== false).length;
    }
    function optionList(values, current, allLabel) {
      return `<option value="all">${esc(allLabel)}</option>${values.map(value => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(value)}</option>`).join('')}`;
    }
    function renderKpis(rows) {
      const counts = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        upgrade: 0,
        downgrade: 0,
        new: 0,
        drop: 0,
        risk: 0,
        lost: 0
      };
      rows.forEach(({
        profile,
        metrics
      }) => {
        if (counts[metrics.grade] !== undefined) counts[metrics.grade] += 1;
        if (profile.currentStatus === 'UPGRADED') counts.upgrade += 1;
        if (profile.currentStatus === 'DOWNGRADED') counts.downgrade += 1;
        if (profile.currentStatus === 'NEW') counts.new += 1;
        if (profile.currentStatus === 'DECLINING') counts.drop += 1;
        if (profile.currentStatus === 'AT_RISK') counts.risk += 1;
        if (profile.currentStatus === 'LOST') counts.lost += 1;
      });
      const primary = [['客户总数', rows.length, 'people'], ['A客户', counts.A, 'grade-a'], ['B客户', counts.B, 'grade-b'], ['本月升级', counts.upgrade, 'good'], ['掉量客户', counts.drop + counts.downgrade, 'warn'], ['流失风险', counts.risk, 'danger']];
      return `<div class="cp-kpi-strip">${primary.map(([label, value, tone]) => `<article class="cp-kpi ${tone}"><span>${label}</span><strong>${value}</strong></article>`).join('')}</div><details class="cp-more-kpis"><summary>查看全部指标</summary><div><span>C客户 <b>${counts.C}</b></span><span>D客户 <b>${counts.D}</b></span><span>本月降级 <b>${counts.downgrade}</b></span><span>新增客户 <b>${counts.new}</b></span><span>已流失 <b>${counts.lost}</b></span></div></details>`;
    }
    function currentCustomerHtml(profile, metrics) {
      const tasks = (config.getDeletionContext?.().tasks || config.tasks || []).filter(task => task.customerId === profile.customerId && !['completed', 'cancelled'].includes(task.status) && !task.completedAt && Number(task.progress) < 100);
      const latest = followUpsForProfile(profile).slice().sort((a, b) => String(b.followUpAt).localeCompare(String(a.followUpAt)))[0];
      const master = masterStore.get(profile.customerId);
      const nextAction = latest?.nextAction || master?.nextAction || '';
      const fact = latest?.content || (metrics.current !== null ? `${state.filters.month} 实际使用 ${metrics.current}盒` : '暂无已记录业务事实');
      return `<div class="cp-current-summary"><p><span>当前任务</span>${tasks.length ? tasks.slice(0, 2).map(task => `<button type="button" data-cp-open-linked-task="${esc(task.id)}">${esc(task.title)}</button>`).join('') + (tasks.length > 2 ? `<small>另有 ${tasks.length - 2} 项</small>` : '') : '<strong>暂无进行中的任务</strong>'}</p><p><span>最近事实</span><strong>${esc(fact)}</strong></p><p><span>下一步</span><strong>${esc(nextAction || '待补充')}</strong></p></div>`;
    }
    function cardHtml(item, monitor = false) {
      const {
        profile,
        metrics,
        risks
      } = item;
      const status = statusFor(profile);
      const key = profileKey(profile);
      const targetText = metrics.target === null ? '未设置' : `${metrics.target}盒`;
      return `<article class="cp-customer-card ${risks.some(risk => risk.tone === 'danger') ? 'has-risk' : ''}" data-profile-key="${esc(key)}">
        ${masterStore.get(profile.customerId) ? `<div class="cp-entry-icons"><button type="button" data-cp-edit-master="${esc(profile.customerId)}" aria-label="编辑客户" title="编辑客户">✎</button><button type="button" data-cp-delete-master="${esc(profile.customerId)}" aria-label="删除或归档客户" title="删除或归档客户">×</button></div>` : ''}
        <button type="button" class="cp-card-main" data-cp-open="${esc(key)}" aria-label="打开${esc(profile.canonicalName)}客户档案">
          <div class="cp-card-title"><span class="cp-grade grade-${(metrics.grade || 'n').toLowerCase()}">${esc(metrics.grade || '—')}</span><div><h3 title="${esc(profile.canonicalName)}">${esc(profile.canonicalName)}</h3><p>${esc(profile.hospitalName || '未填写医院')} · ${esc(profile.departmentName || '未填写科室')}</p></div><span class="cp-r-level">${esc(profile.perceptionLevel || 'R?')}</span></div>
          <div class="cp-owner-row"><span>负责人：${esc(profile.employeeName || '未填写')}</span><span class="cp-status ${status.tone}"><i></i>${status.label}</span></div>
          <div class="cp-card-numbers"><div><span>本月</span><strong>${metrics.current === null ? '—' : `${metrics.current}盒`}</strong></div><div><span>较上月</span><strong class="${(metrics.delta || 0) < 0 ? 'negative' : (metrics.delta || 0) > 0 ? 'positive' : ''}">${formatDelta(metrics.delta)}</strong></div><div><span>目标</span><strong>${targetText}</strong></div><div><span>完成率</span><strong>${pct(metrics.completion)}</strong></div></div>
          <div class="cp-card-footer"><span>${metrics.toUpgrade === null ? '已达最高等级' : `距升级 ${metrics.toUpgrade}盒`}</span><span>销量等级 ${esc(metrics.grade || '—')} · 观念等级 ${esc(profile.perceptionLevel || 'R?')}</span><b>查看档案 ›</b></div>
        </button>
        ${monitor ? `<div class="cp-monitor-detail"><span>上月 ${metrics.previous ?? '—'}盒</span><span>掉量 ${metrics.delta !== null && metrics.delta < 0 ? Math.abs(metrics.delta) : 0}盒</span><span>${metrics.previousGrade || '—'} → ${metrics.grade || '—'}</span><span>连续下降 ${metrics.downStreak}月</span><span>计划 ${profile.plans?.length ? '有' : '无'}</span><span>跟进 ${profile.plans?.some(plan => plan.followUp) ? '有' : '无'}</span></div>` : ''}
      </article>`;
    }
    function renderOverview(rows) {
      const visible = rows.slice(0, state.visibleCount);
      return `<section class="cp-list-panel"><header class="cp-section-heading"><div><p>客户组合</p><h2>${rows.length} 位客户</h2></div><span>按本月销量排序</span></header><div class="cp-customer-list">${visible.length ? visible.map(item => cardHtml(item)).join('') : '<div class="cp-empty"><span>⌕</span><strong>没有符合条件的客户</strong><p>可清除筛选，或等待客户数据接入。</p><button type="button" data-cp-clear>清除筛选</button></div>'}</div>${rows.length > visible.length ? `<button type="button" class="cp-load-more" data-cp-more>继续显示 ${Math.min(40, rows.length - visible.length)} 位</button>` : ''}</section>`;
    }
    function monitorMatch(item, category = state.monitorCategory) {
      const status = item.profile.currentStatus;
      const categories = {
        attention: ['DECLINING', 'DOWNGRADED', 'AT_RISK', 'LOST'],
        upgrade: ['UPGRADED'],
        downgrade: ['DOWNGRADED'],
        new: ['NEW'],
        declining: ['DECLINING', 'DOWNGRADED'],
        risk: ['AT_RISK'],
        lost: ['LOST']
      };
      return (categories[category] || []).includes(status) || category === 'attention' && item.risks.length;
    }
    function renderMonitor(rows) {
      const categories = [['attention', '需要关注'], ['upgrade', '升级客户'], ['downgrade', '降级客户'], ['new', '新增客户'], ['declining', '掉量客户'], ['risk', '流失风险'], ['lost', '已流失']];
      const monitored = rows.filter(item => monitorMatch(item));
      return `<section class="cp-monitor"><div class="cp-monitor-tabs" role="tablist">${categories.map(([key, label]) => `<button type="button" role="tab" aria-selected="${state.monitorCategory === key}" class="${state.monitorCategory === key ? 'active' : ''}" data-cp-monitor="${key}">${label}<b>${rows.filter(item => monitorMatch(item, key)).length}</b></button>`).join('')}</div><div class="cp-monitor-intro"><div><span>责任追踪</span><h2>${categories.find(([key]) => key === state.monitorCategory)?.[1]}</h2></div><p>风险用于安排复盘，不作惩罚性判断；单月 0 盒不会自动认定流失。</p></div><div class="cp-customer-list">${monitored.length ? monitored.map(item => cardHtml(item, true)).join('') : '<div class="cp-empty"><span>✓</span><strong>当前分类暂无客户</strong><p>没有需要处理的变动记录。</p></div>'}</div></section>`;
    }
    function renderHospitals(rows) {
      const hospitals = new Map();
      rows.forEach(item => {
        const key = item.profile.hospitalId || item.profile.hospitalName;
        if (!hospitals.has(key)) hospitals.set(key, {
          id: item.profile.hospitalId || '',
          name: item.profile.hospitalName || '未填写医院',
          rows: [],
          departments: new Set(),
          sales: 0
        });
        const hospital = hospitals.get(key);
        hospital.rows.push(item);
        hospital.departments.add(item.profile.departmentName || '未填写科室');
        hospital.sales += item.metrics.current || 0;
      });
      return `<section class="cp-hospitals"><div class="cp-coming-note"><span>医院 / 科室视图 · V1入口</span><p>医院资料维护复用现有稳定标识；客户结构、销售等级和风险规则保持不变。</p></div><div class="cp-hospital-grid">${[...hospitals.values()].map(hospital => {
        const grades = ['A', 'B', 'C', 'D'].map(grade => hospital.rows.filter(item => item.metrics.grade === grade).length);
        return `<article class="cp-hospital-entry"><button type="button" class="cp-hospital-card" data-cp-hospital="${esc(hospital.name)}"><span>${hospital.rows.length}位客户 · ${hospital.departments.size}个科室</span><h3>${esc(hospital.name)}</h3><strong>${hospital.sales}盒</strong><div class="cp-grade-stack" aria-label="ABCD客户结构">${grades.map((count, index) => `<i class="grade-${['a', 'b', 'c', 'd'][index]}" style="flex:${Math.max(count, .15)}" title="${['A', 'B', 'C', 'D'][index]} ${count}"></i>`).join('')}</div><p>风险 ${hospital.rows.filter(item => ['AT_RISK', 'LOST', 'DECLINING'].includes(item.profile.currentStatus)).length}位 · 点击查看客户</p></button>${hospital.id ? `<button type="button" class="cp-maintain-hospital" data-cp-maintain-hospital="${esc(hospital.id)}">维护医院 / 科室资料</button>` : ''}</article>`;
      }).join('')}</div></section>`;
    }
    function relationshipFilterCount() {
      const filters = state.relationshipFilters;
      return Number(filters.hospital !== 'all') + Number(filters.department !== 'all') + (filters.grades?.length || 0) + (filters.perceptionLevels?.length || 0) + Number(filters.developmentStatus !== 'all') + Number(filters.currentStatus !== 'all') + Number(filters.relationshipScope !== 'all') + Number(filters.hasRelationship !== 'all') + Number(filters.importantOnly) + Number(filters.primaryOnly);
    }
    function hospitalMetrics(groupCustomers) {
      const grades = Object.fromEntries(['A', 'B', 'C', 'D'].map(grade => [grade, groupCustomers.filter(item => item.salesGrade === grade).length]));
      const levels = Object.fromEntries(['R1', 'R2', 'R3', 'R4'].map(level => [level, groupCustomers.filter(item => item.perceptionLevel === level).length]));
      return {
        grades,
        levels,
        priority: groupCustomers.filter(item => item.developmentStatus === 'PRIORITY').length,
        risk: groupCustomers.filter(item => item.overdue || ['AT_RISK', 'LOST', 'DECLINING'].includes(item.currentStatus)).length
      };
    }
    function intelligenceFilterCount() {
      const filters = state.intelligenceFilters;
      return Number(filters.customerId !== 'all') + Number(filters.product !== 'all') + Number(filters.hospital !== 'all') + Number(filters.department !== 'all') + (filters.priorities || []).length + Number(filters.signalType !== 'all') + (filters.grades || []).length + (filters.perceptionLevels || []).length + Number(filters.developmentStatus !== 'all') + Number(filters.currentStatus !== 'all') + Number(filters.overdue !== 'all') + Number(filters.hasRelationship !== 'all') + Number(filters.keyInfluencer !== 'all') + Number(filters.recommendationStatus !== 'all');
    }
    function operatingKpiHtml(recommendations) {
      const actionable = recommendations.filter(item => item.recommendationStatus !== 'DISMISSED');
      const items = [['P0', actionable.filter(item => item.priority === 'P0').length, 'priority:P0', 'danger'], ['P1', actionable.filter(item => item.priority === 'P1').length, 'priority:P1', 'warn'], ['跟进逾期', actionable.filter(item => item.signalType === 'FOLLOWUP_OVERDUE').length, 'signal:FOLLOWUP_OVERDUE', 'overdue'], ['高价值关系薄弱', actionable.filter(item => item.signalType === 'HIGH_VALUE_WEAK_RELATIONSHIP').length, 'signal:HIGH_VALUE_WEAK_RELATIONSHIP', 'relationship'], ['高风险', actionable.filter(item => item.signalType === 'HIGH_RISK_CUSTOMER').length, 'signal:HIGH_RISK_CUSTOMER', 'risk'], ['覆盖缺口', actionable.filter(item => item.signalType === 'COVERAGE_GAP').length, 'signal:COVERAGE_GAP', 'coverage']];
      return `<div class="cp-operating-kpis">${items.map(([label, value, filter, tone]) => `<button type="button" class="${tone}" data-cp-intelligence-kpi="${filter}"><span>${esc(label)}</span><strong>${value}</strong><small>点击筛选</small></button>`).join('')}</div>`;
    }
    function taskLinkHtml(item, compact = false) {
      const link = item.taskLink;
      if (!link) return `<button type="button" class="cp-task-convert" data-cp-create-task="${esc(item.recommendationKey)}" ${taskBridge?.createTaskFromRecommendation ? '' : 'disabled title="任务桥接不可用"'}>${compact ? '转任务' : '转为任务'}</button>`;
      const label = TASK_LINK_STATES[link.state] || link.state;
      const followUp = link.state === 'ACTIVE' && taskBridge?.completeTaskFromFollowUp ? `<button type="button" class="cp-task-followup" data-cp-task-followup="${esc(item.recommendationKey)}">记录跟进并完成</button>` : '';
      const retry = link.state === 'CANCELLED' ? `<button type="button" class="cp-task-convert" data-cp-create-task="${esc(item.recommendationKey)}">重新转为任务</button>` : '';
      const view = !link.orphaned && taskBridge?.openTask ? `<button type="button" data-cp-open-linked-task="${esc(link.taskId)}">查看任务</button>` : '';
      return `<span class="cp-task-link-status state-${link.state.toLowerCase()}" title="关联任务">${esc(label)}</span>${view}${followUp}${retry}`;
    }
    function operatingRecommendationCardHtml(item) {
      const statusLabel = RECOMMENDATION_STATUSES[item.recommendationStatus] || RECOMMENDATION_STATUSES.NEW;
      const profileKeyValue = recommendationProfileKey(item);
      const primaryAction = item.recommendedActions[0];
      return `<article class="cp-operating-card priority-${item.priority.toLowerCase()} status-${String(item.recommendationStatus).toLowerCase()}" data-cp-recommendation-card="${esc(item.recommendationKey)}">
        <header><div><span class="cp-priority-badge">${esc(item.priority)} · ${esc(OPERATING_PRIORITIES[item.priority]?.label || '')}</span><span class="cp-signal-label">${esc(OPERATING_SIGNAL_TYPES[item.signalType] || item.signalType)}</span></div><em>${esc(statusLabel)}</em></header>
        <button type="button" class="cp-operating-card-main" data-cp-recommendation-detail="${esc(item.recommendationKey)}"><h3>${esc(item.title)}</h3><strong>${esc(item.customerName || '匿名客户')}</strong><p>${esc(item.hospital || '医院未填写')} · ${esc(item.department || '科室未填写')} · ${esc(item.product || '客户级')}</p><blockquote>${esc(item.summary)}</blockquote></button>
        <div class="cp-operating-evidence-preview">${item.evidence.slice(0, 2).map(evidence => `<span><i></i>${esc(evidence.label)}${evidence.value ? `：${esc(evidence.value)}` : ''}</span>`).join('')}</div>
        <footer><div><span>建议动作</span><strong>${esc(primaryAction?.title || '查看建议')}</strong></div>${taskLinkHtml(item)}<button type="button" data-cp-recommendation-detail="${esc(item.recommendationKey)}">查看证据</button>${profileKeyValue ? `<button type="button" data-cp-intelligence-customer="${esc(profileKeyValue)}">客户详情</button>` : ''}<button type="button" data-cp-intelligence-graph="${esc(item.customerId)}">关系图谱</button>${profileKeyValue ? `<button type="button" data-cp-intelligence-followup="${esc(profileKeyValue)}">跟进记录</button>` : ''}</footer>
      </article>`;
    }
    function operatingIntelligenceHtml() {
      const snapshot = operatingSnapshot();
      const visible = filterOperatingRecommendations(snapshot.recommendations, state.intelligenceFilters);
      const pending = snapshot.recommendations.filter(item => item.recommendationStatus === 'NEW').length;
      return `<section class="cp-operating-page"><header class="cp-operating-header"><div><p>Operating Intelligence · ${esc(operatingProvider.providerMode || OPERATING_PROVIDER_MODE)}</p><h2>客户经营智能</h2><span>确定性规则生成优先级、风险、关系缺口、跟进建议与逐条证据；不是线上 AI。</span></div><div><b>${pending}</b><span>待人工确认建议</span></div></header>
        ${operatingKpiHtml(snapshot.recommendations)}
        <div class="cp-operating-toolbar"><button type="button" class="cp-filter-button" data-cp-intelligence-filters>经营筛选${intelligenceFilterCount() ? `<b>${intelligenceFilterCount()}</b>` : ''}</button><span>${visible.length} / ${snapshot.recommendations.length} 条建议 · 默认按优先级、重要性、更新时间排序</span><button type="button" class="cp-text-action" data-cp-clear-intelligence-filters>清除筛选</button></div>
        <div class="cp-operating-list">${visible.length ? visible.map(operatingRecommendationCardHtml).join('') : '<div class="cp-empty cp-operating-empty"><span>✓</span><strong>当前筛选没有经营建议</strong><p>没有证据时不会生成建议；可以清除筛选或等待源数据更新。</p></div>'}</div>
        <footer class="cp-operating-boundary"><strong>Evidence First</strong><p>经营事实、相关性与人工判断严格分开。关系弱或跟进少不等于销量变化原因；资源投入后的变化只表示时间上相关，需人工复核。</p></footer></section>`;
    }
    function intelligenceFilterDialogHtml() {
      const recommendations = operatingSnapshot().recommendations;
      const hospitals = [...new Map(recommendations.filter(item => item.hospitalId || item.hospital).map(item => [item.hospitalId || item.hospital, item.hospital || '未填写医院'])).entries()];
      const departments = [...new Map(recommendations.filter(item => state.intelligenceFilters.hospital === 'all' || [item.hospitalId, item.hospital].includes(state.intelligenceFilters.hospital)).filter(item => item.departmentId || item.department).map(item => [item.departmentId || item.department, item.department || '未填写科室'])).entries()];
      const checked = (values, value) => (values || []).includes(value) ? 'checked' : '';
      const selected = (current, value) => current === value ? 'selected' : '';
      return `<dialog class="cp-sheet cp-operating-filter-dialog" id="cpOperatingFilterDialog"><form method="dialog" id="cpOperatingFilterForm"><header><div><p>经营建议与证据同步过滤</p><h2>经营智能筛选</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><label>产品<select name="product"><option value="all">全部产品与客户级</option>${PRODUCTS.map(product => `<option value="${product}" ${selected(state.intelligenceFilters.product, product)}>${product}</option>`).join('')}<option value="__customer__" ${selected(state.intelligenceFilters.product, '__customer__')}>仅客户级</option></select></label><label>医院<select name="hospital"><option value="all">全部医院</option>${hospitals.map(([id, name]) => `<option value="${esc(id)}" ${selected(state.intelligenceFilters.hospital, id)}>${esc(name)}</option>`).join('')}</select></label><label>科室<select name="department"><option value="all">全部科室</option>${departments.map(([id, name]) => `<option value="${esc(id)}" ${selected(state.intelligenceFilters.department, id)}>${esc(name)}</option>`).join('')}</select></label><label>信号类型<select name="signalType"><option value="all">全部信号</option>${Object.entries(OPERATING_SIGNAL_TYPES).map(([key, label]) => `<option value="${key}" ${selected(state.intelligenceFilters.signalType, key)}>${esc(label)}</option>`).join('')}</select></label>
        <fieldset><legend>优先级（可多选）</legend>${Object.keys(OPERATING_PRIORITIES).map(priority => `<label><input type="checkbox" name="priorities" value="${priority}" ${checked(state.intelligenceFilters.priorities, priority)}>${priority}</label>`).join('')}</fieldset><fieldset><legend>ABCD（可多选）</legend>${['A', 'B', 'C', 'D'].map(grade => `<label><input type="checkbox" name="grades" value="${grade}" ${checked(state.intelligenceFilters.grades, grade)}>${grade}</label>`).join('')}</fieldset><fieldset><legend>R1-R4（可多选）</legend>${['R1', 'R2', 'R3', 'R4'].map(level => `<label><input type="checkbox" name="perceptionLevels" value="${level}" ${checked(state.intelligenceFilters.perceptionLevels, level)}>${level}</label>`).join('')}</fieldset>
        <label>开发状态<select name="developmentStatus"><option value="all">全部开发状态</option>${Object.entries(DEVELOPMENT_STATUS).map(([key, meta]) => `<option value="${key}" ${selected(state.intelligenceFilters.developmentStatus, key)}>${esc(meta.label)}</option>`).join('')}</select></label><label>经营状态<select name="currentStatus"><option value="all">全部经营状态</option>${Object.entries(STATUS).map(([key, meta]) => `<option value="${key}" ${selected(state.intelligenceFilters.currentStatus, key)}>${esc(meta.label)}</option>`).join('')}</select></label><label>跟进逾期<select name="overdue"><option value="all">全部</option><option value="yes" ${selected(state.intelligenceFilters.overdue, 'yes')}>已逾期</option><option value="no" ${selected(state.intelligenceFilters.overdue, 'no')}>未逾期</option></select></label><label>关系状态<select name="hasRelationship"><option value="all">全部</option><option value="yes" ${selected(state.intelligenceFilters.hasRelationship, 'yes')}>已有关系</option><option value="no" ${selected(state.intelligenceFilters.hasRelationship, 'no')}>暂无关系</option></select></label><label>关键节点<select name="keyInfluencer"><option value="all">全部</option><option value="yes" ${selected(state.intelligenceFilters.keyInfluencer, 'yes')}>关键节点</option><option value="no" ${selected(state.intelligenceFilters.keyInfluencer, 'no')}>非关键节点</option></select></label><label>人工状态<select name="recommendationStatus"><option value="all">全部</option>${Object.entries(RECOMMENDATION_STATUSES).map(([key, label]) => `<option value="${key}" ${selected(state.intelligenceFilters.recommendationStatus, key)}>${esc(label)}</option>`).join('')}</select></label><p class="cp-full cp-note-association">筛选只作用于派生建议，不修改销售、跟进、关系、活动或任务源数据。</p></div><footer><button type="button" class="cp-secondary" data-cp-clear-intelligence-filters>清除</button><button type="submit" class="cp-primary">应用筛选</button></footer></form></dialog>`;
    }
    function recommendationDetailDialogHtml() {
      const recommendation = operatingSnapshot().recommendations.find(item => item.recommendationKey === state.selectedRecommendationKey);
      if (!recommendation) return '';
      const profileKeyValue = recommendationProfileKey(recommendation);
      return `<dialog class="cp-sheet cp-recommendation-dialog" id="cpRecommendationDialog"><form method="dialog" id="cpRecommendationActionForm"><header><div><p>${esc(OPERATING_SIGNAL_TYPES[recommendation.signalType])} · ${esc(recommendation.source)}</p><h2>${esc(recommendation.title)}</h2></div><button type="button" data-cp-recommendation-close aria-label="关闭">×</button></header><div class="cp-recommendation-scroll"><section class="cp-recommendation-identity"><span class="cp-priority-badge">${esc(recommendation.priority)} · ${esc(OPERATING_PRIORITIES[recommendation.priority]?.label)}</span><div><strong>${esc(recommendation.customerName)}</strong><p>${esc(recommendation.hospital)} · ${esc(recommendation.department)} · ${esc(recommendation.product || '客户级')}</p></div></section><section class="cp-recommendation-section"><header><strong>为什么推荐</strong><span>${recommendation.evidence.length} 条事实依据</span></header><ol class="cp-recommendation-evidence">${recommendation.evidence.map(item => `<li data-evidence-id="${esc(item.evidenceId)}"><span>${esc(item.label)}</span><strong>${esc(item.value || '已记录')}</strong><small>${esc(item.sourceType)} · ${esc(item.observedAt || '时间待补充')}</small></li>`).join('')}</ol></section><section class="cp-recommendation-section"><header><strong>建议动作</strong><span>由人工决定是否执行</span></header><div class="cp-recommended-actions">${recommendation.recommendedActions.map(action => `<article><span>${esc(OPERATING_ACTION_TYPES[action.actionType] || action.actionType)}</span><strong>${esc(action.title)}</strong><p>${esc(action.reason)}</p></article>`).join('')}</div></section>${recommendation.coverage ? `<section class="cp-recommendation-section"><header><strong>覆盖指标</strong><span>${recommendation.scopeType === 'HOSPITAL' ? '医院级' : '科室级'}</span></header><div class="cp-coverage-metrics"><span>客户 ${recommendation.coverage.customerCount}</span><span>A/B ${recommendation.coverage.abCustomerCount}</span><span>重点 ${recommendation.coverage.importantCustomerCount}</span><span>有关系 ${Math.round(recommendation.coverage.relationshipCustomerRatio * 100)}%</span><span>逾期 ${recommendation.coverage.overdueCount}</span><span>长期未跟进 ${recommendation.coverage.longUnfollowedCount || 0}</span><span>高风险 ${recommendation.coverage.highRiskCount}</span><span>关键节点 ${recommendation.coverage.keyInfluencerCount}</span></div></section>` : ''}<p class="cp-causality">数据更新时间：${esc(recommendation.generatedAt)}。建议描述只陈述事实与时间相关，不作未经确认的因果判断。</p><section class="cp-task-link-panel"><header><div><strong>任务转化</strong><span>人工确认后才写入正式任务</span></div>${taskLinkHtml(recommendation)}</header>${recommendation.taskLink ? `<p>任务 ID：${esc(recommendation.taskLink.taskId)}${recommendation.taskLink.recommendationMissing ? ' · 原经营信号已变化' : ''}</p>` : '<p>尚未创建任务；打开草稿不会产生任何写入。</p>'}</section><div class="cp-recommendation-links">${profileKeyValue ? `<button type="button" class="cp-secondary" data-cp-intelligence-customer="${esc(profileKeyValue)}">打开原客户详情</button>` : ''}<button type="button" class="cp-secondary" data-cp-intelligence-graph="${esc(recommendation.customerId)}">打开关系图谱</button>${profileKeyValue ? `<button type="button" class="cp-secondary" data-cp-intelligence-followup="${esc(profileKeyValue)}">查看已有跟进</button>` : ''}</div><div class="cp-sheet-fields"><input type="hidden" name="recommendationKey" value="${esc(recommendation.recommendationKey)}"><label>人工状态<select name="status">${Object.entries(RECOMMENDATION_STATUSES).map(([key, label]) => `<option value="${key}" ${recommendation.recommendationStatus === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label>稍后提醒日期<input type="date" name="snoozeUntil" value="${esc(recommendation.snoozeUntil || '')}"></label><label class="cp-full">人工备注<textarea name="note" rows="4" maxlength="1200" placeholder="记录人工确认、忽略或稍后处理的原因">${esc(recommendation.recommendationNote || '')}</textarea></label>${state.intelligenceError ? `<p class="cp-row-error cp-full">${esc(state.intelligenceError)}</p>` : ''}</div></div><footer><button type="button" class="cp-secondary" data-cp-recommendation-close>关闭</button><button type="submit" class="cp-primary">保存人工状态</button></footer></form></dialog>`;
    }
    function taskDraftDialogHtml() {
      const draft = state.taskDraft;
      if (!draft) return '';
      const duplicate = draft.duplicateTaskId ? `<aside class="cp-task-duplicate"><strong>该建议已存在进行中的任务</strong><p>不会创建第二条任务；确认后仅关联已有任务。</p></aside>` : '';
      return `<dialog class="cp-sheet cp-task-draft-dialog" id="cpTaskDraftDialog"><form method="dialog" id="cpTaskDraftForm"><header><div><p>Customer Profile V1.5 · 人工确认门</p><h2>任务草稿预览</h2></div><button type="button" data-cp-task-draft-cancel aria-label="关闭">×</button></header><div class="cp-task-draft-scroll">${duplicate}<section class="cp-task-draft-identity"><span class="cp-priority-badge">${esc(draft.sourcePriority)}</span><div><strong>${esc(draft.customerName || '匿名客户')}</strong><p>${esc(draft.hospital || '医院未填写')} · ${esc(draft.department || '科室未填写')} · ${esc(draft.product || '客户级')}</p></div></section><div class="cp-sheet-fields"><label class="cp-full">任务标题<input type="text" name="title" maxlength="160" required value="${esc(draft.title)}"></label><label>负责人<input type="text" name="owner" value="${esc(draft.owner)}" placeholder="无法确定时可留空"></label><label>截止日期<input type="date" name="dueDate" required value="${esc(draft.dueDate)}"></label><label class="cp-full">任务说明<textarea name="description" rows="4" maxlength="1600" required>${esc(draft.description)}</textarea></label></div><section class="cp-recommendation-section"><header><strong>为什么生成任务</strong><span>${draft.evidenceSnapshot.length} 条 Evidence Snapshot</span></header><ol class="cp-recommendation-evidence">${draft.evidenceSnapshot.map(item => `<li><span>${esc(item.label)}</span><strong>${esc(item.value || '已记录')}</strong><small>${esc(item.sourceType)} · ${esc(item.observedAt || '时间待补充')}</small></li>`).join('')}</ol></section><dl class="cp-task-draft-source"><div><dt>来源</dt><dd>客户经营建议</dd></div>${config.isDeveloperMode?.() ? `<div><dt>recommendationKey</dt><dd>${esc(draft.recommendationKey)}</dd></div><div><dt>customerId</dt><dd>${esc(draft.customerId)}</dd></div>` : ''}<div><dt>任务类型</dt><dd>customer_visit · 人工创建</dd></div></dl>${state.taskDraftError ? `<p class="cp-row-error">${esc(state.taskDraftError)}</p>` : ''}<p class="cp-causality">打开或取消草稿均为零写入。只有点击“确认创建任务”才会通过 Task Bridge 写入当前正式任务系统。</p></div><footer><button type="button" class="cp-secondary" data-cp-task-draft-cancel>取消</button><button type="submit" class="cp-primary" ${taskBridge?.createTaskFromRecommendation || draft.duplicateTaskId ? '' : 'disabled'}>${draft.duplicateTaskId ? '关联已有任务' : '确认创建任务'}</button></footer></form></dialog>`;
    }
    function detailRecommendationsHtml(profile) {
      const recommendations = operatingSnapshot().recommendations.filter(item => item.customerId === profile.customerId && (!item.product || item.product === profile.product) && item.recommendationStatus !== 'DISMISSED').slice(0, 3);
      return `<section class="cp-detail-section cp-detail-recommendations"><header><div><p>Operating Intelligence · Evidence First</p><h3>经营建议</h3></div><button type="button" class="cp-text-action" data-cp-open-intelligence="${esc(profile.customerId)}">查看全部</button></header>${recommendations.length ? `<div>${recommendations.map(item => `<article><button type="button" data-cp-recommendation-detail="${esc(item.recommendationKey)}"><span class="cp-priority-badge">${esc(item.priority)}</span><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small></button><div>${taskLinkHtml(item, true)}</div></article>`).join('')}</div>` : '<div class="cp-empty cp-inline-empty"><strong>暂无有依据的经营建议</strong><p>没有证据时不会生成建议。</p></div>'}</section>`;
    }
    function selectedCustomerSummary(customer, relationships, allCustomers) {
      if (!customer) return `<aside class="cp-graph-selection cp-graph-selection-empty"><span>选择客户节点</span><strong>查看客户关系与经营提示</strong><p>点击节点后可以打开原客户详情、新增关系或维护公开职业信息。</p></aside>`;
      const linkedIds = new Set(relationships.flatMap(item => item.sourceCustomerId === customer.customerId ? [item.targetCustomerId] : item.targetCustomerId === customer.customerId ? [item.sourceCustomerId] : []));
      const linked = allCustomers.filter(item => linkedIds.has(item.customerId));
      const professional = professionalStore.get(customer.customerId);
      const allRelations = relationshipStore.list({
        customerId: customer.customerId,
        includeDeleted: true
      });
      return `<aside class="cp-graph-selection" data-selected-customer="${esc(customer.customerId)}"><header>${customerAvatarHtml(customer, 'large')}<div><span>${esc(customer.hospital)} · ${esc(customer.department)}</span><h3>${esc(customer.customerName)}</h3><p>${customer.active ? '启用客户' : '客户已停用 · 关系保留'} · ${customer.importance.importanceLevel === 'HIGH' ? '重点客户' : customer.importance.importanceLevel === 'MEDIUM' ? '重要性：中' : '重要性：普通'}</p></div><button type="button" data-cp-graph-clear aria-label="取消选择">×</button></header>
        <div class="cp-graph-selection-tags"><span class="grade-${customer.salesGrade.toLowerCase()}">${esc(customer.salesGrade)}</span><span>${esc(customer.perceptionLevel)}</span><span>${esc(DEVELOPMENT_STATUS[customer.developmentStatus]?.label || '未开发')}</span><span>${esc(STATUS[customer.currentStatus]?.label || '数据不足')}</span>${customer.overdue ? '<strong>跟进逾期</strong>' : ''}</div>
        <p class="cp-importance-explanation">${esc(customer.importance.reasons.slice(0, 4).join(' · ') || '暂无重要性依据')}</p>
        <div class="cp-graph-selection-actions"><button type="button" class="cp-primary" data-cp-graph-detail="${esc(customer.profileKey)}">打开原客户详情</button><button type="button" class="cp-secondary" data-cp-new-relationship="${esc(customer.customerId)}">＋ 新增关系</button><button type="button" class="cp-secondary" data-cp-professional="${esc(customer.customerId)}">职业信息</button></div>
        <section><header><strong>关系 ${allRelations.filter(item => !item.deletedAt).length}</strong><span>关联客户 ${linked.length}</span></header><div class="cp-selected-relations">${allRelations.length ? allRelations.map(relation => {
        const otherId = relation.sourceCustomerId === customer.customerId ? relation.targetCustomerId : relation.sourceCustomerId;
        const other = allCustomers.find(item => item.customerId === otherId);
        return `<article class="${relation.deletedAt ? 'is-deleted' : ''}"><div><strong>${esc(other?.customerName || '缺失客户')}</strong><span>${esc(RELATIONSHIP_SCOPES[relation.relationshipScope])} · ${esc(RELATIONSHIP_TYPES[relation.relationshipType])} · ${esc(RELATIONSHIP_STRENGTHS[relation.strength])}${relation.directed ? relation.sourceCustomerId === customer.customerId ? ' · 指向对方' : ' · 对方指向本客户' : ' · 双向'}</span><p>${esc(relation.description || '暂无说明')}</p></div><footer><button type="button" class="cp-inline-icon" aria-label="编辑关系" title="编辑关系" data-cp-edit-relationship="${esc(relation.relationshipId)}">✎</button>${relation.deletedAt ? `<button type="button" data-cp-restore-relationship="${esc(relation.relationshipId)}">恢复</button>` : `<button type="button" class="cp-inline-icon" aria-label="删除关系" title="删除关系" data-cp-delete-relationship="${esc(relation.relationshipId)}">×</button>`}</footer></article>`;
      }).join('') : '<p class="cp-graph-no-relations">尚无关系，可从当前客户开始建立。</p>'}</div></section>
        ${professional.administrativeTitles.length || professional.academicTitles.length ? `<section class="cp-selection-professional"><strong>公开职业信息</strong><p>${esc([...professional.administrativeTitles, ...professional.academicTitles].map(item => `${item.title}${item.organization ? ` · ${item.organization}` : ''}`).join('；'))}</p></section>` : ''}
      </aside>`;
    }
    function relationshipGraphHtml() {
      const data = graphData();
      const allCustomers = graphCustomers();
      const intelligenceByCustomer = new Map();
      operatingSnapshot().recommendations.filter(item => item.recommendationStatus !== 'DISMISSED' && (!item.product || item.product === state.product)).forEach(item => {
        if (!intelligenceByCustomer.has(item.customerId)) intelligenceByCustomer.set(item.customerId, item);
      });
      const layout = createRelationshipLayout(data.customers, data.relationships, state.relationshipViewMode, {
        storedPositions: relationshipLayoutStore.getPositions(state.relationshipViewMode)
      });
      const customerById = new Map(data.customers.map(item => [item.customerId, item]));
      const selected = customerById.get(state.selectedGraphCustomerId) || null;
      const linkedIds = new Set(data.relationships.flatMap(item => item.sourceCustomerId === state.selectedGraphCustomerId ? [item.targetCustomerId] : item.targetCustomerId === state.selectedGraphCustomerId ? [item.sourceCustomerId] : []));
      const lines = data.relationships.map(relationship => {
        const source = layout.positions[relationship.sourceCustomerId];
        const target = layout.positions[relationship.targetCustomerId];
        if (!source || !target) return '';
        return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" class="cp-relationship-line scope-${relationship.relationshipScope.toLowerCase()} strength-${relationship.strength.toLowerCase()} ${[relationship.sourceCustomerId, relationship.targetCustomerId].includes(state.selectedGraphCustomerId) ? 'is-linked' : ''}" data-cp-relationship-line="${esc(relationship.relationshipId)}" ${relationship.directed ? 'marker-end="url(#cpGraphArrow)"' : ''}><title>${esc(RELATIONSHIP_TYPES[relationship.relationshipType])} · ${esc(RELATIONSHIP_STRENGTHS[relationship.strength])}</title></line>`;
      }).join('');
      const groups = layout.groups.map(group => {
        const visibleGroup = group.customers.filter(item => customerById.has(item.customerId));
        const metrics = hospitalMetrics(visibleGroup);
        if (!visibleGroup.length) return '';
        const departments = (group.departments || []).map(department => {
          const visibleDepartment = department.customers.filter(item => customerById.has(item.customerId));
          return visibleDepartment.length ? `<button type="button" class="cp-graph-department" style="left:${department.x}px;top:${department.y}px;width:${department.width}px;height:${department.height}px" data-cp-focus-department="${esc(department.departmentId)}"><strong>${esc(department.department)}</strong><span>${visibleDepartment.length} 位</span></button>` : '';
        }).join('');
        return `<div class="cp-graph-hospital" style="left:${group.x}px;top:${group.y}px;width:${group.width}px;height:${group.height}px"><button type="button" data-cp-focus-hospital="${esc(group.hospitalId)}"><strong>${esc(group.hospital)}</strong><span>${visibleGroup.length}位 · A${metrics.grades.A}/B${metrics.grades.B}/C${metrics.grades.C}/D${metrics.grades.D}</span><small>R1-${metrics.levels.R1} · R2-${metrics.levels.R2} · R3-${metrics.levels.R3} · R4-${metrics.levels.R4} · 重点${metrics.priority} · 风险${metrics.risk}</small></button></div>${departments}`;
      }).join('');
      const nodes = data.customers.map(customer => {
        const position = layout.positions[customer.customerId];
        const selectedClass = customer.customerId === state.selectedGraphCustomerId ? 'is-selected' : linkedIds.has(customer.customerId) ? 'is-associated' : '';
        const recommendation = intelligenceByCustomer.get(customer.customerId);
        return `<button type="button" class="cp-graph-node ${selectedClass} ${customer.active ? '' : 'is-inactive'} ${customer.importance.importanceLevel === 'HIGH' ? 'is-important' : ''}" style="left:${position.x}px;top:${position.y}px" data-cp-graph-node="${esc(customer.customerId)}" aria-label="选择${esc(customer.customerName)}"><span class="cp-node-avatar">${customerAvatarHtml(customer)}</span><span class="cp-node-copy"><strong>${esc(customer.customerName)}</strong><small>${esc(customer.salesGrade)} · ${esc(customer.perceptionLevel)} · ${esc(DEVELOPMENT_STATUS[customer.developmentStatus]?.label || '未开发')}</small></span>${recommendation ? `<i class="cp-node-intelligence priority-${recommendation.priority.toLowerCase()}" data-cp-recommendation-detail="${esc(recommendation.recommendationKey)}" title="${esc(recommendation.priority)} · ${esc(OPERATING_SIGNAL_TYPES[recommendation.signalType])}">${esc(recommendation.priority)}</i>` : customer.overdue ? '<i title="跟进逾期">!</i>' : ''}</button>`;
      }).join('');
      requestCustomerImages(data.customers);
      const relationshipCount = relationshipFilterCount();
      return `<section class="cp-relationship-page"><header class="cp-relationship-header"><div><p>Customer Relationship Graph V1 · Local First</p><h2>客户关系图谱</h2><span>同一 customerId 贯穿主档案、两种图谱与原客户详情</span></div><div class="cp-view-switch" role="tablist"><button type="button" role="tab" aria-selected="${state.relationshipViewMode === 'horizon'}" class="${state.relationshipViewMode === 'horizon' ? 'active' : ''}" data-cp-graph-view="horizon">地平线</button><button type="button" role="tab" aria-selected="${state.relationshipViewMode === 'planet'}" class="${state.relationshipViewMode === 'planet' ? 'active' : ''}" data-cp-graph-view="planet">星球</button></div></header>
        <div class="cp-graph-toolbar"><div class="cp-graph-toolbar-view-switch" role="tablist"><button type="button" role="tab" aria-selected="${state.relationshipViewMode === 'horizon'}" class="${state.relationshipViewMode === 'horizon' ? 'active' : ''}" data-cp-graph-view="horizon">地平线</button><button type="button" role="tab" aria-selected="${state.relationshipViewMode === 'planet'}" class="${state.relationshipViewMode === 'planet' ? 'active' : ''}" data-cp-graph-view="planet">星球</button></div><button type="button" data-cp-relationship-filters>筛选${relationshipCount ? `<b>${relationshipCount}</b>` : ''}</button><button type="button" class="${state.relationshipFilters.primaryOnly ? 'active' : ''}" data-cp-primary-only>仅显示重点关系</button><span>${data.customers.length} 位客户 · ${data.relationships.length} 条可见关系</span><div><button type="button" data-cp-graph-zoom="out" aria-label="缩小">−</button><strong>${Math.round(state.relationshipZoom * 100)}%</strong><button type="button" data-cp-graph-zoom="in" aria-label="放大">＋</button><button type="button" data-cp-graph-reset>自动布局</button><button type="button" class="cp-graph-fullscreen-toggle" data-cp-graph-fullscreen aria-pressed="${state.graphFullscreen}" aria-label="${state.graphFullscreen ? '缩回默认图谱' : '全屏查看图谱'}">${state.graphFullscreen ? '缩回' : '全屏'}</button></div></div>
        <div class="cp-graph-stage ${state.relationshipViewMode === 'planet' ? 'is-planet' : 'is-horizon'}"><div class="cp-graph-viewport" data-cp-graph-viewport><div class="cp-graph-world" style="width:${layout.width}px;height:${layout.height}px;transform:translate(${state.relationshipPanX}px,${state.relationshipPanY}px) scale(${state.relationshipZoom})"><div class="cp-graph-groups">${groups}</div><svg class="cp-graph-lines" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" aria-label="客户关系连线"><defs><marker id="cpGraphArrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z"></path></marker></defs>${lines}</svg><div class="cp-graph-nodes">${nodes}</div></div>${data.customers.length ? '' : '<div class="cp-empty cp-graph-empty"><strong>暂无符合筛选条件的客户</strong><p>可以清除筛选；关系线只显示在当前可见客户之间。</p><button type="button" data-cp-clear-relationship-filters>清除图谱筛选</button></div>'}</div>${selectedCustomerSummary(selected, data.relationships, allCustomers)}</div>
        <footer class="cp-graph-legend"><span><i class="in"></i>院内关系</span><span><i class="out"></i>院外关系</span><span><i class="strong"></i>重点关系</span><em>拖动节点保存自定义位置；拖动画布平移；滚轮或按钮缩放。</em></footer></section>`;
    }
    function relationshipFilterDialogHtml() {
      const customers = graphCustomers();
      const hospitals = [...new Map(customers.map(item => [item.hospitalId, item.hospital])).entries()];
      const departments = [...new Map(customers.filter(item => state.relationshipFilters.hospital === 'all' || item.hospitalId === state.relationshipFilters.hospital).map(item => [item.departmentId, item.department])).entries()];
      const checked = (values, value) => values.includes(value) ? 'checked' : '';
      return `<dialog class="cp-sheet cp-relationship-filter-dialog" id="cpRelationshipFilterDialog"><form method="dialog" id="cpRelationshipFilterForm"><header><div><p>可见节点与关系线同步过滤</p><h2>关系图谱筛选</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><label>医院<select name="hospital"><option value="all">全部医院</option>${hospitals.map(([id, name]) => `<option value="${esc(id)}" ${state.relationshipFilters.hospital === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label><label>科室<select name="department"><option value="all">全部科室</option>${departments.map(([id, name]) => `<option value="${esc(id)}" ${state.relationshipFilters.department === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label><fieldset><legend>销量等级（可多选）</legend>${['A', 'B', 'C', 'D'].map(grade => `<label><input type="checkbox" name="grades" value="${grade}" ${checked(state.relationshipFilters.grades || [], grade)}>${grade}</label>`).join('')}</fieldset><fieldset><legend>观念等级（可多选）</legend>${['R1', 'R2', 'R3', 'R4'].map(level => `<label><input type="checkbox" name="perceptionLevels" value="${level}" ${checked(state.relationshipFilters.perceptionLevels || [], level)}>${level}</label>`).join('')}</fieldset><label>开发状态<select name="developmentStatus"><option value="all">全部开发状态</option>${Object.entries(DEVELOPMENT_STATUS).map(([key, meta]) => `<option value="${key}" ${state.relationshipFilters.developmentStatus === key ? 'selected' : ''}>${esc(meta.label)}</option>`).join('')}</select></label><label>经营状态<select name="currentStatus"><option value="all">全部经营状态</option>${Object.entries(STATUS).map(([key, meta]) => `<option value="${key}" ${state.relationshipFilters.currentStatus === key ? 'selected' : ''}>${esc(meta.label)}</option>`).join('')}</select></label><label>关系范围<select name="relationshipScope"><option value="all">院内 + 院外</option>${Object.entries(RELATIONSHIP_SCOPES).map(([key, label]) => `<option value="${key}" ${state.relationshipFilters.relationshipScope === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label>关系状态<select name="hasRelationship"><option value="all">全部客户</option><option value="yes" ${state.relationshipFilters.hasRelationship === 'yes' ? 'selected' : ''}>已有关系</option><option value="no" ${state.relationshipFilters.hasRelationship === 'no' ? 'selected' : ''}>暂无关系</option></select></label><fieldset><legend>重点筛选</legend><label><input type="checkbox" name="importantOnly" ${state.relationshipFilters.importantOnly ? 'checked' : ''}> 仅重点客户</label><label><input type="checkbox" name="primaryOnly" ${state.relationshipFilters.primaryOnly ? 'checked' : ''}> 仅强关系</label></fieldset><p class="cp-full cp-note-association">过滤后仅保留当前可见节点之间的有效关系，不会显示连向隐藏节点的断线。</p></div><footer><button type="button" class="cp-secondary" data-cp-clear-relationship-filters>清除</button><button type="submit" class="cp-primary">应用筛选</button></footer></form></dialog>`;
    }
    function relationshipDialogHtml() {
      const existing = state.selectedRelationshipId ? relationshipStore.get(state.selectedRelationshipId) : null;
      const sourceCustomerId = existing?.sourceCustomerId || state.relationshipEditorSourceId || state.selectedGraphCustomerId;
      const customers = graphCustomers();
      const option = (customer, selectedId) => `<option value="${esc(customer.customerId)}" ${customer.customerId === selectedId ? 'selected' : ''}>${esc(customer.customerName)} · ${esc(customer.hospital)} · ${esc(customer.department)}</option>`;
      return `<dialog class="cp-sheet cp-relationship-dialog" id="cpRelationshipDialog"><form method="dialog" id="cpRelationshipForm"><header><div><p>默认有向 · Local First</p><h2>${existing ? '编辑客户关系' : '新增客户关系'}</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields">${state.relationshipError ? `<p class="cp-row-error">${esc(state.relationshipError)}</p>` : ''}<input type="hidden" name="relationshipId" value="${esc(existing?.relationshipId || '')}"><label>当前客户<select name="sourceCustomerId" required><option value="">请选择</option>${customers.map(customer => option(customer, sourceCustomerId)).join('')}</select></label><label>搜索目标客户<input type="search" data-cp-relationship-target-search placeholder="输入姓名、医院、科室或 customerId" autocomplete="off"></label><label class="cp-full">目标客户<select name="targetCustomerId" required><option value="">请选择目标客户</option>${customers.filter(customer => customer.customerId !== sourceCustomerId).map(customer => option(customer, existing?.targetCustomerId)).join('')}</select></label><label>关系范围<select name="relationshipScope">${Object.entries(RELATIONSHIP_SCOPES).map(([key, label]) => `<option value="${key}" ${existing?.relationshipScope === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label>关系类型<select name="relationshipType">${Object.entries(RELATIONSHIP_TYPES).map(([key, label]) => `<option value="${key}" ${existing?.relationshipType === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label>关系强度<select name="strength">${Object.entries(RELATIONSHIP_STRENGTHS).map(([key, label]) => `<option value="${key}" ${(existing?.strength || 'NORMAL') === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label class="cp-directed-toggle"><input type="checkbox" name="directed" ${existing?.directed !== false ? 'checked' : ''}> 有向关系（来源客户 → 目标客户）</label><label class="cp-full">关系说明<textarea name="description" rows="3" maxlength="400" placeholder="记录关系依据与业务上下文">${esc(existing?.description || '')}</textarea></label><p class="cp-full cp-delete-safety">删除操作仅删除关系，不删除任何客户档案或客户图片。</p></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">保存关系</button></footer></form></dialog>`;
    }
    function professionalDialogHtml() {
      const customer = graphCustomers().find(item => item.customerId === state.professionalCustomerId);
      const professional = professionalStore.get(state.professionalCustomerId);
      const titleItems = (type, items) => items.map(item => `<article><div><strong>${esc(item.title)}</strong><span>${esc(item.organization || '组织未填写')} · ${esc(item.level)} · ${esc(item.source)}</span><p>${esc(item.verifiedAt || '未核验日期')}${item.notes ? ` · ${esc(item.notes)}` : ''}</p></div><button type="button" data-cp-remove-professional="${esc(type)}:${esc(item.titleId)}">删除</button></article>`).join('');
      return `<dialog class="cp-sheet cp-professional-dialog" id="cpProfessionalDialog"><form method="dialog" id="cpProfessionalForm"><header><div><p>人工可维护 · 在线查询尚未接入</p><h2>${esc(customer?.customerName || '客户')}职业信息</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-professional-scroll">${state.professionalError ? `<p class="cp-row-error">${esc(state.professionalError)}</p>` : ''}<section class="cp-image-editor"><div>${customer ? customerAvatarHtml(customer, 'large') : ''}<p><strong>客户头像</strong><span>图片按 customerId 存入独立 IndexedDB；姓名、产品或关系变化不会复制或删除图片。</span></p></div><label class="cp-secondary">上传/更换图片<input type="file" accept="image/jpeg,image/png,image/webp" data-cp-customer-image></label><button type="button" class="cp-text-action" data-cp-remove-image>删除图片</button><small>${esc(state.imageError)}</small></section><section class="cp-professional-list"><header><strong>行政职务</strong><span>${professional.administrativeTitles.length} 条</span></header>${titleItems('administrativeTitles', professional.administrativeTitles) || '<p>尚未录入</p>'}<header><strong>学术任职</strong><span>${professional.academicTitles.length} 条</span></header>${titleItems('academicTitles', professional.academicTitles) || '<p>尚未录入</p>'}</section><div class="cp-sheet-fields"><input type="hidden" name="customerId" value="${esc(customer?.customerId || '')}"><label>类型<select name="profileType"><option value="administrativeTitles">行政职务</option><option value="academicTitles">学术任职</option></select></label><label>职务/任职<input type="text" name="title" required placeholder="如：科室主任"></label><label>组织<input type="text" name="organization" placeholder="医院、学会或专业组"></label><label>层级<select name="level"><option value="DEPARTMENT">科室</option><option value="HOSPITAL">院级</option><option value="CITY">市级</option><option value="PROVINCIAL">省级</option><option value="NATIONAL">国家级</option><option value="OTHER">其他</option></select></label><label>来源说明<input type="text" name="source" required value="MANUAL" placeholder="人工录入/公开来源"></label><label>核验日期<input type="date" name="verifiedAt"></label><label class="cp-full">备注<textarea name="notes" rows="2"></textarea></label><p class="cp-full cp-note-association">Provider：${esc(professionalProvider.label)}。本版不会伪装成在线查询结果。</p></div></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>关闭</button><button type="submit" class="cp-primary">新增职业信息</button></footer></form></dialog>`;
    }
    function timelineHtml(profile) {
      const taskLinks = taskLinkStore.reconcile(taskBridge).filter(item => item.customerId === profile.customerId);
      const events = collectCustomerEvents(profile, {
        product: profile.product,
        notes: allLocalNotesForCustomer(profile.customerId),
        followUps: followUpStore.list({
          customerId: profile.customerId
        }),
        developmentHistory: developmentStore.listHistory(profile.customerId),
        masterEvents: developmentStore.listMasterEvents(profile.customerId),
        plans: profile.plans || [],
        resources: profile.resourceInvestments || [],
        taskLinks,
        tasks: taskLinks.map(item => taskBridge?.getTask?.(item.taskId)).filter(Boolean)
      });
      const filters = [['all', '全部'], ['followup', '跟进'], ['task', '任务'], ['quick', '快速记录'], ['status', '状态变化'], ['plan', '计划'], ['investment', '学术投入']];
      const visible = state.timelineFilter === 'all' ? events : events.filter(item => item.category === state.timelineFilter);
      const undo = state.lastDeletedFollowUpId && followUpStore.get(state.lastDeletedFollowUpId)?.deletedAt ? `<div class="cp-undo-banner"><span>跟进记录已软删除</span><button type="button" data-cp-undo-followup="${esc(state.lastDeletedFollowUpId)}">撤销</button></div>` : '';
      const controls = `<div class="cp-timeline-filters" role="tablist">${filters.map(([key, label]) => `<button type="button" role="tab" aria-selected="${state.timelineFilter === key}" class="${state.timelineFilter === key ? 'active' : ''}" data-cp-timeline-filter="${key}">${label}<b>${key === 'all' ? events.length : events.filter(item => item.category === key).length}</b></button>`).join('')}</div>`;
      if (!visible.length) return `${controls}${undo}<div class="cp-empty cp-inline-empty"><strong>尚无客户动态（当前分类）</strong><p>跟进、任务完成、快速记录、状态、计划与学术投入会按时间汇入这里。</p></div>`;
      return `${controls}${undo}<ol class="cp-timeline">${visible.map(event => `<li class="cp-event-${esc(event.category)}" data-event-id="${esc(event.eventId || '')}"><time>${esc(String(event.at || event.date || '').slice(0, 10) || '日期待补充')}</time><div><span>${esc(eventLabel(event.type))}${event.product ? ` · ${esc(event.product)}` : ' · 客户级'}</span><strong>${esc(event.title)}</strong><p>${esc(event.detail || '')}</p>${event.operator ? `<small>操作：${esc(event.operator)} · ${esc(event.source || '')}</small>` : ''}<div class="cp-event-actions">${event.type === 'FOLLOW_UP' ? `<button type="button" class="cp-inline-icon" aria-label="编辑跟进" title="编辑跟进" data-cp-edit-followup="${esc(event.followUpId)}">✎</button><button type="button" class="cp-inline-icon" aria-label="删除跟进" title="删除跟进" data-cp-delete-followup="${esc(event.followUpId)}">×</button>` : ''}${event.type === 'QUICK_NOTE' && !event.convertedToFollowUpId ? `<button type="button" data-cp-convert-note="${esc(event.id)}">转为正式跟进</button>` : ''}${event.type === 'QUICK_NOTE' && event.convertedToFollowUpId ? '<em>已转为跟进</em>' : ''}</div></div></li>`).join('')}</ol>`;
    }
    function gradeTimeline(profile) {
      const history = (profile.gradeHistory || []).filter(item => item.month <= state.filters.month).slice(-8);
      if (!history.length) return '<div class="cp-empty cp-inline-empty"><strong>尚无等级数据</strong><p>导入月度销量后可生成等级变化历史。</p></div>';
      return `<div class="cp-grade-timeline">${history.map((item, index) => {
        const prior = history[index - 1];
        const direction = !prior ? '' : SALES_GRADE_ORDER[item.grade] > SALES_GRADE_ORDER[prior.grade] ? '↑' : SALES_GRADE_ORDER[item.grade] < SALES_GRADE_ORDER[prior.grade] ? '↓' : '→';
        return `<div><time>${monthLabel(item.month)}</time><span class="cp-grade grade-${item.grade.toLowerCase()}">${item.grade}</span>${direction ? `<b class="${direction === '↑' ? 'up' : direction === '↓' ? 'down' : ''}">${direction}</b>` : ''}</div>`;
      }).join('')}</div>`;
    }
    function responsibilityHtml(profile) {
      if (!['AT_RISK', 'LOST'].includes(profile.currentStatus)) return '';
      const item = profile.lossResponsibility || {};
      return `<section class="cp-detail-section cp-responsibility"><header><div><p>责任追踪</p><h3>流失风险闭环</h3></div><span>${esc(item.trackingStatus || '待分析')}</span></header><p class="cp-risk-rule">单月 0 盒不会自动认定流失；风险状态用于安排分析、恢复计划与下一次复盘。</p><div class="cp-info-grid"><div><span>负责人</span><strong>${esc(item.owner || profile.employeeName || '待补充')}</strong></div><div><span>最后产出月份</span><strong>${esc(item.lastOutputMonth || profile.lastActiveMonth || '待补充')}</strong></div><div><span>历史最高月销量</span><strong>${item.historicalPeak ?? '待补充'}${item.historicalPeak !== undefined ? '盒' : ''}</strong></div><div><span>流失前等级</span><strong>${esc(item.gradeBeforeLoss || '待补充')}</strong></div><div><span>掉量开始时间</span><strong>${esc(item.declineStartedAt || '待补充')}</strong></div><div><span>下一次复盘</span><strong>${esc(item.nextReviewDate || '待补充')}</strong></div></div><dl><div><dt>问题原因</dt><dd>${esc(item.reason || '待分析')}</dd></div><div><dt>恢复计划</dt><dd>${esc(item.recoveryPlan || '待补充恢复计划')}</dd></div></dl></section>`;
    }
    function developmentSummaryHtml(profile) {
      const development = developmentFor(profile.customerId);
      const developmentMeta = DEVELOPMENT_STATUS[development.status] || DEVELOPMENT_STATUS.UNDEVELOPED;
      const salesStatus = statusFor(profile);
      const fields = currentFollowUpFields(profile);
      const latest = fields.latest;
      const suggestion = suggestedDevelopmentStatus(profile);
      const suggestionMeta = DEVELOPMENT_STATUS[suggestion.status];
      return `<section class="cp-development-summary ${fields.overdue ? 'is-overdue' : ''}">
        <header><div><p>客户开发与跟进</p><h3>当前行动摘要</h3></div><div class="cp-development-actions"><button type="button" class="cp-secondary" data-cp-status="${esc(profile.customerId)}">调整开发状态</button><button type="button" class="cp-primary" data-cp-new-followup>＋ 新增跟进</button></div></header>
        <div class="cp-development-grid"><div><span>人工开发状态</span><strong class="cp-development-status ${esc(developmentMeta.tone)}">${esc(developmentMeta.label)}</strong><small>${development.updatedAt ? `更新于 ${esc(dateOnly(development.updatedAt))}` : '尚未人工调整'}</small></div><div><span>销量经营状态</span><strong class="cp-status ${esc(salesStatus.tone)}"><i></i>${esc(salesStatus.label)}</strong><small>只读、按 ${esc(profile.product)} 独立计算</small></div><div><span>最近跟进</span><strong>${latest ? `${esc(dateOnly(latest.followUpAt))} · ${esc(FOLLOW_UP_TYPES[latest.followUpType])}` : '尚无正式跟进'}</strong><small>${latest ? esc(latest.content) : '可新增或从快速记录显式转化'}</small></div><div><span>下次跟进</span><strong>${esc(fields.nextFollowUpDate || '待安排')}</strong><small class="${fields.overdue ? 'cp-overdue-text' : ''}">${fields.overdue ? '已逾期，请尽快处理' : '按客户级计划提醒'}</small></div></div>
        <dl><div><dt>当前阻碍</dt><dd>${esc(fields.currentObstacle || '尚未记录')}</dd></div><div><dt>下一步动作</dt><dd>${esc(fields.nextAction || '尚未安排')}</dd></div></dl>
        <aside class="cp-status-suggestion"><span>经营数据建议</span><strong>${esc(suggestionMeta.label)}</strong><p>${esc(suggestion.rationale)}</p><em>不会自动覆盖人工开发状态</em></aside>
      </section>`;
    }
    function insightHtml(profile) {
      const insight = insightStore.get(profile.customerId);
      const expanded = state.expandedInsightCustomerId === profile.customerId;
      if (!insight) return `<section class="cp-detail-section cp-insight-card"><header><div><p>Customer Communication Insights</p><h3>客户沟通洞察</h3></div><button type="button" class="cp-primary" data-cp-generate-insight="${esc(profile.customerId)}">生成建议</button></header><div class="cp-empty cp-inline-empty"><strong>尚无沟通洞察</strong><p>仅从本客户已保存的跟进与快速记录生成；本版使用本地规则模拟 Provider，不调用线上 AI。</p></div></section>`;
      const statusLabel = insight.reviewStatus === 'HUMAN_CONFIRMED' ? '人工已确认' : 'AI 建议待确认';
      const fields = expanded ? INSIGHT_FIELDS : ['keyConcerns', 'currentDifficulty', 'recommendedApproach'];
      return `<section class="cp-detail-section cp-insight-card"><header><div><p>Customer Communication Insights</p><h3>客户沟通洞察</h3></div><span class="cp-insight-review ${insight.reviewStatus === 'HUMAN_CONFIRMED' ? 'confirmed' : ''}">${statusLabel}</span></header><div class="cp-insight-disclosure"><strong>本地规则建议（非线上 AI）</strong><span>更新 ${esc(dateOnly(insight.updatedAt) || '—')} · 只能基于已记录事实，不推断人格、心理或敏感属性</span></div><dl class="cp-insight-fields">${fields.map(field => `<div><dt>${esc(INSIGHT_FIELD_LABELS[field])}</dt><dd>${esc(insight[field] || '记录不足')}</dd></div>`).join('')}</dl>${expanded ? `<div class="cp-insight-evidence"><strong>依据记录</strong>${insight.evidence.map(item => `<blockquote><p>${esc(item.quote)}</p><cite>${esc(dateOnly(item.recordedAt) || '日期未填写')} · ${esc(item.source)}</cite></blockquote>`).join('')}</div>` : ''}<footer><button type="button" class="cp-text-action" data-cp-toggle-insight="${esc(profile.customerId)}">${expanded ? '收起依据' : '查看全部与依据'}</button><button type="button" class="cp-secondary" data-cp-edit-insight="${esc(profile.customerId)}">人工编辑确认</button><button type="button" class="cp-secondary" data-cp-generate-insight="${esc(profile.customerId)}">重新分析</button></footer></section>`;
    }
    function panelShell(title, eyebrow, actions, body) {
      return `<aside class="cp-detail cp-v11-panel" aria-label="${esc(title)}"><header class="cp-detail-header"><button type="button" class="cp-back" data-cp-panel-close aria-label="返回客户首页">‹</button><div><div class="cp-detail-title"><h2>${esc(title)}</h2></div><p>${esc(eyebrow)}</p></div><div class="cp-panel-actions">${actions || ''}</div></header><div class="cp-detail-scroll">${body}</div></aside>`;
    }
    function filteredMasterRecords() {
      const query = normalizedAlias(state.masterSearch);
      return masterStore.list().filter(record => {
        if (state.masterActiveFilter === 'active' && !record.active) return false;
        if (state.masterActiveFilter === 'inactive' && record.active) return false;
        if (!query) return true;
        return [record.customerName, ...record.aliases, record.hospital, ...record.hospitalAliases, record.department, ...record.departmentAliases, record.employee].map(normalizedAlias).join('|').includes(query);
      }).sort((a, b) => Number(b.active) - Number(a.active) || a.customerName.localeCompare(b.customerName, 'zh-CN'));
    }
    function customerDeletionContext(customerId) {
      return {
        app: config.getDeletionContext?.() || {
          tasks: config.tasks || [],
          records: config.records || []
        },
        followUps: followUpStore.list({
          includeDeleted: true
        }),
        development: developmentStore.exportState(),
        relationships: relationshipStore.list({
          includeDeleted: true
        }),
        taskLinks: taskLinkStore.list(),
        notes: allLocalNotesForCustomer(customerId)
      };
    }
    const selectedCustomerIds = new Set();
    function deleteCustomer(customerId, {
      deferRender = false
    } = {}) {
      const record = masterStore.get(customerId);
      if (!record) return null;
      const context = customerDeletionContext(customerId);
      const decision = Deletion.decide('customer', record, context);
      if (decision.action === 'DELETE' && config.getDeletionContext && config.onCustomerDeleted) {
        masterStore.remove(customerId, context);
        config.onCustomerDeleted(customerId);
      } else {
        masterStore.setActive(customerId, false);
        decision.action = 'ARCHIVE';
      }
      selectedCustomerIds.delete(customerId);
      if (!deferRender) {
        refreshHydration();
        render();
      }
      return decision;
    }
    function masterPanelHtml() {
      const records = filteredMasterRecords();
      const body = `<section class="cp-master-summary"><div><strong>${masterStore.list({
        includeInactive: false
      }).length}</strong><span>启用客户</span></div><div><strong>${masterStore.list().filter(record => !record.active).length}</strong><span>已停用</span></div><div><strong>${matchQueue.length}</strong><span>待匹配</span></div></section>
        <div class="cp-master-toolbar"><label class="cp-search"><span>⌕</span><input type="search" id="cpMasterSearch" value="${esc(state.masterSearch)}" placeholder="搜索姓名、别名、医院、科室、负责人"></label><select id="cpMasterActive"><option value="active" ${state.masterActiveFilter === 'active' ? 'selected' : ''}>启用客户</option><option value="inactive" ${state.masterActiveFilter === 'inactive' ? 'selected' : ''}>已停用</option><option value="all" ${state.masterActiveFilter === 'all' ? 'selected' : ''}>全部客户</option></select></div>
        <div class="entry-bulk-actions"><button type="button" data-cp-select-all>☑ 全选</button><span>已选 ${selectedCustomerIds.size}</span><button type="button" data-cp-bulk-remove ${selectedCustomerIds.size ? '' : 'disabled'}>× 删除 / 归档</button></div>
        <section class="cp-master-grid">${records.length ? records.map(record => `<article class="cp-master-card ${record.active ? '' : 'is-inactive'}"><header><div><h3>${esc(record.customerName)}</h3><p>${esc(record.hospital)} · ${esc(record.department)}</p></div><span class="cp-r-level">${esc(record.perceptionLevel || 'R?')}</span><div class="cp-entry-inline-icons"><button type="button" data-cp-select-customer="${esc(record.customerId)}" aria-label="选择客户" aria-pressed="${selectedCustomerIds.has(record.customerId)}">${selectedCustomerIds.has(record.customerId) ? '☑' : '☐'}</button><button type="button" data-cp-edit-master="${esc(record.customerId)}" aria-label="编辑客户">✎</button><button type="button" data-cp-delete-master="${esc(record.customerId)}" aria-label="删除或归档客户">×</button></div></header><div class="cp-master-products" aria-label="关联产品">${record.associatedProducts.length ? record.associatedProducts.map(product => `<span>${esc(product)}</span>`).join('') : '<span class="is-unconfirmed">产品未确认</span>'}</div><div class="cp-master-meta"><span>负责人：${esc(record.employee || '未填写')}</span><span>${esc(DEVELOPMENT_STATUS[developmentFor(record.customerId).status]?.label || '未开发')}</span></div><p>${esc(record.nextAction || '尚未填写下一步动作')}</p>${config.isDeveloperMode?.() ? `<code>${esc(record.customerId)}</code>` : ''}<footer>${record.active ? '' : `<button type="button" class="cp-text-action" data-cp-toggle-master="${esc(record.customerId)}">恢复</button>`}</footer></article>`).join('') : '<div class="cp-empty"><span>⌕</span><strong>没有符合条件的主档案</strong><p>可以新增客户，或切换启用状态筛选。</p></div>'}</section>`;
      return panelShell('客户主档案', '姓名、医院、科室与跟进资料', '<button type="button" class="cp-primary" data-cp-new-master>＋ 新增客户</button>', body);
    }
    function masterFormDialogHtml() {
      const record = state.selectedMasterId ? masterStore.get(state.selectedMasterId) : null;
      const selectedStatus = record ? developmentFor(record.customerId).status : 'UNDEVELOPED';
      const value = field => esc(record?.[field] || '');
      const aliases = field => esc((record?.[field] || []).join('、'));
      return `<dialog class="cp-sheet cp-master-dialog" id="cpMasterDialog"><form method="dialog" id="cpMasterForm"><header><div><p>客户档案</p>${config.isDeveloperMode?.() && record ? `<code>${esc(record.customerId)}</code>` : ''}<h2>${record ? '编辑客户主档案' : '新增客户'}</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><input type="hidden" name="customerId" value="${value('customerId')}"><label>客户姓名<input type="text" name="customerName" value="${value('customerName')}" required></label><label>客户别名<input type="text" name="aliases" value="${aliases('aliases')}" placeholder="用、或逗号分隔"></label><label>医院<input type="text" name="hospital" value="${value('hospital')}" required></label><label>医院别名<input type="text" name="hospitalAliases" value="${aliases('hospitalAliases')}"></label><label>科室<input type="text" name="department" value="${value('department')}" required></label><label>科室别名<input type="text" name="departmentAliases" value="${aliases('departmentAliases')}"></label><label>负责人 / 员工<input type="text" name="employee" value="${value('employee')}"></label><label>观念等级<select name="perceptionLevel"><option value="">未填写</option>${['R1', 'R2', 'R3', 'R4'].map(level => `<option value="${level}" ${record?.perceptionLevel === level ? 'selected' : ''}>${level}</option>`).join('')}</select></label><fieldset class="cp-full cp-product-association"><legend>关联产品（可多选）</legend><div>${PRODUCTS.map(product => `<label><input type="checkbox" name="associatedProducts" value="${product}" ${record?.associatedProducts?.includes(product) ? 'checked' : ''}><span>${product}</span></label>`).join('')}</div><p>可同时选择多个产品；全部不选表示产品未确认，不会自动推断。</p></fieldset><label>开发状态<select name="developmentStatus">${Object.entries(DEVELOPMENT_STATUS).map(([key, meta]) => `<option value="${key}" ${selectedStatus === key ? 'selected' : ''}>${esc(meta.label)}</option>`).join('')}</select></label><label>下次跟进时间<input type="date" name="nextFollowUpDate" value="${value('nextFollowUpDate')}"></label><label class="cp-full">状态调整原因<input type="text" name="developmentReason" placeholder="状态变化时记录原因"></label><label class="cp-full">当前阻碍<textarea name="currentObstacle" rows="2">${value('currentObstacle')}</textarea></label><label class="cp-full">下一步动作<textarea name="nextAction" rows="2">${value('nextAction')}</textarea></label><label class="cp-full">备注<textarea name="notes" rows="3">${value('notes')}</textarea></label></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">${record ? '保存修改' : '创建客户'}</button></footer></form></dialog>`;
    }
    function importActionOptions(item) {
      const current = item.action === 'link' ? `link:${item.selectedCustomerId}` : item.action || (item.recommendedAction === 'create' ? 'create' : item.matchType === 'EXACT' ? `link:${item.customerId}` : 'defer');
      const candidates = item.candidates || [];
      return `<select data-cp-import-action="${esc(item.queueId)}" aria-label="第${item.rowNumber}行处理方式">${candidates.map(candidate => `<option value="link:${esc(candidate.customerId)}" ${current === `link:${candidate.customerId}` ? 'selected' : ''}>关联：${esc(candidate.canonicalName)}</option>`).join('')}<option value="create" ${current === 'create' ? 'selected' : ''}>新建客户</option><option value="defer" ${current === 'defer' ? 'selected' : ''}>暂不处理</option><option value="skip" ${current === 'skip' ? 'selected' : ''}>跳过此行</option></select>`;
    }
    function importReportHtml(report) {
      const metrics = [['新建', report.created], ['更新', report.updated], ['EXACT', report.exact], ['PROBABLE', report.probable], ['AMBIGUOUS', report.ambiguous], ['UNMATCHED', report.unmatched], ['跳过', report.skipped], ['异常', report.errors]];
      return `<section class="cp-import-report"><header><span>导入完成</span><h2>客户导入报告</h2><p>所有写入均发生在本机主档案存储；原销售、计划与资源数据保持只读。</p></header><div class="cp-import-metrics">${metrics.map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join('')}</div>${report.rowResults.some(row => ['ERROR', 'PENDING'].includes(row.status)) ? `<details open><summary>逐行异常与待处理</summary><ol>${report.rowResults.filter(row => ['ERROR', 'PENDING'].includes(row.status)).map(row => `<li>第${row.rowNumber}行 · ${esc(row.reason)}</li>`).join('')}</ol></details>` : '<p class="cp-success-note">全部记录处理完成，没有逐行异常。</p>'}<button type="button" class="cp-secondary" data-cp-import-reset>继续导入</button></section>`;
    }
    function importPanelHtml() {
      if (state.importReport) return panelShell('导入客户', state.importFileName || 'Excel 批量导入', '<button type="button" class="cp-secondary" data-cp-open-matches>匹配确认</button>', importReportHtml(state.importReport));
      const steps = ['选择文件', '字段识别', '数据预览', '匹配分析', '人工确认', '正式导入', '导入报告'];
      if (!state.importAnalysis) {
        const body = `<div class="cp-import-steps">${steps.map((step, index) => `<span class="${index === 0 ? 'active' : ''}">${index + 1}<b>${step}</b></span>`).join('')}</div><section class="cp-import-drop"><strong>选择客户档案 Excel</strong><p>支持 .xlsx / .xls / .csv。选择后只做字段识别、校验与匹配分析，不会直接写入。</p><label class="cp-primary">选择文件<input type="file" data-cp-import-file accept=".xlsx,.xls,.csv" hidden></label><small>原销售数据、客户升级 Provider 与学术投入 Provider 均不会被修改。</small></section>`;
        return panelShell('导入客户', '预览 / 校验优先 · Local First', '<button type="button" class="cp-secondary" data-cp-open-matches>匹配确认</button>', body);
      }
      const analysis = state.importAnalysis;
      const counts = ['EXACT', 'PROBABLE', 'AMBIGUOUS', 'UNMATCHED'].map(type => [type, analysis.items.filter(item => item.matchType === type).length]);
      const body = `<div class="cp-import-steps">${steps.map((step, index) => `<span class="${index >= 1 && index <= 4 ? 'active' : ''}">${index + 1}<b>${step}</b></span>`).join('')}</div><section class="cp-import-summary"><div><strong>${analysis.totalRows}</strong><span>Excel记录</span></div>${counts.map(([label, count]) => `<div><strong>${count}</strong><span>${label}</span></div>`).join('')}<div><strong>${analysis.items.filter(item => item.validationErrors.length).length}</strong><span>异常</span></div></section><section class="cp-recognized"><strong>字段识别</strong><div>${analysis.recognizedFields.map(field => `<span>${esc(field)}</span>`).join('')}</div></section><div class="cp-import-list">${analysis.items.map(item => `<article class="cp-import-row ${item.validationErrors.length ? 'has-error' : ''}"><header><div><b>第${item.rowNumber}行 · ${esc(item.record.customerName || '未填写姓名')}</b><p>${esc(item.record.hospital || '未填写医院')} · ${esc(item.record.department || '未填写科室')}</p></div><span class="cp-match-badge type-${item.matchType.toLowerCase()}">${item.matchType} · ${Math.round(item.confidence * 100)}%</span></header><div class="cp-evidence">${item.evidence.map(text => `<span>${esc(text)}</span>`).join('') || '<span>暂无匹配证据</span>'}</div>${item.validationErrors.length ? `<p class="cp-row-error">${esc(item.validationErrors.join('；'))}</p>` : ''}<footer>${importActionOptions(item)}</footer></article>`).join('')}</div><div class="cp-import-commit"><p>点击“正式导入”才会写入主档案。PROBABLE / AMBIGUOUS 默认进入匹配确认，不会自动覆盖。</p><button type="button" class="cp-primary" data-cp-import-commit>正式导入</button></div>`;
      return panelShell('导入客户', `${state.importFileName} · 预览与人工确认`, '<button type="button" class="cp-secondary" data-cp-import-reset>重新选择</button>', body);
    }
    function matchCenterHtml() {
      const masters = masterStore.list({
        includeInactive: false
      });
      const datalist = `<datalist id="cpMasterCandidates">${masters.map(record => `<option value="${esc(quickCustomerLabel(record))}"></option>`).join('')}</datalist>`;
      const body = matchQueue.length ? `<section class="cp-match-intro"><strong>${matchQueue.length} 条等待人工确认</strong><p>人工决策会按医院 + 科室 + 客户名保存，下次同一对象优先复用。</p></section>${datalist}<div class="cp-match-list">${matchQueue.map(item => `<article class="cp-match-card" data-match-queue-id="${esc(item.queueId)}"><header><div><span>${item.source === 'LOCAL_QUICK_NOTE' ? '快速记录' : `Excel 第${item.rowNumber || '—'}行`}</span><h3>${esc(item.record?.customerName || item.record?.name || '待匹配客户')}</h3><p>${esc(item.record?.hospital || '医院未填写')} · ${esc(item.record?.department || '科室未填写')}</p></div><span class="cp-match-badge type-${String(item.matchType || 'UNMATCHED').toLowerCase()}">${esc(item.matchType || 'UNMATCHED')} · ${Math.round(finite(item.confidence) * 100)}%</span></header><div class="cp-evidence">${(item.evidence || []).map(text => `<span>${esc(text)}</span>`).join('') || '<span>暂无匹配证据</span>'}</div><div class="cp-match-candidates">${(item.candidates || []).map(candidate => `<button type="button" data-cp-pick-candidate="${esc(candidate.customerId)}">${esc(candidate.canonicalName)} · ${esc(candidate.hospitalName)}</button>`).join('')}</div><footer><select data-cp-match-resolution><option value="existing">匹配现有客户</option><option value="create">新建客户</option><option value="defer">暂不处理</option></select><input type="text" list="cpMasterCandidates" data-cp-match-customer value="${esc(item.customerId || item.candidates?.[0]?.customerId || '')}" placeholder="搜索或输入 customerId"><button type="button" class="cp-primary" data-cp-resolve-match="${esc(item.queueId)}">确认</button></footer></article>`).join('')}</div>` : '<div class="cp-empty"><span>✓</span><strong>没有待确认的匹配</strong><p>PROBABLE、AMBIGUOUS、UNMATCHED 和未明确客户的快速记录会集中显示在这里。</p></div>';
      return panelShell('匹配确认', '人工确认优先 · 低置信度绝不自动覆盖', '<button type="button" class="cp-primary" data-cp-import>导入客户</button>', body);
    }
    function renderActivePanel() {
      if (state.panel === 'master') return masterPanelHtml();
      if (state.panel === 'import') return importPanelHtml();
      if (state.panel === 'matches') return matchCenterHtml();
      return '';
    }
    function detailHtml(item) {
      if (!item) return '';
      const {
        profile,
        metrics,
        risks
      } = item;
      const status = statusFor(profile);
      const plans = profile.plans || [];
      const currentPlan = plans.find(plan => plan.targetMonth === state.filters.month) || plans.at(-1);
      const resources = profile.resourceInvestments || [];
      const grades = (profile.gradeHistory || []).filter(entry => entry.month <= state.filters.month).map(entry => entry.grade);
      return `<aside class="cp-detail" aria-label="客户详细档案"><header class="cp-detail-header"><button type="button" class="cp-back" data-cp-close aria-label="返回客户列表">‹</button><div><div class="cp-detail-title"><h2>${esc(profile.canonicalName)}</h2><span class="cp-grade grade-${(metrics.grade || 'n').toLowerCase()}">${esc(metrics.grade || '—')}</span><span class="cp-r-level">${esc(profile.perceptionLevel || 'R?')}</span><span class="cp-status ${status.tone}"><i></i>${status.label}</span></div><p>${esc(profile.hospitalName || '未填写医院')} · ${esc(profile.departmentName || '未填写科室')} · ${esc(profile.employeeName || '未填写负责人')}</p><b>${esc(profile.product)}</b></div><div class="cp-detail-actions"><button type="button" class="cp-text-action" data-cp-sales="${esc(profileKey(profile))}">查看相关销售</button><button type="button" class="cp-text-action" data-cp-edit-master="${esc(profile.customerId)}">编辑档案</button><button type="button" class="cp-quick" data-cp-new-followup>＋ 新增跟进</button></div></header>
        <div class="cp-detail-scroll">
          ${developmentSummaryHtml(profile)}
          ${detailRecommendationsHtml(profile)}
          ${insightHtml(profile)}
          <section class="cp-hero-metrics"><div><span>本月销量</span><strong>${metrics.current === null ? '—' : metrics.current}<small>${metrics.current === null ? '' : '盒'}</small></strong></div><div><span>月环比</span><strong class="${(metrics.delta || 0) < 0 ? 'negative' : 'positive'}">${metrics.delta === null ? '—' : `${metrics.delta > 0 ? '+' : ''}${metrics.delta}`}<small>${metrics.delta === null ? '' : '盒'}</small></strong></div><div><span>${monthLabel(state.filters.month)}目标</span><strong>${metrics.target ?? '—'}<small>${metrics.target === null ? '' : '盒'}</small></strong></div><div><span>完成率</span><strong>${pct(metrics.completion)}</strong></div><div><span>3个月均值</span><strong>${metrics.average3 === null ? '—' : metrics.average3.toFixed(1)}<small>${metrics.average3 === null ? '' : '盒'}</small></strong></div><div><span>距下一等级</span><strong>${metrics.toUpgrade === null ? '最高级' : metrics.toUpgrade}<small>${metrics.toUpgrade === null ? '' : '盒'}</small></strong></div></section>
          ${risks.length ? `<section class="cp-alerts"><strong>异常提示</strong><div>${risks.map(risk => `<span class="${risk.tone || 'warn'}">${esc(risk.label)}</span>`).join('')}</div></section>` : ''}
          <section class="cp-detail-section"><header><div><p>销量经营轨迹</p><h3>客户月度销量趋势</h3></div><div class="cp-segment"><button type="button" data-cp-trend="6" class="${state.trendRange === '6' ? 'active' : ''}">近6个月</button><button type="button" data-cp-trend="fiscal" class="${state.trendRange === 'fiscal' ? 'active' : ''}">当前财年</button></div></header>${renderTrendChart(profile, state.filters.month, state.trendRange)}<div class="cp-trend-notes"><span>${metrics.upStreak >= 2 ? `连续增长 ${metrics.upStreak}月` : metrics.downStreak >= 2 ? `连续下降 ${metrics.downStreak}月` : '近期存在拐点或波动'}</span><span>实际与目标分开计算</span></div></section>
          <section class="cp-detail-section"><header><div><p>销量等级，不含R等级</p><h3>ABCD等级历史</h3></div></header>${gradeTimeline(profile)}<div class="cp-grade-facts"><div><span>当前 / 上月</span><strong>${metrics.grade || '—'} / ${metrics.previousGrade || '—'}</strong></div><div><span>本季度最高 / 最低</span><strong>${metrics.quarterHigh || '—'} / ${metrics.quarterLow || '—'}</strong></div><div><span>连续当前等级</span><strong>${metrics.consecutiveGradeMonths || 0}个月</strong></div><div><span>距升级 / 降级安全空间</span><strong>${metrics.toUpgrade === null ? '—' : `${metrics.toUpgrade}盒`} / ${metrics.downgradeSafety === null ? '—' : `${metrics.downgradeSafety}盒`}</strong></div><div><span>最近升级</span><strong>${metrics.lastUpgrade || '—'}</strong></div><div><span>最近降级</span><strong>${metrics.lastDowngrade || '—'}</strong></div></div></section>
          <section class="cp-detail-section cp-diagnosis"><header><div><p>基于当前数据</p><h3>经营判断</h3></div></header><ol>${diagnosis(profile, state.filters.month, resolver).map(text => `<li>${esc(text)}</li>`).join('')}</ol></section>
          ${responsibilityHtml(profile)}
          <section class="cp-detail-section"><header><div><p>Provider只读消费</p><h3>本月客户计划</h3></div></header>${currentPlan ? `<div class="cp-plan-grid"><div><span>当前销量 / 等级</span><strong>${metrics.current ?? '—'}盒 · ${metrics.grade || '—'}</strong></div><div><span>目标销量 / 等级</span><strong>${currentPlan.targetSales ?? metrics.target ?? '—'}盒 · ${esc(currentPlan.targetGrade || '—')}</strong></div><div><span>目标月份</span><strong>${esc(currentPlan.targetMonth || '—')}</strong></div><div><span>执行状态</span><strong>${esc(currentPlan.executionStatus || '待补充')}</strong></div></div><dl><div><dt>存在问题</dt><dd>${esc(currentPlan.issues || '尚未记录问题')}</dd></div><div><dt>后续跟进方案</dt><dd>${esc(currentPlan.followUp || '尚未制定跟进方案')}</dd></div><div><dt>下次复盘</dt><dd>${esc(currentPlan.nextReviewDate || '待补充')}</dd></div></dl>` : '<div class="cp-empty cp-inline-empty"><strong>尚无客户计划</strong><p>添加计划后可跟踪目标与升级情况；本模块不会复制客户升级录入业务。</p></div>'}</section>
          <section class="cp-detail-section"><header><div><p>接口预留</p><h3>资源与学术投入</h3></div></header>${resources.length ? `<div class="cp-resource-list">${resources.map(resource => `<article><span>${esc(resource.executedAt || resource.appliedAt || '日期待补充')}</span><h4>${esc(resource.project || '未命名项目')}</h4><p>${esc(resource.purpose || '用途待补充')} · ${resource.amount ? `¥${resource.amount}` : '金额待补充'}</p><small>${esc(resource.result || '后续结果待验证')}</small></article>`).join('')}</div><p class="cp-causality">资源投入后观察到客户销量变化；此处不认定活动导致增长。</p>` : '<div class="cp-empty cp-inline-empty"><strong>暂无资源记录</strong><p>已预留 resourceInvestmentProvider，后续可接入项目、金额、员工、执行时间与结果。</p></div>'}</section>
          <section class="cp-detail-section"><header><div><p>统一时间线 · 按时间倒序</p><h3>客户动态</h3></div><div class="cp-timeline-actions"><button type="button" class="cp-text-action" data-cp-note>＋ 快速记录</button><button type="button" class="cp-text-action" data-cp-new-followup>＋ 正式跟进</button></div></header>${timelineHtml(profile)}</section>
          <details class="cp-detail-section cp-id-card"><summary>身份匹配详情</summary><header><div><p>诊断与来源匹配</p><h3>客户统一标识</h3></div></header><code>${esc(profile.customerId)}</code><p>医院 ${esc(profile.hospitalId)} · 科室 ${esc(profile.departmentId)} · 员工 ${esc(profile.employeeId)}</p><p>别名：${esc([...(profile.aliases || []), ...(profile.hospitalAliases || []), ...(profile.departmentAliases || [])].join('、') || '暂无')}</p><span>匹配输出：EXACT / PROBABLE / AMBIGUOUS / UNMATCHED + confidence</span></details>
        </div>
      </aside>`;
    }
    function renderResults() {
      const rows = filteredProfiles();
      const kpiRoot = root.querySelector('#cpKpis');
      const contentRoot = root.querySelector('#cpContent');
      const summary = root.querySelector('#cpFilterSummary');
      if (kpiRoot) kpiRoot.innerHTML = renderKpis(rows);
      if (summary) summary.textContent = `${state.filters.month} · ${rows.length}位${activeFilterCount() ? ` · ${activeFilterCount()}项筛选` : ''}`;
      if (contentRoot) contentRoot.innerHTML = state.mode === 'intelligence' ? operatingIntelligenceHtml() : state.mode === 'relationships' ? relationshipGraphHtml() : state.mode === 'monitor' ? renderMonitor(rows) : state.mode === 'hospitals' ? renderHospitals(rows) : renderOverview(rows);
      const detailRoot = root.querySelector('#cpDetailRoot');
      if (detailRoot) {
        const selected = profileForKey(state.selectedKey);
        detailRoot.innerHTML = state.panel ? renderActivePanel() : state.selectedKey && selected ? detailHtml(decorate(selected)) : '';
      }
    }
    function filtersDialogHtml(profiles) {
      const productProfiles = profiles.filter(profile => profile.product === state.product);
      const values = key => [...new Set(productProfiles.map(profile => profile[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
      const months = availableMonths();
      return `<dialog class="cp-sheet" id="cpFilterDialog"><form method="dialog" id="cpFilterForm"><header><div><p>高级筛选</p><h2>筛选客户组合</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><label>月份<select name="month">${months.map(month => `<option value="${month}" ${month === state.filters.month ? 'selected' : ''}>${month}</option>`).join('')}</select></label><label>办事处<select name="office">${optionList(values('office'), state.filters.office, '全部办事处')}</select></label><label>负责人<select name="employee">${optionList(values('employeeName'), state.filters.employee, '全部员工')}</select></label><label>医院<select name="hospital">${optionList(values('hospitalName'), state.filters.hospital, '全部医院')}</select></label><label>科室<select name="department">${optionList(values('departmentName'), state.filters.department, '全部科室')}</select></label><label>销量等级<select name="grade">${optionList(['A', 'B', 'C', 'D'], state.filters.grade, '全部等级')}</select></label><label>客户状态<select name="status"><option value="all">全部状态</option>${Object.entries(STATUS).map(([key, value]) => `<option value="${key}" ${key === state.filters.status ? 'selected' : ''}>${value.label}</option>`).join('')}</select></label><fieldset><legend>日常管理筛选</legend><label><input type="checkbox" name="resource" ${state.filters.resource ? 'checked' : ''}> 有资源投入</label><label><input type="checkbox" name="targetIncomplete" ${state.filters.targetIncomplete ? 'checked' : ''}> 目标未完成</label><label><input type="checkbox" name="noPlan" ${state.filters.noPlan ? 'checked' : ''}> 未制定计划</label></fieldset></div><footer><button type="button" class="cp-secondary" data-cp-clear>清除</button><button type="submit" class="cp-primary">应用筛选</button></footer></form></dialog>`;
    }
    function hospitalDirectory() {
      const items = typeof config.hospitalDirectoryProvider === 'function' ? config.hospitalDirectoryProvider() : [];
      return Array.isArray(items) ? items : [];
    }
    function hospitalMaintenanceDialogHtml() {
      const hospital = hospitalDirectory().find(item => String(item.hospitalId || '') === state.maintenanceHospitalId);
      if (!hospital) return '<dialog class="cp-sheet" id="cpHospitalMaintenanceDialog"></dialog>';
      const departments = Array.isArray(hospital.departments) ? hospital.departments.filter(item => item.active !== false && !item.deletedAt) : [];
      return `<dialog class="cp-sheet cp-hospital-maintenance-dialog" id="cpHospitalMaintenanceDialog"><form method="dialog" id="cpHospitalMaintenanceForm"><header><div><p>状态驱动 · 保存后自动复核</p><h2>维护医院 / 科室资料</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><input type="hidden" name="hospitalId" value="${esc(hospital.hospitalId)}"><label class="cp-full">Synthetic Hospital Example<input type="text" value="${esc(hospital.hospitalName)}" readonly></label><label>医院编码<input type="text" name="hospitalCode" value="${esc(hospital.hospitalCode)}" placeholder="填写真实备案编码"></label><label>医院等级<input type="text" name="hospitalLevel" value="${esc(hospital.hospitalLevel)}" placeholder="如：三级甲等"></label><label>办事处归属<input type="text" name="office" value="${esc(hospital.office)}" placeholder="填写所属办事处"></label><label>资料负责人<input type="text" name="owner" value="${esc(hospital.owner)}" placeholder="填写维护责任人"></label><section class="cp-full cp-department-maintenance"><header><div><span>科室资料</span><strong>${departments.length} 个科室</strong></div><small>科室名称和稳定标识来自现有主档案，本入口仅补齐负责人。</small></header>${departments.length ? departments.map(department => `<label><span>${esc(department.departmentName)}</span><input type="hidden" data-cp-department-id value="${esc(department.departmentId)}"><input type="text" data-cp-department-director value="${esc(department.director)}" placeholder="填写科室负责人"></label>`).join('') : '<p class="cp-row-error">当前医院没有带稳定标识的有效科室；请先在客户主档案补齐医院/科室。</p>'}</section><p class="cp-full cp-maintenance-note">地址尚未被现有业务流程实际消费，暂列为可选字段，不影响完整度和任务状态。</p></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">保存并自动复核</button></footer></form></dialog>`;
    }
    const quickCustomerLabel = record => [record.customerName, record.hospital, record.department].filter(Boolean).join(' · ');
    function quickCustomerMatch(query) {
      const matches = masterStore.list({
        includeInactive: false
      }).filter(record => quickCustomerLabel(record) === query || record.customerId === query || normalizedAlias(record.customerName) === normalizedAlias(query));
      return matches.length === 1 ? matches[0] : null;
    }
    function quickDialogHtml() {
      const masters = masterStore.list({
        includeInactive: false
      });
      return `<dialog class="cp-sheet cp-note-dialog" id="cpQuickDialog"><form method="dialog" id="cpQuickForm"><header><div><p>Local First · 可先保存为待匹配</p><h2>快速记录</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><datalist id="cpQuickMasterCandidates">${masters.map(record => `<option value="${esc(quickCustomerLabel(record))}"></option>`).join('')}</datalist><div class="cp-sheet-fields"><label>时间<input type="datetime-local" name="date" required></label><label>关联客户<input type="text" list="cpQuickMasterCandidates" name="customerId" placeholder="选择姓名、医院和科室"></label><label>关联产品<select name="product"><option value="">不关联产品</option>${PRODUCTS.map(product => `<option value="${product}">${product}</option>`).join('')}</select></label><label>待匹配客户名<input type="text" name="pendingCustomerName" placeholder="未选客户时可填写"></label><label>医院<input type="text" name="pendingHospital" placeholder="用于后续匹配"></label><label>科室<input type="text" name="pendingDepartment" placeholder="用于后续匹配"></label><label class="cp-full">记录内容<textarea name="detail" rows="4" maxlength="600" required placeholder="记录客户反馈、问题、机会或活动情况"></textarea></label><fieldset class="cp-full"><legend>标签</legend><div class="cp-tag-options">${NOTE_TAGS.map((tag, index) => `<label><input type="radio" name="tag" value="${tag}" ${index === 0 ? 'checked' : ''}><span>${tag}</span></label>`).join('')}</div></fieldset><p class="cp-full cp-note-association" id="cpNoteAssociation">未选择客户时，记录将进入匹配确认中心。</p></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">保存本地记录</button></footer></form></dialog>`;
    }
    function selectedProfile() {
      if (!state.selectedKey) return null;
      const selected = profileForKey(state.selectedKey);
      return selected?.masterActive === false ? null : selected;
    }
    function followUpDialogHtml() {
      const existing = state.selectedFollowUpId ? followUpStore.get(state.selectedFollowUpId) : null;
      const note = state.convertingNoteId ? noteById(state.convertingNoteId) : null;
      const linkedRecommendation = state.followUpRecommendationKey ? operatingSnapshot().recommendations.find(item => item.recommendationKey === state.followUpRecommendationKey) : null;
      const profile = selectedProfile() || allProfiles().find(item => item.customerId === existing?.customerId || item.customerId === note?.customerId || item.customerId === linkedRecommendation?.customerId) || null;
      const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const value = (field, fallback = '') => esc(existing?.[field] ?? fallback);
      const followUpAt = value('followUpAt', note?.date ? String(note.date).slice(0, 16) : now).slice(0, 16);
      const selectedType = existing?.followUpType || (note?.title === '拜访' ? 'VISIT' : 'OTHER');
      const selectedProduct = existing ? existing.product : note?.product ?? linkedRecommendation?.product ?? null;
      const sourceTaskId = existing?.sourceTaskId || state.followUpSourceTaskId || '';
      return `<dialog class="cp-sheet cp-followup-dialog" id="cpFollowUpDialog"><form method="dialog" id="cpFollowUpForm"><header><div><p>${sourceTaskId ? '关联当前任务' : note ? '快速记录将保留，并建立显式关联' : 'Local First · 结构化客户跟进'}</p><h2>${existing ? '编辑跟进记录' : sourceTaskId ? '记录跟进并完成任务' : note ? '转为正式跟进' : '新增跟进记录'}</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><input type="hidden" name="followUpId" value="${esc(existing?.followUpId || '')}"><input type="hidden" name="sourceNoteId" value="${esc(note?.id || existing?.sourceNoteId || '')}"><input type="hidden" name="sourceTaskId" value="${esc(sourceTaskId)}"><input type="hidden" name="customerId" value="${esc(existing?.customerId || note?.customerId || linkedRecommendation?.customerId || profile?.customerId || '')}"><label>跟进时间<input type="datetime-local" name="followUpAt" value="${followUpAt}" required></label><label>跟进类型<select name="followUpType">${Object.entries(FOLLOW_UP_TYPES).map(([key, label]) => `<option value="${key}" ${selectedType === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label>关联产品<select name="product"><option value="" ${!selectedProduct ? 'selected' : ''}>客户级（不关联产品）</option>${PRODUCTS.map(product => `<option value="${product}" ${selectedProduct === product ? 'selected' : ''}>${product}</option>`).join('')}</select></label><label>负责人<input type="text" name="owner" value="${value('owner', profile?.employeeName || '')}" required></label><label class="cp-full">跟进内容<textarea name="content" rows="4" maxlength="1200" required>${value('content', note?.detail || '')}</textarea></label><label class="cp-full">客户反馈<textarea name="customerFeedback" rows="2">${value('customerFeedback')}</textarea></label><label class="cp-full">当前阻碍<textarea name="currentObstacle" rows="2">${value('currentObstacle')}</textarea></label><label class="cp-full">下一步动作<textarea name="nextAction" rows="2">${value('nextAction')}</textarea></label><label>下次跟进日期<input type="date" name="nextFollowUpDate" value="${value('nextFollowUpDate')}"></label><p class="cp-full cp-note-association">${sourceTaskId ? '保存后仅完成本次关联任务，不影响其他任务。' : '产品为空时是客户级记录；选择产品后只会进入对应产品的时间线。'}</p></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">${existing ? '保存修改' : sourceTaskId ? '保存跟进并完成此任务' : '保存正式跟进'}</button></footer></form></dialog>`;
    }
    function statusDialogHtml() {
      const profile = allProfiles().find(item => item.customerId === state.statusCustomerId) || selectedProfile();
      const current = profile ? developmentFor(profile.customerId).status : 'UNDEVELOPED';
      return `<dialog class="cp-sheet cp-status-dialog" id="cpStatusDialog"><form method="dialog" id="cpStatusForm"><header><div><p>人工状态与销量经营状态严格分离</p><h2>调整客户开发状态</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><input type="hidden" name="customerId" value="${esc(profile?.customerId || '')}"><label>开发状态<select name="developmentStatus">${Object.entries(DEVELOPMENT_STATUS).map(([key, meta]) => `<option value="${key}" ${current === key ? 'selected' : ''}>${esc(meta.label)}</option>`).join('')}</select></label><label>操作人<input type="text" name="operator" value="${esc(profile?.employeeName || '')}" required></label><label class="cp-full">调整原因<textarea name="reason" rows="3" required placeholder="记录状态变化的业务依据"></textarea></label><p class="cp-full cp-note-association">保存后会写入开发状态历史，但不会修改 ${esc(profile?.product || '产品')} 的销量经营状态。</p></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">保存状态</button></footer></form></dialog>`;
    }
    function insightGenerateDialogHtml() {
      const profile = allProfiles().find(item => item.customerId === state.insightCustomerId) || selectedProfile();
      const records = profile ? [...followUpsForProfile(profile), ...allLocalNotesForCustomer(profile.customerId)] : [];
      return `<dialog class="cp-sheet cp-insight-dialog" id="cpInsightGenerateDialog"><form method="dialog" id="cpInsightGenerateForm"><header><div><p>Customer Communication Insights</p><h2>生成沟通洞察</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-insight-consent"><strong>本版 Provider：本地规则建议（非线上 AI）</strong><p>将仅分析该客户已保存的 ${records.length} 条跟进/快速记录。输出必须附带依据，不允许推断人格、心理、医疗诊断或其他敏感属性。</p>${state.insightError ? `<p class="cp-row-error">${esc(state.insightError)}</p>` : ''}<input type="hidden" name="customerId" value="${esc(profile?.customerId || '')}"></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">确认生成建议</button></footer></form></dialog>`;
    }
    function insightEditDialogHtml() {
      const profile = allProfiles().find(item => item.customerId === state.insightEditCustomerId) || selectedProfile();
      const insight = profile ? insightStore.get(profile.customerId) : null;
      return `<dialog class="cp-sheet cp-insight-dialog" id="cpInsightEditDialog"><form method="dialog" id="cpInsightEditForm"><header><div><p>人工编辑会标记为 HUMAN_CONFIRMED</p><h2>确认客户沟通洞察</h2></div><button type="button" data-cp-dialog-close aria-label="关闭">×</button></header><div class="cp-sheet-fields"><input type="hidden" name="customerId" value="${esc(profile?.customerId || '')}">${INSIGHT_FIELDS.map(field => `<label class="cp-full">${esc(INSIGHT_FIELD_LABELS[field])}<textarea name="${field}" rows="2">${esc(insight?.[field] || '')}</textarea></label>`).join('')}<div class="cp-full cp-insight-edit-evidence"><strong>保留依据</strong>${insight?.evidence?.map(item => `<p>${esc(item.quote)}</p>`).join('') || '<p>尚无依据，不能保存有内容的洞察。</p>'}</div></div><footer><button type="button" class="cp-secondary" data-cp-dialog-close>取消</button><button type="submit" class="cp-primary">保存人工确认</button></footer></form></dialog>`;
    }
    function render() {
      const profiles = allProfiles();
      const months = availableMonths();
      if (!state.salesMonthExplicit) state.filters.month = months.find(month => month < new Date().toISOString().slice(0, 7)) || shiftMonth(new Date().toISOString().slice(0, 7), -1);
      const graphMode = state.mode === 'relationships';
      const intelligenceMode = state.mode === 'intelligence';
      root.innerHTML = `<section class="cp-shell">
        <header class="cp-page-header"><div><div class="cp-eyebrow"><span>客户经营驾驶舱 V1.4</span>${state.useDemo ? '<b>匿名演示 · 500位</b>' : '<b>现有数据 · Local First</b>'}</div><h1>持续追踪客户开发、经营与关系网络</h1><p>客户身份、关系、开发状态、跟进与经营建议均在 Customer Profile 内隔离；销量经营仍按Primary Product A / Primary Product B严格区分。</p></div><div class="cp-header-actions"><div class="cp-v11-actions"><button type="button" class="cp-upgrade-entry" data-cp-master>客户主档案</button><button type="button" class="cp-upgrade-entry" data-cp-import>导入客户</button><button type="button" class="cp-upgrade-entry" data-cp-open-matches>匹配确认${matchQueue.length ? `<b>${matchQueue.length}</b>` : ''}</button><button type="button" class="cp-upgrade-entry" data-cp-global-note>快速记录</button></div>${typeof config.onOpenCustomerUpgradeManager === 'function' ? '<button type="button" class="cp-upgrade-entry" data-cp-upgrade-entry>客户升级管理</button>' : ''}<div class="cp-product-switch" aria-label="产品切换">${PRODUCTS.map(product => `<button type="button" data-cp-product="${product}" class="${state.product === product ? 'active' : ''}">${product}</button>`).join('')}</div></div></header>
        <nav class="cp-view-tabs" aria-label="客户档案页面"><button type="button" data-cp-mode="overview" class="${state.mode === 'overview' ? 'active' : ''}">客户总览</button><button type="button" data-cp-mode="monitor" class="${state.mode === 'monitor' ? 'active' : ''}">变动监控</button><button type="button" data-cp-mode="hospitals" class="${state.mode === 'hospitals' ? 'active' : ''}">医院/科室</button><button type="button" data-cp-mode="relationships" class="${graphMode ? 'active' : ''}">关系图谱</button><button type="button" data-cp-mode="intelligence" class="${intelligenceMode ? 'active' : ''}">经营智能</button></nav>
        ${graphMode || intelligenceMode ? '' : `<div class="cp-toolbar"><label class="cp-search"><span>⌕</span><input type="search" id="cpSearch" value="${esc(state.search)}" placeholder="搜索客户、医院、科室、负责人" autocomplete="off"></label><button type="button" class="cp-filter-button" data-cp-filters>筛选${activeFilterCount() ? `<b>${activeFilterCount()}</b>` : ''}</button><span id="cpFilterSummary"></span></div><div id="cpKpis"></div>`}<main id="cpContent"></main><div id="cpDetailRoot"></div>
        ${filtersDialogHtml(profiles)}${quickDialogHtml()}${masterFormDialogHtml()}${hospitalMaintenanceDialogHtml()}${followUpDialogHtml()}${statusDialogHtml()}${insightGenerateDialogHtml()}${insightEditDialogHtml()}${relationshipFilterDialogHtml()}${relationshipDialogHtml()}${professionalDialogHtml()}${intelligenceFilterDialogHtml()}${recommendationDetailDialogHtml()}${taskDraftDialogHtml()}
      </section>`;
      renderResults();
      syncRelationshipViewingPlane(graphMode);
    }
    function openDetail(key, push = true) {
      state.panel = null;
      state.selectedKey = key;
      renderResults();
      if (push && typeof history !== 'undefined') history.pushState({
        customerProfileV1: key
      }, '', `#customer-profile-v1/detail/${encodeURIComponent(key)}`);
    }
    function openRecommendationDetail(recommendationKey, push = true) {
      state.selectedRecommendationKey = recommendationKey;
      state.intelligenceError = '';
      render();
      root.querySelector('#cpRecommendationDialog')?.showModal();
      if (push && typeof history !== 'undefined') history.pushState({
        customerProfileV14Recommendation: recommendationKey
      }, '', `#customer-profile-v1/intelligence/${encodeURIComponent(recommendationKey)}`);
    }
    function closeRecommendationDetail(fromHistory = false) {
      if (!state.selectedRecommendationKey) return;
      state.selectedRecommendationKey = '';
      state.intelligenceError = '';
      render();
      if (!fromHistory && typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/intelligence/')) history.back();
    }
    function openTaskDraft(recommendationKey) {
      const recommendation = operatingSnapshot().recommendations.find(item => item.recommendationKey === recommendationKey);
      if (!recommendation) return;
      try {
        const customer = masterStore.get(recommendation.customerId) || {};
        const draft = buildTaskDraft(recommendation, {
          customer
        });
        const duplicate = taskBridge?.isDuplicateTask?.(draft);
        const duplicateTask = duplicate && typeof duplicate === 'object' ? duplicate : duplicate ? taskBridge?.findLinkedTask?.(recommendationKey) : null;
        state.taskDraft = {
          ...draft,
          duplicateTaskId: String(duplicateTask?.taskId || duplicateTask?.id || '')
        };
        state.taskDraftError = '';
        render();
        root.querySelector('#cpTaskDraftDialog')?.showModal();
        if (typeof history !== 'undefined') history.pushState({
          customerProfileV15TaskDraft: recommendationKey
        }, '', `#customer-profile-v1/task-draft/${encodeURIComponent(recommendationKey)}`);
      } catch (error) {
        state.intelligenceError = error.message;
        render();
      }
    }
    function closeTaskDraft(fromHistory = false) {
      if (!state.taskDraft) return;
      state.taskDraft = null;
      state.taskDraftError = '';
      render();
      if (!fromHistory && typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/task-draft/')) history.back();
    }
    function closeDetail(fromHistory = false) {
      if (!state.selectedKey) return;
      state.selectedKey = null;
      renderResults();
      if (!fromHistory && typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/detail/')) history.back();
    }
    function openCustomerById(customerId, options = {}) {
      const matches = allProfiles().filter(profile => profile.customerId === String(customerId || ''));
      const profile = matches.find(item => item.product === options.product) || matches.find(item => item.product === state.product) || matches[0];
      if (!profile) return false;
      state.panel = null;
      state.product = profile.product || state.product;
      state.selectedKey = profileKey(profile);
      state.selectedFollowUpId = null;
      state.convertingNoteId = null;
      state.followUpSourceTaskId = options.openFollowUp ? String(options.taskId || '') : '';
      state.followUpRecommendationKey = String(options.recommendationKey || '');
      render();
      if (options.push !== false && typeof history !== 'undefined') history.pushState({
        customerProfileV1: state.selectedKey
      }, '', `#customer-profile-v1/detail/${encodeURIComponent(state.selectedKey)}`);
      if (options.openFollowUp) queueMicrotask(() => root.querySelector('#cpFollowUpDialog')?.showModal());
      return true;
    }
    function openHospitalById(hospitalIdOrName) {
      const target = String(hospitalIdOrName || '').trim();
      const hospital = globalThis.WorkspaceNavigation.exactHospital(target, hospitalDirectory());
      if (!hospital) { state.maintenanceHospitalId=''; root.querySelector('#cpHospitalMaintenanceDialog')?.close(); return false; }
      state.panel = null;
      state.selectedKey = null;
      state.mode = 'hospitals';
      state.search = '';
      state.maintenanceHospitalId = String(hospital.hospitalId || '');
      render();
      queueMicrotask(() => root.querySelector('#cpHospitalMaintenanceDialog')?.showModal());
      return true;
    }
    function openPanel(panel, push = true) {
      const replacingPanel = Boolean(state.panel);
      state.panel = panel;
      state.selectedKey = null;
      render();
      if (push && typeof history !== 'undefined') history[replacingPanel ? 'replaceState' : 'pushState']({
        customerProfileV11Panel: panel
      }, '', `#customer-profile-v1/${panel}`);
    }
    function closePanel(fromHistory = false) {
      if (!state.panel) return;
      state.panel = null;
      renderResults();
      if (!fromHistory && typeof history !== 'undefined' && /^#customer-profile-v1\/(master|import|matches)$/.test(String(location.hash))) history.back();
    }
    root.addEventListener('input', event => {
      if (event.target.id === 'cpSearch') {
        state.search = event.target.value;
        state.visibleCount = 40;
        renderResults();
      }
      if (event.target.matches('[data-cp-relationship-target-search]')) {
        const query = normalizedAlias(event.target.value);
        const select = event.target.form?.querySelector('[name="targetCustomerId"]');
        [...(select?.options || [])].forEach(option => {
          if (!option.value) return;
          option.hidden = Boolean(query && !normalizedAlias(`${option.value} ${option.textContent}`).includes(query));
        });
      }
    });
    root.addEventListener('change', async event => {
      if (event.target.matches('#cpRelationshipForm [name="sourceCustomerId"]')) {
        const target = event.target.form?.querySelector('[name="targetCustomerId"]');
        if (target?.value === event.target.value) target.value = '';
        [...(target?.options || [])].forEach(option => {
          option.disabled = Boolean(option.value && option.value === event.target.value);
        });
        return;
      }
      if (event.target.matches('[data-cp-customer-image]')) {
        const file = event.target.files?.[0];
        if (!file || !state.professionalCustomerId) return;
        try {
          const blob = await prepareCustomerImage(file);
          await customerImageStore.put(state.professionalCustomerId, blob);
          const previousUrl = imageUrls.get(state.professionalCustomerId);
          if (previousUrl && typeof URL !== 'undefined') URL.revokeObjectURL(previousUrl);
          imageUrls.set(state.professionalCustomerId, typeof URL !== 'undefined' ? URL.createObjectURL(blob) : null);
          state.imageError = '';
        } catch (error) {
          state.imageError = error.message;
        }
        render();
        root.querySelector('#cpProfessionalDialog')?.showModal();
        return;
      }
      if (event.target.id === 'cpMasterSearch') {
        state.masterSearch = event.target.value;
        renderResults();
        return;
      }
      if (event.target.id === 'cpMasterActive') {
        state.masterActiveFilter = event.target.value;
        renderResults();
        return;
      }
      if (event.target.matches('[data-cp-import-action]')) {
        const item = state.importAnalysis?.items.find(row => row.queueId === event.target.dataset.cpImportAction);
        if (!item) return;
        const [action, customerId = ''] = event.target.value.split(':');
        item.action = action;
        item.selectedCustomerId = customerId;
        return;
      }
      if (event.target.matches('#cpQuickForm [name="customerId"]')) {
        const record = quickCustomerMatch(event.target.value);
        const association = root.querySelector('#cpNoteAssociation');
        if (association) association.textContent = record ? `${record.hospital} · ${record.department} · ${record.customerName} · ${record.employee || '负责人未填写'}` : '未选择客户时，记录将进入匹配确认中心。';
        return;
      }
      if (!event.target.matches('[data-cp-import-file]')) return;
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = parseCustomerWorkbook(await file.arrayBuffer(), typeof XLSX !== 'undefined' ? XLSX : null);
        state.importFileName = file.name;
        state.importAnalysis = analyzeCustomerImport(parsed.rows, masterStore.list(), matchDecisions);
        state.importAnalysis.items.forEach(item => {
          if (item.validationErrors.length) item.action = 'skip';else if (item.matchType === 'EXACT') {
            item.action = 'link';
            item.selectedCustomerId = item.customerId;
          } else if (item.matchType === 'UNMATCHED') item.action = 'create';else item.action = 'defer';
        });
        state.importReport = null;
        render();
      } catch (error) {
        state.importAnalysis = null;
        state.importReport = {
          total: 0,
          created: 0,
          updated: 0,
          exact: 0,
          probable: 0,
          ambiguous: 0,
          unmatched: 0,
          skipped: 0,
          errors: 1,
          pending: 0,
          rowResults: [{
            rowNumber: '—',
            status: 'ERROR',
            reason: error.message
          }]
        };
        render();
      }
    });
    root.addEventListener('submit', async event => {
      if (event.target.id === 'cpTaskDraftForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const draft = state.taskDraft;
        if (!draft) return;
        const confirmedDraft = {
          ...draft,
          title: String(data.get('title') || '').trim(),
          owner: String(data.get('owner') || '').trim(),
          dueDate: String(data.get('dueDate') || '').slice(0, 10),
          description: String(data.get('description') || '').trim(),
          confirmed: true
        };
        try {
          if (!confirmedDraft.title || !confirmedDraft.dueDate || !confirmedDraft.description) throw new Error('请完整填写任务标题、截止日期和任务说明');
          const duplicate = taskBridge?.isDuplicateTask?.(confirmedDraft);
          let task = duplicate && typeof duplicate === 'object' ? duplicate : duplicate ? taskBridge?.findLinkedTask?.(confirmedDraft.recommendationKey) : null;
          if (!task) {
            if (!taskBridge?.createTaskFromRecommendation) throw new Error('当前任务桥接不可用，未写入任何任务');
            task = taskBridge.createTaskFromRecommendation(confirmedDraft);
          }
          const taskId = String(task?.taskId || task?.id || '');
          if (!taskId || String(task.customerId || '') !== confirmedDraft.customerId) throw new Error('Task Bridge 返回了无效 customerId 或 taskId');
          if (operatingProduct(task.product) !== confirmedDraft.product) throw new Error('Task Bridge 返回的产品上下文不一致');
          taskLinkStore.create({
            recommendationKey: confirmedDraft.recommendationKey,
            recommendationId: confirmedDraft.recommendationId,
            taskId,
            customerId: confirmedDraft.customerId,
            product: confirmedDraft.product,
            state: taskBridge.getTaskStatus?.(taskId) === 'completed' ? 'COMPLETED' : 'ACTIVE',
            completedAt: task.completedAt
          });
          recommendationActionStore.setStatus(confirmedDraft.recommendationKey, 'CONFIRMED', {
            note: '已人工确认并转为任务'
          });
          state.taskDraft = null;
          state.taskDraftError = '';
          render();
          if (typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/task-draft/')) history.back();
        } catch (error) {
          state.taskDraft = confirmedDraft;
          state.taskDraftError = error.message;
          render();
          root.querySelector('#cpTaskDraftDialog')?.showModal();
        }
        return;
      }
      if (event.target.id === 'cpOperatingFilterForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        state.intelligenceFilters = {
          customerId: state.intelligenceFilters.customerId || 'all',
          product: String(data.get('product') || 'all'),
          hospital: String(data.get('hospital') || 'all'),
          department: String(data.get('department') || 'all'),
          priorities: data.getAll('priorities').map(String),
          signalType: String(data.get('signalType') || 'all'),
          grades: data.getAll('grades').map(String),
          perceptionLevels: data.getAll('perceptionLevels').map(String),
          developmentStatus: String(data.get('developmentStatus') || 'all'),
          currentStatus: String(data.get('currentStatus') || 'all'),
          overdue: String(data.get('overdue') || 'all'),
          hasRelationship: String(data.get('hasRelationship') || 'all'),
          keyInfluencer: String(data.get('keyInfluencer') || 'all'),
          recommendationStatus: String(data.get('recommendationStatus') || 'all')
        };
        root.querySelector('#cpOperatingFilterDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpRecommendationActionForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const recommendationKey = String(data.get('recommendationKey') || '');
        try {
          recommendationActionStore.setStatus(recommendationKey, String(data.get('status') || 'NEW'), {
            note: data.get('note'),
            snoozeUntil: data.get('snoozeUntil')
          });
          state.intelligenceError = '';
          state.selectedRecommendationKey = '';
          root.querySelector('#cpRecommendationDialog')?.close();
          render();
        } catch (error) {
          state.intelligenceError = error.message;
          render();
          root.querySelector('#cpRecommendationDialog')?.showModal();
        }
        return;
      }
      if (event.target.id === 'cpRelationshipFilterForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        state.relationshipFilters = {
          hospital: String(data.get('hospital') || 'all'),
          department: String(data.get('department') || 'all'),
          grades: data.getAll('grades').map(String),
          perceptionLevels: data.getAll('perceptionLevels').map(String),
          developmentStatus: String(data.get('developmentStatus') || 'all'),
          currentStatus: String(data.get('currentStatus') || 'all'),
          relationshipScope: String(data.get('relationshipScope') || 'all'),
          hasRelationship: String(data.get('hasRelationship') || 'all'),
          importantOnly: data.has('importantOnly'),
          primaryOnly: data.has('primaryOnly')
        };
        if (state.relationshipFilters.hospital === 'all') state.relationshipFilters.department = data.get('department') || 'all';
        persistRelationshipView();
        root.querySelector('#cpRelationshipFilterDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpRelationshipForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const relationshipId = String(data.get('relationshipId') || '');
        const payload = {
          sourceCustomerId: data.get('sourceCustomerId'),
          targetCustomerId: data.get('targetCustomerId'),
          relationshipScope: data.get('relationshipScope'),
          relationshipType: data.get('relationshipType'),
          strength: data.get('strength'),
          directed: data.has('directed'),
          description: data.get('description')
        };
        try {
          const saved = relationshipId ? relationshipStore.update(relationshipId, payload) : relationshipStore.create(payload);
          state.selectedGraphCustomerId = saved.sourceCustomerId;
          state.selectedRelationshipId = null;
          state.relationshipEditorSourceId = '';
          state.relationshipError = '';
          persistRelationshipView();
        } catch (error) {
          state.relationshipError = error.message;
          render();
          root.querySelector('#cpRelationshipDialog')?.showModal();
          return;
        }
        root.querySelector('#cpRelationshipDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpProfessionalForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const customerId = String(data.get('customerId') || '');
        try {
          const previous = professionalStore.get(customerId);
          const profileType = data.get('profileType');
          const title = normalizeProfessionalTitle({
            title: data.get('title'),
            organization: data.get('organization'),
            level: data.get('level'),
            source: data.get('source'),
            verifiedAt: data.get('verifiedAt'),
            notes: data.get('notes')
          });
          if (!title.title) throw new Error('请填写职务或学术任职');
          professionalStore.upsert({
            ...previous,
            customerId,
            [profileType]: [...(previous[profileType] || []), title],
            source: 'MANUAL'
          });
          state.professionalError = '';
        } catch (error) {
          state.professionalError = error.message;
        }
        render();
        root.querySelector('#cpProfessionalDialog')?.showModal();
        return;
      }
      if (event.target.id === 'cpFilterForm') {
        observationMonthExplicit = true;
        state.salesMonthExplicit = true;
        event.preventDefault();
        const data = new FormData(event.target);
        state.filters = {
          month: data.get('month') || state.filters.month,
          office: data.get('office') || 'all',
          employee: data.get('employee') || 'all',
          hospital: data.get('hospital') || 'all',
          department: data.get('department') || 'all',
          grade: data.get('grade') || 'all',
          status: data.get('status') || 'all',
          resource: data.has('resource'),
          targetIncomplete: data.has('targetIncomplete'),
          noPlan: data.has('noPlan')
        };
        state.visibleCount = 40;
        root.querySelector('#cpFilterDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpHospitalMaintenanceForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const payload = {
          hospitalId: data.get('hospitalId'),
          hospitalCode: data.get('hospitalCode'),
          hospitalLevel: data.get('hospitalLevel'),
          office: data.get('office'),
          owner: data.get('owner'),
          departments: [...event.target.querySelectorAll('[data-cp-department-id]')].map(idInput => ({
            departmentId: idInput.value,
            director: idInput.parentElement?.querySelector('[data-cp-department-director]')?.value || ''
          }))
        };
        try {
          await config.onHospitalDirectorySaved?.(payload);
        } catch (error) {
          event.target.querySelector('[data-cp-form-error]')?.remove();
          const message = document.createElement('p');
          message.dataset.cpFormError = '';
          message.className = 'cp-row-error';
          message.textContent = error.message;
          event.target.querySelector('.cp-sheet-fields')?.prepend(message);
          return;
        }
        state.maintenanceHospitalId = '';
        root.querySelector('#cpHospitalMaintenanceDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpMasterForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const customerId = String(data.get('customerId') || '');
        const nextStatus = normalizeDevelopmentStatus(data.get('developmentStatus'));
        const payload = {
          customerName: data.get('customerName'),
          aliases: data.get('aliases'),
          hospital: data.get('hospital'),
          hospitalAliases: data.get('hospitalAliases'),
          department: data.get('department'),
          departmentAliases: data.get('departmentAliases'),
          employee: data.get('employee'),
          associatedProducts: data.getAll('associatedProducts'),
          perceptionLevel: data.get('perceptionLevel'),
          developmentStatus: nextStatus,
          currentObstacle: data.get('currentObstacle'),
          nextAction: data.get('nextAction'),
          nextFollowUpDate: data.get('nextFollowUpDate'),
          notes: data.get('notes')
        };
        try {
          const previous = customerId ? masterStore.get(customerId) : null;
          const previousStatus = customerId ? developmentFor(customerId).status : '';
          const reason = String(data.get('developmentReason') || '').trim();
          if (customerId && previousStatus !== nextStatus && !reason) throw new Error('调整开发状态时必须填写原因');
          const updated = customerId ? masterStore.update(customerId, payload) : masterStore.create(payload);
          developmentStore.recordMasterChange(updated.customerId, previous || {}, updated, {
            operator: updated.employee,
            source: 'LOCAL_MASTER'
          });
          developmentStore.setStatus(updated.customerId, nextStatus, {
            operator: updated.employee,
            source: customerId ? 'LOCAL_MASTER' : 'LOCAL_MASTER_CREATE',
            reason: reason || '创建客户主档案时设置'
          });
        } catch (error) {
          event.target.querySelector('[data-cp-form-error]')?.remove();
          const message = document.createElement('p');
          message.dataset.cpFormError = '';
          message.className = 'cp-row-error';
          message.textContent = error.message;
          event.target.querySelector('.cp-sheet-fields')?.prepend(message);
          return;
        }
        state.selectedMasterId = null;
        refreshHydration();
        root.querySelector('#cpMasterDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpFollowUpForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const followUpId = String(data.get('followUpId') || '');
        const sourceNoteId = String(data.get('sourceNoteId') || '');
        const payload = {
          customerId: data.get('customerId'),
          product: String(data.get('product') || '') || null,
          followUpType: data.get('followUpType'),
          followUpAt: String(data.get('followUpAt') || ''),
          owner: data.get('owner'),
          employeeId: data.get('owner'),
          content: data.get('content'),
          customerFeedback: data.get('customerFeedback'),
          currentObstacle: data.get('currentObstacle'),
          nextAction: data.get('nextAction'),
          nextFollowUpDate: data.get('nextFollowUpDate'),
          sourceTaskId: data.get('sourceTaskId')
        };
        try {
          const saved = followUpId ? followUpStore.update(followUpId, payload) : sourceNoteId ? convertQuickNoteToFollowUp(noteById(sourceNoteId), payload, followUpStore) : followUpStore.create(payload);
          updateMasterFromFollowUp(saved);
          if (sourceNoteId) markQuickNoteConverted(sourceNoteId, saved.followUpId);
          if (saved.sourceTaskId && taskBridge?.completeTaskFromFollowUp) taskBridge.completeTaskFromFollowUp(saved);
        } catch (error) {
          event.target.querySelector('[data-cp-form-error]')?.remove();
          const message = document.createElement('p');
          message.dataset.cpFormError = '';
          message.className = 'cp-row-error';
          message.textContent = error.message;
          event.target.querySelector('.cp-sheet-fields')?.prepend(message);
          return;
        }
        state.selectedFollowUpId = null;
        state.convertingNoteId = null;
        state.followUpSourceTaskId = '';
        state.followUpRecommendationKey = '';
        state.lastDeletedFollowUpId = null;
        root.querySelector('#cpFollowUpDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpStatusForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const customerId = String(data.get('customerId') || '');
        try {
          const result = developmentStore.setStatus(customerId, data.get('developmentStatus'), {
            operator: data.get('operator'),
            reason: data.get('reason'),
            source: 'MANUAL_STATUS'
          });
          if (result.event) {
            const master = masterStore.get(customerId);
            if (master) masterStore.update(customerId, {
              developmentStatus: result.record.status
            }, {
              source: 'MANUAL_STATUS'
            });
          }
        } catch (error) {
          event.target.querySelector('[data-cp-form-error]')?.remove();
          const message = document.createElement('p');
          message.dataset.cpFormError = '';
          message.className = 'cp-row-error';
          message.textContent = error.message;
          event.target.querySelector('.cp-sheet-fields')?.prepend(message);
          return;
        }
        state.statusCustomerId = null;
        refreshHydration();
        root.querySelector('#cpStatusDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpInsightGenerateForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const customerId = String(data.get('customerId') || '');
        const profile = allProfiles().find(item => item.customerId === customerId);
        const records = profile ? [...followUpsForProfile(profile), ...allLocalNotesForCustomer(customerId)].sort((a, b) => String(b.followUpAt || b.date || '').localeCompare(String(a.followUpAt || a.date || ''))) : [];
        try {
          const result = await insightProvider.generateInsights(customerId, records, profile ? currentFollowUpFields(profile) : {});
          insightStore.upsert({
            ...result,
            customerId
          }, {
            reviewStatus: 'AI_SUGGESTED'
          });
          state.insightError = '';
          state.insightCustomerId = null;
          state.expandedInsightCustomerId = customerId;
          root.querySelector('#cpInsightGenerateDialog')?.close();
          render();
        } catch (error) {
          state.insightError = error.message;
          render();
          root.querySelector('#cpInsightGenerateDialog')?.showModal();
        }
        return;
      }
      if (event.target.id === 'cpInsightEditForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const customerId = String(data.get('customerId') || '');
        const previous = insightStore.get(customerId);
        try {
          insightStore.upsert({
            ...previous,
            customerId,
            ...Object.fromEntries(INSIGHT_FIELDS.map(field => [field, data.get(field)])),
            source: 'HUMAN_EDIT',
            reviewStatus: 'HUMAN_CONFIRMED'
          }, {
            reviewStatus: 'HUMAN_CONFIRMED'
          });
        } catch (error) {
          event.target.querySelector('[data-cp-form-error]')?.remove();
          const message = document.createElement('p');
          message.dataset.cpFormError = '';
          message.className = 'cp-row-error';
          message.textContent = error.message;
          event.target.querySelector('.cp-sheet-fields')?.prepend(message);
          return;
        }
        state.insightEditCustomerId = null;
        state.expandedInsightCustomerId = customerId;
        root.querySelector('#cpInsightEditDialog')?.close();
        render();
        return;
      }
      if (event.target.id === 'cpQuickForm') {
        event.preventDefault();
        const data = new FormData(event.target);
        const date = new Date(data.get('date'));
        const customerQuery = String(data.get('customerId') || '').trim();
        const product = String(data.get('product') || '');
        const queryMatches = masterStore.list({
          includeInactive: false
        }).filter(record => record.customerId === customerQuery || [record.customerName, ...record.aliases, record.hospital, ...record.hospitalAliases].some(value => normalizedAlias(value) === normalizedAlias(customerQuery)));
        const selectedMaster = quickCustomerMatch(customerQuery) || (queryMatches.length === 1 ? queryMatches[0] : null);
        const customerId = selectedMaster?.customerId || '';
        const pendingRecord = {
          customerName: String(data.get('pendingCustomerName') || (!customerId ? customerQuery : '')).trim(),
          hospital: String(data.get('pendingHospital') || '').trim(),
          department: String(data.get('pendingDepartment') || '').trim()
        };
        const noteId = stableId([customerId || matchSignature(pendingRecord), Number.isNaN(date.getTime()) ? Date.now() : date.toISOString(), data.get('detail')]);
        const eventItem = {
          id: noteId,
          customerId: customerId || null,
          product: product || null,
          date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
          type: 'NOTE',
          source: 'LOCAL_QUICK_NOTE',
          title: data.get('tag') || '快速记录',
          detail: String(data.get('detail') || '').trim(),
          pendingRecord
        };
        const key = customerId ? `${customerId}::${product || '__all__'}` : '__pending__';
        state.localNotes[key] = [eventItem, ...(state.localNotes[key] || [])];
        storage?.setItem(STORAGE_KEY, JSON.stringify(state.localNotes));
        if (!customerId) {
          const match = matchMasterRecord({
            hospital: pendingRecord.hospital,
            department: pendingRecord.department,
            name: pendingRecord.customerName
          }, masterStore.list(), matchDecisions);
          enqueue([{
            queueId: `note_${noteId}`,
            source: 'LOCAL_QUICK_NOTE',
            eventId: noteId,
            record: pendingRecord,
            signature: matchSignature(pendingRecord),
            ...match
          }]);
        }
        root.querySelector('#cpQuickDialog')?.close();
        render();
      }
    });
    root.addEventListener('click', async event => {
      const sales = event.target.closest('[data-cp-sales]');
      if (sales) {
        const profile = profileForKey(sales.dataset.cpSales);
        if (profile) config.onViewSales?.(profile);
        return;
      }
      const createTask = event.target.closest('[data-cp-create-task]');
      if (createTask) {
        openTaskDraft(createTask.dataset.cpCreateTask);
        return;
      }
      if (event.target.closest('[data-cp-task-draft-cancel]')) {
        closeTaskDraft();
        return;
      }
      const openLinkedTask = event.target.closest('[data-cp-open-linked-task]');
      if (openLinkedTask) {
        taskBridge?.openTask?.(openLinkedTask.dataset.cpOpenLinkedTask);
        return;
      }
      const taskFollowUp = event.target.closest('[data-cp-task-followup]');
      if (taskFollowUp) {
        const recommendation = operatingSnapshot().recommendations.find(item => item.recommendationKey === taskFollowUp.dataset.cpTaskFollowup);
        if (!recommendation?.taskLink?.taskId) return;
        state.selectedFollowUpId = null;
        state.convertingNoteId = null;
        state.followUpSourceTaskId = recommendation.taskLink.taskId;
        state.followUpRecommendationKey = recommendation.recommendationKey;
        render();
        root.querySelector('#cpFollowUpDialog')?.showModal();
        return;
      }
      const recommendationDetail = event.target.closest('[data-cp-recommendation-detail]');
      if (recommendationDetail) {
        openRecommendationDetail(recommendationDetail.dataset.cpRecommendationDetail);
        return;
      }
      if (event.target.closest('[data-cp-recommendation-close]')) {
        closeRecommendationDetail();
        return;
      }
      if (event.target.closest('[data-cp-intelligence-filters]')) {
        root.querySelector('#cpOperatingFilterDialog')?.showModal();
        return;
      }
      if (event.target.closest('[data-cp-clear-intelligence-filters]')) {
        state.intelligenceFilters = {
          customerId: 'all',
          product: 'all',
          hospital: 'all',
          department: 'all',
          priorities: [],
          signalType: 'all',
          grades: [],
          perceptionLevels: [],
          developmentStatus: 'all',
          currentStatus: 'all',
          overdue: 'all',
          hasRelationship: 'all',
          keyInfluencer: 'all',
          recommendationStatus: 'all'
        };
        root.querySelector('#cpOperatingFilterDialog')?.close();
        render();
        return;
      }
      const intelligenceKpi = event.target.closest('[data-cp-intelligence-kpi]');
      if (intelligenceKpi) {
        const [kind, value] = intelligenceKpi.dataset.cpIntelligenceKpi.split(':');
        state.intelligenceFilters = {
          customerId: 'all',
          product: 'all',
          hospital: 'all',
          department: 'all',
          priorities: kind === 'priority' ? [value] : [],
          signalType: kind === 'signal' ? value : 'all',
          grades: [],
          perceptionLevels: [],
          developmentStatus: 'all',
          currentStatus: 'all',
          overdue: 'all',
          hasRelationship: 'all',
          keyInfluencer: 'all',
          recommendationStatus: 'all'
        };
        render();
        return;
      }
      const intelligenceCustomer = event.target.closest('[data-cp-intelligence-customer]');
      if (intelligenceCustomer) {
        state.selectedRecommendationKey = '';
        if (typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/intelligence/')) history.replaceState({}, '', '#customer-profile-v1');
        openDetail(intelligenceCustomer.dataset.cpIntelligenceCustomer);
        return;
      }
      const intelligenceFollowUp = event.target.closest('[data-cp-intelligence-followup]');
      if (intelligenceFollowUp) {
        state.selectedRecommendationKey = '';
        state.timelineFilter = 'followup';
        if (typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/intelligence/')) history.replaceState({}, '', '#customer-profile-v1');
        openDetail(intelligenceFollowUp.dataset.cpIntelligenceFollowup);
        return;
      }
      const intelligenceGraph = event.target.closest('[data-cp-intelligence-graph]');
      if (intelligenceGraph) {
        state.selectedRecommendationKey = '';
        state.selectedGraphCustomerId = intelligenceGraph.dataset.cpIntelligenceGraph;
        if (typeof history !== 'undefined' && String(location.hash).startsWith('#customer-profile-v1/intelligence/')) history.replaceState({}, '', '#customer-profile-v1');
        openRelationshipView({
          pushHistory: true
        });
        return;
      }
      const openIntelligence = event.target.closest('[data-cp-open-intelligence]');
      if (openIntelligence) {
        state.selectedKey = null;
        state.mode = 'intelligence';
        state.intelligenceFilters = {
          customerId: openIntelligence.dataset.cpOpenIntelligence,
          product: 'all',
          hospital: 'all',
          department: 'all',
          priorities: [],
          signalType: 'all',
          grades: [],
          perceptionLevels: [],
          developmentStatus: 'all',
          currentStatus: 'all',
          overdue: 'all',
          hasRelationship: 'all',
          keyInfluencer: 'all',
          recommendationStatus: 'all'
        };
        if (typeof history !== 'undefined') history.replaceState({}, '', '#customer-profile-v1');
        render();
        return;
      }
      const graphView = event.target.closest('[data-cp-graph-view]');
      if (graphView) {
        switchRelationshipViewMode(graphView.dataset.cpGraphView);
        render();
        return;
      }
      const graphFullscreen = event.target.closest('[data-cp-graph-fullscreen]');
      if (graphFullscreen) {
        event.preventDefault();
        event.stopPropagation();
        if (state.graphFullscreen) collapseGraphFullscreen();else enterGraphFullscreen({
          pushHistory: true
        });
        return;
      }
      if (event.target.closest('[data-cp-relationship-filters]')) {
        root.querySelector('#cpRelationshipFilterDialog')?.showModal();
        return;
      }
      if (event.target.closest('[data-cp-primary-only]')) {
        state.relationshipFilters.primaryOnly = !state.relationshipFilters.primaryOnly;
        persistRelationshipView();
        renderResults();
        return;
      }
      const graphZoom = event.target.closest('[data-cp-graph-zoom]');
      if (graphZoom) {
        const viewport = root.querySelector('[data-cp-graph-viewport]');
        applyGraphZoom(state.relationshipZoom + (graphZoom.dataset.cpGraphZoom === 'in' ? .15 : -.15), {
          x: (viewport?.clientWidth || 0) / 2,
          y: (viewport?.clientHeight || 0) / 2
        });
        return;
      }
      if (event.target.closest('[data-cp-graph-reset]')) {
        relationshipLayoutStore.reset(state.relationshipViewMode);
        state.relationshipZoom = 1;
        state.relationshipPanX = 0;
        state.relationshipPanY = 0;
        persistRelationshipView();
        renderResults();
        return;
      }
      if (event.target.closest('[data-cp-clear-relationship-filters]')) {
        state.relationshipFilters = {
          hospital: 'all',
          department: 'all',
          grades: [],
          perceptionLevels: [],
          developmentStatus: 'all',
          currentStatus: 'all',
          relationshipScope: 'all',
          hasRelationship: 'all',
          importantOnly: false,
          primaryOnly: false
        };
        persistRelationshipView();
        render();
        return;
      }
      const focusHospital = event.target.closest('[data-cp-focus-hospital]');
      if (focusHospital) {
        state.relationshipFilters.hospital = focusHospital.dataset.cpFocusHospital;
        state.relationshipFilters.department = 'all';
        persistRelationshipView();
        renderResults();
        return;
      }
      const focusDepartment = event.target.closest('[data-cp-focus-department]');
      if (focusDepartment) {
        state.relationshipFilters.department = focusDepartment.dataset.cpFocusDepartment;
        persistRelationshipView();
        renderResults();
        return;
      }
      const graphNode = event.target.closest('[data-cp-graph-node]');
      if (graphNode) {
        if (state.ignoreGraphClick === graphNode.dataset.cpGraphNode) {
          state.ignoreGraphClick = '';
          return;
        }
        state.selectedGraphCustomerId = graphNode.dataset.cpGraphNode;
        persistRelationshipView();
        renderResults();
        return;
      }
      if (event.target.closest('[data-cp-graph-clear]')) {
        state.selectedGraphCustomerId = '';
        persistRelationshipView();
        renderResults();
        return;
      }
      const graphDetail = event.target.closest('[data-cp-graph-detail]');
      if (graphDetail) {
        openDetail(graphDetail.dataset.cpGraphDetail);
        return;
      }
      const newRelationship = event.target.closest('[data-cp-new-relationship]');
      if (newRelationship) {
        state.relationshipEditorSourceId = newRelationship.dataset.cpNewRelationship;
        state.selectedRelationshipId = null;
        state.relationshipError = '';
        render();
        root.querySelector('#cpRelationshipDialog')?.showModal();
        return;
      }
      const editRelationship = event.target.closest('[data-cp-edit-relationship]');
      if (editRelationship) {
        state.selectedRelationshipId = editRelationship.dataset.cpEditRelationship;
        state.relationshipEditorSourceId = '';
        state.relationshipError = '';
        render();
        root.querySelector('#cpRelationshipDialog')?.showModal();
        return;
      }
      const deleteRelationship = event.target.closest('[data-cp-delete-relationship]');
      if (deleteRelationship) {
        if (typeof confirm === 'function' && !confirm('仅删除关系，不删除客户档案。确定删除这条关系吗？')) return;
        relationshipStore.softDelete(deleteRelationship.dataset.cpDeleteRelationship);
        renderResults();
        return;
      }
      const restoreRelationship = event.target.closest('[data-cp-restore-relationship]');
      if (restoreRelationship) {
        relationshipStore.restore(restoreRelationship.dataset.cpRestoreRelationship);
        renderResults();
        return;
      }
      const professionalButton = event.target.closest('[data-cp-professional]');
      if (professionalButton) {
        state.professionalCustomerId = professionalButton.dataset.cpProfessional;
        state.professionalError = '';
        state.imageError = '';
        render();
        root.querySelector('#cpProfessionalDialog')?.showModal();
        return;
      }
      const removeProfessional = event.target.closest('[data-cp-remove-professional]');
      if (removeProfessional) {
        const [profileType, titleId] = removeProfessional.dataset.cpRemoveProfessional.split(':');
        const previous = professionalStore.get(state.professionalCustomerId);
        professionalStore.upsert({
          ...previous,
          [profileType]: (previous[profileType] || []).filter(item => item.titleId !== titleId),
          source: 'MANUAL'
        });
        render();
        root.querySelector('#cpProfessionalDialog')?.showModal();
        return;
      }
      if (event.target.closest('[data-cp-remove-image]')) {
        await customerImageStore.remove(state.professionalCustomerId);
        const previousUrl = imageUrls.get(state.professionalCustomerId);
        if (previousUrl && typeof URL !== 'undefined') URL.revokeObjectURL(previousUrl);
        imageUrls.set(state.professionalCustomerId, null);
        state.imageError = '';
        render();
        root.querySelector('#cpProfessionalDialog')?.showModal();
        return;
      }
      const timelineFilter = event.target.closest('[data-cp-timeline-filter]');
      if (timelineFilter) {
        state.timelineFilter = timelineFilter.dataset.cpTimelineFilter;
        renderResults();
        return;
      }
      if (event.target.closest('[data-cp-new-followup]')) {
        state.selectedFollowUpId = null;
        state.convertingNoteId = null;
        render();
        root.querySelector('#cpFollowUpDialog')?.showModal();
        return;
      }
      const editFollowUp = event.target.closest('[data-cp-edit-followup]');
      if (editFollowUp) {
        state.selectedFollowUpId = editFollowUp.dataset.cpEditFollowup;
        state.convertingNoteId = null;
        render();
        root.querySelector('#cpFollowUpDialog')?.showModal();
        return;
      }
      const deleteFollowUp = event.target.closest('[data-cp-delete-followup]');
      if (deleteFollowUp) {
        followUpStore.softDelete(deleteFollowUp.dataset.cpDeleteFollowup);
        state.lastDeletedFollowUpId = deleteFollowUp.dataset.cpDeleteFollowup;
        renderResults();
        return;
      }
      const undoFollowUp = event.target.closest('[data-cp-undo-followup]');
      if (undoFollowUp) {
        followUpStore.restore(undoFollowUp.dataset.cpUndoFollowup);
        state.lastDeletedFollowUpId = null;
        renderResults();
        return;
      }
      const convertNote = event.target.closest('[data-cp-convert-note]');
      if (convertNote) {
        state.convertingNoteId = convertNote.dataset.cpConvertNote;
        state.selectedFollowUpId = null;
        render();
        root.querySelector('#cpFollowUpDialog')?.showModal();
        return;
      }
      const statusButton = event.target.closest('[data-cp-status]');
      if (statusButton) {
        state.statusCustomerId = statusButton.dataset.cpStatus;
        render();
        root.querySelector('#cpStatusDialog')?.showModal();
        return;
      }
      const generateInsight = event.target.closest('[data-cp-generate-insight]');
      if (generateInsight) {
        state.insightCustomerId = generateInsight.dataset.cpGenerateInsight;
        state.insightError = '';
        render();
        root.querySelector('#cpInsightGenerateDialog')?.showModal();
        return;
      }
      const editInsight = event.target.closest('[data-cp-edit-insight]');
      if (editInsight) {
        state.insightEditCustomerId = editInsight.dataset.cpEditInsight;
        render();
        root.querySelector('#cpInsightEditDialog')?.showModal();
        return;
      }
      const toggleInsight = event.target.closest('[data-cp-toggle-insight]');
      if (toggleInsight) {
        const customerId = toggleInsight.dataset.cpToggleInsight;
        state.expandedInsightCustomerId = state.expandedInsightCustomerId === customerId ? null : customerId;
        renderResults();
        return;
      }
      if (event.target.closest('[data-cp-master]')) {
        openPanel('master');
        return;
      }
      if (event.target.closest('[data-cp-import]')) {
        openPanel('import');
        return;
      }
      if (event.target.closest('[data-cp-open-matches]')) {
        openPanel('matches');
        return;
      }
      if (event.target.closest('[data-cp-panel-close]')) {
        closePanel();
        return;
      }
      if (event.target.closest('[data-cp-new-master]')) {
        state.selectedMasterId = null;
        render();
        root.querySelector('#cpMasterDialog')?.showModal();
        return;
      }
      const selectCustomer = event.target.closest('[data-cp-select-customer]');
      if (selectCustomer) {
        const id = selectCustomer.dataset.cpSelectCustomer;
        selectedCustomerIds.has(id) ? selectedCustomerIds.delete(id) : selectedCustomerIds.add(id);
        render();
        return;
      }
      if (event.target.closest('[data-cp-select-all]')) {
        const ids = filteredMasterRecords().map(record => record.customerId),
          all = ids.length && ids.every(id => selectedCustomerIds.has(id));
        ids.forEach(id => all ? selectedCustomerIds.delete(id) : selectedCustomerIds.add(id));
        render();
        return;
      }
      if (event.target.closest('[data-cp-bulk-remove]')) {
        if (!selectedCustomerIds.size || !confirm('删除无引用客户；已有业务引用的客户归档保留历史。继续？')) return;
        for (const id of [...selectedCustomerIds]) deleteCustomer(id, {
          deferRender: true
        });
        selectedCustomerIds.clear();
        refreshHydration();
        render();
        return;
      }
      const editMaster = event.target.closest('[data-cp-edit-master]');
      if (editMaster) {
        state.selectedMasterId = editMaster.dataset.cpEditMaster;
        render();
        root.querySelector('#cpMasterDialog')?.showModal();
        return;
      }
      const toggleMaster = event.target.closest('[data-cp-toggle-master]');
      if (toggleMaster) {
        const record = masterStore.get(toggleMaster.dataset.cpToggleMaster);
        if (record) {
          masterStore.setActive(record.customerId, !record.active);
          refreshHydration();
          render();
        }
        return;
      }
      const deleteMaster = event.target.closest('[data-cp-delete-master]');
      if (deleteMaster) {
        const record = masterStore.get(deleteMaster.dataset.cpDeleteMaster);
        if (!record) return;
        const decision = Deletion.decide('customer', record, customerDeletionContext(record.customerId));
        if (typeof confirm === 'function' && !confirm(decision.action === 'DELETE' ? '删除此无业务引用的客户档案？' : '客户存在业务引用，将归档并保留历史。继续？')) return;
        deleteCustomer(record.customerId);
        return;
      }
      if (event.target.closest('[data-cp-import-reset]')) {
        state.importAnalysis = null;
        state.importReport = null;
        state.importFileName = '';
        render();
        return;
      }
      if (event.target.closest('[data-cp-import-commit]')) {
        state.importReport = commitCustomerImport(state.importAnalysis, masterStore, {
          saveDecision,
          enqueue
        });
        refreshHydration();
        render();
        return;
      }
      const pickedCandidate = event.target.closest('[data-cp-pick-candidate]');
      if (pickedCandidate) {
        const card = pickedCandidate.closest('.cp-match-card');
        const input = card?.querySelector('[data-cp-match-customer]');
        const select = card?.querySelector('[data-cp-match-resolution]');
        if (input) input.value = pickedCandidate.dataset.cpPickCandidate;
        if (select) select.value = 'existing';
        return;
      }
      const resolveMatch = event.target.closest('[data-cp-resolve-match]');
      if (resolveMatch) {
        const item = matchQueue.find(queuedItem => queuedItem.queueId === resolveMatch.dataset.cpResolveMatch);
        const card = resolveMatch.closest('.cp-match-card');
        if (!item || !card) return;
        const resolution = card.querySelector('[data-cp-match-resolution]')?.value;
        const chosenCustomerId = card.querySelector('[data-cp-match-customer]')?.value.trim();
        if (resolution === 'defer') return;
        try {
          let customerId = chosenCustomerId;
          if (resolution === 'create') customerId = masterStore.create({
            ...item.record,
            source: item.source === 'LOCAL_QUICK_NOTE' ? 'LOCAL_QUICK_NOTE' : 'EXCEL_IMPORT'
          }).customerId;else if (!masterStore.get(customerId)) throw new Error('请选择有效的现有 customerId');
          if (resolution === 'existing' && item.source !== 'LOCAL_QUICK_NOTE') masterStore.update(customerId, importPatch(item.record), {
            source: 'EXCEL_IMPORT'
          });
          saveDecision(item.signature || matchSignature(item.record), customerId);
          if (item.source === 'LOCAL_QUICK_NOTE') {
            const pending = state.localNotes.__pending__ || [];
            const note = pending.find(entry => entry.id === item.eventId);
            state.localNotes.__pending__ = pending.filter(entry => entry.id !== item.eventId);
            if (note) {
              note.customerId = customerId;
              const key = `${customerId}::${note.product || '__all__'}`;
              state.localNotes[key] = [note, ...(state.localNotes[key] || [])];
              storage?.setItem(STORAGE_KEY, JSON.stringify(state.localNotes));
            }
          }
          matchQueue = matchQueue.filter(queuedItem => queuedItem.queueId !== item.queueId);
          persistQueue();
          refreshHydration();
          render();
        } catch (error) {
          card.querySelector('.cp-match-error')?.remove();
          const message = document.createElement('p');
          message.className = 'cp-match-error cp-row-error';
          message.textContent = error.message;
          card.append(message);
        }
        return;
      }
      const product = event.target.closest('[data-cp-product]');
      if (product) {
        state.product = product.dataset.cpProduct;
        state.selectedKey = null;
        state.visibleCount = 40;
        render();
        return;
      }
      if (event.target.closest('[data-cp-upgrade-entry]')) {
        config.onOpenCustomerUpgradeManager?.();
        return;
      }
      const mode = event.target.closest('[data-cp-mode]');
      if (mode) {
        if (mode.dataset.cpMode === 'relationships') openRelationshipView({
          pushHistory: true
        });else {
          state.mode = mode.dataset.cpMode;
          state.selectedKey = null;
          render();
        }
        return;
      }
      const maintainHospital = event.target.closest('[data-cp-maintain-hospital]');
      if (maintainHospital) {
        openHospitalById(maintainHospital.dataset.cpMaintainHospital);
        return;
      }
      const open = event.target.closest('[data-cp-open]');
      if (open) {
        openDetail(open.dataset.cpOpen);
        return;
      }
      if (event.target.closest('[data-cp-close]')) {
        closeDetail();
        return;
      }
      if (event.target.closest('[data-cp-filters]')) {
        root.querySelector('#cpFilterDialog')?.showModal();
        return;
      }
      if (event.target.closest('[data-cp-dialog-close]')) {
        const dialog = event.target.closest('dialog');
        if (dialog?.id === 'cpFollowUpDialog') {
          state.followUpSourceTaskId = '';
          state.followUpRecommendationKey = '';
        }
        dialog?.close();
        return;
      }
      if (event.target.closest('[data-cp-clear]')) {
        state.search = '';
        state.filters = {
          ...state.filters,
          office: 'all',
          employee: 'all',
          hospital: 'all',
          department: 'all',
          grade: 'all',
          status: 'all',
          resource: false,
          targetIncomplete: false,
          noPlan: false
        };
        render();
        return;
      }
      if (event.target.closest('[data-cp-more]')) {
        state.visibleCount += 40;
        renderResults();
        return;
      }
      const trend = event.target.closest('[data-cp-trend]');
      if (trend) {
        state.trendRange = trend.dataset.cpTrend;
        renderResults();
        return;
      }
      const monitor = event.target.closest('[data-cp-monitor]');
      if (monitor) {
        state.monitorCategory = monitor.dataset.cpMonitor;
        renderResults();
        return;
      }
      const hospital = event.target.closest('[data-cp-hospital]');
      if (hospital) {
        state.mode = 'overview';
        state.search = hospital.dataset.cpHospital;
        render();
        return;
      }
      if (event.target.closest('[data-cp-note], [data-cp-global-note]')) {
        const selected = allProfiles().find(profile => profileKey(profile) === state.selectedKey);
        const dialog = root.querySelector('#cpQuickDialog');
        const date = dialog.querySelector('[name="date"]');
        const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        date.value = now.toISOString().slice(0, 16);
        const customerSelect = dialog.querySelector('[name="customerId"]');
        const productSelect = dialog.querySelector('[name="product"]');
        customerSelect.value = selected ? quickCustomerLabel(masterStore.get(selected.customerId) || {
          customerName: selected.canonicalName,
          hospital: selected.hospitalName,
          department: selected.departmentName
        }) : '';
        productSelect.value = selected?.product || '';
        dialog.querySelector('[name="pendingCustomerName"]').value = selected?.canonicalName || '';
        dialog.querySelector('[name="pendingHospital"]').value = selected?.hospitalName || '';
        dialog.querySelector('[name="pendingDepartment"]').value = selected?.departmentName || '';
        dialog.querySelector('#cpNoteAssociation').textContent = selected ? `${selected.hospitalName} · ${selected.departmentName} · ${selected.canonicalName} · ${selected.employeeName}` : '未选择客户时，记录将进入匹配确认中心。';
        dialog.showModal();
      }
    });
    root.addEventListener('pointerdown', event => {
      if (event.target.closest('[data-cp-recommendation-detail]')) return;
      const node = event.target.closest('[data-cp-graph-node]');
      if (node) {
        const viewport = node.closest('[data-cp-graph-viewport]');
        state.graphDrag = {
          customerId: node.dataset.cpGraphNode,
          pointerId: event.pointerId,
          node,
          viewport,
          startPoint: graphLocalPoint(event, viewport),
          x: finite(node.style.left),
          y: finite(node.style.top),
          moved: false
        };
        node.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
      const viewport = event.target.closest('[data-cp-graph-viewport]');
      if (viewport && !event.target.closest('button, input, select, textarea')) {
        state.graphPan = {
          pointerId: event.pointerId,
          viewport,
          startPoint: graphLocalPoint(event, viewport),
          panX: state.relationshipPanX,
          panY: state.relationshipPanY
        };
        viewport.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
    });
    root.addEventListener('pointermove', event => {
      if (state.graphDrag?.pointerId === event.pointerId) {
        const point = graphLocalPoint(event, state.graphDrag.viewport);
        const dx = (point.x - state.graphDrag.startPoint.x) / state.relationshipZoom;
        const dy = (point.y - state.graphDrag.startPoint.y) / state.relationshipZoom;
        if (Math.abs(dx) + Math.abs(dy) > 3) state.graphDrag.moved = true;
        state.graphDrag.node.style.left = `${Math.max(28, state.graphDrag.x + dx)}px`;
        state.graphDrag.node.style.top = `${Math.max(34, state.graphDrag.y + dy)}px`;
        event.preventDefault();
        return;
      }
      if (state.graphPan?.pointerId === event.pointerId) {
        const point = graphLocalPoint(event, state.graphPan.viewport);
        state.relationshipPanX = state.graphPan.panX + point.x - state.graphPan.startPoint.x;
        state.relationshipPanY = state.graphPan.panY + point.y - state.graphPan.startPoint.y;
        const world = root.querySelector('.cp-graph-world');
        if (world) world.style.transform = `translate(${state.relationshipPanX}px,${state.relationshipPanY}px) scale(${state.relationshipZoom})`;
        event.preventDefault();
      }
    });
    root.addEventListener('pointerup', event => {
      if (state.graphDrag?.pointerId === event.pointerId) {
        const drag = state.graphDrag;
        state.graphDrag = null;
        if (drag.moved) {
          relationshipLayoutStore.setPosition(state.relationshipViewMode, drag.customerId, {
            x: finite(drag.node.style.left),
            y: finite(drag.node.style.top)
          });
          state.ignoreGraphClick = drag.customerId;
        } else {
          state.selectedGraphCustomerId = drag.customerId;
          persistRelationshipView();
        }
      }
      if (state.graphPan?.pointerId === event.pointerId) {
        state.graphPan = null;
        persistRelationshipView();
      }
    });
    root.addEventListener('wheel', event => {
      const viewport = event.target.closest('[data-cp-graph-viewport]');
      if (!viewport) return;
      event.preventDefault();
      applyGraphZoom(state.relationshipZoom + (event.deltaY < 0 ? .08 : -.08), graphLocalPoint(event, viewport));
    }, {
      passive: false
    });
    root.addEventListener('error', event => {
      if (!event.target.matches?.('[data-cp-avatar-image]')) return;
      event.target.hidden = true;
      const fallback = event.target.parentElement?.querySelector('[data-cp-avatar-fallback]');
      if (fallback) fallback.hidden = false;
    }, true);
    function captureNavigationState() {
      const selected = selectedProfile();
      const selectedMaster = selected ? masterStore.get(selected.customerId) : null;
      return normalizeCustomerNavigationSnapshot({
        schemaVersion: CUSTOMER_NAVIGATION_SNAPSHOT_VERSION,
        view: {
          page: state.mode,
          product: state.product,
          search: state.search,
          filters: state.filters,
          monitorCategory: state.monitorCategory,
          trendRange: state.trendRange,
          timelineFilter: state.timelineFilter,
          visibleCount: state.visibleCount
        },
        selection: {
          customerId: selected?.customerId || '',
          reliability: selected ? 'STABLE_ID' : '',
          product: selected?.product || null,
          hospitalId: selectedMaster?.hospitalId || '',
          departmentId: selectedMaster?.departmentId || ''
        },
        hospital: {
          hospitalId: state.maintenanceHospitalId || selectedMaster?.hospitalId || '',
          departmentId: selectedMaster?.departmentId || ''
        },
        relationship: {
          viewMode: state.relationshipViewMode,
          zoom: state.relationshipZoom,
          pan: {
            x: state.relationshipPanX,
            y: state.relationshipPanY
          },
          filters: state.relationshipFilters,
          selectedCustomerId: state.selectedGraphCustomerId
        },
        intelligence: {
          filters: state.intelligenceFilters
        },
        ui: {
          panel: state.panel,
          expandedInsightCustomerId: state.expandedInsightCustomerId,
          detailScrollTop: Number(root.querySelector('.cp-detail-scroll')?.scrollTop || 0)
        }
      });
    }
    function restoreNavigationState(input = {}) {
      const snapshot = normalizeCustomerNavigationSnapshot(input);
      const masters = masterStore.list({
        includeInactive: true
      });
      const masterById = new Map(masters.map(record => [String(record.customerId || ''), record]));
      const hospitalRecord = masters.find(record => snapshot.hospital.hospitalId && String(record.hospitalId || '') === snapshot.hospital.hospitalId);
      const departmentRecord = masters.find(record => snapshot.hospital.departmentId && String(record.departmentId || '') === snapshot.hospital.departmentId && (!snapshot.hospital.hospitalId || String(record.hospitalId || '') === snapshot.hospital.hospitalId));
      const selectedMaster = masterById.get(snapshot.selection.customerId) || null;
      const reliableSelection = Boolean(selectedMaster && selectedMaster.active !== false && CUSTOMER_NAVIGATION_RELIABLE_IDENTITIES.has(snapshot.selection.reliability));
      const selectedProduct = snapshot.selection.product;
      const currentProduct = PRODUCTS.includes(snapshot.view.product) ? snapshot.view.product : state.product;
      state.mode = snapshot.view.page;
      state.product = currentProduct;
      state.search = snapshot.view.search;
      state.filters = {
        ...state.filters,
        ...snapshot.view.filters
      };
      if (snapshot.view.filters?.month) observationMonthExplicit = true;
      state.monitorCategory = snapshot.view.monitorCategory;
      state.trendRange = snapshot.view.trendRange;
      state.timelineFilter = snapshot.view.timelineFilter;
      state.visibleCount = snapshot.view.visibleCount;
      state.intelligenceFilters = {
        ...state.intelligenceFilters,
        ...snapshot.intelligence.filters
      };
      state.relationshipViewMode = snapshot.relationship.viewMode;
      state.relationshipZoom = snapshot.relationship.zoom;
      state.relationshipPanX = snapshot.relationship.pan.x;
      state.relationshipPanY = snapshot.relationship.pan.y;
      rememberGraphViewport();
      state.graphFullscreen = false;
      graphFullscreenSnapshot = null;
      state.relationshipFilters = {
        ...state.relationshipFilters,
        ...snapshot.relationship.filters
      };
      state.panel = snapshot.ui.panel;
      state.selectedKey = null;
      state.selectedRecommendationKey = '';
      state.taskDraft = null;
      state.selectedRelationshipId = null;
      state.relationshipEditorSourceId = '';
      state.followUpSourceTaskId = '';
      state.followUpRecommendationKey = '';
      state.maintenanceHospitalId = '';
      state.expandedInsightCustomerId = masterById.has(snapshot.ui.expandedInsightCustomerId) ? snapshot.ui.expandedInsightCustomerId : null;
      let restoredLevel = 'VIEW';
      let reason = '';
      let contextReconciled = false;
      if (snapshot.selection.customerId) {
        if (!selectedMaster) reason = 'CUSTOMER_NOT_FOUND';else if (selectedMaster.active === false) reason = 'CUSTOMER_INACTIVE';else if (!reliableSelection) reason = 'CUSTOMER_ID_UNRELIABLE';else if (!PRODUCTS.includes(selectedProduct)) reason = 'PRODUCT_UNSPECIFIED';else {
          const key = `${selectedMaster.customerId}::${selectedProduct}`;
          if (profileForKey(key)) {
            state.product = selectedProduct;
            state.selectedKey = key;
            state.panel = null;
            restoredLevel = 'CUSTOMER';
            contextReconciled = Boolean(snapshot.selection.hospitalId && snapshot.selection.hospitalId !== String(selectedMaster.hospitalId || '') || snapshot.selection.departmentId && snapshot.selection.departmentId !== String(selectedMaster.departmentId || ''));
          } else reason = 'CUSTOMER_PRODUCT_NOT_AVAILABLE';
        }
      }
      if (snapshot.selection.customerId && !state.selectedKey) {
        const fallbackRecord = departmentRecord || hospitalRecord;
        if (fallbackRecord) {
          state.mode = 'hospitals';
          state.panel = null;
          state.maintenanceHospitalId = String(fallbackRecord.hospitalId || '');
          state.filters.hospital = fallbackRecord.hospital || 'all';
          state.filters.department = departmentRecord?.department || 'all';
          restoredLevel = departmentRecord ? 'DEPARTMENT' : 'HOSPITAL';
        } else {
          state.mode = 'overview';
          state.panel = null;
          restoredLevel = 'OVERVIEW';
        }
      }
      const graphCustomer = masterById.get(snapshot.relationship.selectedCustomerId);
      state.selectedGraphCustomerId = graphCustomer ? graphCustomer.customerId : '';
      if (state.relationshipFilters.hospital !== 'all' && !masters.some(record => String(record.hospitalId || '') === state.relationshipFilters.hospital)) state.relationshipFilters.hospital = 'all';
      if (state.relationshipFilters.department !== 'all' && !masters.some(record => String(record.departmentId || '') === state.relationshipFilters.department)) state.relationshipFilters.department = 'all';
      persistRelationshipView();
      render();
      queueMicrotask(() => {
        const detail = root.querySelector('.cp-detail-scroll');
        if (detail) detail.scrollTop = Math.min(snapshot.ui.detailScrollTop, Math.max(0, detail.scrollHeight - detail.clientHeight));
      });
      return {
        schemaVersion: CUSTOMER_NAVIGATION_SNAPSHOT_VERSION,
        restoredLevel,
        reason,
        contextReconciled,
        snapshot
      };
    }
    function openCustomerContext(input = {}) {
      const context = normalizeCustomerModuleContext(input);
      const snapshot = captureNavigationState();
      snapshot.selection = context;
      snapshot.hospital = {
        hospitalId: context.hospitalId,
        departmentId: context.departmentId
      };
      if (context.focus === 'relationship') {
        snapshot.view.page = 'relationships';
        snapshot.relationship.selectedCustomerId = context.customerId;
        snapshot.selection.customerId = '';
      } else if (context.focus === 'hospital') {
        snapshot.view.page = 'hospitals';
        snapshot.selection.customerId = '';
      }
      const result = restoreNavigationState(snapshot);
      if (result.restoredLevel === 'CUSTOMER' && context.focus === 'followup') {
        state.followUpSourceTaskId = context.taskId;
        state.followUpRecommendationKey = context.recommendationKey;
        render();
        queueMicrotask(() => root.querySelector('#cpFollowUpDialog')?.showModal());
      }
      return result;
    }
    function closeTopLayer() {
      const dialog = [...root.querySelectorAll('dialog[open]')].at(-1);
      if (dialog?.id === 'cpRecommendationDialog') {
        closeRecommendationDetail(true);
        return true;
      }
      if (dialog?.id === 'cpTaskDraftDialog') {
        closeTaskDraft(true);
        return true;
      }
      if (dialog) {
        dialog.close();
        return true;
      }
      if (state.selectedRecommendationKey) {
        closeRecommendationDetail(true);
        return true;
      }
      if (state.taskDraft) {
        closeTaskDraft(true);
        return true;
      }
      if (state.graphFullscreen) {
        collapseGraphFullscreen();
        return true;
      }
      if (state.mode === 'relationships') {
        leaveRelationshipView();
        return true;
      }
      if (state.panel) {
        closePanel(true);
        return true;
      }
      if (state.selectedKey) {
        closeDetail(true);
        return true;
      }
      return false;
    }
    function handleCustomerPopState(event) {
      if (event?.state?.workspaceNavigation && !event?.state?.workspaceNavigationLocalRoute) return false;
      const match = String(location.hash).match(/^#customer-profile-v1\/detail\/(.+)$/);
      const panelMatch = String(location.hash).match(/^#customer-profile-v1\/(master|import|matches)$/);
      const recommendationMatch = String(location.hash).match(/^#customer-profile-v1\/intelligence\/(.+)$/);
      const relationshipMatch = String(location.hash).match(/^#customer-profile-v1\/relationships$/);
      const relationshipFullscreenMatch = String(location.hash).match(/^#customer-profile-v1\/relationships\/fullscreen$/);
      if (relationshipFullscreenMatch) {
        state.mode = 'relationships';
        state.selectedKey = null;
        if (!state.graphFullscreen) enterGraphFullscreen({
          pushHistory: false
        });else render();
      } else if (relationshipMatch) {
        state.mode = 'relationships';
        state.selectedKey = null;
        if (state.graphFullscreen) collapseGraphFullscreen({
          fromHistory: true
        });else render();
      } else if (state.mode === 'relationships') {
        state.graphFullscreen = false;
        graphFullscreenSnapshot = null;
        state.mode = 'overview';
        state.selectedGraphCustomerId = '';
        render();
      } else if (recommendationMatch) {
        state.taskDraft = null;
        state.taskDraftError = '';
        state.panel = null;
        state.selectedKey = null;
        state.selectedRecommendationKey = decodeURIComponent(recommendationMatch[1]);
        render();
        root.querySelector('#cpRecommendationDialog')?.showModal();
      } else if (match) {
        state.panel = null;
        state.selectedRecommendationKey = '';
        state.selectedKey = decodeURIComponent(match[1]);
        renderResults();
      } else if (panelMatch) {
        state.selectedKey = null;
        state.panel = panelMatch[1];
        render();
      } else if (state.taskDraft) closeTaskDraft(true);else if (state.selectedRecommendationKey) closeRecommendationDetail(true);else if (state.panel) closePanel(true);else if (state.selectedKey) closeDetail(true);else return false;
      return true;
    }
    if (!config.deferInitialRender) render();
    return {
      update(data = {}) {
        rawLiveProfiles = buildProfilesFromAppData(data.records || [], data.tasks || [], {
          gradeResolver: resolver
        });
        // Reading imported/live observations never creates a Master record.
        liveProfiles = hydrateProfilesFromMaster(rawLiveProfiles, masterStore.list(), matchDecisions, {
          includeUnrepresented: true
        });
        state.useDemo = forcedDemo || !liveProfiles.length;
        render();
      },
      activate() {
        render();
      },
      destroy() {
        if (typeof URL !== 'undefined') imageUrls.forEach(url => {
          if (url) URL.revokeObjectURL(url);
        });
        root.innerHTML = '';
      },
      getState() {
        return JSON.parse(JSON.stringify(state));
      },
      getNavigationState() {
        return captureNavigationState();
      },
      captureNavigationState() {
        return captureNavigationState();
      },
      restoreNavigationState(snapshot = {}) {
        return restoreNavigationState(snapshot);
      },
      openCustomerContext(context = {}) {
        return openCustomerContext(context);
      },
      closeTopLayer() {
        return closeTopLayer();
      },
      suspendRelationshipViewingPlane() {
        exitRelationshipViewingPlane();
      },
      resumeRelationshipViewingPlane() {
        if (state.mode === 'relationships') void enterRelationshipViewingPlane();
      },
      handlePopState(event) {
        return handleCustomerPopState(event);
      },
      getProfiles() {
        return allProfiles();
      },
      getMasterRecords() {
        return masterStore.list();
      },
      deleteCustomer(customerId) {
        return deleteCustomer(customerId);
      },
      ensureActivityPerson(context = {}) {
        const name = String(context.customerName || '').trim();
        if (!name || !context.hospitalId || !Departments.idsOf(context).length || !context.hospital || !context.department || !context.id) throw new Error('建档需明确来源、医院、科室和人员姓名');
        if (context.customerId) {
          const record = masterStore.get(context.customerId);
          if (!record || record.hospitalId !== context.hospitalId || !Departments.sharesDepartment(record, context)) throw new Error('人员身份与当前医院/科室不一致，请重新选择');
          return record;
        }
        const same = masterStore.list().filter(record => record.active !== false && record.customerName === name && record.hospitalId === context.hospitalId && Departments.sharesDepartment(record, context));
        if (same.length === 1) throw new Error('姓名只产生候选，请明确选择稳定客户身份');
        if (same.length > 1) throw new Error('存在同名人员，请从当前医院/科室候选明确选择，不能按姓名自动合并');
        if (context.explicitCreate !== true) throw new Error('未确认的人员不得自动建档');
        return masterStore.create({
          customerName: name,
          hospital: context.hospital,
          hospitalId: context.hospitalId,
          department: context.department,
          departmentId: context.departmentId,
          departmentIds: Departments.idsOf(context),
          departmentBindingEvidence: context.departmentBindingEvidence,
          associatedProducts: context.product ? [context.product] : [],
          source: context.sourceType === 'TASK_ENTRY' ? 'TASK_ENTRY' : 'ACTIVITY_APPLICATION_DRAFT',
          nextAction: '待完善人员资料',
          notes: '待完善；来源：' + (context.sourceType === 'TASK_ENTRY' ? '任务' : '活动申请') + '；角色：' + context.role
        });
      },
      ensureTaskPerson(context = {}) {
        return this.ensureActivityPerson({
          ...context,
          sourceType: 'TASK_ENTRY',
          role: '客户拜访'
        });
      },
      getMatchQueue() {
        return JSON.parse(JSON.stringify(matchQueue));
      },
      getFollowUps(options = {}) {
        return followUpStore.list(options);
      },
      getDevelopmentHistory(customerId) {
        return developmentStore.listHistory(customerId);
      },
      getInsight(customerId) {
        return insightStore.get(customerId);
      },
      getRelationships(options = {}) {
        return relationshipStore.list(options);
      },
      getProfessionalProfile(customerId) {
        return professionalStore.get(customerId);
      },
      getRelationshipViewState() {
        return {
          viewMode: state.relationshipViewMode,
          zoom: state.relationshipZoom,
          panX: state.relationshipPanX,
          panY: state.relationshipPanY,
          filters: JSON.parse(JSON.stringify(state.relationshipFilters)),
          selectedCustomerId: state.selectedGraphCustomerId
        };
      },
      getImportantCustomers() {
        return getImportantCustomers(graphCustomers(), relationshipStore.list(), professionalStore.list());
      },
      getRelationshipRisks() {
        return getRelationshipRisks(graphCustomers(), relationshipStore.list());
      },
      getCustomersNeedingFollowUp() {
        return getCustomersNeedingFollowUp(graphCustomers(), followUpStore.list());
      },
      getOperatingRecommendations(context = {}) {
        return operatingProvider.analyze({
          ...operatingContext(),
          ...context
        }).recommendations;
      },
      getPriorityCustomers(context = {}) {
        return operatingProvider.analyze({
          ...operatingContext(),
          ...context
        }).recommendations.filter(item => ['P0', 'P1'].includes(item.priority));
      },
      getRelationshipGaps(context = {}) {
        return operatingProvider.analyze({
          ...operatingContext(),
          ...context
        }).recommendations.filter(item => ['RELATIONSHIP_GAP', 'HIGH_VALUE_WEAK_RELATIONSHIP'].includes(item.signalType));
      },
      getCoverageGaps(context = {}) {
        return operatingProvider.analyze({
          ...operatingContext(),
          ...context
        }).recommendations.filter(item => item.signalType === 'COVERAGE_GAP');
      },
      getRecoveryOpportunities(context = {}) {
        return operatingProvider.analyze({
          ...operatingContext(),
          ...context
        }).recommendations.filter(item => item.signalType === 'RECOVERY_OPPORTUNITY');
      },
      getSuggestedActions(context = {}) {
        return operatingProvider.analyze({
          ...operatingContext(),
          ...context
        }).recommendations.flatMap(item => item.recommendedActions.map(action => ({
          ...action,
          recommendationKey: item.recommendationKey,
          priority: item.priority,
          signalType: item.signalType
        })));
      },
      getRecommendationActions() {
        return recommendationActionStore.list();
      },
      getTaskLinks() {
        return taskLinkStore.reconcile(taskBridge);
      },
      getTaskRecommendations(context = {}) {
        return taskRecommendationSnapshot(context);
      },
      updateTaskRecommendationPlan(key, days) {
        return recommendationActionStore.setStatus(key, 'NEW', {
          visitIntervalDays: days
        });
      },
      dismissTaskRecommendation(key) {
        return recommendationActionStore.setStatus(key, 'DISMISSED');
      },
      createTaskRecommendations(recommendations, selectedIds, options = {}) {
        return confirmTaskRecommendations(recommendations, selectedIds, options);
      },
      openCustomer(customerId, options = {}) {
        return openCustomerById(customerId, options);
      },
      openHospital(hospitalIdOrName) {
        return openHospitalById(hospitalIdOrName);
      },
      exportSyncState() {
        const development = developmentStore.exportState();
        return {
          customers: masterStore.serialize(),
          customerFollowUps: followUpStore.list({
            includeDeleted: true
          }),
          customerDevelopmentRecords: development.records,
          customerDevelopmentHistory: development.history,
          customerMasterEvents: development.masterEvents
        };
      },
      applySyncState(snapshot = {}) {
        if (Array.isArray(snapshot.customers)) masterStore.replace(snapshot.customers, {
          silent: true
        });
        if (Array.isArray(snapshot.customerFollowUps)) followUpStore.replace(snapshot.customerFollowUps, {
          silent: true
        });
        const development = developmentStore.exportState();
        const hasDevelopmentSnapshot = [snapshot.customerDevelopmentRecords, snapshot.customerDevelopmentHistory, snapshot.customerMasterEvents].some(Array.isArray);
        if (hasDevelopmentSnapshot) {
          developmentStore.replace({
            records: Array.isArray(snapshot.customerDevelopmentRecords) ? snapshot.customerDevelopmentRecords : development.records,
            history: Array.isArray(snapshot.customerDevelopmentHistory) ? snapshot.customerDevelopmentHistory : development.history,
            masterEvents: Array.isArray(snapshot.customerMasterEvents) ? snapshot.customerMasterEvents : development.masterEvents
          }, {
            silent: true
          });
        }
        refreshHydration();
        render();
      }
    };
  }
  return {
    PRODUCTS,
    CUSTOMER_NAVIGATION_SNAPSHOT_VERSION,
    CUSTOMER_NAVIGATION_RELIABLE_IDENTITIES,
    STATUS,
    SALES_GRADE_ORDER,
    STORAGE_KEY,
    MASTER_STORAGE_KEY,
    MATCH_DECISIONS_KEY,
    MATCH_QUEUE_KEY,
    MASTER_SCHEMA_VERSION,
    DEVELOPMENT_STATUS,
    FOLLOW_UP_TYPES,
    FOLLOWUP_STORAGE_KEY,
    INSIGHT_STORAGE_KEY,
    DEVELOPMENT_HISTORY_KEY,
    V12_SCHEMA_VERSION,
    RELATIONSHIP_STORAGE_KEY,
    RELATIONSHIP_LAYOUT_KEY,
    PROFESSIONAL_PROFILE_STORAGE_KEY,
    CUSTOMER_IMAGE_DB_NAME,
    CUSTOMER_IMAGE_STORE_NAME,
    V13_SCHEMA_VERSION,
    RELATIONSHIP_SCOPES,
    RELATIONSHIP_TYPES,
    RELATIONSHIP_STRENGTHS,
    RECOMMENDATION_ACTIONS_STORAGE_KEY,
    V14_SCHEMA_VERSION,
    TASK_LINK_STORAGE_KEY,
    V15_SCHEMA_VERSION,
    TASK_LINK_STATES,
    VISIT_CYCLE_DAYS,
    CUSTOMER_VISIT_CANCEL_COOLDOWN_DAYS,
    CUSTOMER_VISIT_REASONS,
    OPERATING_PROVIDER_MODE,
    OPERATING_SIGNAL_TYPES,
    OPERATING_PRIORITIES,
    RECOMMENDATION_STATUSES,
    OPERATING_ACTION_TYPES,
    OPERATING_RULES,
    normalizeCustomerModuleContext,
    normalizeCustomerNavigationSnapshot,
    customerEntityMatcher,
    createCustomerPlanProvider,
    createResourceInvestmentProvider,
    createCustomerMasterStore,
    employeeIdentityId: name => String(name || '').trim() ? stableId(['employee', name]) : '',
    seedMasterRecords,
    normalizeMasterRecord,
    customerMasterIdentity,
    resolveCustomerIdentity,
    projectPerception,
    matchSignature,
    matchMasterRecord,
    analyzeCustomerImport,
    parseCustomerWorkbook,
    commitCustomerImport,
    hydrateProfilesFromMaster,
    createDevelopmentStore,
    normalizeDevelopmentStatus,
    suggestedDevelopmentStatus,
    normalizeFollowUp,
    validateFollowUp,
    createFollowUpStore,
    convertQuickNoteToFollowUp,
    isFollowUpOverdue,
    normalizeInsight,
    validateInsightOutput,
    createLocalCustomerInsightProvider,
    createCustomerInsightStore,
    collectCustomerEvents,
    normalizeRelationship,
    validateRelationship,
    relationshipFingerprint,
    createRelationshipStore,
    createRelationshipLayoutStore,
    normalizeProfessionalTitle,
    createProfessionalProfileStore,
    createCustomerProfessionalProfileProvider,
    createCustomerImageStore,
    prepareCustomerImage,
    calculateCustomerImportance,
    sortCustomersByImportance,
    filterRelationshipGraph,
    createRelationshipLayout,
    seedRelationshipRecords,
    getImportantCustomers,
    getRelationshipRisks,
    getCustomersNeedingFollowUp,
    operatingEvidence,
    operatingRecommendationKey,
    normalizeRecommendation,
    calculateOperatingImportance,
    normalizeRecommendationAction,
    createRecommendationActionStore,
    filterOperatingRecommendations,
    buildTaskDraft,
    normalizeTaskLink,
    createTaskLinkStore,
    buildCustomerVisitTaskRecommendations,
    CustomerOperatingIntelligenceProvider,
    createCustomerOperatingIntelligenceProvider,
    getOperatingRecommendations,
    getPriorityCustomers,
    getRelationshipGaps,
    getCoverageGaps,
    getRecoveryOpportunities,
    getSuggestedActions,
    buildFixtureProfiles,
    buildProfilesFromAppData,
    defaultObservationMonth,
    profileMetrics,
    gradeDistances,
    deriveRiskFlags,
    mount
  };
});
