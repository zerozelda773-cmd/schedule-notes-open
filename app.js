const STORAGE_KEY = 'work-progress-desk-v1';
const SECTION_COLLAPSE_KEY = 'work-progress-section-collapse-v1';
const DEVELOPER_MODE_KEY = 'work-progress-developer-mode-v1';
const REMEMBERED_CLOUD_EMAIL_KEY = 'work-progress-cloud-email-v1';
const CUSTOMER_VISIT_CATEGORY = '客户拜访';
const LEGACY_CUSTOMER_CATEGORY = '重点客户追踪';
const CATEGORIES = ['活动申请', '培训', '课件制作', '销售数据分析', '医院信息维护', CUSTOMER_VISIT_CATEGORY, '其他'];
const SALES_HEADERS = ['日期', '办事处', '员工', '产品', '医院', '科室', '收货地址', '客户', '下单盒数', '销售金额', '拜访次数', '活动类型', '活动金额', '活动时长'];
const headerAliases = {
  date: ['日期', '时间', '下单时间', 'date'],
  office: ['办事处', '所属办事处', 'office'],
  employee: ['员工', '信息员', '负责人', '专员', '专员信息', '专员姓名', 'employee'],
  product: ['产品', '产品信息', '品种', 'product'],
  hospital: ['医院', 'Synthetic Hospital Example', '终端', 'hospital'],
  hospitalCode: ['医院编码', '终端编码', '编码', 'hospitalcode', 'code'],
  hospitalLevel: ['医院级别', '级别', 'hospitallevel'],
  department: ['科室', 'department'],
  customer: ['客户', '医生', '客户姓名', 'customer'],
  address: ['收货地址', '收货自提地址', '收货/自提地址', 'address'],
  departmentRoom: ['科室房号', '科室/房号', 'departmentroom'],
  orderBoxes: ['下单盒数', '盒数', '销量', '数量', 'orderboxes'],
  salesAmount: ['销售金额', '销售额', 'salesamount'],
  visitCount: ['拜访次数', '拜访数', '拜访', 'visitcount'],
  activityType: ['活动类型', '活动', 'activitytype'],
  activityCost: ['活动金额', '投入金额', '活动费用', 'activitycost'],
  activityHours: ['活动时长', '投入时间', '时间小时', 'activityhours'],
  activityId: ['活动编号', '申请编号', '请示编号', 'activityid']
};
const STAGE_DEFINITIONS = {
  '活动申请': [{
    label: '未申请',
    value: 0
  }, {
    label: '提交申请',
    value: 34
  }, {
    label: '执行活动',
    value: 67
  }, {
    label: '已核销',
    value: 100
  }],
  '培训': [{
    label: '待完成',
    value: 0
  }, {
    label: '已完成',
    value: 100
  }],
  '课件制作': [{
    label: '待完成',
    value: 0
  }, {
    label: '已完成',
    value: 100
  }],
  '销售数据分析': [{
    label: '待完成',
    value: 0
  }, {
    label: '已完成',
    value: 100
  }],
  '医院信息维护': [{
    label: '备案',
    value: 0
  }, {
    label: '信息登记',
    value: 50
  }, {
    label: '绑定',
    value: 100
  }],
  '客户拜访': [{
    label: '未拜访',
    value: 0
  }, {
    label: '已拜访',
    value: 100
  }],
  '其他': [{
    label: '待完成',
    value: 0
  }, {
    label: '已完成',
    value: 100
  }]
};
const PRODUCT_ALIASES = {
  "Primary Product A": "Primary Product A",
  "Primary Product B": "Primary Product B",
  "Auxiliary Product A": "Auxiliary Product A",
  "Auxiliary Product B": "Auxiliary Product B"
};
const CATEGORY_ALIASES = {
  活动申清: '活动申请',
  活动声请: '活动申请',
  培圳: '培训',
  课件制做: '课件制作',
  销售数据分折: '销售数据分析',
  医院信息围护: '医院信息维护',
  重点客户追踪: '客户拜访',
  重点客户跟踪: '客户拜访',
  客户追踪: '客户拜访'
};
const HOSPITAL_ALIAS_SUGGESTIONS = {};
const CUSTOMER_IMPORT_HEADERS = {
  office: ['办事处', '所属办事处'],
  employee: ['员工', '信息员', '专员', '专员姓名'],
  hospital: ['医院', 'Synthetic Hospital Example'],
  department: ['科室', '科室名称'],
  customer: ['客户', '医生', '客户姓名'],
  product: ['产品', '产品信息', '品种'],
  potential: ['潜力评估', '潜力', '床位'],
  awareness: ['产品知晓情况', '知晓情况', '产品认知']
};
const state = loadState();
let deferredInstallPrompt = null;
let selectedTaskDate = dateKey();
let taskDateScope = 'selected';
let taskExternalContext = null;
let dataComparisonMode = 'none';
let activeWheelSelect = null;
let activeWheelValue = '';
let activeMultiField = null;
let activeMultiSelections = new Set();
let dateDragStart = null;
let suppressDateClickUntil = 0;
let activeTaskSwipe = null;
let suppressTaskClickUntil = 0;
let compactProgressDrag = null;
let versionTapCount = 0;
let versionTapResetTimer = null;
let availableUpdateManifest = null;
let nativeUpdateState = '';
let customerUpgradePreview = null;
let salesImportPreview = null;
let planImportPreview = null;
let currentReportMaterial = null;
let dashboardPeriodMode = 'quarter';
let dashboardV2Filters = null;
let transientNavigationContext = null;
let dashboardNavigationNotice = '';
let activityController = null;
let workspaceNavigationController = null;
let currentWorkspace = 'tasks';
let taskSecondaryPage = '';
let pendingContextChoices = [];
let hospitalMaintenanceSyncScheduled = false;
let hospitalDirectoryCache = {
  hospitals: [],
  invalidRecords: []
};
let hospitalDirectoryCacheReady = false;
let hospitalDirectoryInputs = [];
let hospitalMaintenanceIssues = [];
const expandedTaskIds = new Set();
const expandedCustomerIds = new Set();
const SAFE_DIAGNOSTIC_KEY = 'work-progress-safe-diagnostics-v1';
function recordSafeDiagnostic(event, details = {}) {
  const allowed = ['requestId', 'stage', 'onlineStatus', 'networkType', 'status', 'errorType', 'message', 'size'];
  const safe = {
    event: String(event || 'UNKNOWN'),
    at: new Date().toISOString()
  };
  allowed.forEach(key => {
    if (details[key] !== undefined && details[key] !== null) safe[key] = String(details[key]).slice(0, 240);
  });
  try {
    const history = JSON.parse(localStorage.getItem(SAFE_DIAGNOSTIC_KEY) || '[]');
    localStorage.setItem(SAFE_DIAGNOSTIC_KEY, JSON.stringify([...history.slice(-79), safe]));
  } catch {}
  console.info('[safe-diagnostic]', safe);
}
window.recordSafeDiagnostic = recordSafeDiagnostic;
const $ = id => document.getElementById(id);
const els = {
  todayLabel: $('todayLabel'),
  briefingGrid: $('briefingGrid'),
  briefingList: $('briefingList'),
  dateStrip: $('dateStrip'),
  previousDateButton: $('previousDateButton'),
  nextDateButton: $('nextDateButton'),
  taskYearFilter: $('taskYearFilter'),
  taskMonthFilter: $('taskMonthFilter'),
  todayDateButton: $('todayDateButton'),
  themeToggleButton: $('themeToggleButton'),
  customerModuleButton: $('customerModuleButton'),
  salesModuleButton: $('salesModuleButton'),
  wheelPickerDialog: $('wheelPickerDialog'),
  wheelPickerTitle: $('wheelPickerTitle'),
  wheelPickerList: $('wheelPickerList'),
  wheelPickerConfirm: $('wheelPickerConfirm'),
  filterButton: $('filterButton'),
  filterDialog: $('filterDialog'),
  filterForm: $('filterForm'),
  categoryFilter: $('categoryFilter'),
  statusFilter: $('statusFilter'),
  markerFilter: $('markerFilter'),
  searchInput: $('searchInput'),
  taskSourceFilter: $('taskSourceFilter'),
  taskCanonicalStatusFilter: $('taskCanonicalStatusFilter'),
  taskExternalContext: $('taskExternalContext'),
  taskExternalContextText: $('taskExternalContextText'),
  clearTaskExternalContextButton: $('clearTaskExternalContextButton'),
  synonymSettingsButton: $('synonymSettingsButton'),
  synonymDialog: $('synonymDialog'),
  synonymForm: $('synonymForm'),
  synonymSource: $('synonymSource'),
  synonymTarget: $('synonymTarget'),
  synonymList: $('synonymList'),
  taskList: $('taskList'),
  taskCount: $('taskCount'),
  emptyState: $('emptyState'),
  tasksTitle: $('tasksTitle'),
  collapseAllTasksButton: $('collapseAllTasksButton'),
  tasksSection: $('tasksSection'),
  tasksSectionToggle: $('tasksSectionToggle'),
  tasksSectionBody: $('tasksSectionBody'),
  taskDialog: $('taskDialog'),
  taskForm: $('taskForm'),
  taskDialogTitle: $('taskDialogTitle'),
  taskId: $('taskId'),
  taskTitle: $('taskTitle'),
  taskCategory: $('taskCategory'),
  taskDue: $('taskDue'),
  taskDueWeekday: $('taskDueWeekday'),
  taskLocation: $('taskLocation'),
  taskProgress: $('taskProgress'),
  progressOutput: $('progressOutput'),
  taskUrgent: $('taskUrgent'),
  taskLongTerm: $('taskLongTerm'),
  taskNotes: $('taskNotes'),
  deleteTaskButton: $('deleteTaskButton'),
  taskOfficeEmployeeWrap: $('taskOfficeEmployeeWrap'),
  taskOfficeEmployee: $('taskOfficeEmployee'),
  taskOffice: $('taskOffice'),
  taskEmployee: $('taskEmployee'),
  taskHospitalDepartmentRow: $('taskHospitalDepartmentRow'),
  taskHospital: $('taskHospital'),
  taskDepartment: $('taskDepartment'),
  taskCustomer: $('taskCustomer'),
  taskProduct: $('taskProduct'),
  taskCustomerWrap: $('taskCustomerWrap'),
  taskProductWrap: $('taskProductWrap'),
  taskCustomerProfileFields: $('taskCustomerProfileFields'),
  taskCustomerJobTitle: $('taskCustomerJobTitle'),
  taskManagedBeds: $('taskManagedBeds'),
  taskCustomerType: $('taskCustomerType'),
  taskHospitalEntry: $('taskHospitalEntry'),
  taskDepartmentEntry: $('taskDepartmentEntry'),
  taskCustomerEntry: $('taskCustomerEntry'),
  taskHospitalChips: $('taskHospitalChips'),
  taskDepartmentChips: $('taskDepartmentChips'),
  taskCustomerChips: $('taskCustomerChips'),
  taskImageInput: $('taskImageInput'),
  recognizeTaskButton: $('recognizeTaskButton'),
  taskRecognitionStatus: $('taskRecognitionStatus'),
  taskCustomerExcelWrap: $('taskCustomerExcelWrap'),
  taskCustomerExcelInput: $('taskCustomerExcelInput'),
  taskCustomerExcelStatus: $('taskCustomerExcelStatus'),
  multiPickerDialog: $('multiPickerDialog'),
  multiPickerTitle: $('multiPickerTitle'),
  multiPickerSearch: $('multiPickerSearch'),
  multiPickerList: $('multiPickerList'),
  multiPickerCount: $('multiPickerCount'),
  multiPickerConfirm: $('multiPickerConfirm'),
  taskStagePicker: $('taskStagePicker'),
  taskWeeklyOutputWrap: $('taskWeeklyOutputWrap'),
  taskWeeklyOutput: $('taskWeeklyOutput'),
  taskWeeklyOutputWeek: $('taskWeeklyOutputWeek'),
  taskWeeklySlot: $('taskWeeklySlot'),
  taskHospitalLabel: $('taskHospitalLabel'),
  taskDepartmentLabel: $('taskDepartmentLabel'),
  taskCustomerLabel: $('taskCustomerLabel'),
  weeklyDialog: $('weeklyDialog'),
  weeklyForm: $('weeklyForm'),
  weeklyTaskSummary: $('weeklyTaskSummary'),
  weeklyNotes: $('weeklyNotes'),
  nextWeekTasks: $('nextWeekTasks'),
  weeklyStatus: $('weeklyStatus'),
  toast: $('toast'),
  installButton: $('installButton'),
  notificationButton: $('notificationButton'),
  importInput: $('importInput'),
  taskTab: $('taskTab'),
  activityTab: $('activityTab'),
  taskView: $('taskView'),
  customerView: $('customerView'),
  activityView: $('activityView'),
  dataView: $('dataView'),
  taskProgressV2: $('taskProgressV2'),
  primaryTodoButton: $('primaryTodoButton'),
  primaryActivityButton: $('primaryActivityButton'),
  primaryDatabaseButton: $('primaryDatabaseButton'),
  todoNavigationSheet: $('todoNavigationSheet'),
  databaseNavigationSheet: $('databaseNavigationSheet'),
  taskUtilityTitle: $('taskUtilityTitle'),
  taskUtilityToggle: $('taskUtilityToggle'),
  contextNavigationBar: $('contextNavigationBar'),
  contextNavigationBack: $('contextNavigationBack'),
  contextNavigationKind: $('contextNavigationKind'),
  contextNavigationTitle: $('contextNavigationTitle'),
  contextNavigationMeta: $('contextNavigationMeta'),
  contextChoiceDialog: $('contextChoiceDialog'),
  contextChoiceTitle: $('contextChoiceTitle'),
  contextChoiceHint: $('contextChoiceHint'),
  contextChoiceList: $('contextChoiceList'),
  customerProfileV1: $('customerProfileV1'),
  customerMonthFilter: $('customerMonthFilter'),
  customerKpis: $('customerKpis'),
  customerBoard: $('customerBoard'),
  customerEmpty: $('customerEmpty'),
  customerArchiveCount: $('customerArchiveCount'),
  hospitalArchiveSection: $('hospitalArchiveSection'),
  hospitalArchiveCount: $('hospitalArchiveCount'),
  hospitalArchiveBoard: $('hospitalArchiveBoard'),
  dashboardKpis: $('dashboardKpis'),
  dashboardEmpty: $('dashboardEmpty'),
  dashboardCharts: $('dashboardCharts'),
  dataPeriodMode: $('dataPeriodMode'),
  dataPeriodValue: $('dataPeriodValue'),
  dataOfficeFilter: $('dataOfficeFilter'),
  dataEmployeeFilter: $('dataEmployeeFilter'),
  dataProductFilter: $('dataProductFilter'),
  dataHospitalFilter: $('dataHospitalFilter'),
  salesTrendChart: $('salesTrendChart'),
  trendSummary: $('trendSummary'),
  trendTitle: $('trendTitle'),
  employeeContributionChart: $('employeeContributionChart'),
  activityEfficiencyChart: $('activityEfficiencyChart'),
  alignmentTableBody: $('alignmentTableBody'),
  departmentCustomerBody: $('departmentCustomerBody'),
  hospitalPotentialBody: $('hospitalPotentialBody'),
  dataSignals: $('dataSignals'),
  signalCount: $('signalCount'),
  dataSourceSummary: $('dataSourceSummary'),
  officeContributionChart: $('officeContributionChart'),
  productContributionChart: $('productContributionChart'),
  orderSizeChart: $('orderSizeChart'),
  addressContributionChart: $('addressContributionChart'),
  salesAnomalyList: $('salesAnomalyList'),
  anomalyPeriodLabel: $('anomalyPeriodLabel'),
  dashboardModuleControls: $('dashboardModuleControls'),
  dashboardModuleFilter: $('dashboardModuleFilter'),
  salesDrilldownDialog: $('salesDrilldownDialog'),
  salesDrilldownTitle: $('salesDrilldownTitle'),
  salesDrilldownSummary: $('salesDrilldownSummary'),
  salesDrilldownBody: $('salesDrilldownBody'),
  importDialog: $('importDialog'),
  importForm: $('importForm'),
  salesDataInput: $('salesDataInput'),
  salesDataPassword: $('salesDataPassword'),
  salesPasswordWrap: $('salesPasswordWrap'),
  salesDataPaste: $('salesDataPaste'),
  importResult: $('importResult'),
  salesImportPreview: $('salesImportPreview'),
  salesImportKpis: $('salesImportKpis'),
  salesImportProducts: $('salesImportProducts'),
  salesImportMonths: $('salesImportMonths'),
  salesImportDetailBody: $('salesImportDetailBody'),
  confirmSalesImportButton: $('confirmSalesImportButton'),
  cancelSalesImportPreview: $('cancelSalesImportPreview'),
  previewSalesImportButton: $('previewSalesImportButton'),
  planImportDialog: $('planImportDialog'),
  openPlanImportButton: $('openPlanImportButton'),
  planDataInput: $('planDataInput'),
  planDataPassword: $('planDataPassword'),
  planPasswordWrap: $('planPasswordWrap'),
  previewPlanImportButton: $('previewPlanImportButton'),
  confirmPlanImportButton: $('confirmPlanImportButton'),
  cancelPlanImportPreview: $('cancelPlanImportPreview'),
  planImportStatus: $('planImportStatus'),
  planImportPreview: $('planImportPreview'),
  planImportQualityKpis: $('planImportQualityKpis'),
  planCrossCheckStatus: $('planCrossCheckStatus'),
  planAnalysisPanel: $('planAnalysisPanel'),
  planFiscalYearFilter: $('planFiscalYearFilter'),
  planMonthFilter: $('planMonthFilter'),
  planProductFilter: $('planProductFilter'),
  planOfficeFilter: $('planOfficeFilter'),
  planEmployeeFilter: $('planEmployeeFilter'),
  planHospitalFilter: $('planHospitalFilter'),
  planDepartmentFilter: $('planDepartmentFilter'),
  planAnalysisKpis: $('planAnalysisKpis'),
  planEmployeeTargetChart: $('planEmployeeTargetChart'),
  planEmployeeRateChart: $('planEmployeeRateChart'),
  planMonthlyBody: $('planMonthlyBody'),
  planHospitalBody: $('planHospitalBody'),
  planCustomerBody: $('planCustomerBody'),
  planResourceTags: $('planResourceTags'),
  planReasonTags: $('planReasonTags'),
  planTagCorrectionBody: $('planTagCorrectionBody'),
  cloudButton: $('cloudButton'),
  cloudAccountEntryButton: $('cloudAccountEntryButton'),
  manualUpdateEntryButton: $('manualUpdateEntryButton'),
  cloudDialog: $('cloudDialog'),
  cloudDialogStatus: $('cloudDialogStatus'),
  cloudEmail: $('cloudEmail'),
  cloudPassword: $('cloudPassword'),
  cloudSignUpButton: $('cloudSignUpButton'),
  toggleCloudPassword: $('toggleCloudPassword'),
  rememberCloudAccount: $('rememberCloudAccount'),
  rememberCloudPassword: $('rememberCloudPassword'),
  cloudCredentialHint: $('cloudCredentialHint'),
  cloudSignInButton: $('cloudSignInButton'),
  cloudSyncButton: $('cloudSyncButton'),
  cloudOfflineButton: $('cloudOfflineButton'),
  cloudSignOutButton: $('cloudSignOutButton'),
  cloudHealthStatus: $('cloudHealthStatus'),
  cloudHealthCheckButton: $('cloudHealthCheckButton'),
  cloudHealthLastSuccess: $('cloudHealthLastSuccess'),
  cloudHealthLastCheck: $('cloudHealthLastCheck'),
  cloudHealthHint: $('cloudHealthHint'),
  developerOptions: $('developerOptions'),
  developerCloudEndpoint: $('developerCloudEndpoint'),
  developerConnectionStatus: $('developerConnectionStatus'),
  saveDeveloperEndpointButton: $('saveDeveloperEndpointButton'),
  testDeveloperEndpointButton: $('testDeveloperEndpointButton'),
  restoreDefaultEndpointButton: $('restoreDefaultEndpointButton'),
  appVersionButton: $('appVersionButton'),
  checkUpdateButton: $('checkUpdateButton'),
  updateCheckStatus: $('updateCheckStatus'),
  updateAvailable: $('updateAvailable'),
  availableVersion: $('availableVersion'),
  releaseNotes: $('releaseNotes'),
  downloadUpdateButton: $('downloadUpdateButton'),
  updateDownloadProgress: $('updateDownloadProgress'),
  updateDownloadStatus: $('updateDownloadStatus'),
  reportDialog: $('reportDialog'),
  reportFiscalYear: $('reportFiscalYear'),
  reportFiscalQuarter: $('reportFiscalQuarter'),
  reportProduct: $('reportProduct'),
  reportReferenceDate: $('reportReferenceDate'),
  reportGenerationStatus: $('reportGenerationStatus'),
  reportSummary: $('reportSummary'),
  reportMaterialGrid: $('reportMaterialGrid'),
  generateReportButton: $('generateReportButton'),
  downloadReportButton: $('downloadReportButton'),
  dataManagementDialog: $('dataManagementDialog'),
  dashboardReferenceDate: $('dashboardReferenceDate'),
  dashboardMetricBadge: $('dashboardMetricBadge'),
  openCustomerUpgradeManager: $('openCustomerUpgradeManager'),
  customerUpgradeDialog: $('customerUpgradeDialog'),
  customerUpgradeProduct: $('customerUpgradeProduct'),
  customerUpgradeFiscalYear: $('customerUpgradeFiscalYear'),
  customerUpgradeMonth: $('customerUpgradeMonth'),
  customerUpgradeExcel: $('customerUpgradeExcel'),
  customerUpgradePreviewStatus: $('customerUpgradePreviewStatus'),
  customerUpgradePreviewWrap: $('customerUpgradePreviewWrap'),
  customerUpgradePreviewBody: $('customerUpgradePreviewBody'),
  cancelCustomerUpgradePreview: $('cancelCustomerUpgradePreview'),
  confirmCustomerUpgradeImport: $('confirmCustomerUpgradeImport'),
  customerUpgradeManualForm: $('customerUpgradeManualForm'),
  customerUpgradePlanCount: $('customerUpgradePlanCount'),
  customerUpgradePlanList: $('customerUpgradePlanList'),
  upgradeOffice: $('upgradeOffice'),
  upgradeEmployee: $('upgradeEmployee'),
  upgradeHospital: $('upgradeHospital'),
  upgradeDepartment: $('upgradeDepartment'),
  upgradeCustomer: $('upgradeCustomer'),
  upgradePerception: $('upgradePerception'),
  upgradeSalesGrade: $('upgradeSalesGrade'),
  upgradeJuneActual: $('upgradeJuneActual'),
  upgradeJulyActual: $('upgradeJulyActual'),
  upgradeNextTarget: $('upgradeNextTarget'),
  upgradeAcademicInvestment: $('upgradeAcademicInvestment'),
  upgradeProblem: $('upgradeProblem'),
  upgradeFollowUp: $('upgradeFollowUp'),
  upgradeStatus: $('upgradeStatus'),
  upgradeNotes: $('upgradeNotes'),
  salesDashboardV2: $('salesDashboardV2'),
  smartSheetStatusText: $('smartSheetStatusText'),
  smartSheetStatusBadge: $('smartSheetStatusBadge'),
  smartSheetCorpId: $('smartSheetCorpId'),
  smartSheetSheetId: $('smartSheetSheetId'),
  saveSmartSheetConfigButton: $('saveSmartSheetConfigButton'),
  dataSourceDetail: $('dataSourceDetail'),
  dashboardV1Kpis: $('dashboardV1Kpis'),
  dashboardV1Insights: $('dashboardV1Insights'),
  dashboardV1Charts: $('dashboardV1Charts'),
  dashboardV1Alerts: $('dashboardV1Alerts'),
  dashboardV1AlertCount: $('dashboardV1AlertCount'),
  salesTargetInput: $('salesTargetInput'),
  salesTargetLabel: $('salesTargetLabel'),
  saveSalesTargetButton: $('saveSalesTargetButton'),
  salesTargetFiscalYear: $('salesTargetFiscalYear'),
  salesTargetProduct: $('salesTargetProduct'),
  salesTargetOffice: $('salesTargetOffice'),
  salesTargetMonths: $('salesTargetMonths'),
  averageSalesTargetButton: $('averageSalesTargetButton'),
  copyPreviousSalesTargetButton: $('copyPreviousSalesTargetButton'),
  salesTargetStatus: $('salesTargetStatus')
};
function loadState() {
  try {
    const parsed = window.DepartmentIdentity.migrate(window.HospitalIdentity.migrate(JSON.parse(window.WorkDeskPersistence.storage.getItem(STORAGE_KEY))));
    if (parsed && Array.isArray(parsed.tasks)) {
      const loaded = {
        reviews: [],
        records: [],
        customerUpgradePlans: [],
        employeePlanRecords: [],
        activities: [],
        activityLedgerEntries: [],
        tombstones: [],
        settings: {},
        meta: {},
        ...parsed,
        tasks: normalizeCustomerVisitTasks(parsed.tasks)
      };
      [...loaded.tasks].filter(task => task.cancelledBy === 'recommendation_withdrawal' && task.status === 'cancelled').forEach(task => withdrawRecommendationExecution(loaded, task, task.withdrawnAt || task.updatedAt));
      return loaded;
    }
  } catch (error) {
    if (window.WorkDeskPersistence.native) window.WorkDeskPersistence.fail(error);
    console.warn('无法读取本地数据', error);
  }
  return {
    tasks: [],
    reviews: [],
    records: [],
    customerUpgradePlans: [],
    employeePlanRecords: [],
    activities: [],
    activityLedgerEntries: [],
    tombstones: [],
    settings: {},
    meta: {}
  };
}
function normalizeCustomerVisitTasks(tasks = []) {
  return tasks.map(task => {
    if (task.category !== LEGACY_CUSTOMER_CATEGORY) return task;
    return {
      ...task,
      category: CUSTOMER_VISIT_CATEGORY,
      progress: task.completedAt ? 100 : 0
    };
  });
}
function persist({
  skipCloud = false,
  snapshot = state,
  identityValidated = false
} = {}) {
  hospitalDirectoryCacheReady = false;
  if (!identityValidated) window.DepartmentIdentity.migrate(window.HospitalIdentity.migrate(snapshot));
  snapshot.meta = {
    ...(snapshot.meta || {}),
    updatedAt: new Date().toISOString()
  };
  const committed = window.WorkDeskPersistence.saveState(snapshot);
  if (committed?.then) {
    committed.then(() => {
      if (!skipCloud) window.workDeskCloud?.scheduleSync();
    }, () => {});
    return committed;
  }
  if (!skipCloud) window.workDeskCloud?.scheduleSync();
}
function storedSectionCollapse() {
  try {
    return JSON.parse(localStorage.getItem(SECTION_COLLAPSE_KEY)) || {};
  } catch {
    return {};
  }
}
function setSectionCollapsed(name, collapsed, {
  save = true
} = {}) {
  const section = els.tasksSection;
  const toggle = els.tasksSectionToggle;
  if (!section || !toggle) return;
  section.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', `${collapsed ? '展开' : '收起'}任务清单`);
  if (save) localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify({
    ...storedSectionCollapse(),
    [name]: collapsed
  }));
}
function restoreSectionCollapse() {
  const stored = storedSectionCollapse();
  setSectionCollapsed('tasks', stored.tasks === true, {
    save: false
  });
}
function toggleSectionCollapse(name) {
  const section = els.tasksSection;
  setSectionCollapsed(name, !section.classList.contains('is-collapsed'));
}
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function isRecommendationTask(task) {
  return Boolean(task?.sourceRecommendationKey && (task.sourceType === 'customer' && task.taskType === 'customer_visit' && task.customerId && task.sourceId === task.customerId || task.sourceType === 'hospital' && task.sourceRecommendationType === 'hospital-maintenance' && task.hospitalId && task.sourceId === task.hospitalId));
}
function canWithdrawRecommendationTask(task) {
  return isRecommendationTask(task) && !['completed', 'cancelled'].includes(normalizedTask(task).status) && !task.completedAt && Number(task.progress || 0) < 100;
}
function withdrawRecommendationExecution(data, task, withdrawnAt = new Date().toISOString()) {
  if (!isRecommendationTask(task) || task.status === 'completed' || task.completedAt || Number(task.progress) >= 100) return false;
  const snapshot = {
    ...task,
    status: 'cancelled',
    cancelledBy: 'recommendation_withdrawal',
    recommendationStatus: 'WITHDRAWN',
    withdrawnAt,
    updatedAt: withdrawnAt
  };
  data.tombstones = Array.isArray(data.tombstones) ? data.tombstones : [];
  if (!data.tombstones.some(record => record.kind === 'task' && record.id === task.id)) data.tombstones.push({
    key: `task:${task.id}`,
    kind: 'task',
    id: task.id,
    deletedAt: withdrawnAt,
    withdrawnAt,
    reason: 'recommendation_withdrawal',
    sourceRecommendationKey: task.sourceRecommendationKey,
    recommendationId: task.sourceRecommendationId || task.recommendationId || task.sourceRecommendationKey,
    taskSnapshot: snapshot
  });
  data.tasks = data.tasks.filter(entry => entry.id !== task.id);
  return true;
}
function customerTaskAuditRecord(taskId) {
  return state.tasks.find(task => String(task.taskId || task.id) === String(taskId)) || (state.tombstones || []).find(record => record.kind === 'task' && record.reason === 'recommendation_withdrawal' && String(record.id) === String(taskId))?.taskSnapshot;
}
function customerTaskBridgeClone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}
function customerTaskBridgeStatus(task) {
  if (!task) return 'not_found';
  if (task.status === 'cancelled' || task.status === 'canceled' || task.deletedAt) return 'cancelled';
  if (task.status === 'completed' || task.completedAt || Number(task.progress) >= 100) return 'completed';
  return 'active';
}
window.CustomerTaskBridge = Object.freeze({
  createTaskFromRecommendation(draft = {}) {
    if (draft.confirmed !== true) throw new Error('必须人工确认任务草稿后才能创建任务');
    if (!draft.recommendationKey || !draft.customerId || draft.sourceType !== 'customer' || draft.sourceId !== draft.customerId || draft.taskType !== 'customer_visit') throw new Error('任务草稿缺少稳定客户来源字段');
    if (draft.product && !["Primary Product A", "Primary Product B", "Auxiliary Product A", "Auxiliary Product B"].includes(draft.product)) throw new Error('任务产品必须为空或为已配置产品');
    const duplicate = this.isDuplicateTask(draft);
    if (duplicate) throw new Error('该建议已存在进行中的任务');
    const dueDate = String(draft.dueDate || '').slice(0, 10);
    const values = {
      title: String(draft.title || '').trim(),
      description: String(draft.description || '').trim(),
      notes: String(draft.description || '').trim(),
      status: 'pending',
      dueDate: dueDate ? `${dueDate}T09:00` : '',
      due: dueDate ? `${dueDate}T09:00` : '',
      owner: String(draft.owner || '').trim(),
      employee: String(draft.owner || '').trim(),
      category: CUSTOMER_VISIT_CATEGORY,
      progress: 0,
      urgent: draft.priority === 'high',
      longTerm: true,
      location: '',
      office: '',
      visitIntervalDays: Number(draft.visitIntervalDays) || null,
      recommendationId: String(draft.recommendationId || draft.recommendationKey),
      strategy: String(draft.strategy || ''),
      suggestedInterval: Number(draft.suggestedInterval) || null,
      visitPlanEvidence: draft.evidence || {},
      recommendationStatus: 'ACCEPTED',
      hospital: String(draft.hospital || ''),
      department: String(draft.department || ''),
      customer: String(draft.customerName || ''),
      customerId: String(draft.customerId),
      hospitalId: String(draft.hospitalId || ''),
      departmentId: String(draft.departmentId || ''),
      employeeId: String(draft.employeeId || ''),
      product: draft.product || '',
      weeklyOutputs: {},
      sourceType: 'customer',
      sourceId: String(draft.customerId),
      taskType: 'customer_visit',
      recommended: true,
      autoGenerated: false,
      priority: ['high', 'normal', 'low'].includes(draft.priority) ? draft.priority : 'normal',
      sourceRecommendationKey: String(draft.recommendationKey),
      sourceRecommendationId: String(draft.recommendationId || draft.recommendationKey),
      sourceSignalType: String(draft.sourceSignalType || ''),
      sourceRecommendationCustomerId: String(draft.customerId),
      sourceRecommendationProduct: draft.product || '',
      sourcePriority: String(draft.sourcePriority || ''),
      recommendedActionType: String(draft.recommendedActionType || 'OTHER'),
      recommendationReason: [...(draft.recommendationReason || [])].slice(0, 3),
      recommendationExplanation: String(draft.recommendationExplanation || ''),
      recommendationEvidence: [...(draft.recommendationEvidence || [])].slice(0, 3).map(item => ({
        ...item
      })),
      customerGrade: String(draft.customerGrade || ''),
      lastFollowUpAt: String(draft.lastFollowUpAt || ''),
      currentDevelopmentStatus: String(draft.currentDevelopmentStatus || ''),
      nextAction: String(draft.nextAction || ''),
      nextActionDate: String(draft.nextActionDate || ''),
      visitGoal: String(draft.visitGoal || ''),
      evidenceSnapshot: (draft.evidenceSnapshot || []).slice(0, 5).map(item => ({
        evidenceId: String(item.evidenceId || ''),
        type: String(item.type || ''),
        label: String(item.label || ''),
        value: String(item.value || ''),
        sourceId: String(item.sourceId || ''),
        sourceType: String(item.sourceType || ''),
        observedAt: String(item.observedAt || '')
      }))
    };
    if (!values.title || !values.description || !draft.nativeVisitEditor && !values.dueDate || !values.evidenceSnapshot.length) throw new Error('任务草稿缺少标题、说明、截止日期或证据快照');
    const task = saveNativeTaskRecord(values);
    persist();
    render();
    showToast('经营建议已转为任务');
    return customerTaskBridgeClone(task);
  },
  getTask(taskId) {
    return customerTaskBridgeClone(customerTaskAuditRecord(taskId));
  },
  getTaskStatus(taskId) {
    return customerTaskBridgeStatus(customerTaskAuditRecord(taskId));
  },
  findLinkedTask(recommendationKey) {
    const linked = state.tasks.filter(task => task.sourceRecommendationKey === recommendationKey).sort((left, right) => (customerTaskBridgeStatus(left) === 'active' ? -1 : 1) || String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))[0];
    return customerTaskBridgeClone(linked);
  },
  isDuplicateTask(draft = {}) {
    const customerId = String(draft.customerId || draft.sourceId || '');
    return customerTaskBridgeClone(state.tasks.find(task => customerTaskBridgeStatus(task) === 'active' && (task.sourceRecommendationKey === draft.recommendationKey || customerId && task.sourceType === 'customer' && task.taskType === 'customer_visit' && String(task.customerId || task.sourceId || '') === customerId)));
  },
  completeTaskFromFollowUp(followUp = {}) {
    const sourceTaskId = String(followUp.sourceTaskId || '');
    if (!sourceTaskId) throw new Error('跟进记录缺少 sourceTaskId');
    const task = state.tasks.find(item => String(item.taskId || item.id) === sourceTaskId);
    if (!task) throw new Error('sourceTaskId 对应任务不存在');
    if (task.sourceType !== 'customer' || task.taskType !== 'customer_visit' || String(task.customerId || '') !== String(followUp.customerId || '')) throw new Error('跟进记录与任务 customerId 不一致');
    if ((task.product || '') !== (followUp.product || '')) throw new Error('跟进记录与任务产品上下文不一致');
    if (customerTaskBridgeStatus(task) === 'completed') return {
      ...customerTaskBridgeClone(task),
      alreadyCompleted: true
    };
    const now = new Date().toISOString();
    task.progress = 100;
    task.status = 'completed';
    task.completedAt = now;
    task.updatedAt = now;
    task.completedByFollowUpId = String(followUp.followUpId || '');
    task.followUpId = String(followUp.followUpId || '');
    persist();
    render();
    showToast('跟进已保存，对应客户任务已完成');
    return {
      ...customerTaskBridgeClone(task),
      alreadyCompleted: false
    };
  },
  openTask(taskId) {
    const task = state.tasks.find(item => String(item.taskId || item.id) === String(taskId));
    if (!task) return false;
    switchView('tasks');
    if (window.taskProgressV2App?.openTaskDetails?.(task.id)) return true;
    openTask(task);
    return true;
  }
});
function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  })[char]);
}
function lineIcon(name, className = '') {
  const shapes = {
    all: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    doing: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    done: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
    category: '<path d="M3.5 7.5h6l2-2h9v13h-17z"/><path d="M3.5 9.5h17"/>',
    marker: '<path d="M6 21V4m0 1h10l-1.8 3L16 11H6"/>',
    activity: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-9 4h5m-5 3h3"/>',
    training: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22z"/><path d="M4 5.5V22m5-15h7m-7 4h7"/>',
    analysis: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    hospital: '<path d="M5 21V5h14v16M9 5V2h6v3m-3 4v6m-3-3h6M8 21v-3h8v3"/>',
    customer: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    delete: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
    other: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6V7H9zm0 8h6m-6 4h6"/>'
  };
  return `<svg class="line-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[name] || shapes.other}</svg>`;
}
function taskCategoryIcon(category) {
  const names = {
    活动申请: 'activity',
    培训: 'training',
    课件制作: 'training',
    销售数据分析: 'analysis',
    医院信息维护: 'hospital',
    客户拜访: 'customer',
    其他: 'other'
  };
  return lineIcon(names[category] || 'other', 'task-category-icon');
}
function compactText(value = '') {
  return String(value).replace(/[\s_()（）/\\·,，.。;；:\-]+/g, '').toLowerCase();
}
function canonicalDepartmentRows(rows) {
  const resolver = window.DepartmentIdentity.createResolver(state.settings?.departmentIdentityRegistry || []);
  return rows.map(row => {
    const hospitalId = window.HospitalIdentity.resolve(row.hospitalId || '', row.hospital || row.hospitalName);
    const name = row.department || row.departmentName || row.departmentRoom || '';
    if (!hospitalId || !name) return {
      ...row,
      hospitalId
    };
    if (window.DepartmentIdentity.idsOf(row).length > 1) return {
      ...row,
      hospitalId,
      departmentId: '',
      departmentIds: window.DepartmentIdentity.idsOf(row)
    };
    const match = resolver.match(name, {
      hospitalId,
      departmentId: row.departmentId
    });
    if (match.departmentIds?.length > 1) return {
      ...row,
      hospitalId,
      departmentId: '',
      departmentIds: match.departmentIds,
      departmentProvenance: match.provenance
    };
    const identity = match.status === 'EXACT' ? match : window.DepartmentIdentity.normalize({
      hospitalId,
      department: name,
      departmentId: row.departmentId,
      aliases: row.departmentAliases,
      provenance: row.departmentProvenance,
      sourceDepartmentId: row.sourceDepartmentId
    });
    return {
      ...row,
      hospitalId,
      departmentId: match.status === 'AMBIGUOUS' ? row.departmentId : identity.departmentId,
      departmentAliases: identity.aliases,
      legacyDepartmentIds: identity.legacyIds,
      departmentProvenance: identity.provenance,
      departmentMatchingQuality: match.matchingQuality
    };
  });
}
function directoryRecords() {
  const rows = [...(Array.isArray(window.WORK_PROGRESS_DIRECTORY) ? window.WORK_PROGRESS_DIRECTORY : []), ...(state.settings.departmentIdentityRegistry || []).map(row => ({
    ...row,
    department: row.canonicalName,
    departmentAliases: row.aliases,
    hospital: (window.WORK_PROGRESS_HOSPITAL_MASTER?.hospitals || []).find(h => h.hospitalId === row.hospitalId)?.canonicalName || ''
  })), ...state.records, ...(state.settings?.hospitalMappingRows || []), ...(state.activityLedgerEntries || []), ...(window.customerProfileV1App?.getMasterRecords?.() || []).map(record => ({
    office: '',
    employee: record.employee,
    hospital: record.hospital,
    hospitalId: record.hospitalId,
    department: record.department,
    departmentId: record.departmentId,
    departmentIds: record.departmentIds,
    customer: record.customerName,
    customerId: record.customerId
  }))];
  const unique = new Map();
  canonicalDepartmentRows(rows).forEach(row => {
    const item = {
      office: String(row.office || '').trim(),
      employee: String(row.employee || '').trim(),
      hospital: String(row.hospital || '').trim(),
      hospitalId: String(row.hospitalId || '').trim(),
      purchaseUnitId: String(row.purchaseUnitId || row['购进单位ID'] || '').trim(),
      hospitalCode: String(row.hospitalCode || row.purchaseUnitId || row.code || '').trim(),
      hospitalLevel: String(row.hospitalLevel || row.level || '').trim(),
      department: String(row.department || row.departmentRoom || '').trim(),
      departmentId: String(row.departmentId || '').trim(),
      departmentAliases: row.departmentAliases || [],
      legacyDepartmentIds: row.legacyDepartmentIds || [],
      departmentProvenance: row.departmentProvenance,
      customer: String(row.customer || '').trim(),
      customerId: String(row.customerId || '').trim(),
      product: String(row.product || '').trim()
    };
    const key = [item.office, item.employee, item.hospital, item.department, item.customer, item.product].join('\u001f');
    if (key.replaceAll('\u001f', '')) unique.set(key, item);
  });
  return [...unique.values()];
}
function hospitalDirectorySourceRows() {
  const masterRows = window.customerProfileV1App?.getMasterRecords?.() || [];
  return [...(window.WORK_PROGRESS_HOSPITAL_MASTER?.hospitals || []).map(h => ({
    ...h,
    hospital: h.canonicalName
  })), ...(Array.isArray(window.WORK_PROGRESS_DIRECTORY) ? window.WORK_PROGRESS_DIRECTORY : []), ...(state.settings.departmentIdentityRegistry || []).map(row => ({
    ...row,
    department: row.canonicalName,
    departmentAliases: row.aliases,
    hospital: (window.WORK_PROGRESS_HOSPITAL_MASTER?.hospitals || []).find(h => h.hospitalId === row.hospitalId)?.canonicalName || ''
  })), ...state.records, ...(state.settings?.hospitalMappingRows || []), ...(state.activityLedgerEntries || []), ...masterRows.map(record => ({
    hospitalId: record.hospitalId,
    hospital: record.hospital,
    departmentId: record.departmentId,
    departmentIds: record.departmentIds,
    department: record.department,
    employee: record.employee,
    owner: record.owner,
    active: record.active,
    source: record.source || 'CUSTOMER_MASTER'
  }))];
}
function hospitalDirectorySnapshot({
  refresh = false
} = {}) {
  if (!window.HospitalMaintenanceAdapter) return {
    hospitals: [],
    invalidRecords: []
  };
  const inputs = [state.records, state.records.length, state.activityLedgerEntries, state.activityLedgerEntries.length, state.settings.hospitalMappingRows, state.settings.hospitalMappingRows?.length, state.settings.departmentIdentityRegistry, window.customerProfileV1App?.getMasterRecords?.().map(row => row.customerId + ':' + row.updatedAt).join('|') || ''];
  inputs.push(JSON.stringify(state.settings.hospitalDirectoryOverrides || {}));
  if (hospitalDirectoryCacheReady && !refresh && inputs.every((value, index) => value === hospitalDirectoryInputs[index])) return hospitalDirectoryCache;
  hospitalDirectoryInputs = inputs;
  hospitalDirectoryCache = window.HospitalMaintenanceAdapter.buildHospitalDirectory(canonicalDepartmentRows(hospitalDirectorySourceRows()).flatMap(row => {
    const ids = window.DepartmentIdentity.idsOf(row);
    if (ids.length < 2) return [row];
    return ids.map(id => {
      const entity = (state.settings.departmentIdentityRegistry || []).find(item => item.departmentId === id && item.hospitalId === row.hospitalId);
      return {
        ...row,
        departmentId: id,
        departmentIds: [id],
        department: entity?.canonicalName || '',
        departmentAliases: entity?.aliases || []
      };
    });
  }), state.settings?.hospitalDirectoryOverrides || {}, {
    tombstones: state.tombstones
  });
  hospitalDirectoryCacheReady = true;
  return hospitalDirectoryCache;
}
function syncHospitalMaintenanceTasks({
  now = new Date().toISOString()
} = {}) {
  if (!window.HospitalMaintenanceAdapter) return {
    changed: false,
    tasks: state.tasks,
    issues: []
  };
  const directory = hospitalDirectorySnapshot();
  hospitalMaintenanceIssues = window.HospitalMaintenanceAdapter.buildHospitalMaintenanceIssues(directory.hospitals, {
    now
  });
  let changed = false;
  for (const task of state.tasks) {
    if (!window.HospitalMaintenanceAdapter.isHospitalMaintenanceTask(task) || !task.maintenanceManaged && task.sourceRecommendationKey) continue;
    task.sourceRecommendationKey = task.sourceRecommendationKey || `hospital-maintenance:${task.hospitalId}`;
    task.sourceRecommendationType = 'hospital-maintenance';
    task.sourceRecommendationHospitalId = task.sourceRecommendationHospitalId || task.hospitalId;
    delete task.maintenanceManaged;
    changed = true;
  }
  return {
    changed,
    tasks: state.tasks,
    issues: hospitalMaintenanceIssues
  };
}
function scheduleHospitalMaintenanceSync() {
  if (hospitalMaintenanceSyncScheduled) return;
  hospitalMaintenanceSyncScheduled = true;
  queueMicrotask(() => {
    hospitalMaintenanceSyncScheduled = false;
    const result = syncHospitalMaintenanceTasks();
    if (!result.changed) return;
    persist();
    render();
  });
}
function saveHospitalDirectoryMaintenance(payload = {}) {
  const hospitalId = String(payload.hospitalId || '').trim();
  const snapshot = hospitalDirectorySnapshot();
  const hospital = snapshot.hospitals.find(item => String(item.hospitalId) === hospitalId);
  if (!hospital) throw new Error('未找到对应医院主档案，未保存任何修改');
  const now = new Date().toISOString();
  const current = state.settings?.hospitalDirectoryOverrides || {};
  const hospitals = {
    ...(current.hospitals || {})
  };
  const departments = {
    ...(current.departments || {})
  };
  hospitals[hospitalId] = {
    ...(hospitals[hospitalId] || {}),
    hospitalCode: String(payload.hospitalCode ?? '').trim(),
    hospitalLevel: String(payload.hospitalLevel ?? '').trim(),
    office: String(payload.office ?? '').trim(),
    owner: String(payload.owner ?? '').trim(),
    updatedAt: now
  };
  const allowedDepartments = new Set(hospital.departments.map(item => item.departmentId));
  (payload.departments || []).forEach(department => {
    const departmentId = String(department.departmentId || '').trim();
    if (!allowedDepartments.has(departmentId)) return;
    departments[departmentId] = {
      ...(departments[departmentId] || {}),
      director: String(department.director ?? '').trim(),
      updatedAt: now
    };
  });
  state.settings = {
    ...(state.settings || {}),
    hospitalDirectoryOverrides: {
      hospitals,
      departments,
      updatedAt: now
    }
  };
  const result = syncHospitalMaintenanceTasks({
    now
  });
  persist();
  window.taskProgressV2App?.update({
    tasks: state.tasks
  });
  showToast('医院 / 科室资料已保存，维护建议已更新');
  return result;
}
function displayOffice(office = '') {
  return String(office).trim().replace(/^太原([一二三四五六七八九十])部$/, '太原$1办').replace(/([一二三四五六七八九十])部$/, '$1办');
}
function officeEmployeeChoices() {
  const unique = new Map();
  directoryRecords().forEach(({
    office,
    employee
  }) => {
    if (!employee) return;
    const value = `${displayOffice(office)}${employee}`;
    unique.set(compactText(value), {
      value,
      office,
      employee
    });
  });
  return [...unique.values()].sort((a, b) => a.value.localeCompare(b.value, 'zh-CN'));
}
function syncOfficeEmployeeInput(rawValue = els.taskOfficeEmployee.value) {
  const normalized = compactText(rawValue);
  const choices = officeEmployeeChoices();
  let match = choices.find(choice => compactText(choice.value) === normalized);
  if (!match) match = choices.find(choice => normalized === compactText(choice.employee) || normalized.endsWith(compactText(choice.employee)));
  if (match) {
    els.taskOfficeEmployee.value = match.value;
    els.taskOffice.value = match.office;
    els.taskEmployee.value = match.employee;
    return match;
  }
  els.taskOffice.value = '';
  els.taskEmployee.value = String(rawValue || '').trim();
  return null;
}
function editDistance(left, right) {
  const a = [...compactText(left)];
  const b = [...compactText(right)];
  const row = Array.from({
    length: b.length + 1
  }, (_, index) => index);
  a.forEach((char, i) => {
    let previous = row[0];
    row[0] = i + 1;
    b.forEach((other, j) => {
      const saved = row[j + 1];
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, previous + (char === other ? 0 : 1));
      previous = saved;
    });
  });
  return row[b.length];
}
function closestPreset(value, options, aliases = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const alias = aliases[raw] || aliases[compactText(raw)];
  if (alias) return alias;
  const exact = options.find(option => compactText(option) === compactText(raw));
  if (exact) return exact;
  const ranked = options.map(option => ({
    option,
    distance: editDistance(raw, option)
  })).sort((a, b) => a.distance - b.distance || a.option.length - b.option.length);
  const best = ranked[0];
  const limit = Math.max([...compactText(raw)].length, [...compactText(best?.option || '')].length) <= 4 ? 1 : 2;
  return best && best.distance <= limit ? best.option : raw;
}
function productOptions() {
  return [...new Set([...Object.values(PRODUCT_ALIASES), ...directoryRecords().map(row => row.product).filter(Boolean).flatMap(value => splitMultiValues(value.replaceAll('/', '、')))])];
}
function customSynonyms() {
  return state.settings.customSynonyms || {};
}
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function applyCustomSynonyms(value) {
  let result = String(value || '');
  Object.entries(customSynonyms()).sort((a, b) => b[0].length - a[0].length).forEach(([source, target]) => {
    if (!source || !target) return;
    result = result.replace(new RegExp(escapeRegex(source), /[a-z]/i.test(source) ? 'gi' : 'g'), target);
  });
  return result;
}
function normalizeProduct(value) {
  const corrected = applyCustomSynonyms(value).replace(/bai\s*fu\s*pai/gi, "Primary Product A").replace(/guan\s*fu\s*pai/gi, "Primary Product B");
  return splitMultiValues(String(corrected || '').replaceAll('/', '、')).map(item => closestPreset(item, productOptions(), PRODUCT_ALIASES)).join('、');
}
function knownHospitals() {
  return [...new Set(directoryRecords().map(row => row.hospital).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
function hospitalAliasSuggestion(alias) {
  if (HOSPITAL_ALIAS_SUGGESTIONS[alias]) return HOSPITAL_ALIAS_SUGGESTIONS[alias];
  const normalized = compactText(alias);
  const hospitals = knownHospitals();
  const exact = hospitals.find(hospital => compactText(hospital) === normalized);
  if (exact) return '';
  if (alias.length > 9 || /医院|中心|附属|卫生院|院区$/.test(alias)) return '';
  const scored = hospitals.map(hospital => {
    const chars = new Set([...normalized]);
    const overlap = [...new Set([...compactText(hospital)])].filter(char => chars.has(char)).length;
    return {
      hospital,
      score: overlap / Math.max(1, chars.size)
    };
  }).sort((a, b) => b.score - a.score || a.hospital.length - b.hospital.length);
  return scored[0]?.score >= 0.72 ? scored[0].hospital : '';
}
function resolveHospitalAlias(value, ask = true) {
  const alias = String(value || '').trim();
  if (!alias) return '';
  const custom = customSynonyms()[alias];
  if (custom) return custom;
  const decisions = state.settings.hospitalAliasDecisions || {};
  if (Object.prototype.hasOwnProperty.call(decisions, alias)) return decisions[alias] || alias;
  if (knownHospitals().some(hospital => compactText(hospital) === compactText(alias))) return closestPreset(alias, knownHospitals());
  const suggestion = hospitalAliasSuggestion(alias);
  if (!suggestion || !ask) return alias;
  const accepted = confirm(`“${alias}”可能是医院简称，是否更正为“${suggestion}”？`);
  state.settings.hospitalAliasDecisions = {
    ...decisions,
    [alias]: accepted ? suggestion : null
  };
  state.settings.settingsUpdatedAt = new Date().toISOString();
  persist();
  return accepted ? suggestion : alias;
}
function normalizeRecognizedHospital(value) {
  const raw = String(value || '').trim();
  const matched = closestPreset(raw, knownHospitals());
  return compactText(matched) !== compactText(raw) ? matched : resolveHospitalAlias(raw);
}
function applyTheme(theme = state.settings.theme || 'light') {
  const selected = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selected;
  if (els.themeToggleButton) {
    els.themeToggleButton.textContent = selected === 'dark' ? '☀ 日间' : '🌙 护眼';
    els.themeToggleButton.setAttribute('aria-pressed', String(selected === 'dark'));
  }
}
function toggleTheme() {
  state.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  state.settings.settingsUpdatedAt = new Date().toISOString();
  applyTheme(state.settings.theme);
  persist();
}
function enhanceWheelSelects() {
  document.querySelectorAll('select[id]').forEach(select => {
    if (select.dataset.wheelEnhanced || select.dataset.wheelSkip !== undefined) return;
    select.dataset.wheelEnhanced = 'true';
    select.classList.add('wheel-native-select');
    select.hidden = true;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'wheel-select-trigger';
    trigger.dataset.wheelFor = select.id;
    trigger.dataset.wheelLabel = select.closest('label')?.childNodes[0]?.textContent.trim() || select.getAttribute('aria-label') || '选择项';
    trigger.setAttribute('aria-haspopup', 'dialog');
    select.insertAdjacentElement('afterend', trigger);
  });
  syncWheelTriggers();
}
function syncWheelTriggers() {
  document.querySelectorAll('[data-wheel-for]').forEach(trigger => {
    const select = $(trigger.dataset.wheelFor);
    if (!select) return;
    const selectedLabel = select.selectedOptions[0]?.textContent || '请选择';
    trigger.innerHTML = `<span>${escapeHTML(selectedLabel)}</span><span aria-hidden="true">⌄</span>`;
    trigger.setAttribute('aria-label', `${trigger.dataset.wheelLabel || '选择项'}：${selectedLabel}`);
    trigger.disabled = select.disabled;
  });
}
function openWheelPicker(select) {
  if (!select?.options.length) return;
  activeWheelSelect = select;
  activeWheelValue = select.value;
  const labelNode = select.closest('label')?.childNodes[0];
  els.wheelPickerTitle.textContent = labelNode?.textContent.trim() || select.getAttribute('aria-label') || '请选择';
  els.wheelPickerList.innerHTML = [...select.options].map(option => `<button class="wheel-option ${option.value === select.value ? 'active' : ''}" type="button" role="option" aria-selected="${option.value === select.value}" data-wheel-value="${escapeHTML(option.value)}">${escapeHTML(option.textContent)}</button>`).join('');
  els.wheelPickerList.dataset.opening = 'true';
  els.wheelPickerDialog.showModal();
  requestAnimationFrame(() => {
    const options = [...els.wheelPickerList.querySelectorAll('.wheel-option')];
    const index = Math.max(0, options.findIndex(option => option.classList.contains('active')));
    els.wheelPickerList.scrollTop = index * 48;
    requestAnimationFrame(() => {
      delete els.wheelPickerList.dataset.opening;
    });
  });
}
function selectWheelOption(value, scroll = true) {
  activeWheelValue = value;
  els.wheelPickerList.querySelectorAll('.wheel-option').forEach(option => {
    const active = option.dataset.wheelValue === value;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', String(active));
    if (active && scroll) els.wheelPickerList.scrollTo({
      top: [...option.parentElement.children].indexOf(option) * 48,
      behavior: 'auto'
    });
  });
}
function confirmWheelPicker() {
  if (!activeWheelSelect) return els.wheelPickerDialog.close();
  activeWheelSelect.value = activeWheelValue;
  activeWheelSelect.dispatchEvent(new Event('change', {
    bubbles: true
  }));
  syncWheelTriggers();
  els.wheelPickerDialog.close();
  activeWheelSelect = null;
}
function nearestWheelOption() {
  const options = [...els.wheelPickerList.querySelectorAll('.wheel-option')];
  if (!options.length) return null;
  return options[Math.max(0, Math.min(options.length - 1, Math.round(els.wheelPickerList.scrollTop / 48)))];
}
const MULTI_FIELDS = {
  taskHospital: {
    entry: () => els.taskHospitalEntry,
    chips: () => els.taskHospitalChips
  },
  taskDepartment: {
    entry: () => els.taskDepartmentEntry,
    chips: () => els.taskDepartmentChips
  },
  taskCustomer: {
    entry: () => els.taskCustomerEntry,
    chips: () => els.taskCustomerChips
  }
};
function splitMultiValues(value = '') {
  return [...new Set(String(value).split(/[、,，;；\n]+/).map(item => item.trim()).filter(Boolean))];
}
function setMultiValues(fieldId, values) {
  const field = $(fieldId);
  if (!field || !MULTI_FIELDS[fieldId]) return;
  let normalized = splitMultiValues(Array.isArray(values) ? values.join('、') : values);
  if (els.taskCategory?.value === CUSTOMER_VISIT_CATEGORY && ['taskHospital', 'taskDepartment', 'taskCustomer'].includes(fieldId)) normalized = normalized.slice(-1);
  if (fieldId === 'taskCustomer' && field.value !== normalized.join('、')) delete field.dataset.entityId;
  if (['taskHospital', 'taskDepartment'].includes(fieldId) && field.value !== normalized.join('、')) delete els.taskCustomer.dataset.entityId;
  field.value = normalized.join('、');
  renderMultiChips(fieldId);
  if (fieldId === 'taskHospital' || fieldId === 'taskDepartment') syncLinkedTaskFields();
}
function renderMultiChips(fieldId) {
  const config = MULTI_FIELDS[fieldId];
  if (!config) return;
  config.chips().innerHTML = splitMultiValues($(fieldId).value).map((value, index) => `<span class="multi-chip">${escapeHTML(value)}<button type="button" aria-label="移除 ${escapeHTML(value)}" data-remove-multi="${fieldId}" data-multi-index="${index}">×</button></span>`).join('');
}
function addMultiValue(fieldId, rawValue) {
  const config = MULTI_FIELDS[fieldId];
  if (!config) return;
  let additions = splitMultiValues(rawValue ?? config.entry().value);
  if (fieldId === 'taskHospital') additions = additions.map(value => resolveHospitalAlias(value));
  setMultiValues(fieldId, [...splitMultiValues($(fieldId).value), ...additions]);
  config.entry().value = '';
}
function removeMultiValue(fieldId, index) {
  const values = splitMultiValues($(fieldId).value);
  values.splice(Number(index), 1);
  setMultiValues(fieldId, values);
}
function multiPickerOptions(fieldId) {
  let records = directoryRecords();
  const selectedHospitals = splitMultiValues(els.taskHospital.value);
  if (fieldId === 'taskHospital' && (els.taskOffice.value || els.taskEmployee.value)) {
    const linked = records.filter(record => (!els.taskOffice.value || record.office === els.taskOffice.value) && (!els.taskEmployee.value || record.employee === els.taskEmployee.value));
    if (linked.length) records = linked;
  }
  if (fieldId === 'taskDepartment' && selectedHospitals.length) records = records.filter(record => selectedHospitals.some(hospital => dimensionMatches(record.hospital, hospital)));
  const values = fieldId === 'taskHospital' ? records.map(record => record.hospital) : records.flatMap(record => [record.department]);
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
function syncLinkedTaskFields() {
  const hospitals = splitMultiValues(els.taskHospital.value);
  const departments = splitMultiValues(els.taskDepartment.value);
  if (!hospitals.length && !departments.length) return;
  const matches = directoryRecords().filter(record => {
    const hospitalMatch = !hospitals.length || hospitals.some(hospital => dimensionMatches(record.hospital, hospital));
    const departmentMatch = !departments.length || departments.some(department => dimensionMatches(record.department, department));
    return hospitalMatch && departmentMatch && record.employee;
  });
  const choices = new Map();
  matches.forEach(record => choices.set(`${record.office}\u001f${record.employee}`, record));
  if (choices.size !== 1) return;
  const record = [...choices.values()][0];
  els.taskOffice.value = record.office;
  els.taskEmployee.value = record.employee;
  els.taskOfficeEmployee.value = `${displayOffice(record.office)}${record.employee}`;
}
function taskCustomerCandidates() {
  return (window.customerProfileV1App?.getMasterRecords() || []).filter(person => person.active !== false && person.hospital === els.taskHospital.value && person.department === els.taskDepartment.value).sort((a, b) => a.customerName.localeCompare(b.customerName, 'zh-CN') || a.customerId.localeCompare(b.customerId));
}
function renderMultiPickerOptions() {
  if (!activeMultiField) return;
  const query = els.multiPickerSearch.value.trim().toLowerCase();
  if (activeMultiField === 'taskCustomer') {
    const people = taskCustomerCandidates().filter(p => !query || p.customerName.toLowerCase().includes(query));
    els.multiPickerList.innerHTML = people.map((person, index) => `<button class="wheel-option multi-wheel-option" type="button" data-multi-option="${escapeHTML(person.customerName)}" data-multi-person-id="${escapeHTML(person.customerId)}"><span>${escapeHTML(person.customerName)}</span><small>${escapeHTML(person.professionalTitle || person.customerJobTitle || '同名候选 ' + (index + 1) + '，请核对档案')}</small></button>`).join('');
    els.multiPickerCount.textContent = '请明确选择当前医院/科室的人员';
    return;
  }
  const matches = multiPickerOptions(activeMultiField).filter(value => !query || value.toLowerCase().includes(query)).slice(0, 80);
  const allowCustom = query && !matches.some(value => value.toLowerCase() === query);
  const options = allowCustom ? [els.multiPickerSearch.value.trim(), ...matches] : matches;
  els.multiPickerList.innerHTML = options.length ? options.map((value, index) => {
    const selected = activeMultiSelections.has(value);
    const custom = allowCustom && index === 0;
    return `<button class="wheel-option multi-wheel-option ${selected ? 'active' : ''}" type="button" role="option" aria-selected="${selected}" data-multi-option="${escapeHTML(value)}"><span>${escapeHTML(value)}</span><small>${selected ? '✓ 已选' : custom ? '使用此名称' : '点选'}</small></button>`;
  }).join('') : '<p class="multi-picker-empty">没有匹配名称，可继续输入完整名称。</p>';
  els.multiPickerCount.textContent = `已选择 ${activeMultiSelections.size} 项`;
}
function openMultiPicker(fieldId, query = '') {
  if (!['taskHospital', 'taskDepartment', 'taskCustomer'].includes(fieldId)) return;
  activeMultiField = fieldId;
  activeMultiSelections = new Set(splitMultiValues($(fieldId).value));
  els.multiPickerTitle.textContent = fieldId === 'taskHospital' ? '选择医院' : fieldId === 'taskDepartment' ? '选择科室' : '确认客户身份';
  els.multiPickerSearch.value = query.trim();
  renderMultiPickerOptions();
  if (!els.multiPickerDialog.open) els.multiPickerDialog.showModal();
  setTimeout(() => els.multiPickerSearch.focus(), 60);
}
function confirmMultiPicker() {
  if (activeMultiField) {
    setMultiValues(activeMultiField, [...activeMultiSelections]);
    MULTI_FIELDS[activeMultiField].entry().value = '';
  }
  els.multiPickerDialog.close();
  activeMultiField = null;
}
function taskDimensionMatches(taskValue, recordValue) {
  const values = splitMultiValues(taskValue);
  return values.length ? values.some(value => dimensionMatches(recordValue, value)) : true;
}
function extractLabeledValue(text, labels) {
  const labelPattern = labels.join('|');
  const allLabels = ['截止时间', '截止日期', '时间', '办事处', '负责人', '员工', '信息员', '专员', '医院', '院区', '科室', '客户', '医生', '产品', '品种', '地点', '活动编号', '备注'];
  const stopLabels = allLabels.filter(label => !labels.includes(label)).join('|');
  const match = text.match(new RegExp(`(?:${labelPattern})\\s*[：:]?\\s*([^，。；;\\n]+?)(?=\\s*(?:${stopLabels})\\s*[：:]?|[，。；;\\n]|$)`, 'i'));
  return match?.[1]?.trim() || '';
}
function knownMentions(text, key) {
  const values = [...new Set(directoryRecords().flatMap(record => {
    if (key === 'department') return [record.department, record.departmentRoom];
    return [record[key]];
  }).filter(Boolean))].sort((a, b) => b.length - a.length);
  return values.filter(value => text.includes(value));
}
function correctRecognizedText(text) {
  let result = applyCustomSynonyms(text).replace(/bai\s*fu\s*pai/gi, "Primary Product A").replace(/guan\s*fu\s*pai/gi, "Primary Product B");
  Object.entries({
    ...CATEGORY_ALIASES,
    ...PRODUCT_ALIASES
  }).sort((a, b) => b[0].length - a[0].length).filter(([heard]) => [...heard].length > 1).forEach(([heard, preset]) => {
    result = result.replace(new RegExp(escapeRegex(heard), /[a-z]/i.test(heard) ? 'gi' : 'g'), preset);
  });
  return result;
}
function parseSpokenNumber(value) {
  const token = String(value || '').trim();
  if (!token) return NaN;
  if (/^\d+$/.test(token)) return Number(token);
  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };
  if (token.includes('十')) {
    const [tens, ones] = token.split('十');
    return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0);
  }
  const numeric = [...token].map(char => digits[char]);
  return numeric.some(item => item === undefined) ? NaN : Number(numeric.join(''));
}
function parseTaskDeadline(text) {
  const now = new Date();
  let target = null;
  const weekdayValues = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
    末: 6,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7
  };
  const thisWeek = text.match(/(?:本周|这周)(?:星期|周)?([一二三四五六日天末1-7])/);
  const nextWeek = text.match(/下周(?:星期|周)?([一二三四五六日天末1-7])?/);
  if (/后天/.test(text)) {
    target = new Date(now);
    target.setDate(target.getDate() + 2);
  } else if (/明天|明日/.test(text)) {
    target = new Date(now);
    target.setDate(target.getDate() + 1);
  } else if (/今天|今日/.test(text)) target = new Date(now);else if (thisWeek) {
    const desired = weekdayValues[thisWeek[1]];
    target = new Date(now);
    const current = target.getDay() || 7;
    target.setDate(target.getDate() + desired - current);
  } else if (nextWeek) {
    const desired = weekdayValues[nextWeek[1]] || 1;
    target = new Date(now);
    const current = target.getDay() || 7;
    target.setDate(target.getDate() + (7 - current) + desired);
  } else {
    const chinese = text.match(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
    const numeric = text.match(/(?:(20\d{2})[-/.])(\d{1,2})[-/.](\d{1,2})/);
    const match = chinese || numeric;
    if (match) {
      const year = Number(match[1]) || now.getFullYear();
      target = new Date(year, Number(match[2]) - 1, Number(match[3]));
      if (!match[1] && target < new Date(now.getFullYear(), now.getMonth(), now.getDate())) target.setFullYear(year + 1);
    }
  }
  if (!target || Number.isNaN(target.getTime())) return '';
  const timeText = text.replace(/(?:本周|这周|下周)(?:星期|周)?[一二三四五六日天末1-7]/g, ' ');
  const time = timeText.match(/(?:(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上)\s*)?([零〇一二两三四五六七八九十\d]{1,3})\s*(?:点|时|:)\s*(半|一刻|三刻|[零〇一二两三四五六七八九十\d]{1,3})?\s*分?/);
  let hour = 18;
  let minute = 0;
  if (time) {
    const parsedHour = parseSpokenNumber(time[2]);
    const parsedMinute = time[3] === '半' ? 30 : time[3] === '一刻' ? 15 : time[3] === '三刻' ? 45 : parseSpokenNumber(time[3]);
    if (Number.isFinite(parsedHour) && parsedHour >= 0 && parsedHour <= 23) hour = parsedHour;
    if (Number.isFinite(parsedMinute) && parsedMinute >= 0 && parsedMinute <= 59) minute = parsedMinute;
    if ((time[1] === '下午' || time[1] === '傍晚' || time[1] === '晚上') && hour < 12) hour += 12;
    if (time[1] === '中午' && hour < 11) hour += 12;
    if (time[1] === '凌晨' && hour === 12) hour = 0;
  }
  target.setHours(hour, minute, 0, 0);
  return toLocalInput(target);
}
function parseTaskText(text) {
  const normalized = correctRecognizedText(text).replace(/\s+/g, ' ').trim();
  const labeled = {
    office: extractLabeledValue(normalized, ['办事处']),
    employee: extractLabeledValue(normalized, ['负责人', '员工', '信息员', '专员']),
    hospital: extractLabeledValue(normalized, ['医院', '院区']),
    department: extractLabeledValue(normalized, ['科室']),
    customer: extractLabeledValue(normalized, ['客户', '医生']),
    product: extractLabeledValue(normalized, ['产品', '品种'])
  };
  const firstKnown = key => knownMentions(normalized, key)[0] || '';
  const multiKnown = key => knownMentions(normalized, key);
  const category = CATEGORIES.find(item => normalized.includes(item)) || (/培训/.test(normalized) ? '培训' : /课件/.test(normalized) ? '课件制作' : /销售.*分析|数据.*分析/.test(normalized) ? '销售数据分析' : /备案|信息登记|绑定/.test(normalized) ? '医院信息维护' : /重点客户|客户追踪|客户拜访/.test(normalized) ? CUSTOMER_VISIT_CATEGORY : '');
  const employee = closestPreset(labeled.employee || firstKnown('employee'), officeEmployeeChoices().map(item => item.employee));
  const hospitals = splitMultiValues(multiKnown('hospital').join('、') || labeled.hospital).map(normalizeRecognizedHospital);
  const selectedDepartments = splitMultiValues(multiKnown('department').join('、') || labeled.department);
  return {
    due: parseTaskDeadline(normalized),
    category: closestPreset(category, CATEGORIES, CATEGORY_ALIASES),
    office: labeled.office,
    employee,
    hospitals,
    departments: selectedDepartments.map(value => closestPreset(value, multiPickerOptions('taskDepartment'))),
    customers: splitMultiValues(labeled.customer),
    product: normalizeProduct(labeled.product || firstKnown('product'))
  };
}
function applyParsedTaskFields(parsed) {
  if (parsed.due) {
    els.taskDue.value = parsed.due;
    updateTaskDueWeekday();
  }
  if (parsed.category) {
    els.taskCategory.value = parsed.category;
    renderTaskStagePicker(parsed.category, 0);
    updateTaskFieldVisibility(parsed.category);
  }
  if (parsed.employee) {
    const choice = officeEmployeeChoices().find(item => item.employee === parsed.employee && (!parsed.office || compactText(displayOffice(item.office)).includes(compactText(parsed.office))));
    els.taskOfficeEmployee.value = choice?.value || `${parsed.office ? displayOffice(parsed.office) : ''}${parsed.employee}`;
    syncOfficeEmployeeInput();
  }
  if (parsed.hospitals.length) setMultiValues('taskHospital', parsed.hospitals);
  if (parsed.departments.length) setMultiValues('taskDepartment', parsed.departments);
  if (parsed.customers.length) setMultiValues('taskCustomer', parsed.customers);
  if (parsed.product) els.taskProduct.value = parsed.product;
  syncWheelTriggers();
  return [parsed.due && '截止时间', parsed.employee && '办事处/信息员', parsed.hospitals.length && '医院', parsed.departments.length && '科室', parsed.customers.length && '客户', parsed.product && '产品', parsed.category && '类别'].filter(Boolean);
}
function updateTaskDueWeekday() {
  const datePart = els.taskDue.value.slice(0, 10);
  const date = datePart ? new Date(`${datePart}T12:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    els.taskDueWeekday.hidden = true;
    els.taskDueWeekday.textContent = '';
    return;
  }
  els.taskDueWeekday.textContent = date.toLocaleDateString('zh-CN', {
    weekday: 'long'
  });
  els.taskDueWeekday.hidden = false;
}
function loadOcrLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (loadOcrLibrary.promise) return loadOcrLibrary.promise;
  loadOcrLibrary.promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('vendor/tesseract/tesseract.min.js', location.href).href;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('本地图片识别组件加载失败，请刷新页面后重试。'));
    document.head.appendChild(script);
  });
  return loadOcrLibrary.promise;
}
async function recognizeTaskInput() {
  const file = els.taskImageInput.files?.[0];
  let combined = els.taskTitle.value.trim();
  let worker = null;
  els.recognizeTaskButton.disabled = true;
  try {
    if (file) {
      els.taskRecognitionStatus.textContent = '正在加载图片识别组件…';
      const tesseract = await loadOcrLibrary();
      worker = await tesseract.createWorker('chi_sim+eng', 1, {
        workerPath: new URL('vendor/tesseract/worker.min.js', location.href).href,
        corePath: new URL('vendor/tesseract/core', location.href).href,
        langPath: new URL('vendor/tesseract/lang', location.href).href.replace(/\/$/, ''),
        gzip: true,
        logger: message => {
          if (message.status === 'recognizing text') els.taskRecognitionStatus.textContent = `正在识别图片 ${Math.round((message.progress || 0) * 100)}%`;
        }
      });
      const result = await worker.recognize(file);
      const imageText = result.data.text.trim();
      if (imageText) {
        combined = [combined, imageText].filter(Boolean).join('\n');
        els.taskTitle.value = combined;
      }
    }
    if (!combined) throw new Error('请先输入事项文字或选择图片。');
    const found = applyParsedTaskFields(parseTaskText(combined));
    els.taskRecognitionStatus.textContent = found.length ? `已自动填入：${found.join('、')}。请核对后保存。` : '已读取文字，但未识别出结构化字段；可继续手动补充。';
  } catch (error) {
    console.error('事项识别失败', error);
    els.taskRecognitionStatus.textContent = error.message;
  } finally {
    await worker?.terminate();
    els.recognizeTaskButton.disabled = false;
  }
}
function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function weekKey(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + 4 - (copy.getDay() || 7));
  const yearStart = new Date(copy.getFullYear(), 0, 1);
  const week = Math.ceil(((copy - yearStart) / 86400000 + 1) / 7);
  return `${copy.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function formatDue(value) {
  if (!value) return '';
  const date = window.TaskProgressAdapter?.localDate(value) || new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const prefix = dateKey(date) === dateKey(today) ? '今天' : dateKey(date) === dateKey(tomorrow) ? '明天' : `${date.getMonth() + 1}月${date.getDate()}日`;
  return String(value).includes('T') ? `${prefix} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : prefix;
}
function normalizedTask(task) {
  return window.TaskProgressAdapter?.normalizeTask?.(task) || {
    ...task,
    sourceType: task.sourceType || 'manual',
    status: Number(task.progress) >= 100 ? 'completed' : Number(task.progress) > 0 ? 'in_progress' : 'pending',
    dueDate: task.dueDate || task.due || ''
  };
}
function taskStatus(task) {
  return normalizedTask(task).status === 'completed' ? 'done' : 'doing';
}
function isOverdue(task) {
  return normalizedTask(task).status === 'overdue';
}
function sortedTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aUrgent = Boolean(a.urgent);
    const bUrgent = Boolean(b.urgent);
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
    if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
    if (a.due && b.due && a.due !== b.due) return new Date(a.due) - new Date(b.due);
    const createdDifference = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return Number.isFinite(createdDifference) ? createdDifference : 0;
  });
}
function populateCategories() {
  els.categoryFilter.innerHTML = '<option value="all">全部类别</option>' + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  els.taskCategory.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}
let taskEvidenceDimensionCache = null;
function render() {
  const previousEvidenceCache = taskEvidenceDimensionCache;
  taskEvidenceDimensionCache = new Map();
  try {
    renderHeader();
    if (currentWorkspace === 'tasks') {
      renderBriefing();
      renderTasks();
      renderWeeklyStatus();
      window.taskProgressV2App?.update({
        tasks: state.tasks
      });
    } else if (currentWorkspace === 'activities') activityController?.render();else if (currentWorkspace === 'customers') renderCustomerDashboard();else if (currentWorkspace === 'data') {
      renderDataOptions();
      renderDataDashboard();
    }
    syncWheelTriggers();
  } finally {
    taskEvidenceDimensionCache = previousEvidenceCache;
  }
}
function downloadTextFile(filename, content, mimeType) {
  if (window.AndroidBridge?.saveTextFile) {
    window.AndroidBridge.saveTextFile(filename, content, mimeType);
    return;
  }
  const blob = new Blob([content], {
    type: mimeType
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function renderHeader() {
  const selected = selectedTaskDate ? new Date(`${selectedTaskDate}T12:00:00`) : null;
  const selectedLabel = selected?.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }) || '';
  els.todayLabel.textContent = taskDateScope === 'all' ? `全部日期 · 当前定位 ${selectedLabel}` : selectedLabel;
  renderTaskPeriodControls();
  renderDateStrip();
}
function sharedWorkspaceDateContext() {
  const value = selectedTaskDate || dateKey();
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    date: value
  };
}
function syncActivityToSharedDate(explicitActivity = false) {
  activityController?.setTimeContext?.(sharedWorkspaceDateContext(), {
    explicit: explicitActivity
  });
}
function renderSharedWorkspaceDate(explicitActivity = false) {
  renderHeader();
  renderBriefing();
  renderTasks();
  syncActivityToSharedDate(explicitActivity && currentWorkspace === 'activities');
}
function acceptActivityTimeContext(context = {}) {
  const current = selectedTaskDate ? new Date(`${selectedTaskDate}T12:00:00`) : new Date();
  const year = Number(context.year) || current.getFullYear();
  const month = Number(context.month) || current.getMonth() + 1;
  const maximumDay = new Date(year, month, 0).getDate();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(context.date || '') ? context.date : '';
  selectedTaskDate = requestedDate || dateKey(new Date(year, month - 1, Math.min(current.getDate(), maximumDay), 12));
  taskDateScope = 'selected';
  renderSharedWorkspaceDate(Boolean(context.date));
}
function renderTaskPeriodControls() {
  const reference = selectedTaskDate ? new Date(`${selectedTaskDate}T12:00:00`) : new Date();
  const taskYears = state.tasks.map(task => Number((task.due || '').slice(0, 4))).filter(Number.isFinite);
  const minYear = Math.min(reference.getFullYear() - 2, ...taskYears);
  const maxYear = Math.max(reference.getFullYear() + 2, ...taskYears);
  els.taskYearFilter.innerHTML = Array.from({
    length: maxYear - minYear + 1
  }, (_, index) => minYear + index).map(year => `<option value="${year}">${year}年</option>`).join('');
  els.taskYearFilter.value = String(reference.getFullYear());
  els.taskMonthFilter.innerHTML = Array.from({
    length: 12
  }, (_, index) => `<option value="${index + 1}">${index + 1}月</option>`).join('');
  els.taskMonthFilter.value = String(reference.getMonth() + 1);
  syncWheelTriggers();
}
function shiftDateKey(value, offset) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}
function renderDateStrip() {
  const center = selectedTaskDate || dateKey();
  const today = dateKey();
  els.dateStrip.innerHTML = `<div class="date-track" data-date-track>${Array.from({
    length: 21
  }, (_, index) => {
    const offset = index - 10;
    const key = shiftDateKey(center, offset);
    const date = new Date(`${key}T12:00:00`);
    const weekday = date.toLocaleDateString('zh-CN', {
      weekday: 'short'
    }).replace('周', '');
    return `<button class="date-chip ${key === selectedTaskDate ? 'selected' : ''} ${key === today ? 'today' : ''}" type="button" data-task-date="${key}" data-date-offset="${offset}" aria-pressed="${key === selectedTaskDate}">
      <span>${weekday}</span><strong>${date.getDate()}</strong>
    </button>`;
  }).join('')}</div><span class="date-center-marker" aria-hidden="true"></span>`;
}
function taskMatchesSelectedDateRange(task) {
  if (task.activityProfileOnly) return false;
  if (taskDateScope === 'all') return true;
  const canonical = normalizedTask(task);
  if (!selectedTaskDate || !canonical.dueDate) return true;
  return canonical.dueDate.slice(0, 10) >= selectedTaskDate || !['completed', 'cancelled'].includes(canonical.status);
}
function renderBriefing() {
  const visibleForDate = state.tasks.filter(taskMatchesSelectedDateRange);
  const doing = visibleForDate.filter(task => !['completed', 'cancelled'].includes(normalizedTask(task).status));
  const done = visibleForDate.filter(task => taskStatus(task) === 'done');
  const categoryLabel = els.categoryFilter.selectedOptions[0]?.textContent || '全部类别';
  const markerLabel = els.markerFilter.selectedOptions[0]?.textContent || '全部标记';
  const modules = [{
    key: 'all',
    label: '全部',
    value: state.tasks.filter(task => !task.activityProfileOnly).length,
    detail: taskDateScope === 'all' ? '全部日期' : '切换为全部日期',
    active: taskDateScope === 'all' && els.statusFilter.value === 'all' && els.categoryFilter.value === 'all' && els.markerFilter.value === 'all' && els.taskSourceFilter.value === 'all' && els.taskCanonicalStatusFilter.value === 'all' && !els.searchInput.value.trim() && !taskExternalContext
  }, {
    key: 'doing',
    label: '进行中',
    value: doing.length,
    detail: '未完成',
    active: els.statusFilter.value === 'doing'
  }, {
    key: 'done',
    label: '已完成',
    value: done.length,
    detail: '已完成',
    active: els.statusFilter.value === 'done'
  }, {
    key: 'category',
    label: '类别',
    value: visibleForDate.filter(task => els.categoryFilter.value === 'all' || task.category === els.categoryFilter.value).length,
    detail: categoryLabel,
    active: els.categoryFilter.value !== 'all'
  }, {
    key: 'marker',
    label: '标记',
    value: visibleForDate.filter(task => els.markerFilter.value === 'all' || (els.markerFilter.value === 'urgent' ? task.urgent : task.longTerm)).length,
    detail: markerLabel,
    active: els.markerFilter.value !== 'all'
  }];
  els.briefingGrid.innerHTML = modules.map(module => `<button class="metric briefing-module ${module.active ? 'active' : ''}" type="button" data-briefing-module="${module.key}" aria-pressed="${module.active}"><span class="metric-heading">${lineIcon(module.key)}<span>${module.label}</span></span><strong>${module.value}</strong><small>${escapeHTML(module.detail)}</small></button>`).join('');
  const today = dateKey();
  const todayPool = state.tasks.filter(task => {
    const canonical = normalizedTask(task);
    return !task.activityProfileOnly && !['completed', 'cancelled'].includes(canonical.status) && (!canonical.dueDate || canonical.dueDate.slice(0, 10) <= today);
  });
  const urgent = todayPool.filter(task => task.urgent || normalizedTask(task).priority === 'high').length;
  const overdue = todayPool.filter(task => normalizedTask(task).status === 'overdue').length;
  els.briefingList.innerHTML = `<span><strong>${todayPool.length}</strong> 今日待推进</span><span><strong>${urgent}</strong> 紧急事项</span><span><strong>${overdue}</strong> 逾期未完成</span><p>${escapeHTML(briefingText())}</p>`;
}
function setBriefingStatus(status) {
  els.statusFilter.value = status;
  els.categoryFilter.value = 'all';
  els.markerFilter.value = 'all';
  els.taskSourceFilter.value = 'all';
  els.taskCanonicalStatusFilter.value = 'all';
  if (status === 'all') {
    taskDateScope = 'all';
    els.searchInput.value = '';
    taskExternalContext = null;
  }
  renderHeader();
  renderBriefing();
  renderTasks();
}
function clearTaskFilters() {
  els.searchInput.value = '';
  els.categoryFilter.value = 'all';
  els.statusFilter.value = 'all';
  els.markerFilter.value = 'all';
  els.taskSourceFilter.value = 'all';
  els.taskCanonicalStatusFilter.value = 'all';
  taskDateScope = 'all';
  taskExternalContext = null;
  renderHeader();
  renderBriefing();
  renderTasks();
}
function taskMatchesExternalContext(task, context = taskExternalContext) {
  if (!context) return true;
  const customerId = String(task.customerId || (task.sourceType === 'customer' ? task.sourceId : '') || '');
  if (context.customerId && customerId !== String(context.customerId)) return false;
  if (context.activityId && String(task.activityId || (task.sourceType === 'activity' ? task.sourceId : '') || '') !== String(context.activityId)) return false;
  return ['employee', 'product', 'hospital', 'department', 'customer'].every(key => !context[key] || task[key] && taskDimensionMatches(task[key], context[key]));
}
function taskContextLabel(context = taskExternalContext) {
  if (!context) return '';
  const labels = {
    employee: '员工',
    product: '产品',
    hospital: '医院',
    department: '科室',
    customer: '客户',
    customerId: '客户ID',
    activityId: '活动ID'
  };
  return Object.entries(labels).map(([key, label]) => ['customerId', 'activityId'].includes(key) ? '' : context[key] ? `${label}：${context[key]}` : '').filter(Boolean).join(' · ');
}
function filteredTasks() {
  const query = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const status = els.statusFilter.value;
  const marker = els.markerFilter.value;
  const source = els.taskSourceFilter.value;
  const canonicalStatus = els.taskCanonicalStatusFilter.value;
  return sortedTasks(state.tasks.filter(task => {
    const canonical = normalizedTask(task);
    if (task.archivedAt && canonicalStatus !== 'cancelled') return false;
    const matchesQuery = !query || [task.title, task.notes, task.location, task.category, task.employee, task.hospital, task.department, task.customer, task.product, task.activityId].some(v => (v || '').toLowerCase().includes(query));
    const matchesCategory = category === 'all' || task.category === category;
    const matchesStatus = status === 'all' || (status === 'done' ? canonical.status === 'completed' : !['completed', 'cancelled'].includes(canonical.status));
    const matchesMarker = marker === 'all' || (marker === 'urgent' ? task.urgent : task.longTerm);
    const matchesSource = source === 'all' || canonical.sourceType === source;
    const matchesCanonicalStatus = canonicalStatus === 'all' || canonical.status === canonicalStatus;
    const matchesDate = taskMatchesSelectedDateRange(task);
    return matchesQuery && matchesCategory && matchesStatus && matchesMarker && matchesSource && matchesCanonicalStatus && matchesDate && taskMatchesExternalContext(task);
  }));
}
const selectedNativeTaskIds = new Set();
function renderTaskBulkActions(tasks) {
  let toolbar = document.getElementById('nativeTaskBulkActions');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'nativeTaskBulkActions';
    toolbar.className = 'task-bulk-actions';
    els.taskList.before(toolbar);
    toolbar.addEventListener('click', event => {
      if (event.target.closest('[data-task-select-all]')) {
        const ids = filteredTasks().map(task => task.id);
        const all = ids.length && ids.every(id => selectedNativeTaskIds.has(id));
        ids.forEach(id => all ? selectedNativeTaskIds.delete(id) : selectedNativeTaskIds.add(id));
        renderTasks();
        return;
      }
      const operation = event.target.closest('[data-task-bulk-action]')?.dataset.taskBulkAction;
      if (!operation || !selectedNativeTaskIds.size) return;
      if (!confirm(operation === 'cancel' ? '取消选中任务并保留来源事实？' : '删除无引用自建任务；业务任务撤回或归档并保留历史。继续？')) return;
      for (const id of [...selectedNativeTaskIds]) {
        const task = state.tasks.find(task => task.id === id);
        if (!task) continue;
        if (operation === 'cancel') {
          if (!['completed', 'cancelled'].includes(normalizedTask(task).status)) Object.assign(task, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'user',
            updatedAt: new Date().toISOString()
          });
        } else removeTaskById(id, {
          deferRender: true
        });
      }
      selectedNativeTaskIds.clear();
      persist();
      render();
    });
  }
  for (const id of [...selectedNativeTaskIds]) if (!state.tasks.some(task => task.id === id)) selectedNativeTaskIds.delete(id);
  toolbar.innerHTML = `<button type="button" data-task-select-all aria-label="全选任务">☑ 全选</button><span>已选 ${selectedNativeTaskIds.size}</span><button type="button" data-task-bulk-action="cancel" ${selectedNativeTaskIds.size ? '' : 'disabled'}>⊘ 取消</button><button type="button" data-task-bulk-action="remove" ${selectedNativeTaskIds.size ? '' : 'disabled'}>× 删除 / 归档</button>`;
}
function renderTasks() {
  const tasks = filteredTasks();
  const category = els.categoryFilter.value;
  const selected = selectedTaskDate ? new Date(`${selectedTaskDate}T12:00:00`) : null;
  const dateLabel = taskDateScope === 'all' ? '全部日期' : selected ? `${selected.getMonth() + 1}月${selected.getDate()}日起` : '全部日期';
  els.tasksTitle.textContent = '主动事项';
  els.taskCount.textContent = `${dateLabel} · ${category === 'all' ? '' : `${category} · `}${tasks.length} 项`;
  els.collapseAllTasksButton.disabled = expandedTaskIds.size === 0;
  els.emptyState.hidden = tasks.length > 0;
  renderTaskBulkActions(tasks);
  els.taskList.innerHTML = tasks.map(taskCard).join('');
  const contextLabel = taskContextLabel();
  els.taskExternalContext.hidden = !contextLabel;
  els.taskExternalContextText.textContent = contextLabel ? `销售上下文筛选 · ${contextLabel}` : '';
}
function stagesFor(category) {
  return STAGE_DEFINITIONS[category] || STAGE_DEFINITIONS['其他'];
}
function stageForTask(task) {
  const stages = stagesFor(task.category);
  return [...stages].reverse().find(stage => task.progress >= stage.value) || stages[0];
}
function customerRating(output) {
  const value = Number(output) || 0;
  if (value > 30) return 'A';
  if (value >= 20) return 'B';
  if (value >= 10) return 'C';
  return 'D';
}
function latestTaskOutputMonth(task) {
  return Object.keys(task.weeklyOutputs || {}).map(week => week.slice(0, 7)).sort().at(-1) || latestCompletedMonth();
}
function currentWeekKey() {
  return weekStartKey(dateKey());
}
function customerPeriodForDate(value) {
  const source = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : new Date(value);
  const month = dateKey(source).slice(0, 7);
  const slot = `W${Math.min(4, Math.floor((source.getDate() - 1) / 7) + 1)}`;
  return {
    month,
    slot,
    key: `${month}-${slot}`
  };
}
function previousCustomerPeriod(reference = new Date()) {
  const previous = new Date(reference);
  previous.setDate(previous.getDate() - 7);
  return customerPeriodForDate(previous);
}
function weeklySlotOptions(selected) {
  return ['W1', 'W2', 'W3', 'W4'].map(slot => `<option value="${slot}" ${slot === selected ? 'selected' : ''}>${slot}</option>`).join('');
}
function selectedWeeklyOutputKey(container, id, kind) {
  const select = container.querySelector(`[data-${kind}-slot="${CSS.escape(id)}"]`);
  const month = select?.dataset.weekMonth || previousCustomerPeriod().month;
  return `${month}-${select?.value || previousCustomerPeriod().slot}`;
}
function customerMonthOutput(task, month) {
  return Object.entries(task.weeklyOutputs || {}).reduce((total, [week, value]) => week.slice(0, 7) === month ? total + (Number(value) || 0) : total, 0);
}
function stageNodes(task) {
  const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
  const current = stageForTask(task);
  const stages = stagesFor(task.category);
  return `<div class="thermometer-progress" data-thermometer="${task.id}" style="--progress:${progress}%">
    <div class="thermometer-labels">${stages.map(stage => `<button class="${progress >= stage.value ? 'reached' : ''} ${current.value === stage.value ? 'current' : ''}" style="left:${stage.value}%" type="button" data-stage-value="${stage.value}" data-stage-task="${task.id}" data-stage="${stage.value}" aria-label="切换到${escapeHTML(stage.label)}"><i></i><strong>${escapeHTML(stage.label)}</strong></button>`).join('')}</div>
    <div class="thermometer-shell"><div class="thermometer-fill"></div><input type="range" min="0" max="100" step="1" value="${progress}" data-progress-slider="${task.id}" aria-label="${escapeHTML(task.title)}进度"></div>
    <div class="thermometer-status"><span>前后滑动或直接点节点</span><strong data-progress-label>${escapeHTML(current.label)}</strong></div>
  </div>`;
}
function compactStageLine(task) {
  const progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
  return `<div class="compact-thermometer" data-thermometer="${task.id}" style="--progress:${progress}%">
    <div class="compact-thermometer-track">
      <input type="range" min="0" max="100" step="1" value="${progress}" data-progress-slider="${task.id}" tabindex="-1" aria-hidden="true">
      <button class="compact-progress-thumb" type="button" role="slider" data-compact-progress-thumb="${task.id}" aria-label="拖动${escapeHTML(task.title)}进度圆点" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="${escapeHTML(stageForTask(task).label)}"></button>
    </div>
    <span class="visually-hidden" data-progress-label>${escapeHTML(stageForTask(task).label)}</span>
  </div>`;
}
function taskSourceContext(task) {
  const canonical = normalizedTask(task);
  return {
    employee: String(task.employee || task.owner || '').trim(),
    product: String(task.product || '').trim(),
    hospital: String(canonical.hospital || '').trim(),
    department: String(canonical.department || '').trim(),
    customer: String(canonical.customer || '').trim(),
    customerId: String(canonical.customerId || '').trim(),
    activityId: String(canonical.activityId || '').trim()
  };
}
function taskContextAttributes(context = {}) {
  return Object.entries(context).filter(([, value]) => value).map(([key, value]) => ` data-task-context-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}="${escapeHTML(value)}"`).join('');
}
function taskContextFromDataset(dataset = {}) {
  return {
    employee: dataset.taskContextEmployee || '',
    product: dataset.taskContextProduct || '',
    hospital: dataset.taskContextHospital || '',
    department: dataset.taskContextDepartment || '',
    customer: dataset.taskContextCustomer || '',
    customerId: dataset.taskContextCustomerId || '',
    activityId: dataset.taskContextActivityId || ''
  };
}
function canUseNativeTaskProgress(task) {
  const normalized = normalizedTask(task);
  return normalized.sourceType === 'manual' || normalized.sourceType === 'customer' && ['customer_visit', 'customer_profile_maintenance'].includes(normalized.taskType) || normalized.sourceType === 'hospital' && ['hospital_profile_maintenance', 'hospital_maintenance'].includes(normalized.taskType);
}
function taskCard(task) {
  const canonical = normalizedTask(task);
  const status = taskStatus(task);
  const manual = canonical.sourceType === 'manual';
  const native = canUseNativeTaskProgress(task);
  const due = formatDue(canonical.dueDate);
  const overdue = canonical.status === 'overdue';
  const publicNotes = String(task.notes || '').replace(/来源(?:活动|任务)[：:]\s*[a-zA-Z0-9_-]{8,}/g, '来源：业务记录');
  const notes = publicNotes ? `<p class="task-notes">${escapeHTML(publicNotes)}</p>` : '';
  const evidence = taskEvidence(task);
  const expanded = expandedTaskIds.has(task.id);
  const outputPeriod = previousCustomerPeriod();
  const context = taskSourceContext(task);
  const hasSalesContext = ['employee', 'product', 'hospital', 'department', 'customerId'].some(key => context[key]);
  return `<article class="task-card source-${canonical.sourceType} ${status === 'done' ? 'done' : ''} ${canonical.status === 'cancelled' ? 'cancelled' : ''} ${expanded ? 'expanded' : ''}" data-task-card="${task.id}">
    ${native ? `<div class="swipe-delete-action"><button type="button" data-swipe-delete="${task.id}" aria-label="删除 ${escapeHTML(task.title)}">${lineIcon('delete', 'trash-line-icon')}</button></div>` : ''}
    <div class="task-card-surface" data-task-swipe-surface>
      <div class="task-summary-row"><button class="task-summary" type="button" data-toggle-task="${task.id}" aria-expanded="${expanded}">
      <span class="task-leading-icon">${taskCategoryIcon(task.category)}</span>
      <div class="task-summary-body">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        <div class="task-compact-meta">
          ${due ? `<span class="task-deadline">${overdue ? '逾期 · ' : ''}${due}</span>` : '<span class="task-deadline">未设时间</span>'}
          <span class="task-category-summary">${escapeHTML(task.category)}</span>
          <span class="task-hospital-summary">${escapeHTML(splitMultiValues(task.hospital)[0] || '未填医院')}</span>
          <span class="task-source-badge">${escapeHTML(canonical.sourceLabel || '自建')}</span>
        </div>
      </div>
      <span class="summary-indicators">${status === 'done' ? '<span class="completion-check" aria-label="全部完成">✓</span>' : canonical.status === 'cancelled' ? '<span class="task-cancelled-label">已取消</span>' : ''}<span class="expand-indicator" aria-hidden="true">${expanded ? '⌃' : '⌄'}</span></span>
      </button>
      <div class="task-inline-actions">
      <button class="icon-button" type="button" data-select-native-task="${escapeHTML(task.id)}" aria-label="选择任务" aria-pressed="${selectedNativeTaskIds.has(task.id)}">${selectedNativeTaskIds.has(task.id) ? '☑' : '☐'}</button>
      ${native ? `<button class="icon-button" type="button" data-open-task="${escapeHTML(task.id)}" aria-label="编辑任务" title="编辑任务">✎</button>` : ''}
      ${canWithdrawRecommendationTask(task) ? `<button class="task-withdraw-arrow" type="button" data-withdraw-recommendation="${escapeHTML(task.id)}" aria-label="撤回建议" title="撤回建议">↶</button>` : `<button class="icon-button" type="button" data-remove-native-task="${escapeHTML(task.id)}" aria-label="${manual ? '删除任务' : '归档任务'}" title="${manual ? '删除任务' : '归档任务'}">×</button>`}
      ${!['completed', 'cancelled'].includes(canonical.status) ? `<button class="icon-button" type="button" data-cancel-native-task="${escapeHTML(task.id)}" aria-label="取消任务" title="取消任务">⊘</button>` : ''}
      </div></div>
      ${expanded || !native ? '' : compactStageLine(task)}
      <div class="task-details" ${expanded ? '' : 'hidden'}>
      <div class="task-markers" aria-label="任务标记">
        ${native ? `<button class="marker-button ${task.urgent ? 'active urgent' : ''}" type="button" data-toggle-flag="urgent" data-task-id="${task.id}">紧急事项</button><button class="marker-button ${task.longTerm ? 'active long' : ''}" type="button" data-toggle-flag="longTerm" data-task-id="${task.id}">长期追踪</button>` : `<span class="task-source-managed">${escapeHTML(canonical.sourceLabel)}任务 · ${escapeHTML(canonical.statusLabel)} · 由来源业务管理</span>`}
      </div>
      <div class="task-meta">
        ${task.location ? `<span>⌖ ${escapeHTML(task.location)}</span>` : ''}
        ${task.employee ? `<span>👤 ${escapeHTML(`${displayOffice(task.office || '')}${task.employee}`)}</span>` : ''}
        ${task.hospital ? `<span>🏥 ${escapeHTML(task.hospital)}${task.department ? ` · ${escapeHTML(task.department)}` : ''}</span>` : ''}
        ${task.customer ? `<span>客户：${escapeHTML(task.customer)}</span>` : ''}
        ${task.product ? `<span>产品：${escapeHTML(task.product)}</span>` : ''}
        ${evidence.count ? `<span class="task-evidence">↗ 数据 ${evidence.count} 条 · 销售 ${formatMoney(evidence.sales)}</span>` : ''}
      </div>
      ${notes}
      ${task.category === CUSTOMER_VISIT_CATEGORY ? `<div class="weekly-output-entry"><label>客户周产出<span class="weekly-output-controls"><select class="weekly-slot-select" data-weekly-slot="${task.id}" data-week-month="${outputPeriod.month}" aria-label="选择客户周次">${weeklySlotOptions(outputPeriod.slot)}</select><input type="number" min="0" step="1" inputmode="decimal" data-weekly-output="${task.id}" value="${Number(task.weeklyOutputs?.[outputPeriod.key] || 0)}"></span></label><button class="button compact-button" type="button" data-save-weekly-output="${task.id}">保存</button><span class="muted">${outputPeriod.month} · 默认上一周</span></div>` : ''}
      <div class="task-detail-actions">
        ${native ? `${stageNodes(task)}<button class="edit-button" type="button" data-open-task="${task.id}">编辑详情</button>${manual ? '' : `<button class="edit-button" type="button" data-open-source-task="${task.id}">来源详情</button>`}` : `<button class="edit-button" type="button" data-open-source-task="${task.id}">查看来源详情</button>`}
        ${hasSalesContext ? `<button class="edit-button" type="button" data-task-sales-context="${task.id}"${taskContextAttributes(context)}>查看销售上下文</button>` : ''}
        ${task.category === '医院信息维护' && task.hospitalId ? `<button class="edit-button" type="button" data-task-hospital-context="${escapeHTML(task.hospitalId)}">查看医院资料</button>` : ''}
      </div>
      </div>
    </div>
  </article>`;
}
function taskEvidence(task) {
  const cache = taskEvidenceDimensionCache || new Map();
  const trimmed = value => {
    const raw = String(value || '');
    if (!cache.has(raw)) cache.set(raw, raw.trim());
    return cache.get(raw);
  };
  const dimensions = ['employee', 'hospital', 'department', 'customer', 'product'];
  const supplied = dimensions.filter(key => task[key]);
  const filters = supplied.map(key => ({
    key,
    values: splitMultiValues(task[key]).map(trimmed)
  }));
  const related = state.records.filter(record => {
    if (task.activityId && record.activityId === task.activityId) return true;
    if (!supplied.length) return false;
    return filters.every(({
      key,
      values
    }) => {
      if (!values.length) return true;
      const recordValue = trimmed(record[key]);
      return values.some(value => !recordValue || !value ? !recordValue && !value : recordValue === value || recordValue.includes(value) || value.includes(recordValue));
    });
  });
  return {
    count: related.length,
    sales: sum(related, 'salesAmount'),
    boxes: sum(related, 'orderBoxes'),
    visits: sum(related, 'visitCount'),
    cost: sum(related, 'activityCost')
  };
}
function renderWeeklyStatus() {
  const review = state.reviews.find(item => item.week === weekKey());
  els.weeklyStatus.textContent = review ? `本周已于 ${new Date(review.createdAt).toLocaleString('zh-CN')} 确认，仍可再次更新。` : '确认本周结果，同时录入下周新增工作。';
}
function renderDataOptions() {
  const directory = directoryRecords();
  const dimensions = {
    office: ['dataOfficeFilter', null],
    employee: ['dataEmployeeFilter', 'employeeOptions'],
    product: ['dataProductFilter', 'productOptions'],
    hospital: ['dataHospitalFilter', 'hospitalOptions'],
    department: [null, 'departmentOptions'],
    customer: [null, 'customerOptions']
  };
  Object.entries(dimensions).forEach(([key, [selectId, listId]]) => {
    const values = [...new Set(directory.map(record => record[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const list = listId ? $(listId) : null;
    if (list) list.innerHTML = values.map(value => `<option value="${escapeHTML(value)}"></option>`).join('');
    if (selectId) {
      const select = $(selectId);
      const selected = select.value;
      const label = key === 'office' ? '全部办事处' : key === 'employee' ? '全部员工' : key === 'product' ? '全部产品' : '全部医院';
      select.innerHTML = `<option value="all">${label}</option>` + values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
      if (values.includes(selected)) select.value = selected;
      select.closest('label').hidden = key === 'hospital' && values.length === 0;
    }
  });
  $('officeEmployeeOptions').innerHTML = officeEmployeeChoices().map(choice => `<option value="${escapeHTML(choice.value)}"></option>`).join('');
  renderPeriodOptions(false);
  renderCustomerMonthOptions();
  syncWheelTriggers();
}
function fiscalYearForDate(value) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return month >= 10 ? year + 1 : year;
}
function fiscalQuarterForDate(value) {
  const month = Number(value.slice(5, 7));
  if (month >= 10) return 1;
  if (month <= 3) return 2;
  if (month <= 6) return 3;
  return 4;
}
function renderPeriodOptions(reset = false) {
  const mode = els.dataPeriodMode.value || 'fiscalYear';
  const current = reset ? '' : els.dataPeriodValue.value;
  const values = [...new Set(state.records.map(record => {
    if (mode === 'fiscalYear') return `FY${fiscalYearForDate(record.date)}`;
    if (mode === 'quarter') return `FY${fiscalYearForDate(record.date)}-Q${fiscalQuarterForDate(record.date)}`;
    if (mode === 'month') return record.date.slice(0, 7);
    return weekStartKey(record.date);
  }))].sort((a, b) => b.localeCompare(a));
  const labels = value => mode === 'fiscalYear' ? `${value.slice(2)}财年（上年10月–当年9月）` : mode === 'quarter' ? `${value.replace('-', ' · ')}` : mode === 'month' ? `${value.slice(0, 4)}年${Number(value.slice(5, 7))}月` : `${value} 起一周`;
  els.dataPeriodValue.innerHTML = values.map(value => `<option value="${value}">${labels(value)}</option>`).join('');
  if (values.includes(current)) els.dataPeriodValue.value = current;
  syncWheelTriggers();
}
function renderCustomerMonthOptions() {
  if (!els.customerMonthFilter) return;
  const months = new Set(state.records.map(record => record.date.slice(0, 7)));
  state.tasks.filter(task => task.category === CUSTOMER_VISIT_CATEGORY).forEach(task => Object.keys(task.weeklyOutputs || {}).forEach(week => months.add(week.slice(0, 7))));
  const values = [...months].filter(Boolean).sort((a, b) => b.localeCompare(a));
  const current = els.customerMonthFilter.value;
  els.customerMonthFilter.innerHTML = values.map(month => `<option value="${month}">${month.slice(0, 4)}年${Number(month.slice(5, 7))}月</option>`).join('');
  const preferred = latestCompletedMonth();
  els.customerMonthFilter.value = values.includes(current) ? current : values.includes(preferred) ? preferred : values[0] || '';
  syncWheelTriggers();
}
function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function periodRange(mode = els.dataPeriodMode.value, value = els.dataPeriodValue.value) {
  if (!value) return {
    from: '',
    to: '',
    label: '全部时间'
  };
  let start;
  let end;
  if (mode === 'fiscalYear') {
    const fiscalYear = Number(value.replace('FY', ''));
    start = new Date(fiscalYear - 1, 9, 1, 12);
    end = new Date(fiscalYear, 8, 30, 12);
  } else if (mode === 'quarter') {
    const match = value.match(/FY(\d+)-Q([1-4])/);
    const fiscalYear = Number(match?.[1]);
    const quarter = Number(match?.[2]);
    const starts = {
      1: [fiscalYear - 1, 9],
      2: [fiscalYear, 0],
      3: [fiscalYear, 3],
      4: [fiscalYear, 6]
    };
    start = new Date(starts[quarter][0], starts[quarter][1], 1, 12);
    end = new Date(start.getFullYear(), start.getMonth() + 3, 0, 12);
  } else if (mode === 'month') {
    const [year, month] = value.split('-').map(Number);
    start = new Date(year, month - 1, 1, 12);
    end = new Date(year, month, 0, 12);
  } else {
    start = new Date(`${value}T12:00:00`);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  }
  return {
    from: isoDate(start),
    to: isoDate(end),
    label: value
  };
}
function shiftPeriodRange(range, mode, comparison) {
  const start = new Date(`${range.from}T12:00:00`);
  const end = new Date(`${range.to}T12:00:00`);
  if (comparison === 'yoy' || mode === 'fiscalYear') {
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
  } else if (mode === 'quarter') {
    start.setMonth(start.getMonth() - 3);
    end.setMonth(end.getMonth() - 3);
  } else if (mode === 'month') {
    start.setMonth(start.getMonth() - 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
  } else {
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() - 7);
  }
  return {
    from: isoDate(start),
    to: isoDate(end)
  };
}
function recordsInRange(range, applyDimensions = true) {
  return state.records.filter(record => {
    if (range.from && record.date < range.from) return false;
    if (range.to && record.date > range.to) return false;
    if (!applyDimensions) return true;
    if (els.dataOfficeFilter.value !== 'all' && record.office !== els.dataOfficeFilter.value) return false;
    if (els.dataEmployeeFilter.value !== 'all' && record.employee !== els.dataEmployeeFilter.value) return false;
    if (els.dataProductFilter.value !== 'all' && record.product !== els.dataProductFilter.value) return false;
    if (els.dataHospitalFilter.value !== 'all' && record.hospital !== els.dataHospitalFilter.value) return false;
    return true;
  });
}
function filteredDataRecords() {
  return recordsInRange(periodRange());
}
function renderDataDashboard() {
  const records = filteredDataRecords();
  const range = periodRange();
  const comparisonRange = dataComparisonMode === 'none' ? null : shiftPeriodRange(range, els.dataPeriodMode.value, dataComparisonMode);
  const comparisonRecords = comparisonRange ? recordsInRange(comparisonRange) : [];
  const hasData = records.length > 0;
  els.dashboardEmpty.hidden = hasData;
  els.dashboardCharts.hidden = !hasData;
  els.dashboardModuleControls.hidden = !hasData;
  const sales = sum(records, 'salesAmount');
  const boxes = sum(records, 'orderBoxes');
  const visits = sum(records, 'visitCount');
  const cost = sum(records, 'activityCost');
  const hours = sum(records, 'activityHours');
  const efficiency = cost > 0 ? sales / cost : null;
  const comparisonLabel = dataComparisonMode === 'yoy' ? '同比' : dataComparisonMode === 'mom' ? '环比' : '';
  const primaryCurrent = sales > 0 ? sales : boxes;
  const primaryPrevious = sales > 0 ? sum(comparisonRecords, 'salesAmount') : sum(comparisonRecords, 'orderBoxes');
  const primaryChange = comparisonRange && primaryPrevious ? (primaryCurrent - primaryPrevious) / primaryPrevious : null;
  els.dataSourceSummary.textContent = state.records.length ? `已载入 ${formatNumber(state.records.length, 0)} 条 · 当前 ${range.from} 至 ${range.to}${comparisonLabel ? ` · ${comparisonLabel} ${primaryChange === null ? '暂无基期' : `${primaryChange >= 0 ? '+' : ''}${(primaryChange * 100).toFixed(1)}%`}` : ''}` : '尚未载入数据';
  const hasVisitData = visits > 0;
  const hasActivityData = cost > 0 || hours > 0;
  els.dashboardKpis.innerHTML = [sales > 0 ? ['销售额', formatMoney(sales), `${records.length} 条明细${comparisonLabel ? ` · ${comparisonLabel} ${primaryChange === null ? '—' : `${primaryChange >= 0 ? '+' : ''}${(primaryChange * 100).toFixed(1)}%`}` : ''}`] : ['下单盒数', formatNumber(boxes), `${records.length} 笔订单${comparisonLabel ? ` · ${comparisonLabel} ${primaryChange === null ? '—' : `${primaryChange >= 0 ? '+' : ''}${(primaryChange * 100).toFixed(1)}%`}` : ''}`], sales > 0 ? ['下单盒数', formatNumber(boxes), `单次平均 ${formatNumber(averageOrderBoxes(records))} 盒`] : ['单次平均', `${formatNumber(averageOrderBoxes(records))} 盒`, `最高 ${formatNumber(Math.max(...records.map(record => record.orderBoxes || 0), 0))} 盒`], hasVisitData ? ['拜访次数', formatNumber(visits), `${new Set(records.map(record => record.customer).filter(Boolean)).size} 位客户`] : ['专员覆盖', `${new Set(records.map(record => record.employee).filter(Boolean)).size} 人`, `${new Set(records.map(record => record.office).filter(Boolean)).size} 个办事处`], hasActivityData ? ['活动投入', formatMoney(cost), `${formatNumber(hours)} 小时`] : ['产品结构', `${new Set(records.map(record => record.product).filter(Boolean)).size} 个产品`, `${new Set(records.map(record => record.hospital).filter(Boolean)).size} 家医院`], sales > 0 ? ['销售 / 投入', efficiency === null ? '—' : `${efficiency.toFixed(1)} 倍`, '仅为同期相关性'] : ['覆盖范围', `${new Set(records.map(record => record.department).filter(Boolean)).size} 科室`, `${new Set(records.map(record => record.address).filter(Boolean)).size} 个地址`]].map(([label, value, detail]) => `<div class="dashboard-kpi"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join('');
  renderSalesDashboardV1();
  renderSalesAnomalies();
  if (!hasData) {
    renderDashboardModule(false);
    return;
  }
  renderSalesTrend(records, els.dataPeriodMode.value);
  renderEmployeeContribution(records);
  renderDimensionContribution(records, 'office', els.officeContributionChart, '未填写办事处');
  renderDimensionContribution(records, 'product', els.productContributionChart, '未填写产品');
  renderOrderSizeDistribution(records);
  renderAddressContribution(records);
  renderActivityEfficiency(records);
  renderAlignment(records);
  renderDepartmentCustomerSummary(records);
  renderHospitalPotential(records);
  renderSignals(records);
  labelAnalysisTables(els.dataView);
  renderDashboardModule(true);
}
function renderDashboardModule(hasData = filteredDataRecords().length > 0) {
  const selected = els.dashboardModuleFilter.value || 'all';
  document.querySelectorAll('[data-dashboard-module]').forEach(section => {
    section.hidden = !hasData || selected !== 'all' && section.dataset.dashboardModule !== selected;
    if (section.dataset.dashboardModule === 'anomaly' && (selected === 'anomaly' || selected === 'all') && hasData) section.open = true;
  });
  syncWheelTriggers();
}
function labelAnalysisTables(root = document) {
  root.querySelectorAll('.analysis-table').forEach(table => {
    const labels = [...table.querySelectorAll('thead th')].map(cell => cell.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => [...row.children].forEach((cell, index) => {
      cell.dataset.label = labels[index] || '';
    }));
  });
}
function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}
function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits
  }).format(Number(value) || 0);
}
function formatMoney(value) {
  return `¥${new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0
  }).format(Number(value) || 0)}`;
}
function averageOrderBoxes(records) {
  const orders = records.filter(record => record.orderBoxes > 0);
  return orders.length ? sum(orders, 'orderBoxes') / orders.length : 0;
}
function weekStartKey(value) {
  const date = new Date(`${value}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return dateKey(date);
}
function groupRows(rows, keyFn) {
  const groups = new Map();
  rows.forEach(row => {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}
function renderSalesTrend(records, mode = 'month') {
  const granularity = mode === 'week' ? '日' : mode === 'month' ? '周' : '月';
  const groups = groupRows(records, record => mode === 'week' ? record.date : mode === 'month' ? weekStartKey(record.date) : record.date.slice(0, 7));
  const useSales = sum(records, 'salesAmount') > 0;
  const series = [...groups.entries()].map(([period, rows]) => ({
    period,
    value: sum(rows, useSales ? 'salesAmount' : 'orderBoxes'),
    boxes: sum(rows, 'orderBoxes')
  })).sort((a, b) => a.period.localeCompare(b.period));
  const width = 760;
  const height = 260;
  const left = 58;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...series.map(point => point.value), 1);
  const x = index => left + (series.length === 1 ? plotWidth / 2 : index * plotWidth / (series.length - 1));
  const y = value => top + plotHeight - value / maxValue * plotHeight;
  const points = series.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const area = `${x(0)},${top + plotHeight} ${points} ${x(series.length - 1)},${top + plotHeight}`;
  const ticks = [0, .25, .5, .75, 1];
  const labels = series.map((point, index) => {
    if (series.length > 8 && index % Math.ceil(series.length / 8) !== 0 && index !== series.length - 1) return '';
    const date = new Date(`${point.period}${point.period.length === 7 ? '-01' : ''}T00:00:00`);
    return `<text class="chart-axis-text" x="${x(index)}" y="${height - 12}" text-anchor="middle">${date.getMonth() + 1}/${point.period.length === 7 ? '' : date.getDate()}</text>`;
  }).join('');
  els.trendTitle.textContent = `${granularity}销售趋势`;
  els.salesTrendChart.innerHTML = `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="按${granularity}销售趋势">
    <title>按${granularity}销售趋势</title>
    ${ticks.map(tick => `<line class="chart-gridline" x1="${left}" x2="${width - right}" y1="${y(maxValue * tick)}" y2="${y(maxValue * tick)}"></line><text class="chart-axis-text" x="${left - 8}" y="${y(maxValue * tick) + 4}" text-anchor="end">${useSales ? compactMoney(maxValue * tick) : `${formatNumber(maxValue * tick, 0)}盒`}</text>`).join('')}
    <polygon class="chart-area" points="${area}"></polygon><polyline class="chart-line" points="${points}"></polyline>
    ${series.map((point, index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(point.value)}" r="4"><title>${point.period}：${useSales ? formatMoney(point.value) : `${formatNumber(point.boxes)}盒`}</title></circle>`).join('')}
    ${labels}
  </svg>`;
  const first = series[0]?.value || 0;
  const last = series.at(-1)?.value || 0;
  const change = first ? (last - first) / first : last > 0 ? 1 : 0;
  els.trendSummary.textContent = series.length > 1 ? `首末${granularity} ${change >= 0 ? '增长' : '下降'} ${Math.abs(change * 100).toFixed(0)}%` : `当前仅 1 个${granularity}数据`;
}
function compactMoney(value) {
  if (Math.abs(value) >= 10000) return `¥${(value / 10000).toFixed(1)}万`;
  return `¥${Math.round(value)}`;
}
function formatReportValue(value, metric) {
  return metric.key === 'salesAmount' ? formatMoney(value) : `${formatNumber(value)}盒`;
}
function reportChartMarkup(chart, metric) {
  const series = chart.series || [];
  if (!series.length) return '<p class="chart-note">当前范围暂无有效数据。</p>';
  if (chart.chartType === 'line') {
    const width = 560;
    const height = 170;
    const left = 34;
    const right = 12;
    const top = 12;
    const bottom = 30;
    const max = Math.max(...series.map(item => item.value), 1);
    const x = index => left + (series.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (series.length - 1));
    const y = value => top + (height - top - bottom) * (1 - value / max);
    const points = series.map((item, index) => `${x(index)},${y(item.value)}`).join(' ');
    return `<svg class="report-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(chart.title)}">
      <line class="chart-gridline" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line>
      <polyline class="chart-line" points="${points}"></polyline>
      ${series.map((item, index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(item.value)}" r="3"><title>${escapeHTML(item.period)}：${formatReportValue(item.value, metric)}</title></circle><text class="chart-axis-text" x="${x(index)}" y="${height - 10}" text-anchor="middle">${escapeHTML(item.period.slice(5))}月</text>`).join('')}
    </svg>`;
  }
  const max = Math.max(...series.map(item => item.value), 1);
  return `<div class="report-bars">${series.map(item => `<div class="report-bar-row"><span title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, item.value / max * 100)}%"></div></div><strong>${formatReportValue(item.value, metric)}</strong></div>`).join('')}</div>`;
}
function renderReportMaterial(material) {
  const compareText = value => value === null ? '暂无基期' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  els.reportSummary.hidden = false;
  els.reportSummary.innerHTML = `<div><span>统计口径</span><strong>${escapeHTML(material.metric.label)}</strong><small>${escapeHTML(material.metric.unit)}</small></div>
    <div><span>本期</span><strong>${formatReportValue(material.summary.value, material.metric)}</strong><small>${escapeHTML(material.range.from)} 至 ${escapeHTML(material.range.to)}</small></div>
    <div><span>同比</span><strong>${compareText(material.summary.yoy)}</strong><small>上财年同期</small></div>
    <div><span>环比</span><strong>${compareText(material.summary.mom)}</strong><small>等长上一周期</small></div>`;
  els.reportMaterialGrid.innerHTML = material.charts.map((chart, index) => `<article class="report-material-card" data-report-chart="${escapeHTML(chart.chartId)}">
    <header><span>图表 ${index + 1}</span><h3>${escapeHTML(chart.title)}</h3><small>${escapeHTML(chart.period.from)} 至 ${escapeHTML(chart.period.to)}</small></header>
    <div class="report-chart report-contract-preview"><strong>${escapeHTML(chart.chartType)}</strong><span>${Array.isArray(chart.series) ? chart.series.length : Object.keys(chart.series || {}).length} 组数据</span></div>
    <p class="report-conclusion">${escapeHTML(chart.summary)}</p>
    <details><summary>数据口径</summary><p>${escapeHTML(material.methodology)}</p></details>
  </article>`).join('');
  els.downloadReportButton.disabled = false;
}
function generateQuarterlyReport() {
  if (!window.QuarterlyReporting) {
    recordSafeDiagnostic('ERROR', {
      stage: 'REPORT_CONTEXT_CREATED',
      message: 'reporting unavailable'
    });
    showToast('汇报统计组件未加载');
    return null;
  }
  try {
    const filters = reportFilters();
    recordSafeDiagnostic('REPORT_CONTEXT_CREATED', {
      stage: `FY${filters.fiscalYear}-Q${filters.fiscalQuarter}`
    });
    const localRows = state.records.filter(record => record.product === filters.product);
    if (!localRows.length) throw new Error('当前本机没有足够数据生成PPT');
    recordSafeDiagnostic('LOCAL_DATA_READY', {
      size: localRows.length
    });
    const base = window.QuarterlyReporting.buildSalesDashboardV3(state.records, reportingTasks(), {
      ...filters,
      filters
    });
    const targetKey = `fiscal:${filters.fiscalYear}:product:${dashboardProductId(filters.product)}`;
    const targetRecord = state.settings?.salesTargets?.[targetKey];
    currentReportMaterial = window.QuarterlyReporting.buildSalesDashboardV3(state.records, reportingTasks(), {
      ...filters,
      filters,
      targetPlan: targetRecord?.metricKey === base.metric.key ? targetRecord : null
    });
    recordSafeDiagnostic('REPORTING_COMPLETE', {
      size: currentReportMaterial.charts?.length || 0
    });
    renderReportMaterial(currentReportMaterial);
    const reportProductName = dashboardProductId(currentReportMaterial.filters.product) === "Primary Product B" ? "Primary Product B" : "Primary Product A";
    els.reportGenerationStatus.textContent = `已生成 ${reportProductName} FY${currentReportMaterial.fiscal.fiscalYear} Q${currentReportMaterial.fiscal.fiscalQuarter} 汇报预览。`;
    return currentReportMaterial;
  } catch (error) {
    currentReportMaterial = null;
    recordSafeDiagnostic('ERROR', {
      stage: 'REPORTING_COMPLETE',
      errorType: error.name,
      message: error.message
    });
    els.reportGenerationStatus.textContent = `报告数据生成失败：${error.message}`;
    showToast(`报告数据生成失败：${error.message}`);
    return null;
  }
}
function openReportMode() {
  dashboardV2Filters ||= defaultDashboardV2Filters();
  const latestRecordDate = state.records.map(record => record.date).filter(Boolean).sort().pop();
  const referenceDate = (dashboardV2Filters.cutoffDate || els.dashboardReferenceDate.value || latestRecordDate || dateKey()).slice(0, 10);
  const context = window.QuarterlyReporting?.resolveFiscalPeriod?.(referenceDate);
  const years = [...new Set([context?.fiscalYear, dashboardV2Filters.fiscalYear, ...state.records.map(record => window.QuarterlyReporting?.resolveFiscalPeriod?.(record.date)?.fiscalYear)].filter(Boolean))].sort((a, b) => b - a);
  els.reportFiscalYear.innerHTML = years.map(year => `<option value="${year}">FY${year}</option>`).join('');
  els.reportFiscalYear.value = String(dashboardV2Filters.fiscalYear || context?.fiscalYear);
  els.reportFiscalQuarter.value = String(dashboardV2Filters.fiscalQuarter || context?.fiscalQuarter || 1);
  els.reportProduct.value = ["Primary Product A", "Primary Product B"].includes(dashboardV2Filters.product) ? dashboardV2Filters.product : "Primary Product A";
  els.reportReferenceDate.value = referenceDate;
  currentReportMaterial = null;
  els.reportSummary.hidden = true;
  els.reportGenerationStatus.textContent = '';
  els.reportMaterialGrid.innerHTML = state.records.length ? '<p class="report-placeholder">选择财年、财季、产品和截止日期后，可预览并生成真实季度 PPT。</p>' : '<p class="report-placeholder">当前没有销售数据。导入或同步销售明细后即可生成季度 PPT。</p>';
  els.downloadReportButton.disabled = state.records.length === 0;
  els.reportDialog.showModal();
}
function reportFilters() {
  return {
    fiscalYear: Number(els.reportFiscalYear.value),
    fiscalQuarter: Number(els.reportFiscalQuarter.value),
    month: null,
    cutoffDate: els.reportReferenceDate.value,
    product: els.reportProduct.value,
    office: 'all',
    hospital: 'all',
    department: 'all',
    employee: 'all'
  };
}
async function downloadReportMaterial() {
  recordSafeDiagnostic('PPT_BUTTON_CLICK', {
    onlineStatus: navigator.onLine
  });
  els.downloadReportButton.disabled = true;
  els.reportGenerationStatus.textContent = '正在生成PPT…';
  await new Promise(resolve => requestAnimationFrame(() => resolve()));
  try {
    if (!currentReportMaterial) generateQuarterlyReport();
    if (!currentReportMaterial) return;
    if (!window.QuarterlyPpt || typeof window.PptxGenJS !== 'function') throw new Error('PPT 生成组件未加载');
    recordSafeDiagnostic('PPT_GENERATION_START');
    const deck = window.QuarterlyPpt.buildDeckModel(currentReportMaterial);
    const filename = await window.QuarterlyPpt.download(deck, window.PptxGenJS, progress => {
      els.reportGenerationStatus.textContent = progress.percent ? `${progress.message} ${progress.percent}%` : progress.message;
    });
    recordSafeDiagnostic('FILE_WRITE_SUCCESS', {
      message: filename
    });
    els.reportGenerationStatus.textContent = `已生成：${filename}`;
    showToast('季度 PPT 已生成');
  } catch (error) {
    recordSafeDiagnostic('ERROR', {
      stage: 'PPT_EXPORT',
      errorType: error.name,
      message: error.message
    });
    console.error('季度 PPT 生成失败', error);
    els.reportGenerationStatus.textContent = `生成失败：${error.message}`;
    showToast(`PPT 导出失败：${error.message}`);
  } finally {
    els.downloadReportButton.disabled = false;
  }
}
function dashboardMaterial() {
  if (!window.QuarterlyReporting) return null;
  if (!els.dashboardReferenceDate.value) {
    const latestRecordDate = state.records.map(record => record.date).filter(Boolean).sort().pop();
    els.dashboardReferenceDate.value = (latestRecordDate || dateKey()).slice(0, 10);
  }
  return window.QuarterlyReporting.buildQuarterlyReportMaterial(state.records, {
    asOfDate: els.dashboardReferenceDate.value,
    periodMode: dashboardPeriodMode,
    product: dashboardV2Filters?.product || "Primary Product A"
  });
}
function formatDashboardChange(value) {
  if (value === null) return {
    value: '—',
    detail: '暂无可比基期',
    tone: 'neutral'
  };
  return {
    value: `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`,
    detail: value >= 0 ? '较对比期增长' : '较对比期下降',
    tone: value >= 0 ? 'positive' : 'negative'
  };
}
function dashboardTarget(material) {
  const selected = material.dashboard.selectedPeriod;
  const stored = state.settings?.salesTargets?.[selected.key];
  if (!stored || stored.metricKey !== material.metric.key || !(Number(stored.value) > 0)) return null;
  return Number(stored.value);
}
function dashboardIcon(name) {
  const paths = {
    sales: '<path d="M5 19V9m7 10V5m7 14v-7"></path><path d="M3 19h18"></path>',
    target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><path d="m15 9 5-5"></path>',
    trend: '<path d="m4 16 5-5 4 3 7-8"></path><path d="M16 6h4v4"></path>',
    hospital: '<path d="M5 21V7h14v14M9 7V3h6v4M9 12h6M12 9v6M8 21v-3h8v3"></path>',
    alert: '<path d="M12 3 2.8 19h18.4L12 3Z"></path><path d="M12 9v4m0 3h.01"></path>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.trend}</svg>`;
}
function dashboardKpiIcon(label) {
  if (label === '本期销售') return 'sales';
  if (label === '目标达成率') return 'target';
  if (label === '活跃医院') return 'hospital';
  if (label === '重点关注') return 'alert';
  return 'trend';
}
function dashboardChartCard(chart, metric, index) {
  const compactChart = {
    ...chart,
    series: chart.series.slice(0, chart.id === 'fiscal-monthly-trend' ? 12 : 6)
  };
  return `<article class="dashboard-v1-chart dashboard-v1-chart-${escapeHTML(chart.id)} ${index < 2 ? 'dashboard-v1-chart-wide' : ''}" data-dashboard-v1-chart="${escapeHTML(chart.id)}">
    <header><div><p class="eyebrow">${index === 0 ? '销售趋势' : index === 1 ? '季度对比' : '贡献结构'}</p><h2>${escapeHTML(chart.title)}</h2></div><small>${escapeHTML(chart.timeRange)}</small></header>
    <div class="dashboard-v1-chart-stage">${reportChartMarkup(compactChart, metric)}</div>
    <p class="dashboard-chart-conclusion">${escapeHTML(chart.conclusion)}</p>
  </article>`;
}
function dashboardAlertMarkup(signals) {
  if (!signals.length) return '<p class="dashboard-alert-empty">当前范围暂未发现明显异常。</p>';
  return signals.slice(0, 3).map(signal => `<div class="dashboard-alert-row" data-level="${escapeHTML(signal.level)}">
    <span class="dashboard-alert-icon" aria-hidden="true">${dashboardIcon('alert')}</span>
    <span><strong>${escapeHTML(signal.title)}</strong><small>${escapeHTML(signal.detail)}</small></span>
    <span class="dashboard-alert-arrow" aria-hidden="true">›</span>
  </div>`).join('');
}
function defaultDashboardV2Filters() {
  const today = dateKey();
  const context = window.QuarterlyReporting?.resolveFiscalPeriod?.(today);
  const saved = state.settings?.dashboardV2Filters || {};
  const currentMonth = context?.month || Number(today.slice(5, 7));
  const currentQuarter = context?.fiscalQuarter || (currentMonth >= 10 ? 1 : currentMonth <= 3 ? 2 : currentMonth <= 6 ? 3 : 4);
  const savedProduct = ["Primary Product A", "Primary Product B"].includes(saved.product) ? saved.product : "Primary Product A";
  return {
    fiscalYear: context?.fiscalYear || Number(today.slice(0, 4)),
    fiscalQuarter: currentQuarter,
    month: currentMonth,
    cutoffDate: today,
    product: "Primary Product A",
    office: 'all',
    hospital: 'all',
    department: 'all',
    employee: 'all',
    ...(saved.fiscalYear ? saved : {}),
    product: savedProduct
  };
}
function dashboardProductId(product) {
  return window.ProductRegistry?.getProduct(product)?.id || 'unknown';
}
function persistentDashboardFilters() {
  return {
    ...defaultDashboardV2Filters(),
    ...(state.settings?.dashboardV2Filters || {})
  };
}
function normalizedNavigationFilterPatch(context = {}) {
  const patch = window.WorkspaceNavigation?.resolvedFilterPatch?.(context) || {};
  ['product', 'office', 'hospital', 'department', 'employee'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] === null) patch[key] = 'all';
  });
  ['hospitalId', 'departmentId', 'employeeId', 'customerId'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] === null) patch[key] = '';
  });
  return patch;
}
function reportingTasks() {
  const planTasks = (state.customerUpgradePlans || []).map(item => window.CustomerUpgradeAdapter?.toEmployeePlanTask?.(item)).filter(Boolean);
  const employeePlanTasks = (state.employeePlanRecords || []).map(item => window.FourThreePlanAdapter?.toEmployeePlanTask?.(item)).filter(Boolean);
  return [...state.tasks, ...planTasks, ...employeePlanTasks];
}
const customerPlanProvider = {
  getCustomerPlans(customerId, context = {}) {
    const matches = (left, right) => !right || dimensionMatches(left, right);
    return (state.customerUpgradePlans || []).filter(item => item.product === context.product && `${item.fiscalYear}-${String(item.month).padStart(2, '0')}` === context.month && matches(item.customer, context.customerName) && matches(item.hospital, context.hospital) && matches(item.department, context.department) && matches(item.employee, context.employee)).map(item => ({
      id: item.id,
      customerId,
      product: item.product,
      perceptionLevel: item.perceptionLevel,
      targetMonth: `${item.fiscalYear}-${String(item.month).padStart(2, '0')}`,
      targetSales: item.nextMonthTarget,
      targetGrade: item.currentTargetGrade,
      issues: item.problem,
      followUp: item.followUp,
      executionStatus: item.status,
      nextReviewDate: item.nextReviewDate || ''
    }));
  }
};
const resourceInvestmentProvider = {
  getResourceInvestments(customerId, context = {}) {
    return (state.customerUpgradePlans || []).filter(item => item.product === context.product && item.academicInvestment && (!context.customerName || dimensionMatches(item.customer, context.customerName)) && (!context.hospital || dimensionMatches(item.hospital, context.hospital)) && (!context.department || dimensionMatches(item.department, context.department))).map(item => ({
      id: `upgrade-resource-${item.id}`,
      customerId,
      product: item.product,
      project: item.academicInvestment,
      amount: null,
      applicant: item.employee,
      appliedAt: item.updatedAt || item.importedAt,
      executedAt: '',
      purpose: '客户升级计划中的学术投入记录',
      expectedGoal: item.nextMonthTarget === null ? '' : `${item.nextMonthTarget}盒`,
      result: ''
    }));
  }
};
function dashboardV2TargetKey(filters = dashboardV2Filters || defaultDashboardV2Filters()) {
  const base = `fiscal:${filters.fiscalYear}:product:${dashboardProductId(filters.product)}`;
  return filters.office && filters.office !== 'all' ? `${base}:office:${filters.office}` : base;
}
function dashboardV2TargetRecord() {
  const stored = state.settings?.salesTargets?.[dashboardV2TargetKey()];
  if (!stored || stored.metricKey !== 'orderBoxes' || !(Number(stored.annualTarget ?? stored.value) > 0)) return null;
  return stored;
}
function updateDashboardV2Filters(next) {
  const current = dashboardV2Filters || persistentDashboardFilters();
  const updated = {
    ...current,
    ...next
  };
  if (Object.prototype.hasOwnProperty.call(next, 'hospital') && next.hospital !== current.hospital) updated.hospitalId = '';
  if (Object.prototype.hasOwnProperty.call(next, 'department') && next.department !== current.department) updated.departmentId = '';
  if (Object.prototype.hasOwnProperty.call(next, 'employee') && next.employee !== current.employee) updated.employeeId = '';
  dashboardV2Filters = updated;
  const navigationSource = workspaceNavigationController?.getCurrentEntry?.()?.contract?.source?.module;
  if (navigationSource && navigationSource !== 'modules') transientNavigationContext = {
    ...updated
  };else {
    transientNavigationContext = null;
    state.settings.dashboardV2Filters = {
      ...updated
    };
    persist({
      skipCloud: true
    });
  }
  renderSalesDashboardV1();
}
function renderSalesDashboardV1() {
  if (!els.salesDashboardV2 || !window.QuarterlyReporting?.buildSalesDashboardV2 || !window.SalesDashboardV2) return;
  dashboardV2Filters ||= defaultDashboardV2Filters();
  const targetRecord = dashboardV2TargetRecord();
  const model = window.QuarterlyReporting.buildSalesDashboardV3(state.records, reportingTasks(), {
    ...dashboardV2Filters,
    filters: dashboardV2Filters,
    targetPlan: targetRecord,
    employeePlanRecords: state.employeePlanRecords || []
  });
  els.dashboardReferenceDate.value = model.fiscal.cutoffDate;
  window.SalesDashboardV2.mount(els.salesDashboardV2, model, {
    onFilters: filters => updateDashboardV2Filters(filters),
    onData: openDataManagement,
    onReport: openReportMode,
    onRefresh: () => window.workDeskCloud?.syncNow().then(() => {
      renderDataDashboard();
      showToast('销售数据已刷新');
    }).catch(error => showToast(error.message)),
    onBack: () => workspaceNavigationController?.handleBack('page') || switchView('tasks'),
    onUpgradeManage: openCustomerUpgradeManager
  });
  const entry = workspaceNavigationController?.getCurrentEntry?.();
  const sourceLabels = {
    task: '任务进度',
    activity: '活动申请',
    customer: '客户档案',
    modules: '原工作区'
  };
  els.salesDashboardV2.querySelector('.v2-rail-back span')?.replaceChildren(document.createTextNode(`返回${sourceLabels[entry?.contract?.source?.module] || '原工作区'}`));
  const mobileBack = els.salesDashboardV2.querySelector('.v2-mobile-back');
  if (mobileBack) mobileBack.setAttribute('aria-label', `返回${sourceLabels[entry?.contract?.source?.module] || '原工作区'}`);
  if (dashboardNavigationNotice) {
    const content = els.salesDashboardV2.querySelector('.v2-content');
    const notice = document.createElement('div');
    notice.className = 'workspace-context-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = `<span>${escapeHTML(dashboardNavigationNotice)}</span>`;
    content?.prepend(notice);
  }
}
function openDataManagement() {
  dashboardV2Filters ||= defaultDashboardV2Filters();
  const material = window.QuarterlyReporting?.buildSalesDashboardV2(state.records, reportingTasks(), {
    ...dashboardV2Filters,
    filters: dashboardV2Filters,
    employeePlanRecords: state.employeePlanRecords || []
  });
  const target = material?.targets?.plan || dashboardV2TargetRecord();
  const years = [...new Set([material?.fiscal?.fiscalYear, ...state.records.map(record => window.QuarterlyReporting?.resolveFiscalPeriod?.(record.date)?.fiscalYear)].filter(Boolean))].sort((a, b) => b - a);
  els.salesTargetFiscalYear.innerHTML = years.map(year => `<option value="${year}">FY${year}</option>`).join('');
  els.salesTargetFiscalYear.value = String(material?.fiscal?.fiscalYear || dashboardV2Filters.fiscalYear);
  els.salesTargetProduct.value = dashboardV2Filters.product;
  els.salesTargetOffice.value = dashboardV2Filters.office || 'all';
  syncWheelTriggers();
  els.salesTargetLabel.textContent = material ? `FY${material.fiscal.fiscalYear} ${dashboardV2Filters.product}月度目标（盒数）` : '月度目标设置（盒数）';
  els.salesTargetInput.value = target?.annualTarget ?? target?.value ?? '';
  els.salesTargetInput.placeholder = '请输入盒数';
  renderSalesTargetMonths(target);
  const adapterStatus = window.SmartSheetAdapter?.create(state.settings?.smartSheet || {}).getStatus();
  els.smartSheetCorpId.value = state.settings?.smartSheet?.corpId || '';
  els.smartSheetSheetId.value = state.settings?.smartSheet?.sheetId || '';
  if (adapterStatus) {
    els.smartSheetStatusText.textContent = adapterStatus.configured ? 'Adapter 配置已保存，正式 API 接入仍需企业微信授权' : 'SmartSheet Adapter 已就绪，等待 corpId 与 sheetId 授权配置';
    els.smartSheetStatusBadge.textContent = adapterStatus.configured ? '待授权' : '未配置';
  }
  els.dataSourceDetail.textContent = `本机销售明细 ${state.records.length} 条，4+3计划 ${state.employeePlanRecords?.length || 0} 条；Excel 导入与离线数据不依赖企业微信连接。`;
  els.dataManagementDialog.showModal();
}
function customerUpgradeContext() {
  const resolved = window.QuarterlyReporting?.resolveFiscalPeriod?.(dateKey()) || {};
  return {
    product: dashboardV2Filters?.product || "Primary Product A",
    fiscalYear: resolved.fiscalYear || Number(dateKey().slice(0, 4)),
    month: resolved.month || Number(dateKey().slice(5, 7))
  };
}
function renderCustomerUpgradePlans() {
  const plans = [...(state.customerUpgradePlans || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  els.customerUpgradePlanCount.textContent = `${plans.length} 条`;
  els.customerUpgradePlanList.innerHTML = plans.length ? plans.slice(0, 50).map(item => `<article>
    <div><strong>${escapeHTML(item.employee)} · ${escapeHTML(item.customer)}</strong><small>${escapeHTML(item.hospital)} / ${escapeHTML(item.department)}</small></div>
    <div><strong>${escapeHTML(item.product)}</strong><small>FY${item.fiscalYear} · ${item.month}月</small></div>
    <div><strong>${escapeHTML(item.perceptionLevel || '未填')} / ${escapeHTML(item.currentTargetGrade || '未填')}</strong><small>观念 / 销量等级</small></div>
    <div><strong>${item.nextMonthTarget === null || item.nextMonthTarget === undefined ? '目标未填' : `${formatNumber(item.nextMonthTarget)}盒`}</strong><small>${escapeHTML(item.status || '待确认')}</small></div>
  </article>`).join('') : '<p class="muted">尚未保存客户升级计划。</p>';
}
function clearCustomerUpgradePreview() {
  customerUpgradePreview = null;
  els.customerUpgradeExcel.value = '';
  els.customerUpgradePreviewStatus.textContent = '尚未选择文件。文件只在本机解析，确认前不会写入。';
  els.customerUpgradePreviewWrap.hidden = true;
  els.customerUpgradePreviewBody.innerHTML = '';
  els.confirmCustomerUpgradeImport.disabled = true;
}
function openCustomerUpgradeManager() {
  const context = customerUpgradeContext();
  els.customerUpgradeProduct.value = context.product;
  els.customerUpgradeFiscalYear.value = String(context.fiscalYear);
  els.customerUpgradeMonth.value = String(context.month);
  clearCustomerUpgradePreview();
  renderCustomerUpgradePlans();
  els.customerUpgradeDialog.showModal();
}
async function previewCustomerUpgradeWorkbook() {
  const file = els.customerUpgradeExcel.files?.[0];
  if (!file) return clearCustomerUpgradePreview();
  if (!window.XLSX || !window.CustomerUpgradeAdapter) return showToast('客户升级 Excel 组件未加载，请刷新后重试');
  try {
    const workbook = window.XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true
    });
    const importedAt = new Date().toISOString();
    const rows = window.CustomerUpgradeAdapter.rowsFromWorkbook(workbook, window.XLSX, {
      product: els.customerUpgradeProduct.value,
      fiscalYear: Number(els.customerUpgradeFiscalYear.value),
      month: Number(els.customerUpgradeMonth.value),
      importedAt
    });
    customerUpgradePreview = window.CustomerUpgradeAdapter.buildPreview(rows, directoryRecords(), {
      ...HOSPITAL_ALIAS_SUGGESTIONS,
      ...customSynonyms()
    });
    const p = customerUpgradePreview;
    els.customerUpgradePreviewStatus.textContent = `共 ${p.total} 条；可导入 ${p.total - p.invalid}、必填字段不完整 ${p.invalid}；精确 ${p.exact}、可能 ${p.probable}、歧义 ${p.ambiguous}、未匹配 ${p.unmatched}；等级一致 ${p.gradeMatch}、不一致 ${p.gradeMismatch}、数据不足 ${p.gradeInsufficient}；重复 ${p.duplicates}、目标为0 ${p.zeroTargets}。请核对后确认。`;
    els.customerUpgradePreviewBody.innerHTML = p.items.slice(0, 100).map(item => `<tr><td>${escapeHTML(item.employee)}<br><small>${escapeHTML(item.customer)}</small></td><td>${escapeHTML(item.hospital)}<br><small>${escapeHTML(item.department)}</small></td><td>${escapeHTML(item.perceptionLevel || '—')}</td><td>${escapeHTML(item.reportedSalesGrade || '—')} / ${escapeHTML(item.computedSalesGrade || '—')}<br><small>${item.gradeCheck}</small></td><td>${item.actuals.june ?? '—'} / ${item.actuals.july ?? '—'} / ${item.nextMonthTarget ?? '—'}</td><td>${escapeHTML(item.match.status)}</td></tr>`).join('');
    els.customerUpgradePreviewWrap.hidden = false;
    els.confirmCustomerUpgradeImport.disabled = p.total - p.invalid <= 0;
  } catch (error) {
    clearCustomerUpgradePreview();
    els.customerUpgradePreviewStatus.textContent = `读取失败：${error.message}`;
  }
}
function saveCustomerUpgradePlans(items) {
  const existing = new Map((state.customerUpgradePlans || []).map(item => [item.id, item]));
  items.forEach(item => {
    const prior = existing.get(item.id);
    const history = prior ? [...(prior.history || []), {
      updatedAt: prior.updatedAt,
      status: prior.status,
      target: prior.nextMonthTarget,
      reportedSalesGrade: prior.reportedSalesGrade
    }].slice(-12) : [];
    existing.set(item.id, {
      ...prior,
      ...item,
      history,
      updatedAt: new Date().toISOString()
    });
  });
  state.customerUpgradePlans = [...existing.values()];
  persist();
  renderCustomerUpgradePlans();
  renderSalesDashboardV1();
}
function confirmCustomerUpgradeImport() {
  if (!customerUpgradePreview?.items?.length) return;
  const unique = [...new Map(customerUpgradePreview.items.filter(item => item.valid).map(item => [item.id, item])).values()];
  saveCustomerUpgradePlans(unique);
  showToast(`已确认导入 ${unique.length} 条客户升级计划`);
  clearCustomerUpgradePreview();
}
function saveManualCustomerUpgrade(event) {
  event.preventDefault();
  const context = {
    product: els.customerUpgradeProduct.value,
    fiscalYear: Number(els.customerUpgradeFiscalYear.value),
    month: Number(els.customerUpgradeMonth.value),
    importedAt: new Date().toISOString()
  };
  const item = window.CustomerUpgradeAdapter.normalizeRow({
    办事处: els.upgradeOffice.value,
    负责人: els.upgradeEmployee.value,
    医院全称: els.upgradeHospital.value,
    科室: els.upgradeDepartment.value,
    客户: els.upgradeCustomer.value,
    '客户观念分级(R1、R2、R3、R4)': els.upgradePerception.value,
    '客户销量分级(A、B、C、D)': els.upgradeSalesGrade.value,
    '6月销售': els.upgradeJuneActual.value,
    '7月销售': els.upgradeJulyActual.value,
    '8月目标': els.upgradeNextTarget.value,
    '学术投入情况记录\n(月份+活动）': els.upgradeAcademicInvestment.value,
    存在问题分析: els.upgradeProblem.value,
    后续跟进方案: els.upgradeFollowUp.value
  }, context);
  item.status = els.upgradeStatus.value;
  item.notes = els.upgradeNotes.value.trim();
  saveCustomerUpgradePlans([item]);
  els.customerUpgradeManualForm.reset();
  showToast('客户升级计划已保存并纳入分析');
}
function salesTargetFiscalMonths(fiscalYear = Number(els.salesTargetFiscalYear?.value || dashboardV2Filters?.fiscalYear)) {
  return [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(month => ({
    month,
    key: `${month >= 10 ? fiscalYear - 1 : fiscalYear}-${String(month).padStart(2, '0')}`
  }));
}
function currentSalesTargetFormFilters() {
  return {
    fiscalYear: Number(els.salesTargetFiscalYear.value),
    product: els.salesTargetProduct.value,
    office: els.salesTargetOffice.value || 'all'
  };
}
function renderSalesTargetMonths(target = null) {
  const monthly = target?.monthlyTargets || {};
  els.salesTargetMonths.innerHTML = salesTargetFiscalMonths().map(({
    month,
    key
  }) => `<label>${month}月<input type="number" min="0" step="0.01" data-target-month="${key}" value="${monthly[key] ?? monthly[String(month)] ?? ''}" placeholder="—"></label>`).join('');
  els.salesTargetStatus.textContent = target?.source === 'average-confirmed' ? '已保存平均拆分目标，可继续逐月调整。' : target ? '已读取当前目标。修改后点击“确认并保存”。' : '逐月录入，或先填全年目标再平均拆分。';
}
function loadSalesTargetForm() {
  const filters = currentSalesTargetFormFilters();
  const key = dashboardV2TargetKey(filters);
  const stored = state.settings?.salesTargets?.[key] || null;
  const reportFilters = {
    ...filters,
    fiscalQuarter: null,
    month: null,
    cutoffDate: dashboardV2Filters?.cutoffDate
  };
  const material = window.QuarterlyReporting?.buildSalesDashboardV2(state.records, reportingTasks(), {
    ...reportFilters,
    filters: reportFilters,
    targetPlan: stored,
    employeePlanRecords: state.employeePlanRecords || []
  });
  const target = material?.targets?.plan || stored;
  els.salesTargetLabel.textContent = `FY${filters.fiscalYear} ${filters.product}月度目标（盒数）`;
  els.salesTargetInput.value = target?.annualTarget ?? target?.value ?? '';
  renderSalesTargetMonths(target);
}
function averageSalesTarget() {
  const annual = Number(els.salesTargetInput.value);
  if (!(annual > 0)) return showToast('请先填写大于 0 的财年总目标');
  const base = Math.floor(annual / 12 * 100) / 100;
  let assigned = 0;
  [...els.salesTargetMonths.querySelectorAll('[data-target-month]')].forEach((input, index, all) => {
    const value = index === all.length - 1 ? Math.round((annual - assigned) * 100) / 100 : base;
    input.value = String(value);
    assigned += value;
  });
  els.salesTargetStatus.textContent = '已生成平均拆分建议；尚未保存，请确认后点击“确认并保存”。';
}
function copyPreviousSalesTarget() {
  const filters = currentSalesTargetFormFilters();
  const previous = {
    ...filters,
    fiscalYear: filters.fiscalYear - 1
  };
  const source = state.settings?.salesTargets?.[dashboardV2TargetKey(previous)];
  if (!source) return showToast('上一财年没有可复制的目标');
  els.salesTargetInput.value = source.annualTarget ?? source.value ?? '';
  const values = Object.values(source.monthlyTargets || {});
  [...els.salesTargetMonths.querySelectorAll('[data-target-month]')].forEach((input, index) => {
    input.value = values[index] ?? '';
  });
  els.salesTargetStatus.textContent = `已复制 FY${previous.fiscalYear} 目标；尚未保存，请确认后再保存。`;
}
function saveSmartSheetConfig() {
  const config = {
    corpId: els.smartSheetCorpId.value.trim(),
    sheetId: els.smartSheetSheetId.value.trim()
  };
  const validation = window.SmartSheetAdapter?.validateConfig(config);
  if (!validation?.valid) return showToast(validation?.message || '请填写企业 ID 和智能表格 ID');
  state.settings.smartSheet = config;
  state.settings.settingsUpdatedAt = new Date().toISOString();
  persist();
  els.smartSheetStatusText.textContent = 'Adapter 配置已保存，正式 API 接入仍需企业微信授权';
  els.smartSheetStatusBadge.textContent = '待授权';
  showToast('智能表格连接标识已保存');
}
function saveSalesTarget() {
  dashboardV2Filters ||= defaultDashboardV2Filters();
  const formFilters = currentSalesTargetFormFilters();
  const material = window.QuarterlyReporting?.buildSalesDashboardV2(state.records, reportingTasks(), {
    ...formFilters,
    cutoffDate: dashboardV2Filters.cutoffDate,
    filters: formFilters,
    employeePlanRecords: state.employeePlanRecords || []
  });
  if (!material) return;
  const value = Number(els.salesTargetInput.value);
  state.settings.salesTargets = {
    ...(state.settings.salesTargets || {})
  };
  const key = dashboardV2TargetKey(formFilters);
  const monthlyTargets = Object.fromEntries([...els.salesTargetMonths.querySelectorAll('[data-target-month]')].map(input => [input.dataset.targetMonth, input.value === '' ? null : Number(input.value)]));
  if (Object.values(monthlyTargets).some(entry => entry !== null && entry < 0)) return showToast('月目标不能小于 0');
  const monthlyTotal = Object.values(monthlyTargets).filter(entry => entry !== null).reduce((a, b) => a + b, 0);
  const annualTarget = value > 0 ? value : monthlyTotal > 0 ? monthlyTotal : null;
  if (annualTarget === null) delete state.settings.salesTargets[key];else state.settings.salesTargets[key] = {
    schemaVersion: 2,
    fiscalYear: formFilters.fiscalYear,
    product: dashboardProductId(formFilters.product),
    office: formFilters.office,
    annualTarget,
    value: annualTarget,
    monthlyTargets,
    metricKey: 'orderBoxes',
    source: Object.values(monthlyTargets).every(entry => entry !== null) ? 'monthly-confirmed' : 'annual-only',
    updatedAt: new Date().toISOString()
  };
  state.settings.settingsUpdatedAt = new Date().toISOString();
  persist();
  renderSalesDashboardV1();
  showToast(annualTarget === null ? '目标已清除' : '月度目标已确认保存');
}
function renderEmployeeContribution(records) {
  const groups = groupRows(records, record => record.employee || '未填写员工');
  const rows = [...groups.entries()].map(([name, items]) => ({
    name,
    sales: sum(items, 'salesAmount'),
    boxes: sum(items, 'orderBoxes')
  })).sort((a, b) => b.sales - a.sales || b.boxes - a.boxes).slice(0, 10);
  const useSales = rows.some(row => row.sales > 0);
  const total = rows.reduce((value, row) => value + (useSales ? row.sales : row.boxes), 0) || 1;
  const max = Math.max(...rows.map(row => useSales ? row.sales : row.boxes), 1);
  els.employeeContributionChart.innerHTML = rows.map(row => {
    const value = useSales ? row.sales : row.boxes;
    return `<button class="bar-item drilldown-button" type="button" data-employee-drill="${escapeHTML(row.name)}"><div class="bar-label"><span>${escapeHTML(row.name)}</span><strong>${(value / total * 100).toFixed(1)}% · ${useSales ? formatMoney(row.sales) : `${formatNumber(row.boxes)}盒`}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${value / max * 100}%"></div></div></button>`;
  }).join('');
}
function renderDimensionContribution(records, key, target, emptyLabel) {
  const groups = groupRows(records, record => record[key] || emptyLabel);
  const rows = [...groups.entries()].map(([name, items]) => ({
    name,
    boxes: sum(items, 'orderBoxes'),
    orders: items.length
  })).sort((a, b) => b.boxes - a.boxes).slice(0, 10);
  const total = rows.reduce((value, row) => value + row.boxes, 0) || 1;
  const max = Math.max(...rows.map(row => row.boxes), 1);
  target.innerHTML = rows.map(row => `<div class="bar-item"><div class="bar-label"><span>${escapeHTML(row.name)}</span><strong>${formatNumber(row.boxes)}盒 · ${(row.boxes / total * 100).toFixed(1)}%</strong></div><div class="bar-track"><div class="bar-fill" style="width:${row.boxes / max * 100}%"></div></div><p class="chart-note">${formatNumber(row.orders, 0)} 笔订单 · 单次 ${formatNumber(row.boxes / row.orders)} 盒</p></div>`).join('');
}
function renderOrderSizeDistribution(records) {
  const bins = [{
    label: '1盒',
    test: value => value === 1
  }, {
    label: '2–3盒',
    test: value => value >= 2 && value <= 3
  }, {
    label: '4–5盒',
    test: value => value >= 4 && value <= 5
  }, {
    label: '6–10盒',
    test: value => value >= 6 && value <= 10
  }, {
    label: '10盒以上',
    test: value => value > 10
  }].map(bin => ({
    ...bin,
    count: records.filter(record => bin.test(record.orderBoxes || 0)).length
  }));
  const total = records.length || 1;
  const max = Math.max(...bins.map(bin => bin.count), 1);
  els.orderSizeChart.innerHTML = bins.map(bin => `<div class="bar-item"><div class="bar-label"><span>${bin.label}</span><strong>${formatNumber(bin.count, 0)}笔 · ${(bin.count / total * 100).toFixed(1)}%</strong></div><div class="bar-track"><div class="bar-fill alt" style="width:${bin.count / max * 100}%"></div></div></div>`).join('');
}
function renderAddressContribution(records) {
  renderDimensionContribution(records.filter(record => record.address), 'address', els.addressContributionChart, '未填写地址');
}
function renderActivityEfficiency(records) {
  const activityRows = records.filter(record => record.activityType || record.activityCost > 0);
  if (!activityRows.length) {
    els.activityEfficiencyChart.innerHTML = '<p class="chart-note">筛选范围内没有活动投入记录。</p>';
    return;
  }
  const groups = groupRows(activityRows, record => record.activityType || '未填写类型');
  const rows = [...groups.entries()].map(([name, items]) => {
    const related = records.filter(record => items.some(item => {
      const supplied = ['employee', 'hospital', 'department', 'customer', 'product'].filter(key => item[key]);
      return supplied.length > 0 && supplied.every(key => record[key] === item[key]);
    }));
    const cost = sum(items, 'activityCost');
    const sales = sum(related, 'salesAmount');
    return {
      name,
      cost,
      sales,
      visits: sum(related, 'visitCount'),
      efficiency: cost ? sales / cost : 0
    };
  }).sort((a, b) => b.efficiency - a.efficiency).slice(0, 8);
  const max = Math.max(...rows.map(row => row.efficiency), 1);
  els.activityEfficiencyChart.innerHTML = rows.map(row => `<div class="bar-item"><div class="bar-label"><span>${escapeHTML(row.name)}</span><strong>${row.cost ? `${row.efficiency.toFixed(1)}倍` : '未填金额'}</strong></div><div class="bar-track"><div class="bar-fill alt" style="width:${row.efficiency / max * 100}%"></div></div><p class="chart-note">投入 ${formatMoney(row.cost)} · 同期销售 ${formatMoney(row.sales)} · 拜访 ${formatNumber(row.visits, 0)} 次</p></div>`).join('') + '<p class="chart-note">销售/投入只表示同期量化关系，不等同于活动带来的因果增量。</p>';
}
function relatedTasksFor(employee, product, week) {
  return state.tasks.filter(task => {
    if (employee && task.employee && task.employee !== employee) return false;
    if (product && task.product && task.product !== product) return false;
    if (!task.employee && !task.product) return false;
    const taskDate = (task.due || task.updatedAt || '').slice(0, 10);
    return !taskDate || weekStartKey(taskDate) === week;
  });
}
function renderAlignment(records) {
  const groups = groupRows(records, record => `${record.employee || '未填写员工'}\u0001${record.product || '未填写产品'}\u0001${record.date.slice(0, 7)}`);
  const monthlyTotals = new Map();
  records.forEach(record => monthlyTotals.set(record.date.slice(0, 7), (monthlyTotals.get(record.date.slice(0, 7)) || 0) + (record.orderBoxes || 0)));
  const boxesByKey = new Map([...groups.entries()].map(([key, items]) => [key, sum(items, 'orderBoxes')]));
  const rows = [...groups.entries()].map(([key, items]) => {
    const [employee, product, month] = key.split('\u0001');
    const previousMonth = shiftMonth(month, -1);
    const previousBoxes = boxesByKey.get(`${employee}\u0001${product}\u0001${previousMonth}`) || 0;
    const boxes = sum(items, 'orderBoxes');
    const tasks = state.tasks.filter(task => task.employee === employee && (!task.product || task.product === product));
    return {
      employee,
      product,
      month,
      orders: items.length,
      boxes,
      average: boxes / items.length,
      contribution: boxes / (monthlyTotals.get(month) || 1),
      change: previousBoxes ? (boxes - previousBoxes) / previousBoxes : null,
      tasks: tasks.length
    };
  }).sort((a, b) => b.month.localeCompare(a.month) || b.boxes - a.boxes).slice(0, 15);
  els.alignmentTableBody.innerHTML = rows.map(row => `<tr><td><strong>${escapeHTML(row.employee)}</strong><br><span class="muted">${escapeHTML(row.product)} · ${row.month}</span></td><td class="numeric">${formatNumber(row.orders, 0)}</td><td class="numeric">${formatNumber(row.boxes)}</td><td class="numeric">${formatNumber(row.average)}盒</td><td class="numeric">${(row.contribution * 100).toFixed(1)}%</td><td class="${row.change === null || row.change >= 0 ? 'status-good' : 'status-check'}">${row.change === null ? '新增/无上月' : `${row.change >= 0 ? '+' : ''}${(row.change * 100).toFixed(0)}%`}</td><td><button class="link-task-button" data-task-query="${escapeHTML(row.employee)}"${taskContextAttributes({
    employee: row.employee,
    product: row.product
  })}>${row.tasks ? `${row.tasks} 项任务` : '查看任务'}</button></td></tr>`).join('');
}
function shiftMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function latestCompletedMonth() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function dimensionMatches(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  if (!a || !b) return !a && !b;
  return a === b || a.includes(b) || b.includes(a);
}
function pearsonCorrelation(xs, ys) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const meanX = xs.reduce((sumValue, value) => sumValue + value, 0) / xs.length;
  const meanY = ys.reduce((sumValue, value) => sumValue + value, 0) / ys.length;
  let numerator = 0;
  let dx2 = 0;
  let dy2 = 0;
  xs.forEach((value, index) => {
    const dx = value - meanX;
    const dy = ys[index] - meanY;
    numerator += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  });
  return dx2 && dy2 ? numerator / Math.sqrt(dx2 * dy2) : null;
}
function customerDepartmentStats(task, month) {
  const departmentRecords = state.records.filter(record => record.date.startsWith(month) && (!task.hospital || taskDimensionMatches(task.hospital, record.hospital)) && (!task.department || taskDimensionMatches(task.department, record.department) || taskDimensionMatches(task.department, record.departmentRoom)));
  const departmentBoxes = sum(departmentRecords, 'orderBoxes');
  const weeklyEntries = Object.entries(task.weeklyOutputs || {}).filter(([week]) => week.startsWith(month)).sort(([a], [b]) => a.localeCompare(b));
  const customerValues = weeklyEntries.map(([, value]) => Number(value) || 0);
  const departmentValues = weeklyEntries.map(([week]) => sum(departmentRecords.filter(record => /\-W[1-4]$/.test(week) ? customerPeriodForDate(record.date).key === week : weekStartKey(record.date) === week), 'orderBoxes'));
  const output = customerValues.reduce((total, value) => total + value, 0);
  return {
    output,
    departmentBoxes,
    share: departmentBoxes ? output / departmentBoxes : null,
    correlation: pearsonCorrelation(customerValues, departmentValues),
    weeklyEntries
  };
}
function correlationLabel(value) {
  if (value === null) return '数据不足';
  const absolute = Math.abs(value);
  const strength = absolute >= .7 ? '强' : absolute >= .4 ? '中' : '弱';
  return `${value >= 0 ? '正' : '负'}相关 ${strength}（${value.toFixed(2)}）`;
}
function contributionLabel(share) {
  if (share === null) return '—';
  const value = `${(share * 100).toFixed(1)}%`;
  return share > 1 ? `${value} · 需核查` : value;
}
function renderDepartmentCustomerSummary(records) {
  const months = [...new Set(records.map(record => record.date.slice(0, 7)))].sort();
  const month = months.at(-1) || els.customerMonthFilter?.value || latestCompletedMonth();
  const tasks = state.tasks.filter(task => task.category === CUSTOMER_VISIT_CATEGORY && task.customer);
  els.departmentCustomerBody.innerHTML = tasks.length ? tasks.map(task => {
    const stats = customerDepartmentStats(task, month);
    return `<tr><td><strong>${escapeHTML(task.hospital || '未填写医院')}</strong><br><span class="muted">${escapeHTML(task.department || '未填写科室')}</span></td><td>${escapeHTML(task.customer)}</td><td class="numeric">${formatNumber(stats.output)}</td><td><span class="customer-rating rating-${customerRating(stats.output).toLowerCase()}">${customerRating(stats.output)}</span></td><td class="numeric">${formatNumber(stats.departmentBoxes)}盒</td><td class="numeric ${stats.share > 1 ? 'status-check' : ''}">${contributionLabel(stats.share)}</td><td>${correlationLabel(stats.correlation)}</td></tr>`;
  }).join('') : '<tr><td colspan="7" class="muted">还没有已关联科室的客户拜访任务。</td></tr>';
}
function renderCustomerDashboard() {
  if (window.customerProfileV1App) {
    window.customerProfileV1App.update({
      records: state.records,
      tasks: state.tasks
    });
    return;
  }
  if (!els.customerMonthFilter || !els.customerKpis || !els.customerBoard) return;
  renderCustomerMonthOptions();
  const month = els.customerMonthFilter.value || latestCompletedMonth();
  const tasks = state.tasks.filter(task => task.category === CUSTOMER_VISIT_CATEGORY && task.customer);
  els.customerEmpty.hidden = tasks.length > 0;
  const rows = tasks.map(task => ({
    task,
    stats: customerDepartmentStats(task, month)
  })).sort((a, b) => b.stats.output - a.stats.output);
  const totalOutput = rows.reduce((total, row) => total + row.stats.output, 0);
  const hospitalGroups = new Map();
  rows.forEach(row => {
    const hospital = row.task.hospital?.trim();
    if (!hospital) return;
    if (!hospitalGroups.has(hospital)) hospitalGroups.set(hospital, new Map());
    const customers = hospitalGroups.get(hospital);
    const current = customers.get(row.task.customer) || {
      customer: row.task.customer,
      departments: new Set()
    };
    if (row.task.department) current.departments.add(row.task.department);
    customers.set(row.task.customer, current);
  });
  const hospitalArchives = [...hospitalGroups.entries()].filter(([, customers]) => customers.size >= 2);
  els.customerKpis.innerHTML = [['客户档案', `${rows.length} 位`], ['月产出', formatNumber(totalOutput)], ['已拜访', `${rows.filter(row => Number(row.task.progress) >= 100).length} 位`], ['医院档案', `${hospitalArchives.length} 家`]].map(([label, value]) => `<div class="dashboard-kpi"><span>${label}</span><strong>${value}</strong></div>`).join('');
  els.customerArchiveCount.textContent = `${rows.length} 位客户`;
  const outputPeriod = previousCustomerPeriod();
  els.customerBoard.innerHTML = rows.map(({
    task,
    stats
  }) => {
    const expanded = expandedCustomerIds.has(task.id);
    const visited = Number(task.progress) >= 100;
    return `<article class="customer-card">
      <button class="customer-summary" type="button" data-toggle-customer="${task.id}" aria-expanded="${expanded}">
        <span class="customer-visit-status ${visited ? 'visited' : ''}">${visited ? '✓' : '○'}</span>
        <span><strong>${escapeHTML(task.customer)}</strong><small>${escapeHTML(task.hospital || '未填写医院')} · ${escapeHTML(task.department || '未填写科室')}</small></span>
        <span class="customer-output"><strong>${formatNumber(stats.output)}</strong><small>月产出</small></span>
        <span aria-hidden="true">${expanded ? '⌃' : '⌄'}</span>
      </button>
      <div class="customer-details" ${expanded ? '' : 'hidden'}>
        <div class="customer-detail-grid"><div><span>职称</span><strong>${escapeHTML(task.customerJobTitle || '待补充')}</strong></div><div><span>管床数</span><strong>${task.managedBeds === '' || task.managedBeds === undefined ? '待补充' : `${formatNumber(task.managedBeds, 0)}床`}</strong></div><div><span>客户类型</span><strong>${escapeHTML(task.customerType || '待补充')}</strong></div><div><span>归属信息员</span><strong>${escapeHTML(task.employee || '未填写')}</strong></div></div>
        <div class="weekly-output-entry"><label>客户周产出<span class="weekly-output-controls"><select class="weekly-slot-select" data-customer-slot="${task.id}" data-week-month="${outputPeriod.month}" aria-label="选择客户周次">${weeklySlotOptions(outputPeriod.slot)}</select><input type="number" min="0" step="1" inputmode="decimal" data-customer-output="${task.id}" value="${Number(task.weeklyOutputs?.[outputPeriod.key] || 0)}"></span></label><button class="button compact-button" type="button" data-save-customer-output="${task.id}">保存</button></div>
        <p class="chart-note">周记录：${stats.weeklyEntries.length ? stats.weeklyEntries.map(([week, value]) => `${week}：${formatNumber(value)}`).join(' · ') : '本月尚未填写'}</p>
        <button class="edit-button" type="button" data-edit-customer-profile="${task.id}">补充 / 修改档案</button>
      </div>
    </article>`;
  }).join('');
  els.hospitalArchiveSection.hidden = hospitalArchives.length === 0;
  els.hospitalArchiveCount.textContent = `${hospitalArchives.length} 家医院`;
  els.hospitalArchiveBoard.innerHTML = hospitalArchives.map(([hospital, customers]) => `<article class="hospital-archive-card">
    <div class="hospital-archive-heading"><strong>${escapeHTML(hospital)}</strong><span>${customers.size} 位客户</span></div>
    <div class="hospital-customer-list">${[...customers.values()].map(item => `<div><span>${escapeHTML([...item.departments].join('、') || '未填写科室')}</span><strong>${escapeHTML(item.customer)}</strong></div>`).join('')}</div>
  </article>`).join('');
}
function handleCustomerBoardClick(event) {
  const saveButton = event.target.closest('[data-save-customer-output]');
  if (saveButton) {
    const task = state.tasks.find(item => item.id === saveButton.dataset.saveCustomerOutput);
    const input = els.customerBoard.querySelector(`[data-customer-output="${CSS.escape(saveButton.dataset.saveCustomerOutput)}"]`);
    if (!task || !input) return;
    const outputKey = selectedWeeklyOutputKey(els.customerBoard, task.id, 'customer');
    task.weeklyOutputs = {
      ...(task.weeklyOutputs || {}),
      [outputKey]: Number(input.value) || 0
    };
    task.updatedAt = new Date().toISOString();
    persist();
    render();
    showToast('客户周产出已更新');
    return;
  }
  const editButton = event.target.closest('[data-edit-customer-profile]');
  if (editButton) {
    const task = state.tasks.find(item => item.id === editButton.dataset.editCustomerProfile);
    if (task) openTask(task);
    return;
  }
  const toggle = event.target.closest('[data-toggle-customer]');
  if (!toggle) return;
  const id = toggle.dataset.toggleCustomer;
  if (expandedCustomerIds.has(id)) expandedCustomerIds.delete(id);else expandedCustomerIds.add(id);
  renderCustomerDashboard();
}
function consistencyLabel(row) {
  if (row.taskProgress !== null && row.taskProgress >= 50 && row.boxes === 0 && row.visits === 0 && row.cost === 0) return {
    label: '需核查',
    className: 'status-check'
  };
  if (row.visits > 0 && (row.boxes > 0 || row.sales > 0)) return {
    label: '有数据佐证',
    className: 'status-good'
  };
  if ((row.visits > 0 || row.cost > 0) && row.boxes === 0 && row.sales === 0) return {
    label: '待观察',
    className: 'status-watch'
  };
  if ((row.boxes > 0 || row.sales > 0) && row.visits === 0 && row.cost === 0) return {
    label: '过程未记录',
    className: 'status-watch'
  };
  return {
    label: '数据不足',
    className: 'status-watch'
  };
}
function renderHospitalPotential(records) {
  const dates = records.map(record => new Date(`${record.date}T00:00:00`).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  const midpoint = dates.length ? dateKey(new Date((dates[0] + dates.at(-1)) / 2)) : '';
  const groups = groupRows(records.filter(record => record.hospital), record => record.hospital);
  const useSales = sum(records, 'salesAmount') > 0;
  let hospitals = [...groups.entries()].map(([hospital, items]) => {
    const previous = items.filter(record => record.date < midpoint);
    const current = items.filter(record => record.date >= midpoint);
    const previousValue = sum(previous, useSales ? 'salesAmount' : 'orderBoxes');
    const currentValue = sum(current, useSales ? 'salesAmount' : 'orderBoxes');
    const growth = previousValue ? (currentValue - previousValue) / previousValue : currentValue > 0 ? 1 : 0;
    const sales = sum(items, 'salesAmount');
    const boxes = sum(items, 'orderBoxes');
    const cost = sum(items, 'activityCost');
    const taskCount = state.tasks.filter(task => taskDimensionMatches(task.hospital, hospital) && task.progress < 100).length;
    return {
      hospital,
      growth,
      sales,
      volume: useSales ? sales : boxes,
      boxes,
      employeeCount: new Set(items.map(item => item.employee).filter(Boolean)).size,
      cost,
      orders: items.filter(item => item.orderBoxes > 0).length,
      efficiency: cost ? sales / cost : 0,
      taskCount
    };
  });
  const scoringFields = useSales ? ['growth', 'volume', 'orders', 'efficiency'] : ['growth', 'volume', 'orders'];
  const scores = Object.fromEntries(scoringFields.map(field => [field, normalizedScores(hospitals.map(row => row[field]))]));
  hospitals = hospitals.map((row, index) => ({
    ...row,
    score: Math.round(useSales ? scores.growth[index] * .30 + scores.volume[index] * .25 + scores.orders[index] * .20 + scores.efficiency[index] * .15 + (row.taskCount ? 100 : 0) * .10 : scores.growth[index] * .35 + scores.volume[index] * .35 + scores.orders[index] * .20 + (row.taskCount ? 100 : 0) * .10)
  })).sort((a, b) => b.score - a.score).slice(0, 20);
  els.hospitalPotentialBody.innerHTML = hospitals.map(row => `<tr><td><strong>${escapeHTML(row.hospital)}</strong></td><td><span class="score">${row.score}</span></td><td class="${row.growth >= 0 ? 'status-good' : 'status-check'}">${row.growth >= 0 ? '+' : ''}${(row.growth * 100).toFixed(0)}%</td><td class="numeric">${formatNumber(row.boxes)}</td><td class="numeric">${formatNumber(row.orders, 0)}</td><td class="numeric">${formatNumber(row.employeeCount, 0)}</td><td><button class="link-task-button" data-task-query="${escapeHTML(row.hospital)}"${taskContextAttributes({
    hospital: row.hospital
  })}>${row.taskCount ? `${row.taskCount} 项任务` : '查看/新增任务'}</button></td></tr>`).join('');
}
function normalizedScores(values) {
  const finite = values.map(value => Number.isFinite(value) ? value : 0);
  if (!finite.length) return [];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return finite.map(() => 50);
  return finite.map(value => Math.max(0, Math.min(100, (value - min) / (max - min) * 100)));
}
function latestComparableDataMonth() {
  const completed = latestCompletedMonth();
  return [...new Set(state.records.map(record => record.date.slice(0, 7)).filter(month => month <= completed))].sort().at(-1) || completed;
}
function salesAnomalies() {
  const month = latestComparableDataMonth();
  const previousMonth = shiftMonth(month, -1);
  const currentGroups = groupRows(state.records.filter(record => record.date.startsWith(month)), record => `${record.hospital || '未填写医院'}\u0001${record.department || record.departmentRoom || '未填写科室'}`);
  const previousGroups = groupRows(state.records.filter(record => record.date.startsWith(previousMonth)), record => `${record.hospital || '未填写医院'}\u0001${record.department || record.departmentRoom || '未填写科室'}`);
  const rows = [];
  previousGroups.forEach((previousRecords, key) => {
    const previous = sum(previousRecords, 'orderBoxes');
    const current = sum(currentGroups.get(key) || [], 'orderBoxes');
    if (previous > 0 && current < previous) {
      const [hospital, department] = key.split('\u0001');
      rows.push({
        key: encodeURIComponent(JSON.stringify([month, hospital, department])),
        month,
        previousMonth,
        hospital,
        department,
        previous,
        current,
        change: (current - previous) / previous
      });
    }
  });
  return rows.sort((a, b) => a.change - b.change);
}
function renderSalesAnomalies() {
  const rows = salesAnomalies();
  const month = latestComparableDataMonth();
  els.anomalyPeriodLabel.textContent = `${shiftMonth(month, -1)} → ${month} · ${rows.length} 个科室下滑`;
  const notes = state.settings.salesAnomalyNotes || {};
  els.salesAnomalyList.innerHTML = rows.length ? rows.map(row => `<div class="anomaly-item" data-anomaly-key="${row.key}">
    <div><strong>${escapeHTML(row.hospital)} · ${escapeHTML(row.department)}</strong><p>${formatNumber(row.previous)}盒 → ${formatNumber(row.current)}盒 <span class="status-check">${(row.change * 100).toFixed(1)}%</span></p></div>
    <label>原因备注<textarea rows="2" maxlength="400" placeholder="填写下滑原因、客户变化或下一步动作">${escapeHTML(notes[row.key] || '')}</textarea></label>
    <button class="button secondary compact-button" type="button" data-save-anomaly>保存备注</button>
  </div>`).join('') : '<p class="chart-note">最近两个有数据月份之间，未发现科室产出下滑。</p>';
}
function firstBusinessDayKey(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  while (first.getDay() === 0 || first.getDay() === 6) first.setDate(first.getDate() + 1);
  return dateKey(first);
}
function openEmployeeDrilldown(employee) {
  const records = filteredDataRecords().filter(record => record.employee === employee);
  const total = sum(records, 'orderBoxes') || 1;
  const groups = groupRows(records, record => `${record.hospital || '未填写医院'}\u0001${record.department || record.departmentRoom || '未填写科室'}`);
  const rows = [...groups.entries()].map(([key, items]) => {
    const [hospital, department] = key.split('\u0001');
    return {
      hospital,
      department,
      boxes: sum(items, 'orderBoxes'),
      orders: items.length
    };
  }).sort((a, b) => b.boxes - a.boxes);
  els.salesDrilldownTitle.textContent = `${employee} · 销售构成`;
  const range = periodRange();
  els.salesDrilldownSummary.textContent = `${range.from} 至 ${range.to} · 共 ${formatNumber(total)} 盒，来自 ${new Set(rows.map(row => row.hospital)).size} 家医院、${rows.length} 个科室。`;
  els.salesDrilldownBody.innerHTML = rows.map(row => `<tr><td>${escapeHTML(row.hospital)}</td><td>${escapeHTML(row.department)}</td><td class="numeric">${formatNumber(row.boxes)}</td><td class="numeric">${formatNumber(row.orders, 0)}</td><td class="numeric">${(row.boxes / total * 100).toFixed(1)}%</td></tr>`).join('') || '<tr><td colspan="5">没有匹配数据。</td></tr>';
  labelAnalysisTables(els.salesDrilldownDialog);
  els.salesDrilldownDialog.showModal();
}
function customerFitSignal(task, records) {
  const recordMonths = new Set(records.map(record => record.date.slice(0, 7)));
  const entries = Object.entries(task.weeklyOutputs || {}).filter(([week]) => recordMonths.has(week.slice(0, 7))).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return null;
  const departmentRecords = records.filter(record => (!task.hospital || taskDimensionMatches(task.hospital, record.hospital)) && (!task.department || taskDimensionMatches(task.department, record.department) || taskDimensionMatches(task.department, record.departmentRoom)));
  if (!departmentRecords.length) return {
    level: 'check',
    title: `${task.customer}：已有周产出登记，暂缺可比销售数据`,
    detail: `登记 ${formatNumber(entries.reduce((total, [, value]) => total + (Number(value) || 0), 0))} 盒；更新销售数据后可评估拟合和贡献占比。`,
    query: task.customer || task.hospital
  };
  const exactCustomerRecords = task.customer ? departmentRecords.filter(record => record.customer && taskDimensionMatches(task.customer, record.customer)) : [];
  const comparisonRecords = exactCustomerRecords.length ? exactCustomerRecords : departmentRecords;
  const matchesWeek = (record, week) => /\-W[1-4]$/.test(week) ? customerPeriodForDate(record.date).key === week : weekStartKey(record.date) === week;
  const registeredValues = entries.map(([, value]) => Number(value) || 0);
  const actualValues = entries.map(([week]) => sum(comparisonRecords.filter(record => matchesWeek(record, week)), 'orderBoxes'));
  const registered = registeredValues.reduce((total, value) => total + value, 0);
  const actual = actualValues.reduce((total, value) => total + value, 0);
  const distance = registeredValues.reduce((total, value, index) => total + Math.abs(value - actualValues[index]), 0);
  const scale = registeredValues.reduce((total, value, index) => total + Math.max(value, actualValues[index]), 0);
  const fit = scale ? Math.max(0, 1 - distance / scale) : null;
  const departmentBoxes = sum(departmentRecords, 'orderBoxes');
  const contributionValue = exactCustomerRecords.length ? sum(exactCustomerRecords, 'orderBoxes') : registered;
  const share = departmentBoxes ? contributionValue / departmentBoxes : null;
  const correlation = pearsonCorrelation(registeredValues, actualValues);
  const fitText = fit === null ? '数据不足' : `${(fit * 100).toFixed(0)}%`;
  const shareText = share === null ? '数据不足' : `${(share * 100).toFixed(1)}%`;
  const basis = exactCustomerRecords.length ? '客户销售明细' : '关联科室销售';
  return {
    level: fit !== null && fit < .6 || share !== null && share > 1 ? 'check' : 'good',
    title: `${task.customer} · 拟合度 ${fitText} · 贡献占比 ${shareText}`,
    detail: `登记 ${formatNumber(registered)} 盒，${basis} ${formatNumber(actual)} 盒${correlation === null ? '' : `，周趋势相关 ${correlation.toFixed(2)}`}。${exactCustomerRecords.length ? '' : '当前销售明细缺少客户字段，贡献占比暂按登记量/科室总量估算。'}`,
    query: task.customer || task.hospital
  };
}
function buildDataSignals(records, tasks) {
  const signals = tasks.filter(task => task.category === CUSTOMER_VISIT_CATEGORY && task.customer).map(task => customerFitSignal(task, records)).filter(Boolean);
  tasks.filter(task => task.progress >= 50 && task.progress < 100 && [task.employee, task.hospital, task.product, task.activityId].some(Boolean)).forEach(task => {
    const evidence = taskEvidence(task);
    if (!evidence.count) signals.push({
      level: 'check',
      title: `任务已到“${stageForTask(task).label}”节点，但没有匹配数据`,
      detail: task.title,
      query: task.hospital || task.employee || task.title,
      context: taskSourceContext(task)
    });
  });
  const groups = groupRows(records, record => `${record.employee || '未填写员工'}\u0001${record.hospital || '未填写医院'}\u0001${record.product || '未填写产品'}`);
  groups.forEach((items, key) => {
    const [employee, hospital, product] = key.split('\u0001');
    const visits = sum(items, 'visitCount');
    const boxes = sum(items, 'orderBoxes');
    const sales = sum(items, 'salesAmount');
    const cost = sum(items, 'activityCost');
    if (visits >= 3 && boxes === 0 && sales === 0) signals.push({
      level: 'watch',
      title: `${employee} 已拜访 ${formatNumber(visits, 0)} 次，暂未记录销售`,
      detail: `${hospital} · ${product}，建议核对客户阶段和下一步任务。`,
      query: hospital,
      context: {
        employee,
        hospital,
        product
      }
    });
    if (cost > 0 && sales === 0) signals.push({
      level: 'check',
      title: `活动投入 ${formatMoney(cost)}，同期未记录销售`,
      detail: `${employee} · ${hospital} · ${product}，需结合活动后观察周期复核。`,
      query: hospital,
      context: {
        employee,
        hospital,
        product
      }
    });
  });
  return signals.slice(0, 20);
}
function renderSignals(records) {
  const signals = buildDataSignals(records, state.tasks);
  els.signalCount.textContent = `${signals.length} 条`;
  els.dataSignals.innerHTML = signals.length ? signals.map(signal => `<div class="signal-item"><span class="signal-mark ${signal.level}"></span><div><p class="signal-title">${escapeHTML(signal.title)}</p><p class="signal-detail">${escapeHTML(signal.detail)}</p></div><button class="link-task-button" data-task-query="${escapeHTML(signal.query)}"${taskContextAttributes(signal.context || {})}>查看关联任务</button></div>`).join('') : '<p class="chart-note">筛选范围内暂未发现明显的任务—数据缺口。</p>';
}
function taskProgressProviderValue(name, context) {
  const registry = window.TASK_PROGRESS_PROVIDERS || {};
  const source = registry[name];
  if (typeof source === 'function') return source(context);
  if (Array.isArray(source)) return source;
  if (name === 'getCustomerRecommendations' && window.customerProfileV1App?.getTaskRecommendations) {
    return window.customerProfileV1App.getTaskRecommendations({
      tasks: state.tasks,
      activities: state.activities,
      limit: 20
    }).filter(item => !(state.tombstones || []).some(record => record.kind === 'recommendation' && record.customerId === item.customerId && record.product === (item.product || ''))).map(item => {
      const prior = [...state.tasks].reverse().find(task => task.customerId === item.customerId && (task.product || '') === (item.product || '') && task.sourceRecommendationKey);
      return prior?.visitIntervalDays ? {
        ...item,
        visitIntervalDays: prior.visitIntervalDays,
        lastVisit: prior.completedAt || item.lastFollowUpAt
      } : item;
    });
  }
  if (name === 'getHospitalMaintenance' && window.HospitalMaintenanceAdapter) {
    return hospitalMaintenanceIssues;
  }
  return [];
}
function addRecommendedCustomerTasks(recommendations, selectedIds) {
  if (!window.customerProfileV1App?.createTaskRecommendations) throw new Error('Customer Profile V1.5 任务桥接不可用');
  return window.customerProfileV1App.createTaskRecommendations(recommendations, selectedIds, {
    nativeVisitEditor: true
  });
}
function nativeHospitalRecommendations(items = []) {
  return items.filter(item => !(state.tombstones || []).some(record => record.kind === 'recommendation' && record.sourceType === 'hospital' && record.sourceRecommendationKey === (item.id || `hospital-maintenance:${item.hospitalId}`))).map(item => {
    const key = item.id || `hospital-maintenance:${item.hospitalId}`;
    const linked = state.tasks.find(task => task.sourceRecommendationKey === key && !['completed', 'cancelled'].includes(normalizedTask(task).status));
    return {
      ...item,
      sourceRecommendationKey: key,
      taskId: linked?.id || ''
    };
  });
}
function addRecommendedHospitalTask(item) {
  const hospital = hospitalDirectorySnapshot().hospitals.find(hospital => hospital.hospitalId === item.hospitalId);
  if (!hospital?.hospitalId) return showToast('医院身份匹配待确认，未创建任务');
  const key = item.sourceRecommendationKey || item.id || `hospital-maintenance:${hospital.hospitalId}`;
  const existing = state.tasks.find(task => task.sourceRecommendationKey === key && !['completed', 'cancelled'].includes(normalizedTask(task).status));
  if (existing) return existing;
  const task = saveNativeTaskRecord({
    title: `完善医院信息 · ${hospital.hospitalName}`,
    notes: (item.missingFields || []).join('；'),
    category: '医院信息维护',
    hospital: hospital.hospitalName,
    hospitalId: hospital.hospitalId,
    due: item.dueDate || '',
    dueDate: item.dueDate || '',
    priority: item.priority || 'normal',
    urgent: item.priority === 'high',
    sourceType: 'hospital',
    sourceId: hospital.hospitalId,
    sourceRecommendationKey: key,
    sourceRecommendationId: item.id || key,
    sourceRecommendationType: 'hospital-maintenance',
    sourceRecommendationHospitalId: hospital.hospitalId,
    recommendationStatus: 'ACCEPTED',
    missingFields: item.missingFields || [],
    autoGenerated: false
  });
  persist();
  render();
  return task;
}
function updateTaskRecommendation(action, item) {
  if (!item) return;
  const task = item.sourceRecommendationKey ? state.tasks.find(entry => entry.id === (item.taskId || item.id)) : null;
  if (action === 'withdraw' && task) {
    if (task.status === 'completed' || task.completedAt) return showToast('已完成拜访保留记录，请撤回下一周期的未完成计划');
    if (!withdrawRecommendationExecution(state, task)) return;
    window.customerProfileV1App?.getTaskLinks?.();
  }
  if (action === 'dismiss') {
    state.tombstones = Array.isArray(state.tombstones) ? state.tombstones : [];
    if (item.sourceRecommendationType === 'hospital-maintenance' || item.sourceType === 'hospital') {
      const key = item.sourceRecommendationKey || item.id || `hospital-maintenance:${item.hospitalId}`;
      state.tombstones.push({
        key: `recommendation:${key}`,
        kind: 'recommendation',
        sourceType: 'hospital',
        hospitalId: item.sourceRecommendationHospitalId || item.hospitalId,
        sourceRecommendationKey: key,
        deletedAt: new Date().toISOString()
      });
    } else {
      window.customerProfileV1App?.dismissTaskRecommendation?.(item.sourceRecommendationKey || item.recommendationKey || item.id);
      const customerId = item.sourceRecommendationCustomerId || item.customerId;
      const product = item.sourceRecommendationProduct ?? item.product ?? '';
      state.tombstones.push({
        key: `recommendation:${customerId}:${product}`,
        kind: 'recommendation',
        customerId,
        product,
        deletedAt: new Date().toISOString()
      });
    }
    if (task && task.status !== 'completed') {
      task.status = 'cancelled';
      task.recommendationStatus = 'DISMISSED';
    }
  }
  persist();
  render();
}
function updateUnifiedTaskStatus(id, status) {
  const task = state.tasks.find(item => item.id === id);
  if (!task || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) return;
  const now = new Date().toISOString();
  const wasCompleted = task.status === 'completed' || Boolean(task.completedAt) || Number(task.progress) >= 100;
  task.status = status;
  task.updatedAt = now;
  if (status === 'completed') {
    task.progress = 100;
    task.completedAt = now;
    delete task.cancelledAt;
    delete task.cancelledBy;
    delete task.customerVisitCancelledAt;
    delete task.reopenedAt;
  } else if (status === 'cancelled') {
    task.cancelledAt = now;
    delete task.completedAt;
    if (task.sourceType === 'customer' && task.taskType === 'customer_visit') {
      task.cancelledBy = 'user';
      task.customerVisitCancelledAt = now;
    }
  } else {
    task.progress = status === 'pending' ? 0 : Number(task.progress) > 0 && Number(task.progress) < 100 ? Number(task.progress) : stagesFor(task.category).find(stage => stage.value > 0 && stage.value < 100)?.value || 50;
    delete task.completedAt;
    delete task.cancelledAt;
    delete task.cancelledBy;
    delete task.customerVisitCancelledAt;
    if (wasCompleted) task.reopenedAt = now;
  }
  persist();
  render();
  showToast(`任务已更新为${window.TaskProgressAdapter?.STATUS_LABELS?.[status] || status}`);
}
function activityContextMeta(activity = {}, snapshot = {}) {
  const year = Number(snapshot.year) || Number(String(activity.activityDate || '').slice(0, 4)) || Number(dateKey().slice(0, 4));
  const month = Number(snapshot.month) || Number(String(activity.activityDate || '').slice(5, 7)) || Number(dateKey().slice(5, 7));
  return {
    activityId: String(activity.id || snapshot.activityId || ''),
    hospitalId: String(activity.hospitalId || ''),
    hospitalCode: String(activity.hospitalCode || ''),
    hospitalName: String(activity.hospital || ''),
    department: String(activity.department || ''),
    productId: String(activity.productId || ''),
    product: String(activity.product || ''),
    year,
    month,
    activityDate: String(activity.activityDate || snapshot.date || `${year}-${String(month).padStart(2, '0')}-01`)
  };
}
function updateContextNavigationBar(entry) {
  const destination = entry?.contract?.destination;
  const moduleDestination = ['customer-profile', 'hospital-context', 'sales-dashboard'].includes(destination);
  const visible = Boolean(entry && entry.meta !== '数据库入口');
  els.contextNavigationBar.hidden = !visible;
  if (!visible) return;
  const labels = {
    'customer-profile': '客户详情',
    'hospital-context': '医院上下文',
    'sales-dashboard': '销售上下文',
    'task-progress': '关联任务详情',
    'activity-application': '活动申请'
  };
  const payload = entry.viewPayload || {};
  els.contextNavigationKind.textContent = labels[destination] || '上下文详情';
  els.contextNavigationTitle.textContent = entry.title || payload.hospitalName || payload.hospital || '';
  els.contextNavigationMeta.textContent = entry.meta || [payload.department, payload.product, payload.year && payload.month ? `${payload.year}年${payload.month}月` : ''].filter(Boolean).join(' · ');
  els.contextNavigationBack.hidden = moduleDestination;
  els.contextNavigationBack.textContent = moduleDestination ? '' : `‹ 返回${entry.sourceWorkspace === 'activities' ? '活动申请' : '来源'}`;
}
function closeActivityContextSurface() {
  window.taskProgressV2App?.closeDrawer?.();
  els.customerView.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  updateContextNavigationBar(null);
}
function applyActivitySalesContext(payload = {}) {
  const reference = payload.activityDate || `${payload.year}-${String(payload.month).padStart(2, '0')}-01`;
  const fiscal = window.QuarterlyReporting?.resolveFiscalPeriod?.(reference) || {};
  dashboardV2Filters = {
    ...defaultDashboardV2Filters(),
    fiscalYear: fiscal.fiscalYear || payload.year,
    fiscalQuarter: fiscal.fiscalQuarter || null,
    month: Number(payload.month) || null,
    cutoffDate: reference,
    product: window.ProductRegistry.getProduct(payload.productId || payload.product)?.name || 'unknown',
    hospitalId: payload.hospitalId || '',
    hospital: payload.hospitalName || 'all',
    department: payload.department || 'all'
  };
  renderDataOptions();
  if (els.dataPeriodMode) {
    els.dataPeriodMode.value = 'month';
    renderPeriodOptions();
  }
  if (els.dataPeriodValue && [...els.dataPeriodValue.options].some(option => option.value === `${payload.year}-${String(payload.month).padStart(2, '0')}`)) els.dataPeriodValue.value = `${payload.year}-${String(payload.month).padStart(2, '0')}`;
  if (els.dataProductFilter && [...els.dataProductFilter.options].some(option => option.value === payload.product)) els.dataProductFilter.value = payload.product;
  if (els.dataHospitalFilter && [...els.dataHospitalFilter.options].some(option => option.value === payload.hospitalName)) els.dataHospitalFilter.value = payload.hospitalName;
}
function decorateActivityContextBack(selector) {
  const button = document.querySelector(selector);
  if (!button) return;
  button.classList.add('contextual-navigation-back');
  button.textContent = '‹ 返回活动申请';
  button.setAttribute('aria-label', '返回活动申请');
  if (!button.dataset.workspaceNavigationBound) {
    button.dataset.workspaceNavigationBound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      workspaceNavigationController?.handleBack('context');
    }, true);
  }
}
function openActivityContext(kind, payload, snapshot, labels = {}) {
  if (!workspaceNavigationController) return false;
  const activityState = snapshot || activityController?.captureNavigationState?.() || null;
  const destination = {
    customer: 'customer-profile',
    hospital: 'hospital-context',
    sales: 'sales-dashboard',
    task: 'task-progress'
  }[kind];
  const context = kind === 'sales' ? {
    product: payload.product ? {
      id: dashboardProductId(payload.productId || payload.product),
      label: payload.product
    } : undefined,
    hospital: payload.hospitalName || payload.hospitalCode ? {
      id: payload.hospitalId || payload.hospitalCode || '',
      name: payload.hospitalName || payload.hospitalCode || ''
    } : undefined,
    department: payload.department ? {
      id: payload.departmentId || '',
      name: payload.department,
      hospitalId: payload.hospitalId || payload.hospitalCode || ''
    } : undefined,
    period: {
      fiscalYear: payload.year,
      month: payload.month,
      cutoffDate: payload.activityDate
    },
    customerId: payload.customerId || undefined
  } : {
    customerId: payload.customerId || undefined,
    hospital: payload.hospitalId || payload.hospitalName || payload.hospitalCode ? {
      id: payload.hospitalId || '',
      name: payload.hospitalName || payload.hospitalCode || ''
    } : undefined
  };
  Object.keys(context).forEach(key => {
    if (context[key] === undefined) delete context[key];
  });
  return workspaceNavigationController.openContext({
    destination,
    source: {
      module: 'activity',
      entityType: kind === 'task' ? 'task' : 'activity',
      entityId: String(payload.activityId || payload.taskId || ''),
      routeKey: `activity:${payload.activityId || kind}`
    },
    context,
    behavior: {
      persistence: 'transient',
      customerMatch: 'exact-only',
      fallback: 'broader-context'
    }
  }, {
    sourceWorkspace: 'activities',
    sourceSnapshot: activityState,
    viewPayload: payload,
    title: labels.title,
    meta: labels.meta
  });
}
function openActivityCustomerContext(person, activity, snapshot) {
  return openActivityHospitalContext(activity, snapshot);
}
function openCustomerFromTask(query, {
  openFollowUp = false,
  taskId = '',
  product = '',
  recommendationKey = '',
  sourceTask = null
} = {}) {
  const app = window.customerProfileV1App;
  const target = String(query || '').trim();
  const profiles = app?.getProfiles?.() || [];
  const sourceMatch = sourceTask ? {
    customerId: sourceTask.customerId,
    matchType: sourceTask.matchType || (sourceTask.sourceType === 'customer' && sourceTask.customerId && String(sourceTask.sourceId || '') === String(sourceTask.customerId) ? 'CONFIRMED' : ''),
    customerMatchStatus: sourceTask.customerMatchStatus,
    matchConfidence: sourceTask.matchConfidence,
    confidenceLevel: sourceTask.confidenceLevel,
    resolvedBy: sourceTask.resolvedBy
  } : null;
  const reliableTarget = sourceTask ? window.WorkspaceNavigation?.isReliableCustomerMatch?.(sourceMatch) : profiles.some(item => String(item.customerId || '').trim() === target);
  const profile = reliableTarget ? profiles.find(item => String(item.customerId || '').trim() === target) : null;
  window.taskProgressV2App?.closeDrawer?.();
  if (!workspaceNavigationController) return;
  workspaceNavigationController.openContext({
    destination: 'customer-profile',
    source: {
      module: 'task',
      entityType: 'task',
      entityId: String(taskId || target),
      routeKey: `task:customer:${taskId || target}`
    },
    context: profile ? {
      customerId: String(profile.customerId)
    } : {},
    behavior: {
      persistence: 'transient',
      customerMatch: 'exact-only',
      fallback: 'broader-context'
    }
  }, {
    sourceWorkspace: 'tasks',
    viewPayload: profile ? {
      customerId: String(profile.customerId),
      ...(product ? {
        product
      } : {}),
      openFollowUp,
      taskId,
      recommendationKey
    } : {
      search: target
    },
    title: profile?.canonicalName || profile?.customerName || target || '客户档案',
    meta: [profile?.hospital, profile?.department, profile?.product || product].filter(Boolean).join(' · ')
  });
}
function openHospitalMaintenance(hospitalId, options = {}) {
  const hospital = window.WorkspaceNavigation.exactHospital(hospitalId, hospitalDirectorySnapshot().hospitals);
  const sourceTask = state.tasks.find(item => item.id === options.taskId && item.hospitalId === hospitalId);
  window.taskProgressV2App?.closeDrawer?.();
  if (!workspaceNavigationController) return;
  workspaceNavigationController.openContext({destination:'hospital-context',source:{module:'task',entityType:'task',entityId:sourceTask?.id || String(hospitalId || ''),routeKey:'task:hospital'},context:{hospital:{id:hospital?.hospitalId || '',name:hospital?.hospitalName || ''}},behavior:{persistence:'transient',customerMatch:'exact-only',fallback:'broader-context'}},{sourceWorkspace:'tasks',viewPayload:{hospitalId:hospital?.hospitalId || '',hospitalName:hospital?.hospitalName || ''},title:hospital?.hospitalName || '医院资料',meta:'从任务进度进入'});
}
function openActivityHospitalContext(activity, snapshot) {
  const payload = activityContextMeta(activity, snapshot);
  if (!payload.hospitalId && !payload.hospitalName && !payload.hospitalCode) {
    showToast('请先填写Synthetic Hospital Example或编码');
    return false;
  }
  return openActivityContext('hospital', payload, snapshot, {
    title: payload.hospitalName || payload.hospitalCode,
    meta: [payload.hospitalCode, payload.department].filter(Boolean).join(' · ')
  });
}
function openActivitySalesContext(activity, snapshot) {
  const payload = activityContextMeta(activity, snapshot);
  if (!payload.hospitalName && !payload.hospitalCode) {
    showToast('请先填写Synthetic Hospital Example或编码');
    return false;
  }
  return openActivityContext('sales', payload, snapshot, {
    title: payload.hospitalName || payload.hospitalCode,
    meta: [payload.department, payload.product, `${payload.year}年${payload.month}月`].filter(Boolean).join(' · ')
  });
}
function openActivityTaskContext(activity, snapshot) {
  const tasks = state.tasks.filter(task => task.sourceType === 'activity' && String(task.sourceId || task.activityId || '') === String(activity.id || ''));
  const task = tasks.find(item => item.taskType === 'activity_execute') || tasks[0];
  if (!task) {
    showToast('当前活动尚无可打开的关联任务');
    return false;
  }
  const payload = {
    ...activityContextMeta(activity, snapshot),
    taskId: task.id
  };
  return openActivityContext('task', payload, snapshot, {
    title: task.title || '关联任务',
    meta: [payload.hospitalName, payload.activityDate].filter(Boolean).join(' · ')
  });
}
function syncTasksForActivity(activity) {
  if (!window.ActivityTaskAdapter) return {
    changed: false,
    tasks: state.tasks
  };
  const result = window.ActivityTaskAdapter.syncActivityTasks(activity, state.tasks);
  if (result.changed) state.tasks = result.tasks;
  return result;
}
function syncTasksForAllActivities() {
  if (!window.ActivityTaskAdapter) return {
    changed: false,
    tasks: state.tasks
  };
  const result = window.ActivityTaskAdapter.syncAllActivityTasks(state.activities, state.tasks);
  if (result.changed) state.tasks = result.tasks;
  return result;
}
function openActivitySource(activityId) {
  const activity = state.activities.find(item => String(item.id || '') === String(activityId || ''));
  if (activity && window.activityCenterApp?.openActivityById && workspaceNavigationController) {
    window.taskProgressV2App?.closeDrawer?.();
    workspaceNavigationController.openContext({
      destination: 'activity-application',
      source: {
        module: 'task',
        entityType: 'task',
        entityId: String(activity.id),
        routeKey: `task:activity:${activity.id}`
      },
      context: {},
      behavior: {
        persistence: 'transient',
        customerMatch: 'exact-only',
        fallback: 'broader-context'
      }
    }, {
      sourceWorkspace: 'tasks',
      viewPayload: {
        activityId: activity.id
      },
      title: activity.name || activity.title || '活动申请',
      meta: activity.activityDate || '从任务进度进入'
    });
    return;
  }
  const opener = window.TASK_PROGRESS_PROVIDERS?.openActivity;
  if (typeof opener === 'function' && opener(activityId) !== false) return;
  showToast('未找到关联的活动申请，请先同步或核对活动是否已删除');
}
function showWorkspaceEntry(entry) {
  updateContextNavigationBar(entry);
  const destination = entry.contract?.destination;
  const payload = entry.viewPayload || {};
  if (destination === 'sales-dashboard') {
    dashboardNavigationNotice = entry.notice || '';
    if (entry.contract.source.module === 'modules') {
      transientNavigationContext = null;
      dashboardV2Filters = persistentDashboardFilters();
    } else {
      transientNavigationContext = {
        ...persistentDashboardFilters(),
        ...normalizedNavigationFilterPatch(entry.contract.context)
      };
      dashboardV2Filters = {
        ...transientNavigationContext
      };
    }
    switchView('data', {
      fromWorkspaceNavigation: true,
      preserveActivityRoute: true
    });
    return;
  }
  if (destination === 'customer-profile' || destination === 'hospital-context') {
    switchView('customers', {
      fromWorkspaceNavigation: true,
      preserveActivityRoute: true
    });
    window.customerProfileV1App?.activate?.();
    while (window.customerProfileV1App?.closeTopLayer?.()) {}
    if (destination === 'customer-profile' && payload.customerId) {
      window.customerProfileV1App?.openCustomer?.(payload.customerId, {
        product: payload.product,
        openFollowUp: payload.openFollowUp,
        taskId: payload.taskId,
        recommendationKey: payload.recommendationKey,
        push: false
      });
      queueMicrotask(() => decorateActivityContextBack('#customerView [data-cp-close]'));
    } else if (destination === 'customer-profile' && payload.search) {
      const search = els.customerProfileV1?.querySelector('#cpSearch');
      if (search) {
        search.value = payload.search;
        search.dispatchEvent(new Event('input', {
          bubbles: true
        }));
      }
      queueMicrotask(() => decorateActivityContextBack('#customerView [data-cp-close]'));
    }
    if (destination === 'hospital-context') {
      const opened = window.customerProfileV1App?.openHospital?.(entry.contract?.context?.hospital?.id || '');
      if (!opened) {
        els.customerProfileV1?.querySelector('[data-cp-mode="hospitals"]')?.click();
        const search = els.customerProfileV1?.querySelector('#cpSearch');
        if (search) {
          search.value = payload.hospitalName || payload.hospitalCode || '';
          search.dispatchEvent(new Event('input', {
            bubbles: true
          }));
        }
      }
      queueMicrotask(() => decorateActivityContextBack('#cpHospitalMaintenanceDialog [data-cp-dialog-close]'));
    }
    return;
  }
  if (destination === 'task-progress') {
    switchView('tasks', {
      fromWorkspaceNavigation: true,
      preserveActivityRoute: true
    });
    if (payload.taskId) {
      window.taskProgressV2App?.openTaskDetails?.(payload.taskId);
      queueMicrotask(() => decorateActivityContextBack('#taskView [data-tpv2-close]'));
    }
    return;
  }
  if (destination === 'activity-application') {
    switchView('activities', {
      fromWorkspaceNavigation: true,
      preserveActivityRoute: true
    });
    if (payload.activityId) window.activityCenterApp?.openActivityById?.(payload.activityId, {
      updateRoute: false,
      closeLocally: true
    });
  }
}
function workspaceFocusTarget() {
  const active = document.activeElement;
  return active?.id ? active.id : '';
}
function captureWorkspaceSnapshot(workspace = currentWorkspace) {
  const common = {
    workspace,
    scrollPosition: Math.max(0, window.scrollY || 0),
    focusTarget: workspaceFocusTarget()
  };
  if (workspace === 'tasks') return {
    ...common,
    task: window.taskProgressV2App?.getNavigationState?.() || window.taskProgressV2App?.getState?.() || {},
    date: selectedTaskDate,
    legacyFilters: {
      category: els.categoryFilter.value,
      status: els.statusFilter.value,
      marker: els.markerFilter.value,
      search: els.searchInput.value
    }
  };
  if (workspace === 'activities') return {
    ...common,
    activity: activityController?.getNavigationState?.() || {}
  };
  if (workspace === 'customers') return {
    ...common,
    customer: window.customerProfileV1App?.getNavigationState?.() || {}
  };
  return common;
}
function restoreWorkspaceScrollAndFocus(snapshot = {}) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({
      top: Math.min(Math.max(0, Number(snapshot.scrollPosition) || 0), maximum),
      behavior: 'auto'
    });
    if (snapshot.focusTarget) document.getElementById(snapshot.focusTarget)?.focus?.({
      preventScroll: true
    });
  }));
}
function restoreWorkspaceSnapshot(workspace, snapshot = {}) {
  closeActivityContextSurface();
  dashboardNavigationNotice = '';
  transientNavigationContext = null;
  dashboardV2Filters = persistentDashboardFilters();
  const target = ['tasks', 'activities', 'customers'].includes(workspace) ? workspace : ['tasks', 'activities', 'customers'].includes(snapshot.workspace) ? snapshot.workspace : 'tasks';
  if (target === 'activities' && snapshot.activity?.sourceRoute && location.hash !== snapshot.activity.sourceRoute) {
    history.replaceState({
      ...(history.state || {}),
      activityRoute: String(snapshot.activity.sourceRoute).replace(/^#\/activity\//, ''),
      workspaceNavigationSourceSnapshot: snapshot.activity
    }, '', location.pathname + location.search + snapshot.activity.sourceRoute);
  }
  switchView(target, {
    fromWorkspaceNavigation: true,
    preserveActivityRoute: true
  });
  if (target === 'tasks') {
    selectedTaskDate = snapshot.date === null || /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date || '') ? snapshot.date : selectedTaskDate;
    const filters = snapshot.legacyFilters || {};
    if (filters.category !== undefined) els.categoryFilter.value = filters.category;
    if (filters.status !== undefined) els.statusFilter.value = filters.status;
    if (filters.marker !== undefined) els.markerFilter.value = filters.marker;
    if (filters.search !== undefined) els.searchInput.value = filters.search;
    window.taskProgressV2App?.restoreNavigationState?.(snapshot.task || {});
    renderHeader();
    renderBriefing();
    renderTasks();
  } else if (target === 'activities') activityController?.restoreNavigationState?.(snapshot.activity || {});else if (target === 'customers') window.customerProfileV1App?.restoreNavigationState?.(snapshot.customer || {});
  restoreWorkspaceScrollAndFocus(snapshot);
}
function navigationProduct(value) {
  const id = dashboardProductId(value);
  if (!["Primary Product A", "Primary Product B"].includes(id)) return null;
  return {
    id,
    label: id === "Primary Product B" ? "Primary Product B" : "Primary Product A"
  };
}
function navigationPeriod(value) {
  if (!value || typeof value !== 'object') return null;
  const period = {};
  ['fiscalYear', 'fiscalQuarter', 'month', 'cutoffDate'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(value, key)) period[key] = value[key];
  });
  return Object.keys(period).length ? period : null;
}
function entityNavigationContext(entity = {}, options = {}) {
  const context = {};
  const product = navigationProduct(entity.product);
  if (product) context.product = product;
  if (entity.hospitalId || entity.hospital || entity.hospitalName) context.hospital = {
    id: String(entity.hospitalId || ''),
    name: String(entity.hospital || entity.hospitalName || '')
  };
  if (entity.departmentId || entity.department || entity.departmentName) context.department = {
    id: String(entity.departmentId || ''),
    name: String(entity.department || entity.departmentName || ''),
    hospitalId: String(entity.hospitalId || '')
  };
  if (entity.employeeId || entity.employee || entity.employeeName || entity.owner) context.employee = {
    id: String(entity.employeeId || ''),
    name: String(entity.employee || entity.employeeName || entity.owner || '')
  };
  const period = navigationPeriod(options.period);
  if (period) context.period = period;
  const customerMatch = {
    customerId: entity.customerId,
    matchType: entity.matchType || entity.masterMatch?.matchType,
    customerMatchStatus: entity.customerMatchStatus,
    matchConfidence: entity.matchConfidence,
    confidenceLevel: entity.confidenceLevel,
    resolvedBy: entity.resolvedBy || entity.masterMatch?.resolvedBy
  };
  const customerReliable = window.WorkspaceNavigation?.isReliableCustomerMatch?.(customerMatch);
  if (customerReliable) context.customerId = String(entity.customerId);
  return {
    context,
    customerReliable,
    hasCustomerId: Boolean(entity.customerId)
  };
}
function openSalesFromEntity(sourceModule, entityType, entity, options = {}) {
  if (!workspaceNavigationController) return;
  const prepared = entityNavigationContext(entity, options);
  const fallbackNotice = prepared.hasCustomerId && !prepared.customerReliable ? '客户销售匹配不足，已按医院 / 科室范围展示。' : '';
  const sourceWorkspace = {
    task: 'tasks',
    activity: 'activities',
    customer: 'customers'
  }[sourceModule] || currentWorkspace;
  workspaceNavigationController.openSales({
    schemaVersion: 1,
    destination: 'sales-dashboard',
    source: {
      module: sourceModule,
      entityType,
      entityId: String(entity.id || entity.customerId || ''),
      routeKey: String(options.routeKey || '')
    },
    context: prepared.context,
    behavior: {
      persistence: 'transient',
      customerMatch: 'exact-only',
      fallback: 'broader-context'
    }
  }, {
    sourceWorkspace,
    notice: fallbackNotice
  });
}
function syncPrimaryMobileNav(forced = '') {
  const entry = workspaceNavigationController?.getCurrentEntry?.();
  const sourcePrimary = entry?.contract.destination === 'hospital-context' && entry.contract.source.module === 'task' ? entry.sourceWorkspace : '';
  const active = forced || sourcePrimary || (currentWorkspace === 'activities' ? 'activities' : ['customers', 'data'].includes(currentWorkspace) ? 'database' : 'tasks');
  [[els.primaryTodoButton, 'tasks'], [els.primaryActivityButton, 'activities'], [els.primaryDatabaseButton, 'database']].forEach(([button, key]) => {
    if (!button) return;
    const selected = key === active;
    button.classList.toggle('is-active', selected);
    if (selected) button.setAttribute('aria-current', 'page');else button.removeAttribute('aria-current');
  });
}
function closePrimaryNavigationSheets() {
  let closed = false;
  [els.todoNavigationSheet, els.databaseNavigationSheet].forEach(dialog => {
    if (dialog?.open) {
      dialog.close();
      closed = true;
    }
  });
  syncPrimaryMobileNav();
  return closed;
}
function positionPrimaryNavigationMenu(dialog, anchorButton) {
  if (!dialog || !anchorButton) return;
  const anchor = anchorButton.getBoundingClientRect();
  dialog.style.setProperty('--primary-nav-anchor-x', `${anchor.left + anchor.width / 2}px`);
  dialog.dataset.primaryNavAnchorId = anchorButton.id || '';
}
function openPrimaryNavigationMenu(dialog, activeWorkspace, anchorButton) {
  closePrimaryNavigationSheets();
  if (!dialog) return;
  positionPrimaryNavigationMenu(dialog, anchorButton);
  dialog.show();
  syncPrimaryMobileNav(activeWorkspace);
  queueMicrotask(() => dialog.querySelector('[role="menuitem"]')?.focus({
    preventScroll: true
  }));
}
function taskHomeSurfaces() {
  return [document.querySelector('#taskView > .briefing'), els.tasksSection, els.taskProgressV2].filter(Boolean);
}
function showTaskSecondaryPage(page) {
  closePrimaryNavigationSheets();
  if (page !== 'utility') {
    closeTaskSecondaryPage();
    return;
  }
  taskSecondaryPage = 'utility';
  taskHomeSurfaces().forEach(element => {
    element.hidden = true;
  });
  const utility = document.querySelector('#taskView > .utility-panel');
  els.taskUtilityTitle.hidden = false;
  utility.hidden = false;
  utility.open = true;
  els.taskUtilityToggle.setAttribute('aria-expanded', 'true');
  window.scrollTo({
    top: 0,
    behavior: 'auto'
  });
  syncPrimaryMobileNav('tasks');
}
function closeTaskSecondaryPage() {
  if (!taskSecondaryPage) return false;
  taskSecondaryPage = '';
  taskHomeSurfaces().forEach(element => {
    element.hidden = false;
  });
  const utility = document.querySelector('#taskView > .utility-panel');
  els.taskUtilityTitle.hidden = true;
  utility.hidden = true;
  utility.open = false;
  els.taskUtilityToggle.setAttribute('aria-expanded', 'false');
  window.scrollTo({
    top: 0,
    behavior: 'auto'
  });
  syncPrimaryMobileNav('tasks');
  return true;
}
function closeWorkspaceTopLayer() {
  if (closePrimaryNavigationSheets()) return true;
  if (currentWorkspace === 'tasks' && closeTaskSecondaryPage()) return true;
  if (els.contextChoiceDialog?.open) {
    els.contextChoiceDialog.close();
    pendingContextChoices = [];
    return true;
  }
  if (currentWorkspace === 'data' && window.SalesDashboardV2?.closeTopLayer?.(els.salesDashboardV2)) return true;
  if (currentWorkspace === 'tasks' && window.taskProgressV2App?.hasOpenLayer?.()) {
    window.taskProgressV2App.closeDrawer();
    return true;
  }
  if (currentWorkspace === 'activities' && activityController?.closeTopLayer?.()) return true;
  if (currentWorkspace === 'customers') {
    const entry = workspaceNavigationController?.getCurrentEntry?.();
    const closesContext = entry?.contract.destination === 'hospital-context' && ['task', 'activity'].includes(entry.contract.source.module) && Boolean(els.customerView.querySelector('#cpHospitalMaintenanceDialog[open]'));
    if (window.customerProfileV1App?.closeTopLayer?.()) return closesContext ? {
      closed: true,
      scope: 'context'
    } : true;
  }
  return false;
}
function initializeWorkspaceNavigation() {
  if (!window.WorkspaceNavigation?.create) return;
  workspaceNavigationController = window.WorkspaceNavigation.create({
    window,
    history,
    getCurrentWorkspace: () => currentWorkspace,
    captureSnapshot: captureWorkspaceSnapshot,
    restoreSnapshot: restoreWorkspaceSnapshot,
    closeTopLayer: closeWorkspaceTopLayer,
    isNative: () => Boolean(window.AndroidBridge),
    showEntry: showWorkspaceEntry,
    handleWorkspaceBack: origin => {
      if (origin === 'activity-editor') return false;
      if (currentWorkspace === 'activities' && activityController?.getSection?.() !== 'list') {
        history.back();
        return true;
      }
      if (currentWorkspace === 'activities') {
        openPrimaryWorkspace('tasks', {
          replace: true
        });
        return true;
      }
      return false;
    },
    handlePopState: event => {
      if (location.hash.startsWith('#/activity/')) {
        switchView('activities', {
          fromWorkspaceNavigation: true
        });
        if (event?.state?.workspaceNavigationSourceSnapshot) activityController?.restoreNavigationState?.(event.state.workspaceNavigationSourceSnapshot);else activityController?.handleRoute?.();
        return true;
      }
      if (location.hash.startsWith('#customer-profile-v1')) {
        switchView('customers', {
          fromWorkspaceNavigation: true
        });
        window.customerProfileV1App?.handlePopState?.(event);
        return true;
      }
      switchView('tasks', {
        fromWorkspaceNavigation: true
      });
      return true;
    }
  }).install();
  window.WorkspaceNavigationController = workspaceNavigationController;
  const delegatedContextBack = event => {
    const target = event.target?.closest?.('[data-cp-close], [data-cp-dialog-close], [data-tpv2-close]');
    if (!target || !workspaceNavigationController?.getCurrentEntry?.()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    workspaceNavigationController.handleBack('context');
  };
  [els.customerView, els.taskView].forEach(root => root?.addEventListener('click', delegatedContextBack, true));
  workspaceNavigationController.showActivityCustomerContext = () => openActivityContext('customer', {}, activityController?.captureNavigationState?.(), {
    title: '客户档案',
    meta: '从活动申请进入'
  });
  workspaceNavigationController.showActivitySalesContext = () => openActivityContext('sales', {
    year: Number(dateKey().slice(0, 4)),
    month: Number(dateKey().slice(5, 7)),
    activityDate: dateKey()
  }, activityController?.captureNavigationState?.(), {
    title: '销售数据',
    meta: '从活动申请进入'
  });
}
function mountTaskProgressV2() {
  if (!els.taskProgressV2 || !window.TaskProgressV2) return;
  window.taskProgressV2App = window.TaskProgressV2.mount({
    root: els.taskProgressV2,
    tasks: state.tasks,
    getTasks: () => state.tasks,
    providers: {
      getCustomerRecommendations: context => taskProgressProviderValue('getCustomerRecommendations', context),
      getHospitalMaintenance: context => nativeHospitalRecommendations(taskProgressProviderValue('getHospitalMaintenance', context))
    },
    onCreateManual: () => openTask(),
    onEditManual: task => openTask(task),
    onEditCustomerVisit: task => openTask(task),
    onEditHospitalMaintenance: task => openTask(task),
    onAddHospitalTask: addRecommendedHospitalTask,
    onAddCustomerTasks: addRecommendedCustomerTasks,
    onRecommendationAction: updateTaskRecommendation,
    onRecommendationPlan: (item, days) => window.customerProfileV1App?.updateTaskRecommendationPlan?.(item.recommendationKey || item.id, days),
    onUpdateTaskStatus: updateUnifiedTaskStatus,
    onViewCustomer: (query, sourceTask) => openCustomerFromTask(query, {
      taskId: sourceTask?.id || '',
      product: sourceTask?.product || '',
      sourceTask
    }),
    onCompleteCustomerVisit: id => {
      const task = state.tasks.find(item => item.id === id);
      if (!task || task.sourceType !== 'customer' || task.taskType !== 'customer_visit') return showToast('未找到对应客户拜访任务');
      openCustomerFromTask(task.customerId || task.sourceId, {
        openFollowUp: true,
        taskId: task.id,
        product: task.product,
        recommendationKey: task.sourceRecommendationKey,
        sourceTask: task
      });
    },
    onViewHospital: openHospitalMaintenance,
    onViewActivity: openActivitySource,
    onViewSales: task => openSalesFromEntity('task', 'task', {
      ...task,
      matchType: task.sourceType === 'customer' && task.customerId && String(task.sourceId || '') === String(task.customerId) ? 'CONFIRMED' : task.matchType
    }, {
      period: task.salesPeriod,
      routeKey: `task:${task.id}`
    }),
    onProviderError: (name, error) => console.warn(`任务进度 Provider ${name} 读取失败`, error),
    onNotify: showToast
  });
}
function openPrimaryWorkspace(workspace, {
  replace = false,
  fromHistory = false
} = {}) {
  const target = workspace === 'activities' ? 'activities' : 'tasks';
  if (!fromHistory) {
    const hash = target === 'activities' ? '#/activity/list' : '#/tasks';
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({
      ...(history.state || {}),
      appWorkspace: target,
      fromWorkspace: currentWorkspace
    }, '', location.pathname + location.search + hash);
  }
  switchView(target);
}
function switchView(view, options = {}) {
  if (view !== 'tasks' && taskSecondaryPage) closeTaskSecondaryPage();
  if (view !== 'customers') window.customerProfileV1App?.suspendRelationshipViewingPlane?.();
  closePrimaryNavigationSheets();
  const showTasks = view === 'tasks';
  const showCustomers = view === 'customers';
  const showActivities = view === 'activities';
  const showData = view === 'data';
  currentWorkspace = view;
  els.taskView.hidden = !showTasks;
  els.customerView.hidden = !showCustomers;
  els.activityView.hidden = !showActivities;
  els.dataView.hidden = !showData;
  document.body.classList.toggle('sales-dashboard-mode', showData);
  document.body.classList.toggle('customer-workspace-mode', showCustomers);
  document.body.classList.toggle('activity-dashboard-mode', showActivities);
  document.body.classList.toggle('task-progress-v2-mode', showTasks);
  els.customerModuleButton?.setAttribute('aria-current', showCustomers ? 'page' : 'false');
  els.salesModuleButton?.setAttribute('aria-current', showData ? 'page' : 'false');
  [[els.taskTab, currentWorkspace === 'tasks'], [els.activityTab, currentWorkspace === 'activities']].forEach(([tab, active]) => {
    if (!tab) return;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  if (!options.fromWorkspaceNavigation && !workspaceNavigationController?.getCurrentEntry?.()) updateContextNavigationBar(null);
  if (showTasks) {
    renderHeader();
    renderBriefing();
    renderTasks();
    window.taskProgressV2App?.update({
      tasks: state.tasks
    });
  }
  if (showCustomers) {
    renderCustomerDashboard();
    window.customerProfileV1App?.resumeRelationshipViewingPlane?.();
  }
  if (showActivities) {
    syncActivityToSharedDate();
    if (activityController?.enter) activityController.enter({
      preserveRoute: Boolean(options.preserveActivityRoute)
    });else activityController?.render();
  } else {
    activityController?.leave?.({
      preserveRoute: Boolean(options.preserveActivityRoute)
    });
  }
  if (showData) renderDataDashboard();
  syncPrimaryMobileNav();
}
function openLinkedTasks(query, context = {}) {
  const structured = Object.fromEntries(Object.entries(context || {}).filter(([, value]) => String(value || '').trim()).map(([key, value]) => [key, String(value).trim()]));
  switchView('tasks');
  taskDateScope = 'all';
  taskExternalContext = Object.keys(structured).length ? structured : null;
  els.searchInput.value = taskExternalContext ? '' : String(query || '');
  els.statusFilter.value = 'all';
  els.categoryFilter.value = 'all';
  els.markerFilter.value = 'all';
  els.taskSourceFilter.value = 'all';
  els.taskCanonicalStatusFilter.value = 'all';
  renderHeader();
  renderBriefing();
  renderTasks();
  $('tasksTitle').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}
function openSalesContextFromTask(taskId) {
  const task = state.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return showToast('未找到任务');
  window.taskProgressV2App?.closeDrawer?.();
  const stableCustomerSource = task.sourceType === 'customer' && task.customerId && String(task.sourceId || '') === String(task.customerId);
  openSalesFromEntity('task', 'task', {
    ...task,
    matchType: task.customerMatchStatus || task.matchType || (stableCustomerSource ? 'CONFIRMED' : '')
  }, {
    period: task.salesPeriod,
    routeKey: `task:${task.id}`
  });
}
function downloadSalesTemplate() {
  const content = `\uFEFF${SALES_HEADERS.join(',')}\r\n`;
  downloadTextFile('销售活动数据导入模板.csv', content, 'text/csv;charset=utf-8');
}
function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').replace(/[\s_()（）\/\-]/g, '').toLowerCase();
}
function headerKey(value) {
  const normalized = normalizeHeader(value);
  return Object.keys(headerAliases).find(key => headerAliases[key].some(alias => normalizeHeader(alias) === normalized)) || null;
}
function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}
function parseNumber(value) {
  const cleaned = String(value || '').replace(/[¥￥,$，\s]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}
function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateKey(value);
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    return `${excelDate.getUTCFullYear()}-${String(excelDate.getUTCMonth() + 1).padStart(2, '0')}-${String(excelDate.getUTCDate()).padStart(2, '0')}`;
  }
  const raw = String(value || '').trim();
  if (!raw) return '';
  const chinese = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, '0')}-${chinese[3].padStart(2, '0')}`;
  const matched = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (matched) return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : dateKey(date);
}
function detectHeaderRow(rows) {
  let best = {
    index: -1,
    keys: [],
    score: 0
  };
  rows.slice(0, 50).forEach((row, index) => {
    const keys = row.map(headerKey);
    const unique = new Set(keys.filter(Boolean));
    const requiredBoost = unique.has('date') ? 3 : 0;
    const score = unique.size + requiredBoost;
    if (score > best.score) best = {
      index,
      keys,
      score,
      unique
    };
  });
  if (best.index < 0 || !best.unique?.has('date') || best.unique.size < 3) return null;
  return best;
}
async function readSalesRows(file, pastedText) {
  if (!file) return {
    rows: parseDelimited(pastedText),
    source: '粘贴导入',
    sheetName: ''
  };
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension)) {
    if (!window.XLSX) throw new Error('Excel 组件未加载，请刷新页面后重试。');
    const workbook = window.XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true
    });
    const sheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === 'sheet1') || workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel 文件中没有可读取的工作表。');
    const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
      defval: '',
      blankrows: false
    });
    return {
      rows,
      source: file.name,
      sheetName
    };
  }
  return {
    rows: parseDelimited(await file.text()),
    source: file.name,
    sheetName: ''
  };
}
function recordFingerprint(record) {
  if (record.source && Number(record.sourceRow) > 0) {
    const sourceName = String(record.source).replace(/\s*·\s*Sheet1$/i, '').trim();
    return `source-row:${sourceName}:${Number(record.sourceRow)}:${record.productId || ''}:${record.saleId || ''}`;
  }
  return ['date', 'office', 'employee', 'product', 'hospital', 'hospitalCode', 'hospitalLevel', 'department', 'departmentRoom', 'address', 'customer', 'orderBoxes', 'salesAmount', 'visitCount', 'activityType', 'activityCost', 'activityHours', 'activityId'].map(key => record[key] || '').join('\u001f');
}
async function importSalesData(event) {
  event.preventDefault();
  const file = els.salesDataInput.files?.[0];
  const pastedText = els.salesDataPaste.value.trim();
  if (!file && !pastedText) {
    els.importResult.textContent = '请选择原始 Excel / CSV 文件，或粘贴表格数据。';
    return;
  }
  if (!window.SalesImportAdapter || !window.ExcelLocalReader || !window.XLSX) {
    els.importResult.textContent = '本地 Excel 解析组件未加载，请刷新后重试。';
    return;
  }
  els.importResult.textContent = '正在本机解密、清洗并生成预览…';
  els.previewSalesImportButton.disabled = true;
  try {
    let workbook;
    let sourceName;
    let encrypted = false;
    let passwordSource = 'none';
    if (file) {
      const read = await window.ExcelLocalReader.readWorkbook(file, {
        password: els.salesDataPassword.value || undefined
      });
      workbook = read.workbook;
      sourceName = file.name;
      encrypted = read.encrypted;
      passwordSource = read.passwordSource;
    } else {
      const rows = parseDelimited(pastedText);
      workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, window.XLSX.utils.aoa_to_sheet(rows), '粘贴数据');
      sourceName = '粘贴导入';
    }
    const directory = directoryRecords();
    const parsed = window.SalesImportAdapter.parseWorkbook(workbook, window.XLSX, {
      sourceName,
      hospitals: hospitalDirectorySnapshot({
        refresh: true
      }).hospitals.map(item => ({
        hospital: item.canonicalName || item.hospitalName,
        hospitalId: item.hospitalId,
        aliases: item.aliases
      })),
      departments: directory.map(item => ({
        hospitalId: item.hospitalId,
        department: item.department,
        departmentId: item.departmentId,
        aliases: item.departmentAliases
      })),
      hospitalAliases: {
        ...HOSPITAL_ALIAS_SUGGESTIONS,
        ...customSynonyms()
      }
    });
    salesImportPreview = {
      ...parsed,
      preview: window.SalesImportAdapter.buildPreview(parsed),
      encrypted,
      passwordSource
    };
    renderSalesImportPreview();
    els.salesPasswordWrap.hidden = true;
    els.salesDataPassword.value = '';
    els.importResult.textContent = `${encrypted ? `已在本机解密（${passwordSource === 'filename' ? '文件名默认密码' : '手动密码'}）。` : ''}已读取 ${parsed.sheetName}，请核对后确认导入。`;
  } catch (error) {
    salesImportPreview = null;
    els.confirmSalesImportButton.disabled = true;
    els.salesImportPreview.hidden = true;
    if (error?.code === 'PASSWORD_REQUIRED' || error?.code === 'INVALID_PASSWORD') {
      els.salesPasswordWrap.hidden = false;
      els.importResult.textContent = error.message;
    } else {
      console.error('销售数据解析失败', error);
      els.importResult.textContent = `解析失败：${error.message}`;
    }
  } finally {
    els.previewSalesImportButton.disabled = false;
  }
}
function importKpiMarkup(items) {
  return items.map(([label, value]) => `<article><span>${escapeHTML(label)}</span><strong>${escapeHTML(String(value))}</strong></article>`).join('');
}
function renderSalesImportPreview() {
  if (!salesImportPreview) return;
  const preview = salesImportPreview.preview;
  els.salesImportPreview.hidden = false;
  els.confirmSalesImportButton.disabled = preview.validRecords === 0;
  els.salesImportKpis.innerHTML = importKpiMarkup([['原始记录', preview.originalRecords], ['目标产品', preview.targetProductRecords], ['剔除其他产品', preview.excludedProductRecords], ['剔除已取消', preview.cancelledRecords], ['有效记录', preview.validRecords], ['退货记录', preview.returnRecords], ['净销售盒数', `${preview.netBoxes}盒`], ['日期无效', preview.invalidRecords]]);
  els.salesImportProducts.innerHTML = preview.products.map(item => `<p><span>${escapeHTML(item.productName)}</span><strong>${item.netBoxes}盒</strong></p>`).join('') || '<p>暂无目标产品</p>';
  els.salesImportMonths.innerHTML = preview.months.sort((a, b) => a.fiscalYear - b.fiscalYear || a.month - b.month).map(item => `<p><span>FY${item.fiscalYear} · ${item.month}月</span><strong>${item.netBoxes}盒</strong></p>`).join('') || '<p>暂无有效月份</p>';
  els.salesImportDetailBody.innerHTML = preview.detailRows.slice(0, 100).map(row => `<tr><td data-label="日期">${escapeHTML(row.date)}</td><td data-label="产品">${escapeHTML(row.productName)}</td><td data-label="办事处">${escapeHTML(row.office || '未识别')}</td><td data-label="医院 / 科室">${escapeHTML(row.hospitalCanonical || '未识别')}<small>${escapeHTML(row.departmentCanonical || '未识别')}</small></td><td data-label="订单" class="numeric">${row.quantity}</td><td data-label="退货" class="numeric">${row.returnQuantity}</td><td data-label="净销量" class="numeric">${row.netBoxes}</td><td data-label="匹配">${escapeHTML(`${row.hospitalMatchStatus}/${row.departmentMatchStatus}`)}</td></tr>`).join('');
}
function clearSalesImportPreview({
  close = true
} = {}) {
  salesImportPreview = null;
  els.salesDataPassword.value = '';
  els.salesPasswordWrap.hidden = true;
  els.salesImportPreview.hidden = true;
  els.confirmSalesImportButton.disabled = true;
  els.salesDataInput.value = '';
  els.salesDataPaste.value = '';
  els.importResult.textContent = '尚未选择文件。确认前不会写入正式数据。';
  if (close && els.importDialog.open) els.importDialog.close();
}
function confirmSalesImport() {
  if (!salesImportPreview) return;
  state.settings.salesRawProductImports = state.settings.salesRawProductImports || {};
  const sourceKey = salesImportPreview.rawProducts?.[0]?.sourceName || salesImportPreview.sheetName;
  state.settings.salesRawProductImports[sourceKey] = salesImportPreview.rawProducts || [];
  const existing = new Set(state.records.map(recordFingerprint));
  let imported = 0;
  let skipped = 0;
  salesImportPreview.records.forEach(record => {
    const fingerprint = recordFingerprint(record);
    if (existing.has(fingerprint)) {
      skipped += 1;
      return;
    }
    existing.add(fingerprint);
    state.records.push(record);
    imported += 1;
  });
  {
    const importedAt = new Date().toISOString();
    state.settings.lastSalesImport = {
      importedAt,
      records: imported,
      statistics: salesImportPreview.preview.statistics
    };
    syncHospitalMaintenanceTasks({
      now: importedAt
    });
    persist();
    render();
  }
  showToast(`已导入 ${imported} 条净销售记录${skipped ? `，跳过重复 ${skipped} 条` : ''}`);
  clearSalesImportPreview();
  switchView('data');
}
function planMatcherOptions() {
  const directory = directoryRecords();
  return {
    hospitals: hospitalDirectorySnapshot({
      refresh: true
    }).hospitals.map(item => ({
      hospital: item.canonicalName || item.hospitalName,
      hospitalId: item.hospitalId,
      aliases: item.aliases
    })),
    departments: directory.map(item => ({
      hospitalId: item.hospitalId,
      department: item.department,
      departmentId: item.departmentId,
      aliases: item.departmentAliases
    })),
    customers: directory.map(item => ({
      customer: item.customer,
      customerId: item.customerId,
      hospitalId: item.hospitalId,
      departmentId: item.departmentId,
      hospital: item.hospital,
      department: item.department,
      employee: item.employee
    })),
    hospitalAliases: {
      ...HOSPITAL_ALIAS_SUGGESTIONS,
      ...customSynonyms()
    },
    departmentAliases: customSynonyms(),
    customerAliases: customSynonyms()
  };
}
async function previewFourThreePlan() {
  const file = els.planDataInput.files?.[0];
  if (!file) {
    els.planImportStatus.textContent = '请选择4+3工作簿。';
    return;
  }
  if (!window.ExcelLocalReader || !window.FourThreePlanAdapter || !window.XLSX) {
    els.planImportStatus.textContent = '本地计划解析组件未加载，请刷新后重试。';
    return;
  }
  els.previewPlanImportButton.disabled = true;
  els.planImportStatus.textContent = '正在本机识别工作表、计算达成并交叉校验…';
  try {
    const read = await window.ExcelLocalReader.readWorkbook(file, {
      password: els.planDataPassword.value || undefined
    });
    planImportPreview = window.FourThreePlanAdapter.parseWorkbook(read.workbook, window.XLSX, {
      sourceName: file.name,
      ...planMatcherOptions()
    });
    renderPlanImportPreview();
    renderPlanAnalysis(planImportPreview.records);
    els.planPasswordWrap.hidden = true;
    els.planDataPassword.value = '';
    els.planImportStatus.textContent = `已读取 ${planImportPreview.sheetNames.main}${planImportPreview.sheetNames.customer ? `、${planImportPreview.sheetNames.customer}` : ''}${planImportPreview.sheetNames.pivot ? '，并完成数据透视交叉校验' : ''}。请核对后确认导入。`;
  } catch (error) {
    planImportPreview = null;
    els.confirmPlanImportButton.disabled = true;
    els.planImportPreview.hidden = true;
    if (error?.code === 'PASSWORD_REQUIRED' || error?.code === 'INVALID_PASSWORD') {
      els.planPasswordWrap.hidden = false;
      els.planImportStatus.textContent = error.message;
    } else {
      console.error('4+3计划解析失败', error);
      els.planImportStatus.textContent = `解析失败：${error.message}`;
    }
  } finally {
    els.previewPlanImportButton.disabled = false;
  }
}
function renderPlanImportPreview() {
  const quality = planImportPreview?.quality;
  if (!quality) return;
  els.planImportPreview.hidden = false;
  els.confirmPlanImportButton.disabled = quality.targetProductRecords === 0;
  els.planImportQualityKpis.innerHTML = importKpiMarkup([['目标产品记录', quality.targetProductRecords], ['员工', quality.employees], ['医院', quality.hospitals], ['科室', quality.departments], ['客户', quality.customers], ['客户管理记录', quality.customerSheetRecords], ['客户产品已匹配', quality.customerProductMatched], ['客户产品待确认', quality.customerProductAmbiguous + quality.customerProductUnmatched], ['目标完整', quality.targetComplete], ['实际完整', quality.actualComplete], ['资源配置完整', quality.resourceComplete], ['问题分析完整', quality.problemComplete], ['待确认匹配', quality.probableCustomers + quality.ambiguousCustomers], ['未匹配', quality.unmatchedCustomers]]);
  const checked = quality.pivotCrossCheck;
  els.planCrossCheckStatus.dataset.status = checked.status;
  els.planCrossCheckStatus.textContent = checked.status === 'MATCH' ? `数据透视交叉校验通过（${checked.compared}项）。` : checked.status === 'MISMATCH' ? `警告：明细汇总与原工作簿数据透视结果不一致（${checked.differences.length}项），请核对后再确认。` : '工作簿没有可用的数据透视汇总，已跳过交叉校验。';
}
function optionMarkup(values, allLabel = '全部') {
  return `<option value="all">${allLabel}</option>${[...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')).map(value => `<option value="${escapeHTML(String(value))}">${escapeHTML(String(value))}</option>`).join('')}`;
}
function populatePlanFilters(records) {
  const current = [els.planFiscalYearFilter, els.planMonthFilter, els.planProductFilter, els.planOfficeFilter, els.planEmployeeFilter, els.planHospitalFilter, els.planDepartmentFilter].map(element => element.value);
  els.planFiscalYearFilter.innerHTML = optionMarkup(records.map(row => row.fiscalYear), '全部财年');
  els.planMonthFilter.innerHTML = optionMarkup(records.map(row => row.month), '全部月份');
  els.planOfficeFilter.innerHTML = optionMarkup(records.map(row => row.office));
  els.planEmployeeFilter.innerHTML = optionMarkup(records.map(row => row.employee));
  els.planHospitalFilter.innerHTML = optionMarkup(records.map(row => row.hospitalName));
  els.planDepartmentFilter.innerHTML = optionMarkup(records.map(row => row.departmentName));
  [els.planFiscalYearFilter, els.planMonthFilter, els.planProductFilter, els.planOfficeFilter, els.planEmployeeFilter, els.planHospitalFilter, els.planDepartmentFilter].forEach((element, index) => {
    if ([...element.options].some(option => option.value === current[index])) element.value = current[index];
  });
}
function planFilters() {
  return {
    fiscalYear: els.planFiscalYearFilter.value === 'all' ? null : Number(els.planFiscalYearFilter.value),
    month: els.planMonthFilter.value === 'all' ? null : Number(els.planMonthFilter.value),
    productId: els.planProductFilter.value,
    office: els.planOfficeFilter.value,
    employee: els.planEmployeeFilter.value,
    hospital: els.planHospitalFilter.value,
    department: els.planDepartmentFilter.value
  };
}
function planPercent(value) {
  return value === null || !Number.isFinite(Number(value)) ? '数据不足' : `${(Number(value) * 100).toFixed(1)}%`;
}
function planTableEmpty(columns, message = '当前筛选暂无数据') {
  return `<tr><td colspan="${columns}">${escapeHTML(message)}</td></tr>`;
}
const PLAN_RESOURCE_TAG_LABELS = Object.freeze({
  HOME_VISIT: '家访',
  VISIT_INCREASE: '加强拜访',
  DIRECTOR_VISIT: '主任协访',
  PRODUCT_MANAGER_VISIT: '产品经理协访',
  INTERNAL_TRAINING: '内训会',
  DEPARTMENT_MEETING: '科室会',
  JOINT_VISIT: '协访',
  OTHER: '其他'
});
const PLAN_REASON_TAG_LABELS = Object.freeze({
  PATIENT_SHORTAGE: '患者不足',
  CUSTOMER_CAUTION: '客户谨慎',
  ADHERENCE: '依从性',
  PRICE: '价格',
  POLICY: '政策',
  VISIT_GAP: '拜访不足',
  RECOMMENDATION_GAP: '推荐不足',
  PRODUCT_AWARENESS: '产品认知',
  COMPETITION: '竞争',
  OTHER: '其他'
});
function planTagSelect(kind, record) {
  const labels = kind === 'resource' ? PLAN_RESOURCE_TAG_LABELS : PLAN_REASON_TAG_LABELS;
  const manual = kind === 'resource' ? record.manualResourceTag : record.manualReasonTag;
  return `<select data-plan-tag-kind="${kind}" data-plan-record-id="${escapeHTML(record.id)}" aria-label="修正${kind === 'resource' ? '资源' : '原因'}主标签"><option value="">使用自动标签</option>${Object.entries(labels).map(([value, label]) => `<option value="${value}"${manual === value ? ' selected' : ''}>${label}</option>`).join('')}</select>`;
}
function renderPlanAnalysis(records = state.employeePlanRecords || []) {
  if (!records.length || !window.FourThreePlanAdapter) {
    els.planAnalysisPanel.hidden = true;
    return;
  }
  els.planAnalysisPanel.hidden = false;
  populatePlanFilters(records);
  const stats = window.FourThreePlanAdapter.buildStatistics(records, planFilters());
  const totals = stats.totals;
  els.planAnalysisKpis.innerHTML = importKpiMarkup([['员工数', totals.employees], ['计划客户数', totals.customers], ['目标盒数', totals.target], ['实际盒数', totals.actual], ['达成率', planPercent(totals.achievementRate)], ['达标客户', totals.achieved], ['未达标客户', totals.notAchieved], ['缺数据', totals.missing]]);
  const employeeMax = Math.max(...stats.employee.flatMap(row => [row.target, row.actual]), 1);
  els.planEmployeeTargetChart.innerHTML = stats.employee.sort((a, b) => b.actual - a.actual).slice(0, 20).map(row => `<div class="plan-bar-row"><span title="${escapeHTML(row.employee)}">${escapeHTML(row.employee)}</span><i class="plan-bar-track"><i style="width:${row.target / employeeMax * 100}%"></i><b style="width:${row.actual / employeeMax * 100}%"></b></i><strong>${planPercent(row.achievementRate)}</strong></div>`).join('') || '<p class="muted">暂无员工数据</p>';
  const rated = stats.employee.filter(row => row.achievementRate !== null).sort((a, b) => b.achievementRate - a.achievementRate);
  const maxRate = Math.max(...rated.map(row => row.achievementRate), 1);
  els.planEmployeeRateChart.innerHTML = rated.map(row => `<div class="plan-bar-row"><span title="${escapeHTML(row.employee)}">${escapeHTML(row.employee)}</span><i class="plan-bar-track" data-tone="${row.achievementRate >= 1 ? 'good' : row.achievementRate >= .8 ? 'near' : 'risk'}"><i style="width:${Math.min(100, row.achievementRate / maxRate * 100)}%"></i></i><strong>${planPercent(row.achievementRate)}</strong></div>`).join('') || '<p class="muted">暂无可计算达成率的数据</p>';
  els.planMonthlyBody.innerHTML = stats.monthly.slice(0, 80).map(row => `<tr><td data-label="员工">${escapeHTML(row.employee)}</td><td data-label="上月实际">${row.previousActual ?? '—'}</td><td data-label="本月目标">${row.currentTarget ?? '—'}</td><td data-label="本月实际">${row.currentActual ?? '—'}</td><td data-label="下月目标">${row.nextMonthTarget ?? '—'}</td></tr>`).join('') || planTableEmpty(5);
  els.planHospitalBody.innerHTML = stats.department.sort((a, b) => a.difference - b.difference).slice(0, 50).map(row => `<tr><td data-label="医院 / 科室">${escapeHTML(row.hospitalName)}<small>${escapeHTML(row.departmentName)}</small></td><td data-label="目标">${row.target}</td><td data-label="实际">${row.actual}</td><td data-label="差额">${row.difference > 0 ? '+' : ''}${row.difference}</td><td data-label="达成率">${planPercent(row.achievementRate)}</td></tr>`).join('') || planTableEmpty(5);
  els.planCustomerBody.innerHTML = stats.customer.sort((a, b) => a.difference - b.difference).slice(0, 80).map(row => `<tr><td data-label="客户">${escapeHTML(row.customerName)}</td><td data-label="医院 / 科室">${escapeHTML(row.hospitalName)}<small>${escapeHTML(row.departmentName)}</small></td><td data-label="目标">${row.target}</td><td data-label="实际">${row.actual}</td><td data-label="差额">${row.difference > 0 ? '+' : ''}${row.difference}</td><td data-label="下月目标">${row.nextTarget}</td></tr>`).join('') || planTableEmpty(6);
  els.planResourceTags.innerHTML = stats.resources.sort((a, b) => b.records - a.records).map(row => `<span>${escapeHTML(row.tag)} · ${row.records}条 / ${row.hospitals}院</span>`).join('') || '<span>暂无资源配置</span>';
  els.planReasonTags.innerHTML = stats.reasons.sort((a, b) => b.records - a.records).map(row => `<span>${escapeHTML(row.tag)} · ${row.records}条 / 缺口${row.boxGap}盒</span>`).join('') || '<span>暂无原因记录</span>';
  els.planTagCorrectionBody.innerHTML = stats.records.slice(0, 100).map(row => `<tr><td data-label="员工 / 客户">${escapeHTML(row.employee)}<small>${escapeHTML(row.customerName)}</small></td><td data-label="原始内容"><span>${escapeHTML(row.resourcePlan || '未填写资源')}</span><small>${escapeHTML(row.problemAnalysis || '未填写原因')}</small></td><td data-label="资源主标签">${planTagSelect('resource', row)}</td><td data-label="原因主标签">${planTagSelect('reason', row)}</td></tr>`).join('') || planTableEmpty(4);
}
function updatePlanManualTag(event) {
  const control = event.target.closest('[data-plan-tag-kind][data-plan-record-id]');
  if (!control) return;
  const records = planImportPreview?.records || state.employeePlanRecords || [];
  const row = records.find(item => item.id === control.dataset.planRecordId);
  if (!row) return;
  const field = control.dataset.planTagKind === 'resource' ? 'manualResourceTag' : 'manualReasonTag';
  row[field] = control.value;
  row.updatedAt = new Date().toISOString();
  if (!planImportPreview) persist();
  renderPlanAnalysis(records);
  showToast(control.value ? '人工主标签已应用' : '已恢复自动标签');
}
function clearPlanImportPreview({
  close = false
} = {}) {
  planImportPreview = null;
  els.planDataInput.value = '';
  els.planDataPassword.value = '';
  els.planPasswordWrap.hidden = true;
  els.planImportPreview.hidden = true;
  els.confirmPlanImportButton.disabled = true;
  els.planImportStatus.textContent = '尚未选择文件。';
  if (state.employeePlanRecords?.length) renderPlanAnalysis();else els.planAnalysisPanel.hidden = true;
  if (close && els.planImportDialog.open) els.planImportDialog.close();
}
function confirmPlanImport() {
  if (!planImportPreview) return;
  const planIds = new Set(planImportPreview.records.map(row => row.id));
  state.employeePlanRecords = [...(state.employeePlanRecords || []).filter(row => !planIds.has(row.id)), ...planImportPreview.records];
  const customerIds = new Set(planImportPreview.customerPlans.map(row => row.id));
  state.customerUpgradePlans = [...(state.customerUpgradePlans || []).filter(row => !customerIds.has(row.id)), ...planImportPreview.customerPlans];
  state.settings.lastPlanImport = {
    importedAt: new Date().toISOString(),
    fiscalYear: planImportPreview.fiscalYear,
    month: planImportPreview.month,
    quality: planImportPreview.quality
  };
  persist();
  render();
  const count = planImportPreview.records.length;
  const customers = planImportPreview.customerPlans.length;
  planImportPreview = null;
  els.confirmPlanImportButton.disabled = true;
  els.planImportPreview.hidden = true;
  renderPlanAnalysis();
  els.planImportStatus.textContent = `已保存 ${count} 条员工计划与 ${customers} 条客户管理记录，可继续使用筛选分析。`;
  showToast('4+3计划已导入并生成执行分析');
}
function openPlanImport() {
  els.dataManagementDialog.close();
  clearPlanImportPreview();
  if (state.employeePlanRecords?.length) {
    renderPlanAnalysis();
    els.planImportStatus.textContent = `本机已有 ${state.employeePlanRecords.length} 条计划记录，可直接分析或重新导入。`;
  }
  els.planImportDialog.showModal();
}
function taskFieldScope(category) {
  if (['培训', '课件制作', '销售数据分析'].includes(category)) return {
    officeEmployee: false,
    hospitalDepartment: false,
    customer: false,
    product: true
  };
  if (category === '医院信息维护') return {
    officeEmployee: true,
    hospitalDepartment: true,
    customer: false,
    product: false
  };
  return {
    officeEmployee: true,
    hospitalDepartment: true,
    customer: true,
    product: true
  };
}
function updateTaskFieldVisibility(category = els.taskCategory.value) {
  const scope = taskFieldScope(category);
  const singleCustomer = category === CUSTOMER_VISIT_CATEGORY;
  els.taskOfficeEmployeeWrap.hidden = !scope.officeEmployee;
  els.taskHospitalDepartmentRow.hidden = !scope.hospitalDepartment;
  els.taskCustomerWrap.hidden = !scope.customer;
  els.taskProductWrap.hidden = !scope.product;
  els.taskCustomerExcelWrap.hidden = category !== CUSTOMER_VISIT_CATEGORY;
  els.taskWeeklyOutputWrap.hidden = category !== CUSTOMER_VISIT_CATEGORY;
  els.taskCustomerProfileFields.hidden = category !== CUSTOMER_VISIT_CATEGORY;
  els.taskHospitalLabel.textContent = singleCustomer ? '医院（单选）' : '医院（可多选）';
  els.taskDepartmentLabel.textContent = singleCustomer ? '科室（单选）' : '科室（可多选）';
  els.taskCustomerLabel.textContent = singleCustomer ? '客户（单选）' : '客户（可多选）';
  if (singleCustomer) ['taskHospital', 'taskDepartment', 'taskCustomer'].forEach(fieldId => setMultiValues(fieldId, splitMultiValues($(fieldId).value).slice(-1)));
}
function customerHeaderKey(value) {
  const normalized = normalizeHeader(value);
  return Object.keys(CUSTOMER_IMPORT_HEADERS).find(key => CUSTOMER_IMPORT_HEADERS[key].some(alias => normalizeHeader(alias) === normalized)) || null;
}
function normalizeOffice(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const restored = raw.replace(/^太原([一二三四五六七八九十])办$/, '太原$1部');
  const offices = [...new Set(directoryRecords().map(record => record.office).filter(Boolean))];
  return closestPreset(restored, offices);
}
async function importCustomerWorkbook(file) {
  if (!file) return;
  if (!window.XLSX) throw new Error('Excel 组件未加载，请刷新页面后重试。');
  els.taskCustomerExcelStatus.textContent = `正在读取 ${file.name}…`;
  const workbook = window.XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel 文件中没有可读取的工作表。');
  const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true
  });
  let header = null;
  rows.slice(0, 30).some((row, index) => {
    const keys = row.map(customerHeaderKey);
    const unique = new Set(keys.filter(Boolean));
    if (unique.has('hospital') && unique.has('employee') && unique.size >= 4) {
      header = {
        index,
        keys
      };
      return true;
    }
    return false;
  });
  if (!header) throw new Error('未识别到客户档案表头，需要包含员工、医院及至少另外两个字段。');
  const context = {
    office: '',
    employee: '',
    hospital: '',
    department: '',
    customer: '',
    product: '',
    potential: '',
    awareness: ''
  };
  const existing = new Set(state.tasks.map(task => task.customerImportKey).filter(Boolean));
  const now = new Date().toISOString();
  const due = `${selectedTaskDate || dateKey()}T09:00`;
  let imported = 0;
  let skipped = 0;
  rows.slice(header.index + 1).forEach((cells, rowOffset) => {
    const raw = {};
    header.keys.forEach((key, index) => {
      if (key) raw[key] = String(cells[index] || '').trim();
    });
    if (!Object.values(raw).some(Boolean)) return;
    if (raw.office) context.office = normalizeOffice(raw.office);
    if (raw.employee && raw.employee !== context.employee) {
      context.employee = closestPreset(raw.employee, officeEmployeeChoices().map(item => item.employee));
      context.hospital = '';
      context.department = '';
      context.customer = '';
      context.product = '';
      context.potential = '';
      context.awareness = '';
    }
    if (raw.hospital) {
      context.hospital = resolveHospitalAlias(raw.hospital);
      context.department = '';
      context.customer = '';
    }
    if (raw.department) {
      context.department = raw.department;
      context.customer = '';
    }
    if (raw.customer) context.customer = raw.customer;
    if (raw.product) context.product = normalizeProduct(raw.product);
    if (raw.potential) context.potential = raw.potential;
    if (raw.awareness) context.awareness = raw.awareness;
    if (!raw.customer || !context.customer) return;
    if (!context.office && context.employee) {
      const offices = [...new Set(directoryRecords().filter(record => record.employee === context.employee).map(record => record.office).filter(Boolean))];
      if (offices.length === 1) context.office = offices[0];
    }
    const sourceRow = header.index + rowOffset + 2;
    const customerImportKey = `${file.name}\u001f${sheetName}\u001f${sourceRow}`;
    if (existing.has(customerImportKey)) {
      skipped++;
      return;
    }
    const notes = [context.potential && `潜力评估：${context.potential}`, context.awareness && `产品知晓情况：${context.awareness}`].filter(Boolean).join('\n');
    const subject = [context.hospital, context.department, context.customer].filter(Boolean).join(' · ');
    state.tasks.push({
      id: uid(),
      title: `${subject || '客户'}拜访`,
      category: CUSTOMER_VISIT_CATEGORY,
      due,
      location: '',
      progress: 0,
      urgent: false,
      longTerm: true,
      notes,
      office: context.office,
      employee: context.employee,
      hospital: context.hospital,
      department: context.department,
      customer: context.customer,
      product: context.product,
      weeklyOutputs: {},
      customerImportKey,
      source: `${file.name} · ${sheetName}`,
      sourceRow,
      createdAt: now,
      updatedAt: now
    });
    existing.add(customerImportKey);
    imported++;
  });
  if (!imported && !skipped) throw new Error('表格中没有可生成客户拜访任务的数据行。');
  if (imported) {
    persist();
    render();
  }
  els.taskCustomerExcelStatus.textContent = `已读取 ${sheetName}：新增 ${imported} 条客户拜访任务${skipped ? `，跳过重复 ${skipped} 条` : ''}。`;
}
function openTask(task = null) {
  renderDataOptions();
  if (task && !canUseNativeTaskProgress(task)) {
    window.taskProgressV2App?.openTask?.(task.id);
    return;
  }
  els.taskForm.reset();
  els.taskId.value = task?.id || '';
  els.taskDialogTitle.textContent = task ? task.category === CUSTOMER_VISIT_CATEGORY ? '编辑客户拜访' : task.category === '医院信息维护' ? '编辑医院信息维护' : task.taskType === 'customer_profile_maintenance' ? '编辑人员维护任务' : '编辑自建任务' : '新建其他任务';
  $('taskDialogSourceLabel').textContent = task?.relatedActivityId ? '活动申请来源任务' : task?.sourceType === 'customer' ? '客户来源任务' : task?.sourceType === 'hospital' ? '医院来源任务' : task?.sourceType === 'activity' ? '活动来源任务' : '自建任务';
  els.taskTitle.value = task?.title || '';
  if (task?.category && ![...els.taskCategory.options].some(option => option.value === task.category)) els.taskCategory.add(new Option(task.category, task.category));
  els.taskCategory.value = task?.category || '其他';
  const canonicalDue = task ? window.TaskProgressAdapter.dueValue(task) : '';
  els.taskDue.value = canonicalDue ? canonicalDue.includes('T') ? canonicalDue : `${canonicalDue}T09:00` : task ? '' : selectedTaskDate ? `${selectedTaskDate}T09:00` : '';
  updateTaskDueWeekday();
  els.taskLocation.value = task?.location || '';
  els.taskProgress.value = task?.progress ?? 0;
  renderTaskStagePicker(task?.category || '其他', task?.progress ?? 0);
  els.taskUrgent.checked = Boolean(task?.urgent);
  els.taskLongTerm.checked = Boolean(task?.longTerm);
  document.querySelector('#taskVisitInterval').value = task?.visitIntervalDays || '';
  document.querySelector('#taskVisitInterval').closest('label').hidden = task?.taskType !== 'customer_visit' && task?.category !== CUSTOMER_VISIT_CATEGORY;
  document.querySelector('#taskVisitProgress').value = task?.progress ?? 0;
  els.taskNotes.value = String(task?.notes || '').replace(/来源(?:活动|任务)[：:]\s*[a-zA-Z0-9_-]{8,}/g, '来源：业务记录');
  els.taskOffice.value = task?.office || '';
  els.taskEmployee.value = task?.employee || '';
  els.taskOfficeEmployee.value = task?.employee ? `${displayOffice(task?.office || '')}${task.employee}` : '';
  setMultiValues('taskHospital', task?.hospital || '');
  setMultiValues('taskDepartment', task?.department || '');
  setMultiValues('taskCustomer', task?.customer || '');
  els.taskCustomer.dataset.entityId = task?.customerId || '';
  els.taskHospitalEntry.value = '';
  els.taskDepartmentEntry.value = '';
  els.taskCustomerEntry.value = '';
  els.taskImageInput.value = '';
  els.taskRecognitionStatus.textContent = '可输入或语音转写文字，也可选择截图、照片；读取时会匹配预设选项。';
  els.taskCustomerExcelInput.value = '';
  els.taskCustomerExcelStatus.textContent = '支持办事处、员工、医院、科室、客户、产品等字段，空白续行会自动继承。';
  els.taskProduct.value = task?.product || '';
  els.taskCustomerJobTitle.value = task?.customerJobTitle || '';
  els.taskManagedBeds.value = task?.managedBeds ?? '';
  els.taskCustomerType.value = task?.customerType || '';
  const outputPeriod = previousCustomerPeriod();
  els.taskWeeklyOutputWrap.dataset.weekMonth = outputPeriod.month;
  els.taskWeeklySlot.value = outputPeriod.slot;
  els.taskWeeklyOutputWeek.textContent = `（${outputPeriod.month}，默认上一周）`;
  els.taskWeeklyOutput.value = task?.weeklyOutputs?.[outputPeriod.key] ?? '';
  updateTaskFieldVisibility(task?.category || '其他');
  els.deleteTaskButton.hidden = !task;
  document.querySelector('#cancelNativeTaskButton').hidden = !task || ['completed', 'cancelled'].includes(normalizedTask(task).status);
  document.querySelector('#withdrawTaskRecommendationButton').hidden = !canWithdrawRecommendationTask(task);
  syncWheelTriggers();
  els.taskDialog.showModal();
  els.taskTitle.focus({
    preventScroll: true
  });
}
function renderTaskStagePicker(category, progress = Number(els.taskProgress.value) || 0) {
  const stages = stagesFor(category);
  const current = [...stages].reverse().find(stage => progress >= stage.value) || stages[0];
  const isCustomer = category === CUSTOMER_VISIT_CATEGORY;
  els.taskProgress.value = progress;
  els.progressOutput.value = current.label;
  els.taskStagePicker.innerHTML = '';
  els.taskWeeklyOutputWrap.hidden = !isCustomer;
}
function saveTask(event) {
  event.preventDefault();
  syncOfficeEmployeeInput();
  Object.keys(MULTI_FIELDS).forEach(fieldId => {
    const entry = MULTI_FIELDS[fieldId].entry();
    if (!entry.value.trim()) return;
    if (fieldId === 'taskCustomer' || multiPickerOptions(fieldId).includes(entry.value.trim())) addMultiValue(fieldId, entry.value);
  });
  const now = new Date().toISOString();
  const existingTask = els.taskId.value ? state.tasks.find(task => task.id === els.taskId.value) : null;
  if (existingTask && !canUseNativeTaskProgress(existingTask)) return showToast('系统任务请从来源详情中处理');
  const weeklyOutputs = {
    ...(existingTask?.weeklyOutputs || {})
  };
  if (els.taskCategory.value === CUSTOMER_VISIT_CATEGORY && els.taskWeeklyOutput.value !== '') {
    const weekMonth = els.taskWeeklyOutputWrap.dataset.weekMonth || previousCustomerPeriod().month;
    weeklyOutputs[`${weekMonth}-${els.taskWeeklySlot.value}`] = Number(els.taskWeeklyOutput.value) || 0;
  }
  const scope = taskFieldScope(els.taskCategory.value);
  const correctedHospitals = scope.hospitalDepartment ? splitMultiValues(els.taskHospital.value).map(value => resolveHospitalAlias(value)).join('、') : '';
  const values = {
    title: els.taskTitle.value.trim(),
    category: els.taskCategory.value,
    due: els.taskDue.value,
    location: els.taskLocation.value.trim(),
    progress: Number(els.taskProgress.value),
    urgent: els.taskUrgent.checked,
    longTerm: els.taskLongTerm.checked,
    notes: els.taskNotes.value.trim(),
    visitIntervalDays: document.querySelector('#taskVisitInterval').value ? Number(document.querySelector('#taskVisitInterval').value) : null,
    office: scope.officeEmployee ? els.taskOffice.value.trim() : '',
    employee: scope.officeEmployee ? els.taskEmployee.value.trim() : '',
    hospital: correctedHospitals,
    department: scope.hospitalDepartment ? els.taskDepartment.value.trim() : '',
    customer: scope.customer ? els.taskCustomer.value.trim() : '',
    customerId: scope.customer ? els.taskCustomer.dataset.entityId || '' : '',
    product: scope.product ? normalizeProduct(els.taskProduct.value) : '',
    weeklyOutputs,
    updatedAt: now,
    customerJobTitle: els.taskCategory.value === CUSTOMER_VISIT_CATEGORY ? els.taskCustomerJobTitle.value.trim() : '',
    managedBeds: els.taskCategory.value === CUSTOMER_VISIT_CATEGORY && els.taskManagedBeds.value !== '' ? Number(els.taskManagedBeds.value) : '',
    customerType: els.taskCategory.value === CUSTOMER_VISIT_CATEGORY ? els.taskCustomerType.value.trim() : '',
    description: els.taskNotes.value.trim(),
    dueDate: els.taskDue.value,
    sourceType: existingTask?.sourceType || 'manual',
    sourceId: existingTask?.sourceId || '',
    taskType: els.taskCategory.value === CUSTOMER_VISIT_CATEGORY ? 'customer_visit' : existingTask?.taskType || 'manual_other',
    priority: els.taskUrgent.checked ? 'high' : existingTask?.priority === 'low' ? 'low' : 'normal',
    status: Number(els.taskProgress.value) >= 100 ? 'completed' : Number(els.taskProgress.value) > 0 ? 'in_progress' : 'pending',
    autoGenerated: existingTask?.sourceType && existingTask.sourceType !== 'manual' ? existingTask.autoGenerated !== false : false
  };
  if (existingTask?.taskType === 'customer_profile_maintenance') {
    for (const key of ['hospital', 'hospitalId', 'department', 'departmentId', 'departmentIds', 'customer', 'customerId', 'product', 'employee', 'office']) values[key] = existingTask[key] || '';
  }
  if (!values.title) return;
  const id = els.taskId.value;
  if (existingTask?.sourceRecommendationKey) {
    if (existingTask.sourceRecommendationType !== 'hospital-maintenance') window.customerProfileV1App?.updateTaskRecommendationPlan?.(existingTask.sourceRecommendationKey, values.visitIntervalDays);
    if (values.status === 'completed' && !existingTask.completedAt) values.completedAt = now;
  }
  try {
    saveNativeTaskRecord(values, id);
  } catch (error) {
    showToast(error.message);
    if (error.message.includes('同名')) openMultiPicker('taskCustomer', values.customer);
    return;
  }
  persist();
  els.taskDialog.close();
  render();
  showToast(id ? '事项已更新' : '事项已添加');
}
function saveNativeTaskRecord(values, id = '') {
  const index = id ? state.tasks.findIndex(task => task.id === id) : -1;
  const previous = index >= 0 ? state.tasks[index] : null;
  const now = new Date().toISOString();
  const taskId = previous?.id || uid();
  const task = {
    progress: 0,
    status: 'pending',
    urgent: false,
    longTerm: false,
    location: '',
    office: '',
    employee: '',
    hospital: '',
    department: '',
    customer: '',
    product: '',
    notes: '',
    weeklyOutputs: {},
    sourceType: 'manual',
    sourceId: '',
    createdAt: now,
    ...previous,
    ...values,
    id: taskId,
    taskId,
    updatedAt: now
  };
  task.taskType = task.category === CUSTOMER_VISIT_CATEGORY ? 'customer_visit' : task.category === '医院信息维护' ? 'hospital_profile_maintenance' : task.taskType || 'manual_other';
  task.productId = window.ProductRegistry?.getProduct(task.product)?.id || '';
  if (previous && previous.employee !== task.employee) task.employeeId = '';
  if ([CUSTOMER_VISIT_CATEGORY, '医院信息维护'].includes(task.category)) {
    const records = directoryRecords();
    const uniqueId = (matches, key) => {
      const ids = [...new Set(matches.map(record => record[key]).filter(Boolean))];
      return ids.length === 1 ? ids[0] : '';
    };
    if (!task.hospitalId || previous && previous.hospital !== task.hospital) task.hospitalId = uniqueId([...records.filter(record => record.hospital === task.hospital), ...hospitalDirectorySnapshot().hospitals.filter(record => record.hospitalName === task.hospital)], 'hospitalId');
    if (!task.departmentId || previous && (previous.hospital !== task.hospital || previous.department !== task.department)) task.departmentId = uniqueId(records.filter(record => record.hospital === task.hospital && record.department === task.department), 'departmentId');
    if (!values.customerId && (!task.customerId || previous && ['hospital', 'department', 'customer'].some(key => previous[key] !== task[key]))) task.customerId = uniqueId(records.filter(record => record.hospital === task.hospital && record.department === task.department && record.customer === task.customer), 'customerId');
    if (task.sourceType === 'customer') task.sourceId = task.customerId || '';
    if (task.sourceType === 'hospital') task.sourceId = task.hospitalId || '';
    task.hospitalMatchStatus = hospitalDirectorySnapshot().hospitals.some(hospital => hospital.hospitalId === task.hospitalId) ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
  }
  if (task.category === CUSTOMER_VISIT_CATEGORY && task.sourceType === 'manual' && task.hospitalId && task.hospitalMatchStatus === 'CONFIRMED' && task.department && task.customer && splitMultiValues(task.customer).length === 1) {
    const resolver = window.DepartmentIdentity.createResolver([...(state.settings.departmentIdentityRegistry || []), ...directoryRecords().map(row => ({
      ...row,
      referenceOnly: true
    }))]);
    const department = resolver.match(task.department, {
      hospitalId: task.hospitalId
    });
    if (department.status === 'AMBIGUOUS') throw new Error('科室身份不唯一，请明确选择');
    task.departmentId = department.status === 'EXACT' ? department.departmentId || department.id : window.DepartmentIdentity.deterministicId(task.hospitalId, task.department);
    const person = window.customerProfileV1App.ensureTaskPerson({
      id: taskId,
      customerName: task.customer,
      customerId: values.customerId || (previous && ['hospital', 'department', 'customer'].every(key => previous[key] === task[key]) ? previous.customerId : ''),
      hospitalId: task.hospitalId,
      hospital: task.hospital,
      departmentId: task.departmentId,
      department: task.department,
      product: task.product
    });
    task.customerId = person.customerId;
  }
  if (task.progress >= 100) task.completedAt = task.completedAt || now;else {
    if (previous?.status === 'completed' || previous?.completedAt) task.reopenedAt = now;
    delete task.completedAt;
    delete task.cancelledAt;
    delete task.cancelledBy;
    delete task.customerVisitCancelledAt;
  }
  if (index >= 0) state.tasks[index] = task;else state.tasks.push(task);
  return task;
}
function removeTaskById(id, {
  closeDialog = false,
  deferRender = false
} = {}) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const context = {
    activities: state.activities,
    followUps: window.customerProfileV1App?.getFollowUps({
      includeDeleted: true
    }) || [],
    reviews: state.reviews
  };
  const decision = window.DeletionPolicy.decide('task', task, context);
  if (decision.action === 'WITHDRAW') withdrawRecommendationExecution(state, task);else if (decision.action === 'ARCHIVE') {
    const now = new Date().toISOString();
    task.archivedAt = now;
    task.updatedAt = now;
    if (!task.completedAt && Number(task.progress) < 100) Object.assign(task, {
      status: 'cancelled',
      cancelledAt: now,
      cancelledBy: 'user'
    });
  } else {
    state.tombstones ||= [];
    state.tombstones.push({
      key: 'task:' + id,
      kind: 'task',
      id,
      deletedAt: new Date().toISOString()
    });
    state.tasks = state.tasks.filter(item => item.id !== id);
  }
  expandedTaskIds.delete(id);
  selectedNativeTaskIds.delete(id);
  if (closeDialog && els.taskDialog.open) els.taskDialog.close();
  if (!deferRender) {
    persist();
    render();
    showToast(decision.action === 'DELETE' ? '事项已删除' : decision.action === 'WITHDRAW' ? '建议已撤回' : '事项已归档，历史已保留');
  }
}
function deleteCurrentTask() {
  const id = els.taskId.value;
  const task = state.tasks.find(item => item.id === id);
  if (!task || !confirm(`确定删除“${task.title}”吗？`)) return;
  removeTaskById(id, {
    closeDialog: true
  });
}
function nearestStage(category, progress) {
  return stagesFor(category).reduce((nearest, stage) => Math.abs(stage.value - Number(progress)) < Math.abs(nearest.value - Number(progress)) ? stage : nearest);
}
function updateTaskCardProgress(task, card) {
  if (!card) return;
  const done = taskStatus(task) === 'done';
  card.classList.toggle('done', done);
  const indicators = card.querySelector('.summary-indicators');
  let check = indicators?.querySelector('.completion-check');
  if (done && indicators && !check) {
    check = document.createElement('span');
    check.className = 'completion-check';
    check.setAttribute('aria-label', '全部完成');
    check.textContent = '✓';
    indicators.prepend(check);
  } else if (!done) check?.remove();
  const wrap = card.querySelector('[data-thermometer]');
  if (!wrap) return;
  wrap.style.setProperty('--progress', `${task.progress}%`);
  wrap.querySelectorAll('[data-stage-value]').forEach(node => {
    const value = Number(node.dataset.stageValue);
    node.classList.toggle('reached', task.progress >= value);
    node.classList.toggle('current', task.progress === value);
  });
  const slider = wrap.querySelector('[data-progress-slider]');
  if (slider) slider.value = String(task.progress);
  const label = wrap.querySelector('[data-progress-label]');
  if (label) label.textContent = stageForTask(task).label;
  const thumb = wrap.querySelector('[data-compact-progress-thumb]');
  if (thumb) {
    thumb.setAttribute('aria-valuenow', String(task.progress));
    thumb.setAttribute('aria-valuetext', stageForTask(task).label);
  }
}
function setProgress(id, progress, {
  renderPage = true,
  notify = true,
  card = null
} = {}) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  if (!canUseNativeTaskProgress(task)) return showToast('系统任务进度由来源生命周期管理');
  const wasCompleted = normalizedTask(task).status === 'completed';
  task.progress = nearestStage(task.category, progress).value;
  task.updatedAt = new Date().toISOString();
  task.status = task.progress === 100 ? 'completed' : task.progress > 0 ? 'in_progress' : 'pending';
  if (task.progress === 100) task.completedAt = task.updatedAt;else {
    if (wasCompleted) task.reopenedAt = task.updatedAt;
    delete task.completedAt;
    delete task.cancelledAt;
    delete task.cancelledBy;
    delete task.customerVisitCancelledAt;
  }
  persist();
  if (renderPage) render();else {
    updateTaskCardProgress(task, card);
    window.taskProgressV2App?.update({
      tasks: state.tasks
    });
  }
  if (notify) showToast(`进度已更新：${stageForTask(task).label}`);
}
function updateThermometerPreview(slider, {
  snap = true
} = {}) {
  const wrap = slider.closest('[data-thermometer]');
  const task = state.tasks.find(item => item.id === slider.dataset.progressSlider);
  if (!wrap || !task) return;
  const value = snap ? nearestStage(task.category, Number(slider.value)).value : Math.max(0, Math.min(100, Number(slider.value) || 0));
  slider.value = String(value);
  wrap.style.setProperty('--progress', `${value}%`);
  wrap.querySelectorAll('[data-stage-value]').forEach(node => {
    node.classList.toggle('reached', value >= Number(node.dataset.stageValue));
    node.classList.toggle('current', value === Number(node.dataset.stageValue));
  });
  const current = [...stagesFor(task.category)].reverse().find(stage => value >= stage.value) || stagesFor(task.category)[0];
  const label = wrap.querySelector('[data-progress-label]');
  if (label) label.textContent = current.label;
  const thumb = wrap.querySelector('[data-compact-progress-thumb]');
  if (thumb) {
    thumb.setAttribute('aria-valuenow', String(value));
    thumb.setAttribute('aria-valuetext', current.label);
  }
}
function commitThermometerProgress(slider) {
  const task = state.tasks.find(item => item.id === slider.dataset.progressSlider);
  if (!task) return;
  const matchedDateRange = taskMatchesSelectedDateRange(task);
  const stage = nearestStage(task.category, Number(slider.value));
  setProgress(task.id, stage.value, {
    renderPage: false,
    notify: false,
    card: slider.closest('.task-card')
  });
  renderBriefing();
  if (els.statusFilter.value !== 'all' || matchedDateRange !== taskMatchesSelectedDateRange(task)) renderTasks();
}
function startCompactProgressDrag(event) {
  const thumb = event.target.closest('[data-compact-progress-thumb]');
  if (!thumb || event.button !== 0) return;
  const wrap = thumb.closest('[data-thermometer]');
  const slider = wrap?.querySelector('[data-progress-slider]');
  const task = state.tasks.find(item => item.id === thumb.dataset.compactProgressThumb);
  if (!wrap || !slider || !task) return;
  compactProgressDrag = {
    thumb,
    slider,
    task,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    horizontal: false
  };
  try {
    thumb.setPointerCapture(event.pointerId);
  } catch {}
}
function moveCompactProgressDrag(event) {
  if (!compactProgressDrag || event.pointerId !== compactProgressDrag.pointerId) return;
  const dx = event.clientX - compactProgressDrag.x;
  const dy = event.clientY - compactProgressDrag.y;
  if (!compactProgressDrag.horizontal && Math.abs(dx) < 5) return;
  if (!compactProgressDrag.horizontal && Math.abs(dx) <= Math.abs(dy)) return;
  compactProgressDrag.horizontal = true;
  event.preventDefault();
  const track = compactProgressDrag.thumb.closest('.compact-thermometer-track');
  const box = track.getBoundingClientRect();
  const value = Math.max(0, Math.min(100, (event.clientX - box.left) / Math.max(1, box.width) * 100));
  compactProgressDrag.slider.value = String(value);
  updateThermometerPreview(compactProgressDrag.slider, {
    snap: false
  });
}
function finishCompactProgressDrag(event) {
  if (!compactProgressDrag || event.pointerId !== compactProgressDrag.pointerId) return;
  const drag = compactProgressDrag;
  compactProgressDrag = null;
  if (drag.horizontal) commitThermometerProgress(drag.slider);
}
function cancelCompactProgressDrag(event) {
  if (!compactProgressDrag || event.pointerId !== compactProgressDrag.pointerId) return;
  const {
    task
  } = compactProgressDrag;
  compactProgressDrag = null;
  updateTaskCardProgress(task, event.target.closest('.task-card'));
}
function handleCompactProgressKey(event) {
  const thumb = event.target.closest('[data-compact-progress-thumb]');
  if (!thumb || !['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const task = state.tasks.find(item => item.id === thumb.dataset.compactProgressThumb);
  const slider = thumb.closest('[data-thermometer]')?.querySelector('[data-progress-slider]');
  if (!task || !slider) return;
  const stages = stagesFor(task.category);
  const index = Math.max(0, stages.findIndex(stage => stage.value === nearestStage(task.category, task.progress).value));
  const target = event.key === 'Home' ? stages[0] : event.key === 'End' ? stages.at(-1) : stages[Math.max(0, Math.min(stages.length - 1, index + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1)))];
  event.preventDefault();
  slider.value = String(target.value);
  commitThermometerProgress(slider);
}
function toLocalInput(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function openWeeklyReview(auto = false) {
  const start = new Date();
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  start.setHours(0, 0, 0, 0);
  const touched = state.tasks.filter(task => !task.activityProfileOnly && new Date(task.updatedAt) >= start);
  const done = touched.filter(task => task.progress >= 100);
  const continuing = state.tasks.filter(task => !task.activityProfileOnly && task.progress < 100);
  els.weeklyTaskSummary.innerHTML = `<div class="weekly-summary">
    <strong>本周完成 ${done.length} 项</strong>
    <span>本周有进展 ${touched.length} 项 · 继续跟进 ${continuing.length} 项</span>
  </div>`;
  const existing = state.reviews.find(item => item.week === weekKey());
  els.weeklyNotes.value = existing?.notes || '';
  els.nextWeekTasks.value = '';
  els.weeklyDialog.showModal();
  if (auto) state.settings.lastWeeklyPrompt = weekKey();
  persist();
}
function saveWeeklyReview(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const lines = els.nextWeekTasks.value.split('\n').map(line => line.trim()).filter(Boolean);
  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  nextMonday.setHours(9, 0, 0, 0);
  lines.forEach(title => state.tasks.push({
    id: uid(),
    title,
    category: '其他',
    due: toLocalInput(nextMonday),
    location: '',
    progress: 0,
    urgent: false,
    longTerm: false,
    notes: '周五复盘新增',
    description: '周五复盘新增',
    sourceType: 'manual',
    sourceId: '',
    taskType: 'manual_other',
    priority: 'normal',
    status: 'pending',
    dueDate: toLocalInput(nextMonday),
    autoGenerated: false,
    createdAt: now,
    updatedAt: now
  }));
  const review = {
    week: weekKey(),
    notes: els.weeklyNotes.value.trim(),
    added: lines,
    createdAt: now
  };
  state.reviews = state.reviews.filter(item => item.week !== review.week);
  state.reviews.push(review);
  persist();
  els.weeklyDialog.close();
  render();
  showToast(`本周已确认${lines.length ? `，新增 ${lines.length} 项下周工作` : ''}`);
}
function briefingText() {
  const today = dateKey();
  const active = sortedTasks(state.tasks.filter(task => {
    const canonical = normalizedTask(task);
    return !task.activityProfileOnly && !['completed', 'cancelled'].includes(canonical.status) && (!canonical.dueDate || canonical.dueDate.slice(0, 10) <= today);
  }));
  if (!active.length) return '今天没有未完成事项。';
  const urgentCount = active.filter(task => task.urgent || normalizedTask(task).priority === 'high').length;
  const overdueCount = active.filter(task => normalizedTask(task).status === 'overdue').length;
  const top = active.slice(0, 3).map((task, index) => `第${index + 1}，${task.title}，${normalizedTask(task).sourceType === 'manual' ? `当前节点${stageForTask(task).label}` : `当前状态${normalizedTask(task).statusLabel}`}`).join('。');
  return `今天共有${active.length}项待推进，其中${urgentCount}项紧急${overdueCount ? `，${overdueCount}项逾期未完成` : ''}。${top}。`;
}
let briefingReading = false;
function setBriefingReading(reading) {
  briefingReading = reading;
  const button = $('readBriefingButton');
  button.textContent = reading ? '停止朗读' : '朗读今日晨报';
  button.setAttribute('aria-pressed', String(reading));
}
window.MorningBriefSpeech = Object.freeze({
  onState(value) {
    $('readBriefingButton').dataset.speechState = value;
    if (value === 'speaking') setBriefingReading(true);else if (value === 'idle' || value === 'error') {
      setBriefingReading(false);
      if (value === 'error') showToast('朗读失败，请检查系统语音服务');
    }
  }
});
function readBriefing() {
  if (briefingReading) {
    if (window.AndroidBridge?.stopMorningBrief) window.AndroidBridge.stopMorningBrief().catch(() => showToast('停止朗读失败'));else window.speechSynthesis?.cancel();
    setBriefingReading(false);
    return;
  }
  if (window.AndroidBridge?.startMorningBrief) {
    $('readBriefingButton').dataset.speechState = 'starting';
    setBriefingReading(true);
    window.AndroidBridge.startMorningBrief().catch(() => window.MorningBriefSpeech.onState('error'));
    return;
  }
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return showToast('当前浏览器不支持朗读');
  const utterance = new SpeechSynthesisUtterance(briefingText());
  utterance.lang = 'zh-CN';
  utterance.onend = () => setBriefingReading(false);
  utterance.onerror = () => setBriefingReading(false);
  setBriefingReading(true);
  speechSynthesis.speak(utterance);
}
async function enableNotifications() {
  if (!('Notification' in window)) return showToast('当前浏览器不支持系统提醒');
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    state.settings.notifications = true;
    persist();
    els.notificationButton.textContent = '提醒已开启';
    new Notification('工作进度台', {
      body: '提醒已开启。工作日打开应用时会生成晨报，周五 17:00 后提示复盘。'
    });
  } else showToast('未获得提醒权限');
}
function maybePrompt() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const today = dateKey(now);
  const isWeekdayMorning = day >= 1 && day <= 5 && hour >= 6 && hour < 12;
  if (isWeekdayMorning && state.settings.lastMorningPrompt !== today) {
    state.settings.lastMorningPrompt = today;
    persist();
    if (state.settings.notifications && Notification.permission === 'granted') {
      new Notification('今日工作晨报', {
        body: briefingText(),
        icon: 'icon.svg'
      });
    }
  }
  const fridayReviewDue = day === 5 && hour >= 17 && state.settings.lastWeeklyPrompt !== weekKey(now);
  if (fridayReviewDue) {
    state.settings.lastWeeklyPrompt = weekKey(now);
    persist();
    setTimeout(() => showToast('本周复盘待确认，可在“复盘、提醒与备份”中打开'), 700);
  }
  const anomalyPromptKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (today === firstBusinessDayKey(now) && state.settings.lastAnomalyPrompt !== anomalyPromptKey) {
    state.settings.lastAnomalyPrompt = anomalyPromptKey;
    persist();
    const count = salesAnomalies().length;
    setTimeout(() => showToast(count ? `月度销售提醒：发现 ${count} 个科室产出下滑，请查看销售数据面板` : '月度销售检查完成：未发现科室产出下滑'), 1100);
  }
}
function exportBackup() {
  downloadTextFile(`工作进度台备份-${dateKey()}.json`, JSON.stringify({
    exportedAt: new Date().toISOString(),
    ...state
  }, null, 2), 'application/json');
}
async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.tasks)) throw new Error('格式不正确');
    if (!confirm(`备份中有 ${parsed.tasks.length} 项事项。导入会替换本机现有数据，是否继续？`)) return;
    state.tasks = parsed.tasks;
    state.reviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];
    state.records = Array.isArray(parsed.records) ? parsed.records : [];
    state.customerUpgradePlans = Array.isArray(parsed.customerUpgradePlans) ? parsed.customerUpgradePlans : [];
    state.employeePlanRecords = Array.isArray(parsed.employeePlanRecords) ? parsed.employeePlanRecords : [];
    state.activities = Array.isArray(parsed.activities) ? parsed.activities : [];
    state.activityLedgerEntries = Array.isArray(parsed.activityLedgerEntries) ? parsed.activityLedgerEntries : [];
    state.tombstones = Array.isArray(parsed.tombstones) ? parsed.tombstones : [];
    state.settings = {
      ...(parsed.settings || {})
    };
    const importedEmployees = Array.isArray(state.settings.companyEmployees) ? state.settings.companyEmployees : [];
    state.settings.companyEmployees = [...new Set([...importedEmployees, ...(window.ActivityCenter?.DEFAULT_COMPANY_EMPLOYEES || [])])];
    syncTasksForAllActivities();
    syncHospitalMaintenanceTasks();
    persist();
    render();
    showToast('备份已导入');
  } catch (error) {
    showToast(`导入失败：${error.message}`);
  } finally {
    event.target.value = '';
  }
}
function showToast(message) {
  if (window.WorkDeskPersistence.native && window.WorkDeskPersistence.status().pending) {
    window.WorkDeskPersistence.flush().then(() => showToast(message), () => showToast('本地保存失败，请重试'));
    return;
  }
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2500);
}
function renderSynonymList() {
  const entries = Object.entries(customSynonyms()).sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
  els.synonymList.innerHTML = entries.length ? entries.map(([source, target]) => `<div class="synonym-row"><span>${escapeHTML(source)}</span><span aria-hidden="true">→</span><strong>${escapeHTML(target)}</strong><button class="text-button" type="button" data-delete-synonym="${escapeHTML(source)}">删除</button></div>`).join('') : "<p class=\"hint\">\u5C1A\u672A\u6DFB\u52A0\u81EA\u5B9A\u4E49\u540C\u4E49\u8BCD\u3002\u5185\u7F6E\u652F\u6301 Primary Product A\u2192Primary Product A\u3001Primary Product B\u2192Primary Product B\u3002</p>";
}
function openSynonymDialog() {
  if (els.filterDialog.open) els.filterDialog.close();
  els.synonymSource.value = '';
  els.synonymTarget.value = '';
  renderSynonymList();
  els.synonymDialog.showModal();
  setTimeout(() => els.synonymSource.focus(), 50);
}
function saveSynonym(event) {
  event.preventDefault();
  const source = els.synonymSource.value.trim();
  const target = els.synonymTarget.value.trim();
  if (!source || !target || source === target) return showToast('请填写不同的输入词和更正词');
  state.settings.customSynonyms = {
    ...customSynonyms(),
    [source]: target
  };
  state.settings.settingsUpdatedAt = new Date().toISOString();
  persist();
  els.synonymSource.value = '';
  els.synonymTarget.value = '';
  renderSynonymList();
  showToast('同义词已保存');
}
function bindEvents() {
  let hospitalMappingPreview = null;
  $('hospitalMappingInput')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = $('hospitalMappingStatus');
    const confirmButton = $('confirmHospitalMappingImport');
    confirmButton.disabled = true;
    hospitalMappingPreview = null;
    try {
      const {
        workbook
      } = await window.ExcelLocalReader.readWorkbook(file);
      hospitalMappingPreview = window.HospitalMaintenanceAdapter.parseMappingWorkbook(workbook, window.XLSX, file.name);
      status.textContent = '已识别 ' + hospitalMappingPreview.rows.length + ' 条医院编码映射；仅更新身份资料，不作为销售统计源。';
      confirmButton.disabled = !hospitalMappingPreview.rows.length;
    } catch (error) {
      status.textContent = '映射解析失败：' + error.message;
    }
  });
  $('confirmHospitalMappingImport')?.addEventListener('click', () => {
    if (!hospitalMappingPreview?.rows.length) return;
    state.settings.hospitalMappingRows = hospitalMappingPreview.rows;
    state.settings.settingsUpdatedAt = new Date().toISOString();
    syncHospitalMaintenanceTasks();
    persist();
    render();
    $('hospitalMappingStatus').textContent = '已导入医院身份映射；未写入销售统计。';
    $('confirmHospitalMappingImport').disabled = true;
    hospitalMappingPreview = null;
  });
  $('newTaskButton').addEventListener('click', () => openTask());
  els.tasksSectionToggle.addEventListener('click', () => toggleSectionCollapse('tasks'));
  els.taskUtilityToggle.addEventListener('click', () => {
    const utility = document.querySelector('#taskView > .utility-panel');
    utility.open = !utility.open;
    els.taskUtilityToggle.setAttribute('aria-expanded', String(utility.open));
  });
  els.collapseAllTasksButton.addEventListener('click', () => {
    expandedTaskIds.clear();
    renderTasks();
  });
  els.themeToggleButton?.addEventListener('click', toggleTheme);
  els.wheelPickerConfirm.addEventListener('click', confirmWheelPicker);
  els.wheelPickerList.addEventListener('click', event => {
    const option = event.target.closest('[data-wheel-value]');
    if (!option) return;
    if (option.dataset.wheelValue === activeWheelValue && option.classList.contains('active')) confirmWheelPicker();else selectWheelOption(option.dataset.wheelValue);
  });
  els.wheelPickerList.addEventListener('scroll', () => {
    if (els.wheelPickerList.dataset.opening) return;
    cancelAnimationFrame(els.wheelPickerList.scrollFrame);
    els.wheelPickerList.scrollFrame = requestAnimationFrame(() => {
      const nearest = nearestWheelOption();
      if (nearest) selectWheelOption(nearest.dataset.wheelValue, false);
    });
  }, {
    passive: true
  });
  els.multiPickerConfirm.addEventListener('click', confirmMultiPicker);
  els.multiPickerSearch.addEventListener('input', renderMultiPickerOptions);
  els.multiPickerList.addEventListener('click', event => {
    const option = event.target.closest('[data-multi-option]');
    if (!option) return;
    const value = activeMultiField === 'taskHospital' ? resolveHospitalAlias(option.dataset.multiOption) : option.dataset.multiOption;
    if (els.taskCategory.value === CUSTOMER_VISIT_CATEGORY) activeMultiSelections = new Set([value]);else if (activeMultiSelections.has(value)) activeMultiSelections.delete(value);else activeMultiSelections.add(value);
    const personId = option.dataset.multiPersonId;
    confirmMultiPicker();
    if (personId) els.taskCustomer.dataset.entityId = personId;
  });
  els.taskForm.addEventListener('submit', saveTask);
  document.querySelector('#cancelNativeTaskButton').addEventListener('click', () => {
    const id = els.taskId.value;
    els.taskDialog.close();
    updateUnifiedTaskStatus(id, 'cancelled');
  });
  document.querySelector('#withdrawTaskRecommendationButton').addEventListener('click', () => {
    const task = state.tasks.find(entry => entry.id === els.taskId.value);
    if (!task?.sourceRecommendationKey) return;
    els.taskDialog.close();
    updateTaskRecommendation('withdraw', task);
  });
  document.querySelector('#taskVisitProgress').addEventListener('input', event => {
    renderTaskStagePicker(els.taskCategory.value, Math.max(0, Math.min(100, Number(event.target.value) || 0)));
  });
  els.deleteTaskButton.addEventListener('click', deleteCurrentTask);
  els.taskCategory.addEventListener('change', () => {
    renderTaskStagePicker(els.taskCategory.value, 0);
    updateTaskFieldVisibility(els.taskCategory.value);
  });
  els.taskDue.addEventListener('input', updateTaskDueWeekday);
  els.taskDue.addEventListener('change', updateTaskDueWeekday);
  els.taskWeeklySlot.addEventListener('change', () => {
    const task = state.tasks.find(item => item.id === els.taskId.value);
    const month = els.taskWeeklyOutputWrap.dataset.weekMonth || previousCustomerPeriod().month;
    els.taskWeeklyOutput.value = task?.weeklyOutputs?.[`${month}-${els.taskWeeklySlot.value}`] ?? '';
  });
  els.taskOfficeEmployee.addEventListener('change', () => syncOfficeEmployeeInput());
  els.taskOfficeEmployee.addEventListener('blur', () => syncOfficeEmployeeInput());
  els.recognizeTaskButton.addEventListener('click', recognizeTaskInput);
  els.taskImageInput.addEventListener('change', () => {
    const file = els.taskImageInput.files?.[0];
    els.taskRecognitionStatus.textContent = file ? `已选择 ${file.name}，点击“识别文字并填入”。` : '可只输入文字，也可选择截图、照片后补充文字。';
  });
  els.taskCustomerExcelInput.addEventListener('change', async () => {
    try {
      await importCustomerWorkbook(els.taskCustomerExcelInput.files?.[0]);
    } catch (error) {
      console.error('客户拜访 Excel 导入失败', error);
      els.taskCustomerExcelStatus.textContent = `读取失败：${error.message}`;
    }
  });
  els.taskForm.addEventListener('click', event => {
    const open = event.target.closest('[data-open-multi]');
    if (open) {
      openMultiPicker(open.dataset.openMulti, MULTI_FIELDS[open.dataset.openMulti].entry().value);
      return;
    }
    const add = event.target.closest('[data-add-multi]');
    if (add) {
      addMultiValue(add.dataset.addMulti);
      return;
    }
    const remove = event.target.closest('[data-remove-multi]');
    if (remove) removeMultiValue(remove.dataset.removeMulti, remove.dataset.multiIndex);
  });
  [els.taskHospitalEntry, els.taskDepartmentEntry, els.taskCustomerEntry].forEach(entry => entry.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ',' && event.key !== '，') return;
    event.preventDefault();
    const fieldId = Object.keys(MULTI_FIELDS).find(key => MULTI_FIELDS[key].entry() === entry);
    if (fieldId === 'taskCustomer') addMultiValue(fieldId);else openMultiPicker(fieldId, entry.value);
  }));
  [els.taskHospitalEntry, els.taskDepartmentEntry].forEach(entry => entry.addEventListener('input', () => {
    clearTimeout(entry.multiSearchTimer);
    const query = entry.value.trim();
    if (query.length < 2) return;
    entry.multiSearchTimer = setTimeout(() => {
      if (els.taskDialog.open && document.activeElement === entry) openMultiPicker(entry === els.taskHospitalEntry ? 'taskHospital' : 'taskDepartment', query);
    }, 550);
  }));
  els.filterButton.addEventListener('click', () => els.filterDialog.showModal());
  els.searchInput.addEventListener('input', () => {
    renderBriefing();
    renderTasks();
  });
  els.synonymSettingsButton.addEventListener('click', openSynonymDialog);
  els.synonymForm.addEventListener('submit', saveSynonym);
  els.synonymList.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-synonym]');
    if (!button) return;
    const next = {
      ...customSynonyms()
    };
    delete next[button.dataset.deleteSynonym];
    state.settings.customSynonyms = next;
    state.settings.settingsUpdatedAt = new Date().toISOString();
    persist();
    renderSynonymList();
  });
  $('clearTaskFiltersButton').addEventListener('click', () => {
    els.filterDialog.close();
    clearTaskFilters();
  });
  $('clearBriefingFiltersButton').addEventListener('click', clearTaskFilters);
  els.clearTaskExternalContextButton.addEventListener('click', () => {
    taskExternalContext = null;
    renderBriefing();
    renderTasks();
  });
  els.briefingGrid.addEventListener('click', event => {
    const module = event.target.closest('[data-briefing-module]');
    if (!module) return;
    if (['all', 'doing', 'done'].includes(module.dataset.briefingModule)) return setBriefingStatus(module.dataset.briefingModule);
    openWheelPicker(module.dataset.briefingModule === 'category' ? els.categoryFilter : els.markerFilter);
  });
  els.categoryFilter.addEventListener('change', () => {
    els.statusFilter.value = 'all';
    els.markerFilter.value = 'all';
    renderBriefing();
    renderTasks();
  });
  els.markerFilter.addEventListener('change', () => {
    els.statusFilter.value = 'all';
    els.categoryFilter.value = 'all';
    renderBriefing();
    renderTasks();
  });
  els.dateStrip.addEventListener('click', event => {
    if (Date.now() < suppressDateClickUntil) return;
    const button = event.target.closest('[data-task-date]');
    if (!button) return;
    selectedTaskDate = button.dataset.taskDate;
    taskDateScope = 'selected';
    renderSharedWorkspaceDate(true);
  });
  els.dateStrip.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const track = els.dateStrip.querySelector('[data-date-track]');
    const chipWidth = els.dateStrip.clientWidth / 7;
    dateDragStart = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      track,
      chipWidth,
      baseX: -7 * chipWidth,
      offset: 0,
      horizontal: false
    };
    track.style.transform = `translate3d(${dateDragStart.baseX}px,0,0)`;
    els.dateStrip.classList.add('dragging');
  });
  els.dateStrip.addEventListener('pointermove', event => {
    if (!dateDragStart || event.pointerId !== dateDragStart.pointerId) return;
    const dx = event.clientX - dateDragStart.x;
    const dy = event.clientY - dateDragStart.y;
    if (!dateDragStart.horizontal && Math.abs(dx) < 5) return;
    if (!dateDragStart.horizontal && Math.abs(dx) <= Math.abs(dy)) return;
    if (!dateDragStart.horizontal) {
      try {
        els.dateStrip.setPointerCapture(event.pointerId);
      } catch {}
    }
    dateDragStart.horizontal = true;
    event.preventDefault();
    const limitedDx = Math.max(-7 * dateDragStart.chipWidth, Math.min(7 * dateDragStart.chipWidth, dx));
    dateDragStart.offset = Math.max(-7, Math.min(7, Math.round(-limitedDx / dateDragStart.chipWidth)));
    dateDragStart.track.style.transform = `translate3d(${dateDragStart.baseX + limitedDx}px,0,0)`;
    dateDragStart.track.querySelectorAll('[data-date-offset]').forEach(chip => {
      const active = Number(chip.dataset.dateOffset) === dateDragStart.offset;
      chip.classList.toggle('selected', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  });
  const finishDateDrag = event => {
    if (!dateDragStart || event.pointerId !== dateDragStart.pointerId) return;
    const {
      horizontal,
      offset,
      track
    } = dateDragStart;
    dateDragStart = null;
    els.dateStrip.classList.remove('dragging');
    if (!horizontal) {
      track.style.transform = '';
      return;
    }
    suppressDateClickUntil = Date.now() + 350;
    selectedTaskDate = shiftDateKey(selectedTaskDate || dateKey(), offset);
    taskDateScope = 'selected';
    renderSharedWorkspaceDate(true);
  };
  els.dateStrip.addEventListener('pointerup', finishDateDrag);
  els.dateStrip.addEventListener('pointercancel', () => {
    dateDragStart?.track && (dateDragStart.track.style.transform = '');
    dateDragStart = null;
    els.dateStrip.classList.remove('dragging');
  });
  els.previousDateButton.addEventListener('click', () => {
    selectedTaskDate = shiftDateKey(selectedTaskDate || dateKey(), -1);
    taskDateScope = 'selected';
    renderSharedWorkspaceDate(true);
  });
  els.nextDateButton.addEventListener('click', () => {
    selectedTaskDate = shiftDateKey(selectedTaskDate || dateKey(), 1);
    taskDateScope = 'selected';
    renderSharedWorkspaceDate(true);
  });
  [els.taskYearFilter, els.taskMonthFilter].forEach(select => select.addEventListener('change', () => {
    const day = selectedTaskDate ? Number(selectedTaskDate.slice(8, 10)) : 1;
    const target = new Date(Number(els.taskYearFilter.value), Number(els.taskMonthFilter.value) - 1, 1, 12);
    target.setDate(Math.min(day, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
    selectedTaskDate = dateKey(target);
    taskDateScope = 'selected';
    renderSharedWorkspaceDate(true);
  }));
  els.todayDateButton.addEventListener('click', () => {
    selectedTaskDate = dateKey();
    taskDateScope = 'selected';
    renderSharedWorkspaceDate(true);
  });
  els.taskList.addEventListener('click', handleTaskListClick);
  els.taskList.addEventListener('pointerdown', startCompactProgressDrag);
  els.taskList.addEventListener('pointermove', moveCompactProgressDrag);
  els.taskList.addEventListener('pointerup', finishCompactProgressDrag);
  els.taskList.addEventListener('pointercancel', cancelCompactProgressDrag);
  els.taskList.addEventListener('keydown', handleCompactProgressKey);
  els.taskList.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('[data-select-native-task], [data-remove-native-task], [data-cancel-native-task], input, select, textarea, [data-compact-progress-thumb], [data-swipe-delete], [data-withdraw-recommendation], [data-open-task], [data-open-source-task], [data-task-sales-context], [data-task-hospital-context], [data-stage-task], [data-toggle-flag], [data-save-weekly-output]')) return;
    const card = event.target.closest('[data-task-card]');
    const surface = card?.querySelector('[data-task-swipe-surface]');
    const task = card ? state.tasks.find(item => String(item.id) === String(card.dataset.taskCard)) : null;
    if (!card || !surface || !canUseNativeTaskProgress(task)) return;
    els.taskList.querySelectorAll('.task-card.swipe-revealed').forEach(item => {
      if (item !== card) item.classList.remove('swipe-revealed');
    });
    activeTaskSwipe = {
      card,
      surface,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startOffset: card.classList.contains('swipe-revealed') ? -72 : 0,
      horizontal: false
    };
  });
  els.taskList.addEventListener('pointermove', event => {
    if (!activeTaskSwipe || event.pointerId !== activeTaskSwipe.pointerId) return;
    const dx = event.clientX - activeTaskSwipe.x;
    const dy = event.clientY - activeTaskSwipe.y;
    if (!activeTaskSwipe.horizontal && Math.abs(dx) < 6) return;
    if (!activeTaskSwipe.horizontal && Math.abs(dx) <= Math.abs(dy)) {
      activeTaskSwipe = null;
      return;
    }
    if (!activeTaskSwipe.horizontal) {
      try {
        activeTaskSwipe.surface.setPointerCapture(event.pointerId);
      } catch {}
    }
    activeTaskSwipe.horizontal = true;
    event.preventDefault();
    activeTaskSwipe.card.classList.add('swiping');
    const offset = Math.max(-82, Math.min(0, activeTaskSwipe.startOffset + dx));
    activeTaskSwipe.offset = offset;
    activeTaskSwipe.surface.style.transform = `translate3d(${offset}px,0,0)`;
  });
  const finishTaskSwipe = event => {
    if (!activeTaskSwipe || event.pointerId !== activeTaskSwipe.pointerId) return;
    const {
      card,
      surface,
      horizontal,
      offset = activeTaskSwipe.startOffset
    } = activeTaskSwipe;
    activeTaskSwipe = null;
    card.classList.remove('swiping');
    if (!horizontal) return;
    suppressTaskClickUntil = Date.now() + 320;
    card.classList.toggle('swipe-revealed', offset <= -36);
    surface.style.transform = '';
  };
  els.taskList.addEventListener('pointerup', finishTaskSwipe);
  els.taskList.addEventListener('pointercancel', event => {
    if (!activeTaskSwipe || event.pointerId !== activeTaskSwipe.pointerId) return;
    activeTaskSwipe.surface.style.transform = '';
    activeTaskSwipe.card.classList.remove('swiping');
    activeTaskSwipe = null;
  });
  els.taskList.addEventListener('input', event => {
    const slider = event.target.closest('[data-progress-slider]');
    if (slider) updateThermometerPreview(slider);
  });
  els.taskList.addEventListener('change', event => {
    const slider = event.target.closest('[data-progress-slider]');
    if (slider) commitThermometerProgress(slider);
    const slot = event.target.closest('[data-weekly-slot]');
    if (slot) {
      const task = state.tasks.find(item => item.id === slot.dataset.weeklySlot);
      const input = els.taskList.querySelector(`[data-weekly-output="${CSS.escape(slot.dataset.weeklySlot)}"]`);
      if (input) input.value = task?.weeklyOutputs?.[`${slot.dataset.weekMonth}-${slot.value}`] ?? '';
    }
  });
  els.taskSourceFilter.addEventListener('change', () => {
    renderBriefing();
    renderTasks();
  });
  els.taskCanonicalStatusFilter.addEventListener('change', () => {
    if (els.taskCanonicalStatusFilter.value !== 'all') els.statusFilter.value = 'all';
    renderBriefing();
    renderTasks();
  });
  $('weeklyReviewButton').addEventListener('click', () => openWeeklyReview(false));
  els.weeklyForm.addEventListener('submit', saveWeeklyReview);
  $('readBriefingButton').addEventListener('click', readBriefing);
  els.notificationButton.addEventListener('click', enableNotifications);
  $('exportButton').addEventListener('click', exportBackup);
  els.importInput.addEventListener('change', importBackup);
  els.taskTab?.addEventListener('click', () => openPrimaryWorkspace('tasks'));
  els.activityTab?.addEventListener('click', () => openPrimaryWorkspace('activities'));
  const openDirectModule = destination => {
    if (!workspaceNavigationController) return;
    const activeWorkspace = destination === 'customer-profile' ? 'customers' : 'data';
    const currentEntry = workspaceNavigationController.getCurrentEntry?.();
    if (currentWorkspace === activeWorkspace) {
      return;
    }
    const sourceWorkspace = currentEntry?.sourceWorkspace || currentWorkspace;
    const sourceModule = currentEntry?.contract?.source?.module || {
      tasks: 'task',
      activities: 'activity',
      customers: 'customer'
    }[sourceWorkspace] || 'modules';
    const contract = {
      schemaVersion: 1,
      destination,
      source: currentEntry?.contract?.source || {
        module: sourceModule,
        entityType: 'none',
        entityId: '',
        routeKey: `${sourceModule}-module`
      },
      context: {},
      behavior: {
        persistence: 'transient',
        customerMatch: 'exact-only',
        fallback: 'broader-context'
      }
    };
    const metadata = {
      sourceWorkspace,
      title: destination === 'customer-profile' ? '客户档案' : '销售数据',
      meta: '数据库入口'
    };
    if (currentEntry) workspaceNavigationController.replaceContext(contract, metadata);else workspaceNavigationController.openContext(contract, metadata);
  };
  els.customerModuleButton?.addEventListener('click', () => openDirectModule('customer-profile'));
  els.salesModuleButton?.addEventListener('click', () => openDirectModule('sales-dashboard'));
  els.primaryTodoButton?.addEventListener('click', () => {
    closePrimaryNavigationSheets();
    if (currentWorkspace !== 'tasks') {
      openPrimaryWorkspace('tasks', {
        replace: true
      });
      return;
    }
    if (taskSecondaryPage) {
      closeTaskSecondaryPage();
      return;
    }
    openPrimaryNavigationMenu(els.todoNavigationSheet, 'tasks', els.primaryTodoButton);
  });
  els.primaryActivityButton?.addEventListener('click', () => {
    closePrimaryNavigationSheets();
    openPrimaryWorkspace('activities', {
      replace: true
    });
  });
  els.primaryDatabaseButton?.addEventListener('click', () => openPrimaryNavigationMenu(els.databaseNavigationSheet, 'database', els.primaryDatabaseButton));
  [els.todoNavigationSheet, els.databaseNavigationSheet].forEach(dialog => {
    dialog?.addEventListener('close', () => syncPrimaryMobileNav());
  });
  window.addEventListener('resize', () => {
    [els.todoNavigationSheet, els.databaseNavigationSheet].forEach(dialog => {
      if (!dialog?.open) return;
      positionPrimaryNavigationMenu(dialog, document.getElementById(dialog.dataset.primaryNavAnchorId));
    });
  });
  els.todoNavigationSheet?.addEventListener('click', event => {
    const button = event.target.closest('[data-task-secondary]');
    if (button) showTaskSecondaryPage(button.dataset.taskSecondary);
  });
  els.databaseNavigationSheet?.addEventListener('click', event => {
    const button = event.target.closest('[data-database-destination]');
    if (!button) return;
    els.databaseNavigationSheet.close();
    openDirectModule(button.dataset.databaseDestination);
  });
  document.addEventListener('click', event => {
    const openMenu = [els.todoNavigationSheet, els.databaseNavigationSheet].find(dialog => dialog?.open);
    if (!openMenu || openMenu.contains(event.target) || event.target.closest?.('.primary-mobile-nav__item')) return;
    event.preventDefault();
    event.stopPropagation();
    closePrimaryNavigationSheets();
  }, true);
  document.querySelector('.mode-tabs')?.addEventListener('keydown', event => {
    const tabs = [els.taskTab, els.activityTab];
    const views = ['tasks', 'activities'];
    const current = tabs.indexOf(event.target);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    openPrimaryWorkspace(views[next]);
    tabs[next].focus();
  });
  document.addEventListener('click', event => {
    if (workspaceNavigationController?.getCurrentEntry?.() && event.target.closest('#customerView [data-cp-close], #customerView [data-cp-panel-close], #taskView [data-tpv2-close], #cpHospitalMaintenanceDialog [data-cp-dialog-close]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      workspaceNavigationController.handleBack('context');
      return;
    }
    if (event.target.closest('[data-navigation-back]')) {
      event.preventDefault();
      workspaceNavigationController?.handleBack('page');
    }
  }, true);
  els.contextChoiceList?.addEventListener('click', event => {
    const button = event.target.closest('[data-context-choice]');
    if (!button) return;
    const choice = pendingContextChoices[Number(button.dataset.contextChoice)];
    els.contextChoiceDialog.close();
    pendingContextChoices = [];
    choice?.action?.();
  });
  els.customerMonthFilter?.addEventListener('change', renderCustomerDashboard);
  els.customerBoard?.addEventListener('click', handleCustomerBoardClick);
  els.customerBoard?.addEventListener('change', event => {
    const slot = event.target.closest('[data-customer-slot]');
    if (!slot) return;
    const task = state.tasks.find(item => item.id === slot.dataset.customerSlot);
    const input = els.customerBoard.querySelector(`[data-customer-output="${CSS.escape(slot.dataset.customerSlot)}"]`);
    if (input) input.value = task?.weeklyOutputs?.[`${slot.dataset.weekMonth}-${slot.value}`] ?? '';
  });
  $('downloadTemplateButton').addEventListener('click', downloadSalesTemplate);
  els.saveSalesTargetButton.addEventListener('click', saveSalesTarget);
  els.averageSalesTargetButton.addEventListener('click', averageSalesTarget);
  els.copyPreviousSalesTargetButton.addEventListener('click', copyPreviousSalesTarget);
  [els.salesTargetFiscalYear, els.salesTargetProduct, els.salesTargetOffice].forEach(control => control.addEventListener('change', loadSalesTargetForm));
  els.saveSmartSheetConfigButton.addEventListener('click', saveSmartSheetConfig);
  els.generateReportButton.addEventListener('click', generateQuarterlyReport);
  els.downloadReportButton.addEventListener('click', downloadReportMaterial);
  $('clearSalesDataButton').addEventListener('click', () => {
    if (!state.records.length) return showToast('当前没有销售明细');
    if (!confirm(`确定清空本机的 ${state.records.length} 条销售、拜访和活动明细吗？任务不会删除。建议先导出备份。`)) return;
    state.records = [];
    state.settings.allRecordsClearedAt = new Date().toISOString();
    state.settings.settingsUpdatedAt = state.settings.allRecordsClearedAt;
    persist();
    render();
    showToast('销售明细已清空');
  });
  $('openImportButton').addEventListener('click', () => {
    els.dataManagementDialog.close();
    clearSalesImportPreview({
      close: false
    });
    els.importDialog.showModal();
  });
  els.importForm.addEventListener('submit', importSalesData);
  els.confirmSalesImportButton.addEventListener('click', confirmSalesImport);
  els.cancelSalesImportPreview.addEventListener('click', () => clearSalesImportPreview());
  els.openPlanImportButton.addEventListener('click', openPlanImport);
  els.previewPlanImportButton.addEventListener('click', previewFourThreePlan);
  els.confirmPlanImportButton.addEventListener('click', confirmPlanImport);
  els.cancelPlanImportPreview.addEventListener('click', () => clearPlanImportPreview({
    close: true
  }));
  [els.planFiscalYearFilter, els.planMonthFilter, els.planProductFilter, els.planOfficeFilter, els.planEmployeeFilter, els.planHospitalFilter, els.planDepartmentFilter].forEach(element => element.addEventListener('change', () => renderPlanAnalysis(planImportPreview?.records || state.employeePlanRecords || [])));
  els.planTagCorrectionBody.addEventListener('change', updatePlanManualTag);
  els.dataPeriodMode.addEventListener('change', () => {
    renderPeriodOptions(true);
    renderDataDashboard();
  });
  els.dashboardModuleFilter.addEventListener('change', () => renderDashboardModule(true));
  [els.dataPeriodValue, els.dataOfficeFilter, els.dataEmployeeFilter, els.dataProductFilter, els.dataHospitalFilter].forEach(element => element.addEventListener('change', renderDataDashboard));
  document.querySelectorAll('[data-comparison]').forEach(button => button.addEventListener('click', () => {
    dataComparisonMode = button.dataset.comparison;
    document.querySelectorAll('[data-comparison]').forEach(item => item.classList.toggle('active', item === button));
    renderDataDashboard();
  }));
  $('clearDataFiltersButton').addEventListener('click', () => {
    dataComparisonMode = 'none';
    document.querySelectorAll('[data-comparison]').forEach(button => button.classList.toggle('active', button.dataset.comparison === 'none'));
    els.dataOfficeFilter.value = 'all';
    els.dataEmployeeFilter.value = 'all';
    els.dataProductFilter.value = 'all';
    els.dataHospitalFilter.value = 'all';
    els.dashboardModuleFilter.value = 'all';
    renderDataDashboard();
  });
  els.dataView.addEventListener('click', event => {
    const employeeButton = event.target.closest('[data-employee-drill]');
    if (employeeButton) {
      openEmployeeDrilldown(employeeButton.dataset.employeeDrill);
      return;
    }
    const anomalyButton = event.target.closest('[data-save-anomaly]');
    if (anomalyButton) {
      const item = anomalyButton.closest('[data-anomaly-key]');
      state.settings.salesAnomalyNotes = {
        ...(state.settings.salesAnomalyNotes || {}),
        [item.dataset.anomalyKey]: item.querySelector('textarea').value.trim()
      };
      state.settings.settingsUpdatedAt = new Date().toISOString();
      persist();
      showToast('异常原因已保存');
      return;
    }
    const button = event.target.closest('[data-task-query]');
    if (button) openLinkedTasks(button.dataset.taskQuery, taskContextFromDataset(button.dataset));
  });
  els.installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return showToast('如未弹出安装窗口，请在浏览器菜单中选择“安装工作进度台”');
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (els.installButton) els.installButton.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (els.installButton) els.installButton.hidden = true;
    showToast('已安装，可从桌面直接离线打开');
  });
  els.cloudButton?.addEventListener('click', openCloudDialog);
  els.cloudAccountEntryButton?.addEventListener('click', () => openCloudDialog());
  els.manualUpdateEntryButton?.addEventListener('click', () => openCloudDialog({
    focusUpdate: true
  }));
  els.openCustomerUpgradeManager?.addEventListener('click', openCustomerUpgradeManager);
  els.customerUpgradeExcel.addEventListener('change', previewCustomerUpgradeWorkbook);
  els.customerUpgradeProduct.addEventListener('change', () => {
    if (els.customerUpgradeExcel.files?.length) previewCustomerUpgradeWorkbook();
  });
  els.customerUpgradeFiscalYear.addEventListener('change', () => {
    if (els.customerUpgradeExcel.files?.length) previewCustomerUpgradeWorkbook();
  });
  els.customerUpgradeMonth.addEventListener('change', () => {
    if (els.customerUpgradeExcel.files?.length) previewCustomerUpgradeWorkbook();
  });
  els.cancelCustomerUpgradePreview.addEventListener('click', clearCustomerUpgradePreview);
  els.confirmCustomerUpgradeImport.addEventListener('click', confirmCustomerUpgradeImport);
  els.customerUpgradeManualForm.addEventListener('submit', saveManualCustomerUpgrade);
  els.cloudSignUpButton.addEventListener('click', () => cloudAuthenticate('signup'));
  els.cloudSignInButton.addEventListener('click', () => cloudAuthenticate('signin'));
  els.toggleCloudPassword.addEventListener('click', () => {
    const visible = els.cloudPassword.type === 'text';
    els.cloudPassword.type = visible ? 'password' : 'text';
    els.toggleCloudPassword.textContent = visible ? '显示' : '隐藏';
    els.toggleCloudPassword.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
  });
  els.appVersionButton.addEventListener('click', handleVersionTap);
  els.checkUpdateButton.addEventListener('click', checkForAppUpdate);
  els.downloadUpdateButton.addEventListener('click', startUpdateDownload);
  els.saveDeveloperEndpointButton.addEventListener('click', saveDeveloperEndpoint);
  els.testDeveloperEndpointButton.addEventListener('click', testDeveloperEndpoint);
  els.restoreDefaultEndpointButton.addEventListener('click', restoreDefaultEndpoint);
  els.cloudSyncButton.addEventListener('click', () => window.workDeskCloud?.syncNow().catch(error => showToast(error.message)));
  els.cloudHealthCheckButton.addEventListener('click', checkCloudHealthNow);
  els.cloudOfflineButton.addEventListener('click', () => {
    const cloud = window.workDeskCloud;
    if (!cloud) return;
    const offline = cloud.setManualOffline(!cloud.manualOffline);
    showToast(offline ? '已返回离线使用' : cloud.signedIn() ? '已主动开启在线，正在同步' : '已主动开启在线，请登录后同步');
  });
  els.cloudSignOutButton.addEventListener('click', async () => {
    const clearCredentials = window.confirm('是否同时清除本机记住的账号和加密密码？\n选择“取消”将保留，方便下次登录。');
    if (clearCredentials) {
      window.AndroidBridge?.clearSecureCredentials?.();
      localStorage.removeItem(REMEMBERED_CLOUD_EMAIL_KEY);
      els.cloudEmail.value = '';
      els.cloudPassword.value = '';
    }
    await window.workDeskCloud?.signOut();
    updateCloudStatus({
      state: 'local',
      message: clearCredentials ? '已退出并清除登录信息，本机业务数据仍保留' : '已退出云账号，本机数据与登录信息仍保留',
      configured: true,
      signedIn: false
    });
  });
  document.addEventListener('click', event => {
    const wheelTrigger = event.target.closest('[data-wheel-for]');
    if (wheelTrigger) {
      openWheelPicker($(wheelTrigger.dataset.wheelFor));
      return;
    }
    const closeButton = event.target.closest('[data-close-dialog]');
    if (!closeButton) return;
    const dialog = closeButton.closest('dialog');
    if (!dialog) return;
    dialog.close();
  });
}
function handleTaskListClick(event) {
  const select = event.target.closest('[data-select-native-task]');
  if (select) {
    const id = select.dataset.selectNativeTask;
    selectedNativeTaskIds.has(id) ? selectedNativeTaskIds.delete(id) : selectedNativeTaskIds.add(id);
    renderTasks();
    return;
  }
  const remove = event.target.closest('[data-remove-native-task]');
  if (remove) {
    if (confirm('删除无引用自建任务，业务任务保留历史。继续？')) removeTaskById(remove.dataset.removeNativeTask);
    return;
  }
  const cancel = event.target.closest('[data-cancel-native-task]');
  if (cancel) {
    updateUnifiedTaskStatus(cancel.dataset.cancelNativeTask, 'cancelled');
    return;
  }
  const withdrawButton = event.target.closest('[data-withdraw-recommendation]');
  if (withdrawButton) {
    const task = state.tasks.find(item => item.id === withdrawButton.dataset.withdrawRecommendation);
    if (canWithdrawRecommendationTask(task)) updateTaskRecommendation('withdraw', task);
    return;
  }
  const deleteButton = event.target.closest('[data-swipe-delete]');
  if (deleteButton) {
    suppressTaskClickUntil = 0;
    removeTaskById(deleteButton.dataset.swipeDelete);
    return;
  }
  if (Date.now() < suppressTaskClickUntil) return;
  const revealedCard = event.target.closest('.task-card.swipe-revealed');
  if (revealedCard) {
    revealedCard.classList.remove('swipe-revealed');
    return;
  }
  const openButton = event.target.closest('[data-open-task]');
  if (openButton) {
    const task = state.tasks.find(item => item.id === openButton.dataset.openTask);
    if (task && canUseNativeTaskProgress(task)) openTask(task);
    return;
  }
  const sourceButton = event.target.closest('[data-open-source-task]');
  if (sourceButton) {
    if (!window.taskProgressV2App?.openTaskDetails?.(sourceButton.dataset.openSourceTask)) showToast('未找到来源任务详情');
    return;
  }
  const salesButton = event.target.closest('[data-task-sales-context]');
  if (salesButton) {
    openSalesContextFromTask(salesButton.dataset.taskSalesContext);
    return;
  }
  const hospitalButton = event.target.closest('[data-task-hospital-context]');
  if (hospitalButton) {
    openHospitalMaintenance(hospitalButton.dataset.taskHospitalContext, {taskId:hospitalButton.closest('[data-task-card]')?.dataset.taskCard || ''});
    return;
  }
  const progressButton = event.target.closest('[data-progress-task]');
  if (progressButton) {
    setProgress(progressButton.dataset.progressTask, Number(progressButton.dataset.progress), {
      renderPage: false,
      notify: false,
      card: progressButton.closest('.task-card')
    });
    return;
  }
  const stageButton = event.target.closest('[data-stage-task]');
  if (stageButton && !stageButton.disabled) {
    setProgress(stageButton.dataset.stageTask, Number(stageButton.dataset.stage), {
      renderPage: false,
      notify: false,
      card: stageButton.closest('.task-card')
    });
    return;
  }
  const weeklySaveButton = event.target.closest('[data-save-weekly-output]');
  if (weeklySaveButton) {
    const id = weeklySaveButton.dataset.saveWeeklyOutput;
    const task = state.tasks.find(item => item.id === id);
    const input = els.taskList.querySelector(`[data-weekly-output="${CSS.escape(id)}"]`);
    if (!task || !input) return;
    const outputKey = selectedWeeklyOutputKey(els.taskList, task.id, 'weekly');
    task.weeklyOutputs = {
      ...(task.weeklyOutputs || {}),
      [outputKey]: Number(input.value) || 0
    };
    task.updatedAt = new Date().toISOString();
    persist();
    render();
    showToast('本周客户产出已保存');
    return;
  }
  const markerButton = event.target.closest('[data-toggle-flag]');
  if (markerButton) {
    const task = state.tasks.find(item => item.id === markerButton.dataset.taskId);
    if (!task || !canUseNativeTaskProgress(task)) return;
    const field = markerButton.dataset.toggleFlag;
    task[field] = !task[field];
    task.updatedAt = new Date().toISOString();
    persist();
    renderBriefing();
    renderTasks();
    return;
  }
  const toggleButton = event.target.closest('[data-toggle-task]');
  if (toggleButton) {
    const id = toggleButton.dataset.toggleTask;
    if (expandedTaskIds.has(id)) expandedTaskIds.delete(id);else expandedTaskIds.add(id);
    renderTasks();
  }
}
async function loadBundledSalesData() {
  if (window.AndroidBridge || window.WORK_PROGRESS_CLOUD?.mode === 'cloud') return;
  const sourceId = '24.10-26.6-sheet1';
  const importedSources = Array.isArray(state.settings.importedSources) ? state.settings.importedSources : [];
  if (importedSources.includes(sourceId)) return;
  const response = await fetch('data/sales-24.10-26.6-sheet1.json', {
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`预装销售数据读取失败：${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.records)) throw new Error('预装销售数据格式不正确');
  const existingIds = new Set(state.records.map(record => record.id));
  const existingFingerprints = new Set(state.records.map(recordFingerprint));
  payload.records.forEach(record => {
    const fingerprint = recordFingerprint(record);
    if (!existingIds.has(record.id) && !existingFingerprints.has(fingerprint)) {
      state.records.push(record);
      existingIds.add(record.id);
      existingFingerprints.add(fingerprint);
    }
  });
  state.settings.importedSources = [...new Set([...importedSources, sourceId])];
  state.settings.sourceSummaries = {
    ...(state.settings.sourceSummaries || {}),
    [sourceId]: payload.summary
  };
  syncHospitalMaintenanceTasks();
  persist();
}
function updateCloudStatus(status = {}) {
  const stateName = status.state || 'local';
  const message = status.message || (status.signedIn ? '云同步已连接' : '本地模式');
  if (els.cloudButton) els.cloudButton.dataset.state = stateName;
  els.cloudDialogStatus.dataset.state = stateName;
  els.cloudDialogStatus.textContent = status.email ? `${message} · ${status.email}` : message;
  const labels = {
    local: '☁ 离线使用',
    ready: '☁ 在线待登录',
    offline: '☁ 离线使用',
    syncing: '☁ 同步中…',
    synced: '☁ 已同步',
    error: '☁ 同步异常'
  };
  if (els.cloudButton) els.cloudButton.textContent = stateName === 'offline' && status.manualOffline ? '☁ 离线使用' : labels[stateName] || labels.local;
  els.cloudSyncButton.hidden = !status.signedIn || status.manualOffline;
  els.cloudOfflineButton.hidden = false;
  els.cloudOfflineButton.textContent = status.manualOffline ? '主动在线同步' : '返回离线使用';
  els.cloudSignOutButton.hidden = !status.signedIn;
  els.cloudSignInButton.hidden = Boolean(status.signedIn);
  els.cloudSignUpButton.hidden = Boolean(status.signedIn);
  els.cloudSignInButton.disabled = Boolean(status.manualOffline);
  els.cloudSignUpButton.disabled = Boolean(status.manualOffline);
}
function formatCloudHealthTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime()) || !value) return '暂无';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
function updateCloudHealthStatus(health = {}) {
  const labels = {
    ONLINE: '● 正常',
    DEGRADED: '△ 暂时不可用',
    OFFLINE: '○ 离线',
    PAUSED_OR_UNRESOLVED: '△ 服务不可用',
    AUTH_UNAVAILABLE: '△ 登录服务不可用',
    UNKNOWN: '○ 尚未检查'
  };
  const status = health.status || 'UNKNOWN';
  els.cloudHealthStatus.textContent = labels[status] || labels.UNKNOWN;
  els.cloudHealthStatus.dataset.state = status;
  els.cloudHealthLastSuccess.textContent = formatCloudHealthTime(health.lastSuccessAt);
  els.cloudHealthLastCheck.textContent = formatCloudHealthTime(health.lastCheckAt);
  els.cloudHealthHint.textContent = status === 'PAUSED_OR_UNRESOLVED' ? '云服务不可用，请打开 Supabase Dashboard 确认项目是否已暂停。' : status === 'AUTH_UNAVAILABLE' ? '服务可访问，但当前登录授权不可用；本机功能不受影响。' : status === 'DEGRADED' ? '云服务暂时异常，请稍后手动检查；本机功能不受影响。' : status === 'OFFLINE' ? '当前无网络，未发送检查请求；本机功能可继续使用。' : '每天首次启动最多自动检查一次；当天已有登录或同步成功时不再重复。';
}
async function checkCloudHealthNow() {
  const cloud = window.workDeskCloud;
  if (!cloud) return;
  els.cloudHealthCheckButton.disabled = true;
  els.cloudHealthStatus.textContent = '正在检查…';
  try {
    await cloud.checkHealth({
      manual: true
    });
  } catch {
    updateCloudHealthStatus(cloud.healthSnapshot());
  } finally {
    els.cloudHealthCheckButton.disabled = false;
  }
}
async function openCloudDialog({
  focusUpdate = false
} = {}) {
  const cloud = window.workDeskCloud;
  const remembered = await readSecureCloudCredentials();
  els.cloudEmail.value = cloud?.userEmail() || remembered.email || localStorage.getItem(REMEMBERED_CLOUD_EMAIL_KEY) || els.cloudEmail.value;
  els.cloudPassword.value = remembered.password || '';
  els.rememberCloudAccount.checked = remembered.rememberAccount !== false;
  els.rememberCloudPassword.checked = Boolean(window.AndroidBridge) && remembered.rememberPassword !== false;
  els.rememberCloudPassword.disabled = !window.AndroidBridge;
  els.cloudCredentialHint.textContent = window.AndroidBridge ? '密码只以 Android Keystore 加密密文保存，不写入网页存储。' : '网页端只记住账号，不保存密码。';
  if (remembered.error) showToast(remembered.error);
  updateCloudHealthStatus(cloud?.healthSnapshot?.() || {});
  renderDeveloperOptions();
  els.cloudDialog.showModal();
  if (focusUpdate) requestAnimationFrame(() => {
    els.checkUpdateButton.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });
    els.checkUpdateButton.focus({
      preventScroll: true
    });
  });
}
function isProductionRuntime() {
  try {
    return window.AndroidBridge?.isProductionBuild?.() === true;
  } catch {
    return false;
  }
}
function developerModeEnabled() {
  return !isProductionRuntime() && localStorage.getItem(DEVELOPER_MODE_KEY) === '1';
}
function setDeveloperConnectionStatus(message, stateName = '') {
  els.developerConnectionStatus.textContent = message;
  if (stateName) els.developerConnectionStatus.dataset.state = stateName;else delete els.developerConnectionStatus.dataset.state;
}
function renderDeveloperOptions() {
  if (isProductionRuntime()) {
    localStorage.removeItem(DEVELOPER_MODE_KEY);
    els.developerOptions.open = false;
    els.developerOptions.hidden = true;
    return;
  }
  const enabled = developerModeEnabled();
  els.developerOptions.hidden = !enabled;
  if (!enabled) return;
  els.developerCloudEndpoint.value = window.workDeskCloud?.config?.url || window.workDeskCloud?.defaultEndpoint?.() || '';
}
function currentAppVersion() {
  const runtime = window.WORK_PROGRESS_PUBLIC_RUNTIME || {};
  const versionCode = Number(runtime.currentVersionCode);
  const versionName = String(runtime.currentVersionName || '').trim();
  if (!Number.isInteger(versionCode) || versionCode < 1 || !/^\d+\.\d+\.\d+$/.test(versionName)) {
    throw new Error('当前应用版本配置无效');
  }
  return {
    versionCode,
    versionName
  };
}
function renderCurrentAppVersion() {
  try {
    const current = currentAppVersion();
    els.appVersionButton.textContent = `版本 ${current.versionName}（${current.versionCode}）`;
    els.appVersionButton.setAttribute('aria-label', `应用版本 ${current.versionName}，版本代码 ${current.versionCode}`);
  } catch (error) {
    els.appVersionButton.textContent = '版本信息异常';
    els.appVersionButton.setAttribute('aria-label', error.message);
  }
}
function updateManifestUrl() {
  let url;
  try {
    url = new URL(String(window.WORK_PROGRESS_PUBLIC_RUNTIME?.updateManifestUrl || ''));
  } catch {
    throw new Error('更新服务尚未配置');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/\/version\.json$/.test(url.pathname)) {
    throw new Error('更新服务配置无效');
  }
  return url.href;
}
function parseUpdateManifest(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('更新信息格式异常');
  const versionCode = payload.versionCode;
  const versionName = String(payload.versionName || '').trim();
  if (!(typeof payload.releaseNotes === 'string' || Array.isArray(payload.releaseNotes) && payload.releaseNotes.every(item => typeof item === 'string'))) {
    throw new Error('更新信息格式异常');
  }
  const noteItems = Array.isArray(payload.releaseNotes) ? payload.releaseNotes : [payload.releaseNotes];
  const releaseNotes = noteItems.map(item => item.trim()).filter(Boolean).join('\n');
  const apkUrl = String(payload.apkUrl || '').trim();
  const sha256 = String(payload.sha256 || '').trim().toLowerCase();
  const fileSize = payload.fileSize;
  const publishedAt = String(payload.publishedAt || '').trim();
  let parsedApkUrl;
  try {
    parsedApkUrl = new URL(apkUrl);
  } catch {
    throw new Error('更新信息格式异常');
  }
  if (!Number.isInteger(versionCode) || versionCode < 1 || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(versionName) || versionName.length > 50 || !releaseNotes || releaseNotes.length > 4000 || parsedApkUrl.protocol !== 'https:' || parsedApkUrl.username || parsedApkUrl.password || parsedApkUrl.search || parsedApkUrl.hash || !/\.apk$/i.test(parsedApkUrl.pathname) || !/^[0-9a-f]{64}$/.test(sha256) || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 500 * 1024 * 1024 || !publishedAt || Number.isNaN(Date.parse(publishedAt))) {
    throw new Error('更新信息格式异常');
  }
  return {
    versionCode,
    versionName,
    releaseNotes,
    apkUrl: parsedApkUrl.href,
    sha256,
    fileSize,
    publishedAt
  };
}
function setUpdateCheckStatus(message, stateName = '') {
  els.updateCheckStatus.textContent = message;
  if (stateName) els.updateCheckStatus.dataset.state = stateName;else delete els.updateCheckStatus.dataset.state;
}
async function checkForAppUpdate() {
  els.checkUpdateButton.disabled = true;
  els.updateAvailable.hidden = true;
  availableUpdateManifest = null;
  nativeUpdateState = '';
  els.availableVersion.textContent = '';
  els.releaseNotes.textContent = '';
  resetUpdateDownloadUi();
  setUpdateCheckStatus('正在检查更新…');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(updateManifestUrl(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`更新服务响应异常：${response.status}`);
    const raw = await response.text();
    if (raw.length > 65536) throw new Error('更新信息格式异常');
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('更新信息格式异常');
    }
    const latest = parseUpdateManifest(payload);
    const current = currentAppVersion();
    if (latest.versionCode > current.versionCode) {
      availableUpdateManifest = latest;
      els.availableVersion.textContent = `发现新版本 ${latest.versionName}（${latest.versionCode}）`;
      els.releaseNotes.textContent = latest.releaseNotes;
      els.downloadUpdateButton.textContent = `下载更新 · ${formatUpdateSize(latest.fileSize)}`;
      els.updateAvailable.hidden = false;
      setUpdateCheckStatus('有新版本可用', 'success');
    } else {
      setUpdateCheckStatus(`已是最新版本 · ${current.versionName}（${current.versionCode}）`, 'success');
    }
  } catch (error) {
    console.warn('检查更新失败', error);
    const message = error.name === 'AbortError' ? '检查更新超时，请稍后重试' : /格式|配置/.test(error.message) ? error.message : '暂时无法连接更新服务，请检查网络后重试';
    setUpdateCheckStatus(message, 'error');
  } finally {
    clearTimeout(timeout);
    els.checkUpdateButton.disabled = false;
  }
}
function formatUpdateSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function resetUpdateDownloadUi() {
  els.downloadUpdateButton.disabled = false;
  els.downloadUpdateButton.textContent = '下载更新';
  els.updateDownloadProgress.hidden = true;
  els.updateDownloadProgress.value = 0;
  els.updateDownloadStatus.textContent = '';
  delete els.updateDownloadStatus.dataset.state;
}
function setUpdateDownloadStatus(message, stateName = '') {
  els.updateDownloadStatus.textContent = message;
  if (stateName) els.updateDownloadStatus.dataset.state = stateName;else delete els.updateDownloadStatus.dataset.state;
}
function startUpdateDownload() {
  if (!availableUpdateManifest) {
    setUpdateDownloadStatus('请先检查更新', 'error');
    return;
  }
  const bridge = window.AndroidBridge;
  if (!bridge || typeof bridge.downloadUpdate !== 'function') {
    setUpdateDownloadStatus('请在 Android 安装版中下载更新', 'error');
    return;
  }
  if (nativeUpdateState === 'permission_required' && typeof bridge.continueUpdateInstall === 'function') {
    els.downloadUpdateButton.disabled = true;
    bridge.continueUpdateInstall();
    return;
  }
  els.downloadUpdateButton.disabled = true;
  els.updateDownloadProgress.hidden = false;
  els.updateDownloadProgress.value = 0;
  setUpdateDownloadStatus('正在准备下载…');
  bridge.downloadUpdate(JSON.stringify({
    versionCode: availableUpdateManifest.versionCode,
    versionName: availableUpdateManifest.versionName,
    apkUrl: availableUpdateManifest.apkUrl,
    sha256: availableUpdateManifest.sha256,
    fileSize: availableUpdateManifest.fileSize
  }));
}
function handleAndroidUpdateEvent(event = {}) {
  const stateName = String(event.state || '');
  const message = String(event.message || '');
  const percent = Number(event.percent);
  nativeUpdateState = stateName;
  if (Number.isFinite(percent) && percent >= 0) {
    els.updateDownloadProgress.hidden = false;
    els.updateDownloadProgress.value = Math.max(0, Math.min(100, percent));
  }
  setUpdateDownloadStatus(message, stateName === 'error' ? 'error' : ['verified', 'installing'].includes(stateName) ? 'success' : '');
  if (stateName === 'permission_required') {
    els.downloadUpdateButton.disabled = false;
    els.downloadUpdateButton.textContent = '继续安装';
  } else if (stateName === 'error') {
    els.downloadUpdateButton.disabled = false;
    els.downloadUpdateButton.textContent = '重新下载';
  } else {
    els.downloadUpdateButton.disabled = ['starting', 'downloading', 'verifying', 'verified', 'installing'].includes(stateName);
  }
}
window.handleAndroidUpdateEvent = handleAndroidUpdateEvent;
function handleVersionTap() {
  if (isProductionRuntime()) return;
  if (developerModeEnabled()) {
    renderDeveloperOptions();
    els.developerOptions.open = true;
    return;
  }
  versionTapCount += 1;
  clearTimeout(versionTapResetTimer);
  versionTapResetTimer = setTimeout(() => {
    versionTapCount = 0;
  }, 2500);
  const remaining = 7 - versionTapCount;
  if (remaining > 0) {
    if (remaining <= 3) showToast(`再点击 ${remaining} 次开启开发者模式`);
    return;
  }
  localStorage.setItem(DEVELOPER_MODE_KEY, '1');
  versionTapCount = 0;
  renderDeveloperOptions();
  els.developerOptions.open = true;
  showToast('开发者模式已开启');
}
function saveDeveloperEndpoint() {
  try {
    const endpoint = window.workDeskCloud.saveEndpoint(els.developerCloudEndpoint.value);
    els.developerCloudEndpoint.value = endpoint;
    setDeveloperConnectionStatus('地址已保存，建议执行连接测试');
    showToast('连接服务地址已保存');
  } catch (error) {
    setDeveloperConnectionStatus(error.message, 'error');
    showToast(error.message);
  }
}
async function testDeveloperEndpoint() {
  els.testDeveloperEndpointButton.disabled = true;
  setDeveloperConnectionStatus('正在测试连接…');
  try {
    const message = await window.workDeskCloud.testConnection(els.developerCloudEndpoint.value);
    setDeveloperConnectionStatus(message, 'success');
  } catch (error) {
    setDeveloperConnectionStatus(error.message, 'error');
  } finally {
    els.testDeveloperEndpointButton.disabled = false;
  }
}
function restoreDefaultEndpoint() {
  try {
    const endpoint = window.workDeskCloud.restoreDefaultEndpoint();
    els.developerCloudEndpoint.value = endpoint;
    setDeveloperConnectionStatus('已恢复默认地址，建议执行连接测试');
    showToast('已恢复默认连接服务');
  } catch (error) {
    setDeveloperConnectionStatus(error.message, 'error');
    showToast(error.message);
  }
}
async function cloudAuthenticate(action) {
  const email = els.cloudEmail.value.trim();
  const password = els.cloudPassword.value;
  if (!email || password.length < 8) return showToast('请输入邮箱和至少 8 位密码');
  try {
    await window.workDeskCloud.ensureConfigured();
    const message = action === 'signup' ? await window.workDeskCloud.signUp(email, password) : await window.workDeskCloud.signIn(email, password);
    if (els.rememberCloudAccount.checked) localStorage.setItem(REMEMBERED_CLOUD_EMAIL_KEY, email);else localStorage.removeItem(REMEMBERED_CLOUD_EMAIL_KEY);
    if (window.AndroidBridge?.saveSecureCredentials) {
      const saveError = await window.AndroidBridge.saveSecureCredentials(email, password, els.rememberCloudAccount.checked, els.rememberCloudPassword.checked);
      if (saveError) showToast(saveError);
    }
    if (!els.rememberCloudPassword.checked) els.cloudPassword.value = '';
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}
async function readSecureCloudCredentials() {
  if (!window.AndroidBridge?.loadSecureCredentials) return {
    email: localStorage.getItem(REMEMBERED_CLOUD_EMAIL_KEY) || '',
    password: '',
    rememberAccount: true,
    rememberPassword: false
  };
  try {
    return JSON.parse(await window.AndroidBridge.loadSecureCredentials()) || {};
  } catch {
    return {
      email: '',
      password: '',
      rememberAccount: true,
      rememberPassword: false,
      error: '无法读取本机安全登录信息，请重新输入'
    };
  }
}
async function applyCloudState(merged) {
  window.HospitalIdentity.migrate(merged);
  window.DepartmentIdentity.migrate(merged);
  const localActivityTemplate = state.settings?.activityTemplate?.dataBase64 ? state.settings.activityTemplate : null;
  state.tasks = Array.isArray(merged.tasks) ? normalizeCustomerVisitTasks(merged.tasks) : [];
  state.reviews = Array.isArray(merged.reviews) ? merged.reviews : [];
  state.records = Array.isArray(merged.records) ? merged.records : [];
  state.customerUpgradePlans = Array.isArray(merged.customerUpgradePlans) ? merged.customerUpgradePlans : [];
  state.employeePlanRecords = Array.isArray(merged.employeePlanRecords) ? merged.employeePlanRecords : [];
  state.activities = Array.isArray(merged.activities) ? merged.activities : [];
  state.activityLedgerEntries = Array.isArray(merged.activityLedgerEntries) ? merged.activityLedgerEntries : [];
  state.tombstones = Array.isArray(merged.tombstones) ? merged.tombstones : [];
  state.settings = merged.settings || {};
  const mergedActivityTemplate = state.settings.activityTemplate;
  const localTemplateTime = Date.parse(localActivityTemplate?.importedAt || '');
  const mergedTemplateTime = Date.parse(mergedActivityTemplate?.importedAt || '');
  const mergedTemplateMarkerTime = Date.parse(state.settings.activityTemplateUpdatedAt || '');
  const localTemplateSheets = [...(localActivityTemplate?.sheets || [])].map(String).sort().join('|');
  const mergedTemplateSheets = [...(mergedActivityTemplate?.sheets || [])].map(String).sort().join('|');
  const sameLocalTemplateVersion = localActivityTemplate && mergedActivityTemplate && String(localActivityTemplate.name || '') === String(mergedActivityTemplate.name || '') && localTemplateSheets === mergedTemplateSheets && Number.isFinite(localTemplateTime) && localTemplateTime === mergedTemplateTime && mergedTemplateTime === mergedTemplateMarkerTime;
  if (sameLocalTemplateVersion && !mergedActivityTemplate.dataBase64) {
    state.settings.activityTemplate = {
      ...mergedActivityTemplate,
      dataBase64: localActivityTemplate.dataBase64
    };
  }
  state.meta = merged.meta || {};
  window.customerProfileV1App?.applySyncState?.({
    customers: Array.isArray(merged.customers) ? merged.customers : undefined,
    customerFollowUps: Array.isArray(merged.customerFollowUps) ? merged.customerFollowUps : undefined,
    customerDevelopmentRecords: Array.isArray(merged.customerDevelopmentRecords) ? merged.customerDevelopmentRecords : undefined,
    customerDevelopmentHistory: Array.isArray(merged.customerDevelopmentHistory) ? merged.customerDevelopmentHistory : undefined,
    customerMasterEvents: Array.isArray(merged.customerMasterEvents) ? merged.customerMasterEvents : undefined
  });
  syncTasksForAllActivities();
  syncHospitalMaintenanceTasks();
  await persist({
    skipCloud: true
  });
  applyTheme();
  render();
}
function initializeCloud() {
  if (!window.CloudSyncClient) {
    updateCloudStatus({
      state: 'error',
      message: '云同步组件未加载'
    });
    return Promise.resolve();
  }
  window.workDeskCloud = new window.CloudSyncClient({
    getState: () => {
      const snapshotFromCommit = () => {
        const snapshot = window.WorkDeskPersistence.native ? window.WorkDeskPersistence.committedSyncState() : JSON.parse(JSON.stringify(state));
        if (!window.WorkDeskPersistence.native) Object.assign(snapshot, window.customerProfileV1App?.exportSyncState?.() || {});
        if (snapshot.settings?.activityTemplate) delete snapshot.settings.activityTemplate.dataBase64;
        return snapshot;
      };
      return window.WorkDeskPersistence.native ? window.WorkDeskPersistence.flush().then(snapshotFromCommit) : snapshotFromCommit();
    },
    applyState: applyCloudState,
    onStatus: updateCloudStatus,
    onHealth: updateCloudHealthStatus,
    getRememberedCredentials: readSecureCloudCredentials
  });
  window.addEventListener('online', () => window.workDeskCloud.scheduleSync(100));
  window.addEventListener('offline', () => window.workDeskCloud.restore());
  window.workDeskCloud.scheduleDailyHealthCheck();
  return window.workDeskCloud.restore();
}
function showPersistenceRecovery() {
  document.body.inert = false;
  document.body.dataset.runtimeReady = 'recovery';
  if (document.getElementById('persistenceRecovery')) return;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  const panel = document.createElement('section');
  panel.id = 'persistenceRecovery';
  panel.className = 'persistence-recovery';
  panel.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = '本机数据暂时无法读取';
  const text = document.createElement('p');
  text.textContent = '业务操作已暂停。请保留本机数据，不要清除数据或卸载应用。可以重新读取并重试。';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'button primary';
  retry.textContent = '重新读取并重试';
  retry.addEventListener('click', () => location.reload());
  panel.append(title, text, retry);
  for (const child of document.body.children) {
    if (!['SCRIPT', 'STYLE'].includes(child.tagName)) child.inert = true;
  }
  document.body.prepend(panel);
  retry.focus();
}
window.addEventListener('workdesk-persistence-failed', showPersistenceRecovery);
let appInitialization = null;
function init() {
  if (!appInitialization) appInitialization = initializeApp();
  return appInitialization;
}
async function initializeApp() {
  document.body.inert = window.WorkDeskPersistence.native;
  try {
    await window.WorkDeskPersistence.initialize(state);
  } catch (error) {
    showPersistenceRecovery();
    return;
  } finally {
    document.body.inert = false;
  }
  populateCategories();
  enhanceWheelSelects();
  applyTheme();
  initializeWorkspaceNavigation();
  bindEvents();
  activityController = window.ActivityCenter?.init({
    state,
    persist,
    directoryRecords,
    showToast,
    uid,
    persistActivityState: async (activities, tasks) => {
      const staged = JSON.parse(JSON.stringify({...state, activities, tasks}));
      for (const activity of activities) {
        const evidence = activity.departmentBindingEvidence;
        if (evidence?.type !== 'USER_CONFIRMED_SOURCE_LABEL' || evidence.hospitalId !== activity.hospitalId || !evidence.departmentIds?.length) continue;
        const hospital = hospitalDirectorySnapshot().hospitals.find(h=>h.hospitalId===activity.hospitalId);
        const known = (hospital?.departments || []).map(d=>({...d,hospitalId:activity.hospitalId}));
        if (!evidence.departmentIds.every(id=>known.some(d=>d.departmentId===id))) continue;
        staged.settings.departmentIdentityRegistry = window.DepartmentIdentity.confirmAliases([...(staged.settings.departmentIdentityRegistry||[]),...known], evidence);
      }
      await persist({snapshot: staged, identityValidated: true});
      state.activities = staged.activities; state.tasks = staged.tasks;
      state.settings.departmentIdentityRegistry = staged.settings.departmentIdentityRegistry;
    },
    getProductOptions: () => Object.values(PRODUCT_ALIASES),
    syncWheelTriggers,
    getHospitalDirectory: () => hospitalDirectorySnapshot().hospitals,
    developerMode: new URLSearchParams(location.search).get('developerMode') === '1',
    getCustomerEntities: () => window.customerProfileV1App?.getMasterRecords() || [],
    ensureActivityPerson: context => {
      if (!window.customerProfileV1App) throw new Error('人员档案尚未就绪，请稍后保存');
      return window.customerProfileV1App.ensureActivityPerson(context);
    },
    syncActivityTasks: activity => syncTasksForActivity(activity),
    syncAllActivityTasks: () => syncTasksForAllActivities(),
    navigationCoordinator: {
      back: origin => workspaceNavigationController?.handleBack(origin) || false,
      syncActivityState: snapshot => workspaceNavigationController?.syncSourceSnapshot?.('activities', snapshot)
    },
    onOpenCustomerContext: openActivityCustomerContext,
    onOpenHospitalContext: openActivityHospitalContext,
    onOpenSalesContext: openActivitySalesContext,
    onOpenTaskContext: openActivityTaskContext,
    onViewSales: activity => openSalesFromEntity('activity', 'activity', activity, {
      period: activity.observationPeriod,
      routeKey: `activity:${activity.id}`
    }),
    onTimeContextChange: acceptActivityTimeContext
  }) || null;
  window.activityCenterApp = activityController;
  const initialActivitySync = syncTasksForAllActivities();
  if (initialActivitySync.changed) persist({
    skipCloud: true
  });
  if (els.customerProfileV1 && window.CustomerProfileV1) {
    window.customerProfileV1App = window.CustomerProfileV1.mount({
      root: els.customerProfileV1,
      deferInitialRender: true,
      storage: window.WorkDeskPersistence.storage,
      records: state.records,
      tasks: state.tasks,
      getDeletionContext: () => ({
        tasks: state.tasks,
        activities: state.activities,
        records: state.records,
        plans: state.employeePlanRecords,
        reviews: state.reviews,
        tombstones: state.tombstones
      }),
      onCustomerDeleted: id => {
        state.tombstones ||= [];
        state.tombstones.push({
          key: 'customer:' + id,
          kind: 'customer',
          id,
          deletedAt: new Date().toISOString()
        });
        persist();
      },
      isDeveloperMode: developerModeEnabled,
      gradeResolver: customerRating,
      customerPlanProvider,
      resourceInvestmentProvider,
      taskBridge: window.CustomerTaskBridge,
      hospitalDirectoryProvider: () => hospitalDirectorySnapshot().hospitals,
      onOpenCustomerUpgradeManager: openCustomerUpgradeManager,
      onDataChange: () => {
        window.taskProgressV2App?.update({
          tasks: state.tasks
        });
        persist();
      },
      onHospitalDirectoryChange: scheduleHospitalMaintenanceSync,
      onHospitalDirectorySaved: saveHospitalDirectoryMaintenance,
      onViewSales: profile => openSalesFromEntity('customer', 'customer', profile, {
        routeKey: `customer:${profile.customerId}`
      }),
      demo: new URLSearchParams(location.search).get('customerProfileDemo') === '1'
    });
  }
  const initialHospitalMaintenanceSync = syncHospitalMaintenanceTasks();
  if (initialHospitalMaintenanceSync.changed) persist({
    skipCloud: true
  });
  mountTaskProgressV2();
  workspaceNavigationController?.restoreHospitalHistory?.();
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/activity/')) return;
    if (els.activityView.hidden) switchView('activities', {
      fromWorkspaceNavigation: true
    });else if (!history.state?.workspaceNavigationSourceSnapshot) activityController?.handleRoute?.();
  });
  if (location.hash.startsWith('#/activity/')) switchView('activities');else {
    switchView('tasks');
    if (!location.hash) history.replaceState({
      appWorkspace: 'tasks'
    }, '', location.pathname + location.search + '#/tasks');
  }
  renderCurrentAppVersion();
  restoreSectionCollapse();
  document.body.dataset.runtimeReady = 'true';
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    await loadBundledSalesData();
  } catch (error) {
    console.warn(error);
    if (!window.AndroidBridge) showToast('预装销售数据读取失败，请确认通过启动脚本打开应用');
  }
  if (!window.AndroidBridge) render();
  await initializeCloud();
  if (location.hash.startsWith('#/activity/')) switchView('activities');
  if (location.hash.startsWith('#customer-profile-v1')) switchView('customers');
  if (state.settings.notifications && 'Notification' in window && Notification.permission === 'granted') els.notificationButton.textContent = '提醒已开启';
  if (!window.AndroidBridge && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(error => console.warn('离线服务未启用', error));
  maybePrompt();
}
init();
