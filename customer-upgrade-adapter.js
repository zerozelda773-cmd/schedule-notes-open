(function (root, factory) {
  const api = factory(root.QuarterlyReporting || (typeof require === 'function' ? require('./reporting.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CustomerUpgradeAdapter = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function (Reporting) {
  const HEADERS = {
    office: ['片区', '办事处'], employee: ['负责人', '员工', '信息员'], hospital: ['医院全称', '医院'], department: ['科室'], customer: ['客户', '客户姓名'],
    perceptionLevel: ['客户观念分级(R1、R2、R3、R4)', '客户观念分级'], reportedSalesGrade: ['客户销量分级(A、B、C、D)', '客户销量分级'],
    academicInvestment: ['学术投入情况记录\n(月份+活动）', '学术投入情况记录(月份+活动)', '学术投入情况记录'],
    juneActual: ['6月销售'], julyActual: ['7月销售'], augustTarget: ['8月目标'], problem: ['存在问题分析'], followUp: ['后续跟进方案'],
  };
  const compact = (value) => String(value ?? '').replace(/[\s_()（）/\\·,，.。;；:\-\n]+/g, '').toLowerCase();
  const text = (value) => String(value ?? '').trim();
  const numberOrNull = (value) => { const cleaned = text(value).replace(/[,，盒]/g, ''); if (!cleaned) return null; const parsed = Number(cleaned); return Number.isFinite(parsed) ? parsed : null; };
  const stableId = (value) => { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `cup-${(hash >>> 0).toString(36)}`; };
  const headerKey = (value) => Object.keys(HEADERS).find((key) => HEADERS[key].some((alias) => compact(alias) === compact(value))) || '';
  const cleanLevel = (value, expression) => { const match = text(value).toUpperCase().match(expression); return match ? match[0] : ''; };
  const salesGradeForBoxes = (value) => Reporting?.salesGradeForBoxes?.(value) || (Number(value) > 30 ? 'A' : Number(value) >= 20 ? 'B' : Number(value) >= 10 ? 'C' : 'D');
  const gradeProgress = (value) => Reporting?.customerGradeProgress?.(value) || (() => {
    const currentBoxes = Number(value) || 0; const currentGrade = salesGradeForBoxes(currentBoxes);
    const next = { D: ['C', 10], C: ['B', 20], B: ['A', 31], A: [null, null] }[currentGrade];
    return { currentBoxes, currentGrade, nextGrade: next[0], nextGradeThreshold: next[1], upgradeGap: next[1] === null ? 0 : Math.max(0, next[1] - currentBoxes) };
  })();

  function normalizeRow(raw, options = {}) {
    const mapped = {};
    Object.entries(raw || {}).forEach(([header, value]) => { const key = headerKey(header); if (key) mapped[key] = value; });
    const employee = text(mapped.employee); const hospital = text(mapped.hospital); const department = text(mapped.department); const customer = text(mapped.customer);
    const juneActual = numberOrNull(mapped.juneActual); const julyActual = numberOrNull(mapped.julyActual); const augustTarget = numberOrNull(mapped.augustTarget);
    const latestActual = julyActual ?? juneActual;
    const reportedSalesGrade = cleanLevel(mapped.reportedSalesGrade, /[ABCD]/);
    const computedSalesGrade = latestActual === null ? '' : salesGradeForBoxes(latestActual);
    const gradeCheck = !reportedSalesGrade || latestActual === null ? 'INSUFFICIENT_DATA' : reportedSalesGrade === computedSalesGrade ? 'MATCH' : 'MISMATCH';
    const product = text(options.product); const fiscalYear = Number(options.fiscalYear); const month = Number(options.month || 8);
    const key = [product, fiscalYear, month, employee, hospital, department, customer].map(compact).join('|');
    const problem = text(mapped.problem); const followUp = text(mapped.followUp);
    const validationErrors = [['产品', product], ['财年', fiscalYear], ['月份', month], ['员工', employee], ['医院', hospital], ['科室', department], ['客户', customer]].filter(([, value]) => !value).map(([label]) => `${label}缺失`);
    const customerId = stableId([product, employee, hospital, department, customer].map(compact).join('|'));
    return {
      id: stableId(key), customerId, schemaVersion: 2, product, fiscalYear, month, office: text(mapped.office), employee, hospital, department, customer,
      perceptionLevel: cleanLevel(mapped.perceptionLevel, /R[1-4]/), reportedSalesGrade, computedSalesGrade, gradeCheck,
      actuals: { june: juneActual, july: julyActual }, nextMonthTarget: augustTarget,
      academicInvestment: text(mapped.academicInvestment), resourcePlanLinkStatus: text(mapped.academicInvestment) ? 'LINKABLE' : 'NOT_PROVIDED',
      problem, followUp, zeroTargetAssessment: augustTarget === 0 ? (problem || followUp ? 'EXPLAINED_REVIEW' : 'REQUIRES_REVIEW') : 'NOT_APPLICABLE', currentTargetGrade: reportedSalesGrade || computedSalesGrade,
      gradeProgress: latestActual === null ? null : gradeProgress(latestActual),
      status: '待确认', notes: '', importedAt: options.importedAt || new Date().toISOString(), updatedAt: options.importedAt || new Date().toISOString(), history: [],
      valid: validationErrors.length === 0, validationErrors,
    };
  }

  function matchRow(row, directory = [], aliases = {}) {
    const canonicalHospital = text(aliases[row.hospital] || row.hospital);
    const candidates = directory.filter((item) => compact(item.employee) === compact(row.employee) && compact(item.customer) === compact(row.customer));
    const exact = candidates.filter((item) => compact(aliases[item.hospital] || item.hospital) === compact(canonicalHospital) && compact(item.department) === compact(row.department));
    if (exact.length === 1) return { status: 'exact', candidate: exact[0] };
    if (exact.length > 1) return { status: 'ambiguous', candidates: exact };
    const probable = candidates.filter((item) => compact(aliases[item.hospital] || item.hospital) === compact(canonicalHospital) || compact(item.department) === compact(row.department));
    if (probable.length === 1) return { status: 'probable', candidate: probable[0] };
    if (probable.length > 1 || candidates.length > 1) return { status: 'ambiguous', candidates: probable.length ? probable : candidates };
    return { status: 'unmatched', candidates: [] };
  }

  function rowsFromWorkbook(workbook, XLSX, options = {}) {
    if (!workbook || !XLSX?.utils) throw new Error('Excel 组件不可用');
    const sheetName = workbook.SheetNames.find((name) => /客户管理/.test(name)) || workbook.SheetNames[0];
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '', blankrows: false });
    const headerIndex = matrix.findIndex((row) => row.some((value) => compact(value) === compact('医院全称')) && row.some((value) => compact(value) === compact('负责人')));
    if (headerIndex < 0) throw new Error('未找到客户管理表头（需要负责人、医院全称、科室、客户）');
    const headers = matrix[headerIndex];
    return matrix.slice(headerIndex + 1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
      .map((row) => normalizeRow(row, options)).filter((row) => row.employee || row.hospital || row.department || row.customer);
  }

  function buildPreview(rows, directory = [], aliases = {}) {
    const seen = new Set(); let duplicates = 0;
    const items = rows.map((row) => {
      const match = matchRow(row, directory, aliases);
      const candidate = (match.status === 'exact' || match.status === 'probable') ? match.candidate : null;
      const canonical = candidate ? { ...row, office: text(candidate.office || row.office), employee: text(candidate.employee || row.employee), hospital: text(candidate.hospital || row.hospital), department: text(candidate.department || row.department), customer: text(candidate.customer || row.customer), sourceNames: { hospital: row.hospital, department: row.department, customer: row.customer } } : row;
      canonical.id = stableId([canonical.product, canonical.fiscalYear, canonical.month, canonical.employee, canonical.hospital, canonical.department, canonical.customer].map(compact).join('|'));
      if (seen.has(canonical.id)) duplicates += 1; else seen.add(canonical.id);
      return { ...canonical, match };
    });
    const count = (status) => items.filter((item) => item.match.status === status).length;
    return {
      items, total: items.length, exact: count('exact'), probable: count('probable'), ambiguous: count('ambiguous'), unmatched: count('unmatched'), duplicates,
      gradeMatch: items.filter((item) => item.gradeCheck === 'MATCH').length,
      gradeMismatch: items.filter((item) => item.gradeCheck === 'MISMATCH').length,
      gradeInsufficient: items.filter((item) => item.gradeCheck === 'INSUFFICIENT_DATA').length,
      zeroTargets: items.filter((item) => item.nextMonthTarget === 0).length,
      invalid: items.filter((item) => !item.valid).length,
    };
  }

  function toEmployeePlanTask(item) {
    return {
      id: `customer-plan-${item.id}`, recordType: 'customerUpgradePlan', isEmployeePlan: true, category: '客户升级计划',
      planPeriod: `${item.fiscalYear}-${String(item.month).padStart(2, '0')}-01`, due: `${item.fiscalYear}-${String(item.month).padStart(2, '0')}-28`,
      employee: item.employee, office: item.office, product: item.product, hospital: item.hospital, department: item.department, customer: item.customer,
      planTarget: item.nextMonthTarget, plannedHospitals: item.hospital ? [item.hospital] : [], plannedDepartments: item.department ? [item.department] : [],
      customerLevels: item.currentTargetGrade ? { [item.currentTargetGrade]: 1 } : {}, planText: [item.problem, item.followUp, item.academicInvestment].filter(Boolean).join('；'),
      customerId: item.customerId, customerPlanProvider: 'customer-upgrade-workbook', customerProfileRoute: item.customerId ? `customer:${item.customerId}` : '',
      customerUpgrade: { perceptionLevel: item.perceptionLevel, reportedSalesGrade: item.reportedSalesGrade, computedSalesGrade: item.computedSalesGrade, gradeCheck: item.gradeCheck, actuals: item.actuals, nextMonthTarget: item.nextMonthTarget, academicInvestment: item.academicInvestment, problem: item.problem, followUp: item.followUp, resourcePlanLinkStatus: item.resourcePlanLinkStatus },
      createdAt: item.importedAt, updatedAt: item.updatedAt,
    };
  }

  return { HEADERS, normalizeRow, rowsFromWorkbook, buildPreview, matchRow, toEmployeePlanTask, salesGradeForBoxes };
}));
