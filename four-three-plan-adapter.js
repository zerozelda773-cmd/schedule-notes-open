(function initFourThreePlanAdapter(root, factory) {
  const api = factory(root?.QuarterlyReporting, root?.SalesImportAdapter, root?.CustomerUpgradeAdapter, typeof module === 'object' && module.exports ? require('./product-registry.js') : root?.ProductRegistry);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FourThreePlanAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (Reporting, SalesAdapter, CustomerUpgradeAdapter, ProductRegistry) => {
  if (!ProductRegistry) throw new Error('Product Registry is required for 4+3 product identity');
  const MAIN_HEADERS = Object.freeze({
    region: ['大区'],
    area: ['片区'],
    office: ['办事处'],
    employeeId: ['员工ID', '信息员ID', '专员ID'],
    employee: ['信息员', '负责人', '员工'],
    hospital: ['医院全称', '医院'],
    sourceDepartmentId: ['科室ID', '科室编号', '科室编码'],
    department: ['科室'],
    product: ['派', '产品'],
    customer: ['客户姓名', '客户'],
    potentialAnalysis: ['潜力分析'],
    resourcePlan: ['资源配置'],
    fabe: ['FABE法则应用', 'FABE'],
    problemAndNext: ['未达标原因分析及下月规划'],
    regionalManagerComment: ['片区经理点评'],
    areaManagerComment: ['大区经理点评']
  });
  const CUSTOMER_HEADERS = Object.freeze({
    region: ['大区'],
    area: ['片区'],
    employee: ['负责人', '信息员'],
    hospital: ['医院全称', '医院'],
    department: ['科室'],
    customer: ['客户', '客户姓名'],
    perceptionLevel: ['客户观念分级(R1、R2、R3、R4)', '客户观念分级'],
    reportedSalesGrade: ['客户销量分级(A、B、C、D)', '客户销量分级'],
    academicInvestment: ['学术投入情况记录(月份+活动)', '学术投入情况记录'],
    problem: ['存在问题分析'],
    followUp: ['后续跟进方案']
  });
  const text = value => String(value ?? '').trim();
  const compact = value => text(value).replace(/[\s_()（）/\\\-、，,:：\r\n]/g, '').toLowerCase();
  const numeric = value => {
    if (value === null || value === undefined || text(value) === '') return null;
    const parsed = Number(text(value).replace(/[,，盒%]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const productId = value => ProductRegistry.getProduct(value)?.id || '';
  const productMetadata = value => {
    const product = ProductRegistry.getProduct(value);
    return {
      productId: product?.id || '',
      productName: product?.name || '',
      productRole: product?.role || 'UNKNOWN'
    };
  };
  const stableId = (value, prefix = 'plan') => {
    let hash = 2166136261;
    for (const char of value) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
  };
  const salesGradeForBoxes = value => CustomerUpgradeAdapter?.salesGradeForBoxes?.(value) || Reporting?.salesGradeForBoxes?.(value) || (Number(value) >= 31 ? 'A' : Number(value) >= 20 ? 'B' : Number(value) >= 10 ? 'C' : 'D');
  const grade = (value, expression) => text(value).toUpperCase().match(expression)?.[0] || '';
  function headerKey(value, definitions) {
    return Object.keys(definitions).find(key => definitions[key].some(alias => compact(alias) === compact(value))) || '';
  }
  function sheetByPattern(workbook, pattern) {
    return workbook.SheetNames.find(name => pattern.test(compact(name))) || '';
  }
  function sheetMatrix(workbook, XLSX, name, raw = true) {
    return XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw,
      dateNF: 'yyyy-mm-dd',
      defval: '',
      blankrows: false
    });
  }
  function findHeader(matrix, definitions, required) {
    let best = null;
    matrix.slice(0, 30).forEach((row, index) => {
      const keys = row.map(value => headerKey(value, definitions));
      const unique = new Set(keys.filter(Boolean));
      const monthColumns = row.filter(value => /^\d{1,2}月(?:目标分解|目标达成|销售|目标)$/.test(text(value))).length;
      const score = unique.size + monthColumns;
      if (!best || score > best.score) best = {
        index,
        keys,
        unique,
        row,
        score
      };
    });
    if (!best || required.some(key => !best.unique.has(key))) return null;
    return best;
  }
  function monthColumns(headers) {
    const columns = {
      actual: {},
      target: {},
      status: {},
      customerSales: {}
    };
    headers.forEach((header, index) => {
      const value = text(header);
      let match;
      if (match = value.match(/^(\d{1,2})月目标分解$/)) columns.target[Number(match[1])] = index;else if (match = value.match(/^(\d{1,2})月目标达成$/)) columns.actual[Number(match[1])] = index;else if (match = value.match(/^(\d{1,2})月目标达成情况$/)) columns.status[Number(match[1])] = index;else if (match = value.match(/^(\d{1,2})月销售$/)) columns.customerSales[Number(match[1])] = index;else if (match = value.match(/^(\d{1,2})月目标$/)) columns.target[Number(match[1])] = index;
    });
    return columns;
  }
  function analysisMonth(columns) {
    const paired = Object.keys(columns.target).map(Number).filter(month => columns.actual[month] !== undefined).sort((a, b) => a - b);
    return paired.pop() || Object.keys(columns.actual).map(Number).sort((a, b) => a - b).pop() || new Date().getMonth() + 1;
  }
  function fiscalYearForMonth(month, options = {}) {
    if (Number(options.fiscalYear)) return Number(options.fiscalYear);
    const match = text(options.sourceName).match(/FY\s*(\d{2,4})/i);
    if (match) return Number(match[1]) < 100 ? 2000 + Number(match[1]) : Number(match[1]);
    const year = new Date().getFullYear();
    return month >= 10 ? year + 1 : year;
  }
  function achievement(target, actual) {
    if (target === null) return {
      achievementRate: null,
      achievementStatus: 'TARGET_MISSING'
    };
    if (actual === null) return {
      achievementRate: null,
      achievementStatus: 'ACTUAL_MISSING'
    };
    return {
      achievementRate: target === 0 ? actual >= 0 ? 1 : 0 : actual / target,
      achievementStatus: actual >= target ? 'ACHIEVED' : 'NOT_ACHIEVED'
    };
  }
  function splitProblemAndNext(value) {
    const source = text(value);
    if (!source) return {
      problemAnalysis: '',
      nextAction: ''
    };
    const marker = source.search(/(?:下月|后续|下一步|规划|计划)[：:，,]?/);
    if (marker <= 0) return {
      problemAnalysis: source,
      nextAction: source
    };
    return {
      problemAnalysis: source.slice(0, marker).replace(/[；;，,。\s]+$/, ''),
      nextAction: source.slice(marker).replace(/^(?:下月|后续|下一步|规划|计划)[：:，,]?\s*/, '')
    };
  }
  const RESOURCE_TAGS = [['HOME_VISIT', /家访/], ['VISIT_INCREASE', /加强拜访|增加拜访|拜访量/], ['DIRECTOR_VISIT', /主任.*协访|主任协访/], ['PRODUCT_MANAGER_VISIT', /产品经理.*协访/], ['INTERNAL_TRAINING', /内训/], ['DEPARTMENT_MEETING', /科室会/], ['JOINT_VISIT', /协访/]];
  const REASON_TAGS = [['PATIENT_SHORTAGE', /患者少|患者不足|病人少/], ['CUSTOMER_CAUTION', /谨慎|保守/], ['ADHERENCE', /依从性/], ['PRICE', /价格|费用贵/], ['POLICY', /政策/], ['VISIT_GAP', /拜访不足|拜访少/], ['RECOMMENDATION_GAP', /推荐不足|未推荐|推荐少/], ['PRODUCT_AWARENESS', /认知|不了解|知晓/], ['COMPETITION', /竞争|竞品/]];
  const tags = (value, rules) => {
    const matched = rules.filter(([, pattern]) => pattern.test(text(value))).map(([key]) => key);
    return matched.length ? matched : text(value) ? ['OTHER'] : [];
  };
  function customerMatch(row, directory = [], aliases = {}) {
    const normalized = value => compact(aliases[value] || value);
    const candidates = [...new Map(directory.filter(item => item.active !== false && text(item.customerId || item.id) && normalized(item.customer || item.customerName || item.name) === normalized(row.customerName)).map(item => [text(item.customerId || item.id), item])).values()];
    const exact = candidates.filter(item => (item.hospitalId && row.hospitalId ? item.hospitalId === row.hospitalId : normalized(item.hospital || item.hospitalName) === normalized(row.hospitalName)) && (item.departmentId && row.departmentId ? item.departmentId === row.departmentId : normalized(item.department || item.departmentName) === normalized(row.departmentName)));
    if (exact.length === 1) return {
      status: 'EXACT',
      customerId: text(exact[0].customerId || exact[0].id),
      candidate: exact[0]
    };
    if (exact.length > 1) return {
      status: 'AMBIGUOUS',
      candidates: exact
    };
    const probable = candidates.filter(item => normalized(item.hospital || item.hospitalName) === normalized(row.hospitalName) || normalized(item.department || item.departmentName) === normalized(row.departmentName));
    if (probable.length === 1) return {
      status: 'PROBABLE',
      customerId: text(probable[0].customerId || probable[0].id),
      candidate: probable[0]
    };
    if (probable.length > 1 || candidates.length > 1) return {
      status: 'AMBIGUOUS',
      candidates: probable.length ? probable : candidates
    };
    return {
      status: 'UNMATCHED',
      customerId: '',
      legacyCustomerMatchingKey: stableId([row.productId, row.hospitalName, row.departmentName, row.customerName].map(compact).join('|'), 'customer')
    };
  }
  function parseMainSheet(workbook, XLSX, sheetName, options = {}) {
    const matrix = sheetMatrix(workbook, XLSX, sheetName, true);
    const header = findHeader(matrix, MAIN_HEADERS, ['employee', 'hospital', 'product']);
    if (!header) throw new Error('未找到(4+3)主表表头。');
    const months = monthColumns(header.row);
    const currentMonth = Number(options.month) || analysisMonth(months);
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const fiscalYear = fiscalYearForMonth(currentMonth, options);
    const hospitalMatcher = SalesAdapter?.createMatcher?.(options.hospitals || [], options.hospitalAliases || {}, 'hospital');
    const departmentMatcher = SalesAdapter?.createMatcher?.(options.departments || [], options.departmentAliases || {}, 'department');
    const records = [];
    const rawRows = [];
    const ignoredProducts = [];
    const errors = [];
    matrix.slice(header.index + 1).forEach((cells, offset) => {
      const raw = {};
      header.keys.forEach((key, index) => {
        if (key) raw[key] = cells[index];
      });
      rawRows.push(cells);
      if (![raw.employee, raw.hospital, raw.department, raw.product, raw.customer].some(value => text(value))) return;
      const stableProduct = productId(raw.product);
      if (!stableProduct) {
        ignoredProducts.push(header.index + offset + 2);
        return;
      }
      const hospital = hospitalMatcher?.match(raw.hospital) || {
        status: 'UNMATCHED',
        canonicalName: text(raw.hospital),
        id: stableId(compact(raw.hospital), 'hospital')
      };
      const department = departmentMatcher?.match(raw.department, {
        hospitalId: hospital.id,
        sourceDepartmentId: raw.sourceDepartmentId,
        provenance: {
          source: options.sourceName || sheetName,
          evidence: 'SOURCE_DEPARTMENT_ID_COLUMN',
          sourceRow: header.index + offset + 2
        }
      }) || {
        status: 'UNMATCHED',
        canonicalName: text(raw.department),
        id: stableId(compact(raw.department), 'department')
      };
      const currentTarget = months.target[currentMonth] === undefined ? null : numeric(cells[months.target[currentMonth]]);
      const currentActual = months.actual[currentMonth] === undefined ? null : numeric(cells[months.actual[currentMonth]]);
      const previousActual = months.actual[previousMonth] === undefined ? null : numeric(cells[months.actual[previousMonth]]);
      const nextMonthTarget = months.target[nextMonth] === undefined ? null : numeric(cells[months.target[nextMonth]]);
      const status = achievement(currentTarget, currentActual);
      const problem = splitProblemAndNext(raw.problemAndNext);
      const draft = {
        schemaVersion: 1,
        fiscalYear,
        month: currentMonth,
        planPeriod: `${currentMonth >= 10 ? fiscalYear - 1 : fiscalYear}-${String(currentMonth).padStart(2, '0')}-01`,
        sourceDimensions: {
          department: header.unique.has('department'),
          customer: header.unique.has('customer')
        },
        planTargets: Object.entries(months.target).map(([month, column]) => ({
          planPeriod: `${Number(month) >= 10 ? fiscalYear - 1 : fiscalYear}-${String(month).padStart(2, '0')}-01`,
          target: numeric(cells[column]),
          sourceColumn: header.row[column],
          source: `${options.sourceName || '4+3 Excel'} · ${sheetName}`,
          sourceRow: header.index + offset + 2
        })),
        region: text(raw.region),
        area: text(raw.area),
        office: text(raw.office),
        employee: text(raw.employee),
        employeeId: text(raw.employeeId) || SalesAdapter.employeeIdentityId(raw.employee),
        hospitalId: hospital.id,
        hospitalName: hospital.canonicalName || text(raw.hospital),
        hospitalRaw: text(raw.hospital),
        hospitalMatchStatus: hospital.status,
        sourceDepartmentId: text(raw.sourceDepartmentId),
        departmentId: department.id,
        legacyDepartmentIds: department.legacyIds || [],
        departmentProvenance: department.provenance,
        departmentAliases: department.aliases || [],
        departmentMatchingQuality: department.matchingQuality,
        departmentName: department.canonicalName || text(raw.department),
        departmentRaw: text(raw.department),
        departmentMatchStatus: department.status,
        ...productMetadata(stableProduct),
        customerName: text(raw.customer),
        previousActual,
        currentTarget,
        currentActual,
        ...status,
        nextMonthTarget,
        potentialAnalysis: text(raw.potentialAnalysis),
        resourcePlan: text(raw.resourcePlan),
        resourceTags: tags(raw.resourcePlan, RESOURCE_TAGS),
        fabe: text(raw.fabe),
        problemAnalysis: problem.problemAnalysis,
        nextAction: problem.nextAction,
        reasonTags: tags(problem.problemAnalysis, REASON_TAGS),
        regionalManagerComment: text(raw.regionalManagerComment),
        areaManagerComment: text(raw.areaManagerComment),
        plannedActivityType: tags(raw.resourcePlan, RESOURCE_TAGS).filter(key => ['INTERNAL_TRAINING', 'DEPARTMENT_MEETING', 'HOME_VISIT', 'DIRECTOR_VISIT', 'PRODUCT_MANAGER_VISIT', 'JOINT_VISIT'].includes(key)),
        plannedActivityId: '',
        actualActivityId: '',
        activityMatchStatus: 'NOT_LINKED',
        importedAt: options.importedAt || new Date().toISOString(),
        source: `${options.sourceName || '4+3 Excel'} · ${sheetName}`,
        sourceRow: header.index + offset + 2
      };
      const match = customerMatch(draft, options.customers || [], options.customerAliases || {});
      draft.customerId = match.customerId;
      draft.customerMatchStatus = match.status;
      draft.id = stableId([fiscalYear, currentMonth, stableProduct, draft.office, draft.employee, draft.hospitalName, draft.departmentName, draft.customerName].map(compact).join('|'));
      if (!draft.employee) errors.push({
        sourceRow: draft.sourceRow,
        type: 'MISSING_EMPLOYEE'
      });
      records.push(draft);
    });
    return {
      records,
      rawRows,
      ignoredProducts,
      errors,
      currentMonth,
      previousMonth,
      nextMonth,
      fiscalYear
    };
  }
  function parseCustomerSheet(workbook, XLSX, sheetName, planRecords, options = {}) {
    const matrix = sheetMatrix(workbook, XLSX, sheetName, true);
    const header = findHeader(matrix, CUSTOMER_HEADERS, ['employee', 'hospital', 'department', 'customer']);
    if (!header) throw new Error('未找到(客户管理)表头。');
    const months = monthColumns(header.row);
    const currentMonth = Number(options.month) || Object.keys(months.customerSales).map(Number).sort((a, b) => a - b).pop() || 8;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const hospitalMatcher = SalesAdapter?.createMatcher?.(options.hospitals || [], options.hospitalAliases || {}, 'hospital');
    const departmentMatcher = SalesAdapter?.createMatcher?.(options.departments || [], options.departmentAliases || {}, 'department');
    const byIdentity = new Map();
    planRecords.forEach(row => {
      const key = [row.employee, row.hospitalName, row.departmentName, row.customerName].map(compact).join('|');
      const match = byIdentity.get(key) || {
        products: new Set(),
        offices: new Set(),
        hospitals: new Set(),
        hospitalIds: new Set(),
        departments: new Set(),
        departmentIds: new Set()
      };
      match.products.add(row.productId);
      if (row.office) match.offices.add(row.office);
      if (row.hospitalName) match.hospitals.add(row.hospitalName);
      if (row.hospitalId) match.hospitalIds.add(row.hospitalId);
      if (row.departmentName) match.departments.add(row.departmentName);
      if (row.departmentId) match.departmentIds.add(row.departmentId);
      byIdentity.set(key, match);
    });
    const rows = [];
    matrix.slice(header.index + 1).forEach((cells, offset) => {
      const raw = {};
      header.keys.forEach((key, index) => {
        if (key) raw[key] = cells[index];
      });
      if (![raw.employee, raw.hospital, raw.department, raw.customer].some(value => text(value))) return;
      const hospital = hospitalMatcher?.match(raw.hospital) || {
        status: 'UNMATCHED',
        canonicalName: text(raw.hospital),
        id: stableId(compact(raw.hospital), 'hospital')
      };
      const department = departmentMatcher?.match(raw.department, {
        hospitalId: hospital.id,
        sourceDepartmentId: raw.sourceDepartmentId,
        provenance: {
          source: options.sourceName || sheetName,
          evidence: 'SOURCE_DEPARTMENT_ID_COLUMN',
          sourceRow: header.index + offset + 2
        }
      }) || {
        status: 'UNMATCHED',
        canonicalName: text(raw.department),
        id: stableId(compact(raw.department), 'department')
      };
      const key = [raw.employee, hospital.canonicalName || raw.hospital, department.canonicalName || raw.department, raw.customer].map(compact).join('|');
      const identity = byIdentity.get(key);
      const inferred = [...(identity?.products || [])];
      const stableProduct = inferred.length === 1 ? inferred[0] : '';
      const inferredOffice = identity?.offices?.size === 1 ? [...identity.offices][0] : '';
      const inferredHospital = identity?.hospitals?.size === 1 ? [...identity.hospitals][0] : hospital.canonicalName || text(raw.hospital);
      const inferredHospitalId = identity?.hospitalIds?.size === 1 ? [...identity.hospitalIds][0] : hospital.id;
      const inferredDepartment = identity?.departments?.size === 1 ? [...identity.departments][0] : department.canonicalName || text(raw.department);
      const inferredDepartmentId = identity?.departmentIds?.size === 1 ? [...identity.departmentIds][0] : department.id;
      const actuals = {};
      Object.entries(months.customerSales).forEach(([month, index]) => {
        actuals[Number(month)] = numeric(cells[index]);
      });
      const latestActual = actuals[currentMonth] ?? Object.entries(actuals).sort((a, b) => Number(b[0]) - Number(a[0])).map(([, value]) => value).find(value => value !== null) ?? null;
      const reportedSalesGrade = grade(raw.reportedSalesGrade, /[ABCD]/);
      const computedSalesGrade = latestActual === null ? '' : salesGradeForBoxes(latestActual);
      const namedActuals = {
        ...actuals,
        june: actuals[6] ?? null,
        july: actuals[7] ?? null,
        august: actuals[8] ?? null,
        september: actuals[9] ?? null
      };
      const draft = {
        schemaVersion: 3,
        fiscalYear: fiscalYearForMonth(currentMonth, options),
        month: currentMonth,
        region: text(raw.region),
        area: text(raw.area),
        office: inferredOffice,
        employee: text(raw.employee),
        employeeId: text(raw.employeeId) || SalesAdapter.employeeIdentityId(raw.employee),
        hospitalId: inferredHospitalId,
        hospital: inferredHospital,
        hospitalName: inferredHospital,
        departmentId: inferredDepartmentId,
        department: inferredDepartment,
        departmentName: inferredDepartment,
        customer: text(raw.customer),
        customerName: text(raw.customer),
        ...productMetadata(stableProduct),
        product: ProductRegistry.getProduct(stableProduct)?.name || '',
        productMatchStatus: inferred.length === 1 ? 'EXACT' : stableProduct ? 'DEFAULT' : inferred.length > 1 ? 'AMBIGUOUS' : 'UNMATCHED',
        perceptionLevel: grade(raw.perceptionLevel, /R[1-4]/),
        reportedSalesGrade,
        computedSalesGrade,
        currentTargetGrade: reportedSalesGrade || computedSalesGrade,
        gradeMatchStatus: !reportedSalesGrade || !computedSalesGrade ? 'INSUFFICIENT_DATA' : reportedSalesGrade === computedSalesGrade ? 'MATCH' : 'MISMATCH',
        gradeCheck: !reportedSalesGrade || !computedSalesGrade ? 'INSUFFICIENT_DATA' : reportedSalesGrade === computedSalesGrade ? 'MATCH' : 'MISMATCH',
        actuals: namedActuals,
        currentActual: latestActual,
        nextMonthTarget: months.target[nextMonth] === undefined ? null : numeric(cells[months.target[nextMonth]]),
        academicInvestment: text(raw.academicInvestment),
        problem: text(raw.problem),
        followUp: text(raw.followUp),
        importedAt: options.importedAt || new Date().toISOString(),
        updatedAt: options.importedAt || new Date().toISOString(),
        source: `${options.sourceName || '4+3 Excel'} · ${sheetName}`,
        sourceRow: header.index + offset + 2
      };
      const customerAliases = {
        ...(options.hospitalAliases || {}),
        ...(options.departmentAliases || {}),
        ...(options.customerAliases || {})
      };
      const match = customerMatch(draft, options.customers || [], customerAliases);
      draft.customerId = match.customerId;
      draft.customerMatchStatus = match.status;
      draft.id = stableId([draft.fiscalYear, currentMonth, stableProduct || 'unresolved', key].join('|'), 'customer-plan');
      rows.push(draft);
    });
    return rows;
  }
  function pivotTotals(workbook, XLSX, sheetName) {
    const matrix = sheetMatrix(workbook, XLSX, sheetName, true);
    const totalRow = matrix.find(row => row.some(cell => /^总计$/.test(text(cell))));
    if (!totalRow) return {
      available: false,
      totals: {}
    };
    const productRow = matrix.find(row => row.some(cell => /Primary Product A|Primary Product B/.test(text(cell)))) || [];
    const metricRow = [...matrix].sort((left, right) => right.filter(cell => /月目标分解/.test(text(cell))).length - left.filter(cell => /月目标分解/.test(text(cell))).length)[0] || [];
    const totals = {};
    productRow.forEach((product, index) => {
      const stable = /Primary Product A/.test(text(product)) ? "Primary Product A" : /Primary Product B/.test(text(product)) ? "Primary Product B" : '';
      if (!stable) return;
      [index, index + 1].forEach(column => {
        const match = text(metricRow[column]).match(/(\d{1,2})月目标分解/);
        if (match) totals[`${stable}:${Number(match[1])}`] = finite(totalRow[column]);
      });
    });
    return {
      available: Object.keys(totals).length > 0,
      totals
    };
  }
  function crossCheck(records, pivot) {
    if (!pivot.available) return {
      status: 'UNAVAILABLE',
      differences: []
    };
    const detail = new Map();
    records.forEach(row => {
      [[row.month, row.currentTarget], [row.month === 12 ? 1 : row.month + 1, row.nextMonthTarget]].forEach(([month, value]) => {
        if (value === null) return;
        const key = `${row.productId}:${month}`;
        detail.set(key, finite(detail.get(key)) + value);
      });
    });
    const differences = Object.entries(pivot.totals).map(([key, pivotValue]) => ({
      key,
      detailValue: finite(detail.get(key)),
      pivotValue,
      difference: finite(detail.get(key)) - pivotValue
    })).filter(row => Math.abs(row.difference) > 0.001);
    return {
      status: differences.length ? 'MISMATCH' : 'MATCH',
      differences,
      compared: Object.keys(pivot.totals).length
    };
  }
  const group = (records, keys) => {
    const groups = new Map();
    records.forEach(row => {
      const key = keys.map(field => text(row[field])).join('|');
      const item = groups.get(key) || Object.fromEntries(keys.map(field => [field, row[field]]));
      item.customers = (item.customers || 0) + 1;
      item.target = finite(item.target) + finite(row.currentTarget);
      item.actual = finite(item.actual) + finite(row.currentActual);
      item.previousActual = finite(item.previousActual) + finite(row.previousActual);
      item.nextTarget = finite(item.nextTarget) + finite(row.nextMonthTarget);
      groups.set(key, item);
    });
    return [...groups.values()].map(item => ({
      ...item,
      achievementRate: item.target > 0 ? item.actual / item.target : null,
      difference: item.actual - item.target
    }));
  };
  function buildStatistics(records = [], filters = {}) {
    const filtered = records.filter(row => (!filters.fiscalYear || row.fiscalYear === Number(filters.fiscalYear)) && (!filters.month || row.month === Number(filters.month)) && (!filters.productId || filters.productId === 'all' || row.productId === filters.productId) && (!filters.office || filters.office === 'all' || row.office === filters.office) && (!filters.employee || filters.employee === 'all' || row.employee === filters.employee) && (!filters.hospital || filters.hospital === 'all' || row.hospitalName === filters.hospital) && (!filters.department || filters.department === 'all' || row.departmentName === filters.department));
    const totals = {
      employees: new Set(filtered.map(row => row.employee).filter(Boolean)).size,
      customers: new Set(filtered.map(row => row.customerId).filter(Boolean)).size,
      target: filtered.reduce((sum, row) => sum + finite(row.currentTarget), 0),
      actual: filtered.reduce((sum, row) => sum + finite(row.currentActual), 0),
      achieved: filtered.filter(row => row.achievementStatus === 'ACHIEVED').length,
      notAchieved: filtered.filter(row => row.achievementStatus === 'NOT_ACHIEVED').length,
      missing: filtered.filter(row => /MISSING/.test(row.achievementStatus)).length
    };
    totals.achievementRate = totals.target > 0 ? totals.actual / totals.target : null;
    const resources = new Map();
    const reasons = new Map();
    filtered.forEach(row => {
      const resourceTags = row.manualResourceTag ? [row.manualResourceTag] : row.resourceTags;
      const reasonTags = row.manualReasonTag ? [row.manualReasonTag] : row.reasonTags;
      resourceTags.forEach(tag => {
        const item = resources.get(tag) || {
          tag,
          records: 0,
          employees: new Set(),
          hospitals: new Set(),
          customers: new Set()
        };
        item.records += 1;
        item.employees.add(row.employee);
        item.hospitals.add(row.hospitalId);
        item.customers.add(row.customerId);
        resources.set(tag, item);
      });
      reasonTags.forEach(tag => {
        const item = reasons.get(tag) || {
          tag,
          records: 0,
          boxGap: 0,
          hospitals: new Set(),
          customers: new Set()
        };
        item.records += 1;
        item.boxGap += Math.max(0, finite(row.currentTarget) - finite(row.currentActual));
        item.hospitals.add(row.hospitalId);
        item.customers.add(row.customerId);
        reasons.set(tag, item);
      });
    });
    const serialize = map => [...map.values()].map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value instanceof Set ? value.size : value])));
    const monthly = group(filtered, ['employee', 'office']).map(row => ({
      employee: row.employee,
      office: row.office,
      previousActual: row.previousActual,
      currentTarget: row.target,
      currentActual: row.actual,
      nextMonthTarget: row.nextTarget
    }));
    return {
      filters,
      records: filtered,
      totals,
      employee: group(filtered, ['employee', 'office']),
      hospital: group(filtered, ['hospitalId', 'hospitalName']),
      department: group(filtered, ['hospitalId', 'hospitalName', 'departmentId', 'departmentName']),
      customer: group(filtered, ['customerId', 'customerName', 'hospitalName', 'departmentName']),
      monthly,
      resources: serialize(resources),
      reasons: serialize(reasons)
    };
  }
  function qualityReport(records, customerPlans, crossCheckResult, ignoredProducts, errors) {
    const keyCounts = new Map();
    records.forEach(row => keyCounts.set(row.id, (keyCounts.get(row.id) || 0) + 1));
    return {
      totalRecords: records.length + ignoredProducts.length,
      targetProductRecords: records.length,
      employees: new Set(records.map(row => row.employee).filter(Boolean)).size,
      hospitals: new Set(records.map(row => row.hospitalId).filter(Boolean)).size,
      departments: new Set(records.map(row => row.departmentId).filter(Boolean)).size,
      customers: new Set(records.map(row => row.customerId).filter(Boolean)).size,
      customerSheetRecords: customerPlans.length,
      customerProductMatched: customerPlans.filter(row => row.productMatchStatus === 'EXACT').length,
      customerProductAmbiguous: customerPlans.filter(row => row.productMatchStatus === 'AMBIGUOUS').length,
      customerProductUnmatched: customerPlans.filter(row => row.productMatchStatus === 'UNMATCHED').length,
      matchedCustomers: records.filter(row => row.customerMatchStatus === 'EXACT').length,
      probableCustomers: records.filter(row => row.customerMatchStatus === 'PROBABLE').length,
      ambiguousCustomers: records.filter(row => row.customerMatchStatus === 'AMBIGUOUS').length,
      unmatchedCustomers: records.filter(row => row.customerMatchStatus === 'UNMATCHED').length,
      targetComplete: records.filter(row => row.currentTarget !== null).length,
      actualComplete: records.filter(row => row.currentActual !== null).length,
      resourceComplete: records.filter(row => row.resourcePlan).length,
      problemComplete: records.filter(row => row.problemAnalysis).length,
      duplicates: [...keyCounts.values()].filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0),
      missingEmployees: records.filter(row => !row.employee).length,
      missingTargets: records.filter(row => row.currentTarget === null).length,
      missingActuals: records.filter(row => row.currentActual === null).length,
      ignoredProducts: ignoredProducts.length,
      errors,
      pivotCrossCheck: crossCheckResult
    };
  }
  function parseWorkbook(workbook, XLSX, options = {}) {
    const mainSheet = sheetByPattern(workbook, /^4\+3$/);
    const customerSheet = sheetByPattern(workbook, /客户管理/);
    const pivotSheet = sheetByPattern(workbook, /数据透视/);
    if (!mainSheet) throw new Error('未找到(4+3)工作表。');
    const main = parseMainSheet(workbook, XLSX, mainSheet, options);
    const customerPlans = customerSheet ? parseCustomerSheet(workbook, XLSX, customerSheet, main.records, {
      ...options,
      month: main.currentMonth,
      fiscalYear: main.fiscalYear
    }) : [];
    const pivot = pivotSheet ? pivotTotals(workbook, XLSX, pivotSheet) : {
      available: false,
      totals: {}
    };
    const checked = crossCheck(main.records, pivot);
    return {
      sheetNames: {
        main: mainSheet,
        customer: customerSheet,
        pivot: pivotSheet
      },
      records: main.records,
      customerPlans,
      rawCache: {
        sheetName: mainSheet,
        rowCount: main.rawRows.length
      },
      statistics: buildStatistics(main.records, {
        fiscalYear: main.fiscalYear,
        month: main.currentMonth,
        productId: 'all'
      }),
      quality: qualityReport(main.records, customerPlans, checked, main.ignoredProducts, main.errors),
      pivotCrossCheck: checked,
      fiscalYear: main.fiscalYear,
      month: main.currentMonth
    };
  }
  function toEmployeePlanTask(item) {
    const calendarYear = item.month >= 10 ? item.fiscalYear - 1 : item.fiscalYear;
    return {
      id: `employee-plan-${item.id}`,
      recordType: 'employeePlanRecord',
      isEmployeePlan: true,
      hiddenFromTaskList: true,
      category: '四定计划',
      planPeriod: `${calendarYear}-${String(item.month).padStart(2, '0')}-01`,
      due: `${calendarYear}-${String(item.month).padStart(2, '0')}-28`,
      fiscalYear: item.fiscalYear,
      employee: item.employee,
      office: item.office,
      product: item.productName,
      hospital: item.hospitalName,
      department: item.departmentName,
      customer: item.customerName,
      customerId: item.customerId,
      planTarget: item.currentTarget,
      plannedHospitals: item.hospitalName ? [item.hospitalName] : [],
      plannedDepartments: item.departmentName ? [item.departmentName] : [],
      planText: [item.potentialAnalysis, item.resourcePlan, item.fabe, item.problemAnalysis, item.nextAction].filter(Boolean).join('；'),
      decomposedTarget: item.currentTarget,
      customerPlanProvider: 'four-three-workbook',
      customerProfileRoute: item.customerId ? `customer:${item.customerId}` : '',
      employeePlan: item,
      createdAt: item.importedAt,
      updatedAt: item.importedAt
    };
  }
  return {
    MAIN_HEADERS,
    CUSTOMER_HEADERS,
    RESOURCE_TAGS,
    REASON_TAGS,
    achievement,
    splitProblemAndNext,
    parseWorkbook,
    parseMainSheet,
    parseCustomerSheet,
    pivotTotals,
    crossCheck,
    buildStatistics,
    qualityReport,
    toEmployeePlanTask,
    salesGradeForBoxes
  };
});
