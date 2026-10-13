(function attachActivityCenter(root, factory) {
  const api = factory(root?.SalesImportAdapter || (typeof require === 'function' ? require('./sales-import-adapter.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ActivityCenter = api;
})(typeof window !== 'undefined' ? window : globalThis, function activityCenterFactory(Sales) {
  'use strict';

  const ACTIVITY_TYPES = ['科室会', '内训会', '病例收集', '圆桌会', '片区会', '第三方赞助会', '全国会'];
  const ACTIVITY_STATUSES = ['草稿', '资料完整', '待执行', '执行中', '已完成', '已复盘', '暂停', '已取消'];
  const DEFAULT_COMPANY_EMPLOYEES = ["Synthetic Employee A", "Synthetic Employee B"];
  const UNIT_PRICE = Object.freeze({
    "Primary Product A": 17,
    "Primary Product B": 29,
    "Auxiliary Product A": 7,
    "Auxiliary Product B": 11
  });
  const PRODUCT_TOPICS = {
    "Primary Product A": "Primary Product A\u7684\u4E34\u5E8A\u5E94\u7528\u75C5\u4F8B\u5206\u4EAB",
    "Primary Product B": "Primary Product B\u5728\u7BA1\u9972\u60A3\u8005\u4E2D\u7684\u4E34\u5E8A\u5E94\u7528",
    舒复派: "Auxiliary Product A\u7684\u4E34\u5E8A\u5E94\u7528",
    增稠派: "Auxiliary Product B\u7684\u4E34\u5E8A\u5E94\u7528"
  };
  function text(value) {
    return String(value ?? '').trim();
  }
  const Departments = typeof require === 'function' ? require('./department-identity.js') : window.DepartmentIdentity;
  const departmentIds = entity => Departments.idsOf(entity);
  function scopedPeople(records, context = {}) {
    if (!text(context.hospitalId)) return [];
    return (records || []).filter(person => person.active !== false && text(person.customerId) && text(person.hospitalId) === text(context.hospitalId) && (!departmentIds(context).length || Departments.sharesDepartment(person, context)));
  }
  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function fiscalExpenseDisclosure(rows) {
    const reconciled = rows.filter(row => row.markedYellow);
    const actualValue = row => Object.prototype.hasOwnProperty.call(row, 'actualExpense') ? row.actualExpense : row.actualExpenseTotal;
    const known = reconciled.filter(row => actualValue(row) != null && text(actualValue(row)) !== '' && Number.isFinite(Number(actualValue(row))));
    const incompleteReconciledRows = reconciled.length - known.length;
    const incompleteExpenseRows = rows.length - known.length;
    return {
      fyBudgetTotal: rows.length ? rows.reduce((total, row) => total + number(row.budgetTotal), 0) : null,
      knownActualExpense: known.length ? known.reduce((total, row) => total + Number(actualValue(row)), 0) : null,
      reconciledCount: reconciled.length,
      incompleteReconciledRows,
      incompleteExpenseRows,
      expenseCompleteness: !rows.length ? 'DATA_INSUFFICIENT' : incompleteExpenseRows ? 'INCOMPLETE' : 'COMPLETE'
    };
  }
  function dateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function monthLabel(value) {
    const date = new Date(`${dateKey(value)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}月`;
  }
  function nextMonthLabel(value) {
    const date = new Date(`${dateKey(value)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    return `${date.getMonth() + 1}月`;
  }
  function fiscalYearForDate(value) {
    const date = new Date(`${dateKey(value)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return new Date().getFullYear();
    return date.getMonth() + 1 >= 10 ? date.getFullYear() + 1 : date.getFullYear();
  }
  function fiscalRange(value) {
    const end = dateKey(value) || dateKey();
    const fiscalYear = fiscalYearForDate(end);
    return {
      fiscalYear,
      from: `${fiscalYear - 1}-10-01`,
      to: end
    };
  }
  function previousMonthKey(value) {
    const date = new Date(`${dateKey(value)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    date.setMonth(date.getMonth() - 1);
    return dateKey(date).slice(0, 7);
  }
  function comparable(value) {
    return text(value).toLowerCase().replace(/[〇零]/g, '0').replace(/一/g, '1').replace(/二/g, '2').replace(/三/g, '3').replace(/四/g, '4').replace(/五/g, '5').replace(/六/g, '6').replace(/七/g, '7').replace(/八/g, '8').replace(/九/g, '9').replace(/第(?=\d)/g, '').replace(/[\s·•・,，.。()（）\-_/\\]/g, '');
  }
  function sameDimension(left, right) {
    const a = comparable(left);
    const b = comparable(right);
    return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
  }
  function hospitalMatches(activity, row) {
    if (text(activity.hospitalId) && text(row.hospitalId)) return text(activity.hospitalId) === text(row.hospitalId);
    const activityCode = text(activity.hospitalCode);
    const rowCode = text(row.hospitalCode || row.code);
    return activityCode && rowCode ? activityCode === rowCode : Boolean(comparable(activity.hospital) && comparable(activity.hospital) === comparable(row.hospital));
  }
  function salesHospitalMatches(activity, row, ledgerRows = []) {
    return Sales.isReliableHospitalRecord(row) && Sales.hospitalIdentityMatches(activity, row);
  }
  function productMatches(activity, row) {
    const id = Sales.stableProductId(activity.productId || activity.product);
    return Boolean(id && id === Sales.stableProductId(row.productId || row.rawProductName || row.product));
  }
  function departmentMatches(activity, row) {
    if (departmentIds(activity).length && departmentIds(row).length) return Departments.sharesDepartment(activity, row);
    return Boolean(comparable(activity.department) && comparable(activity.department) === comparable(row.department || row.departmentRoom));
  }
  function sum(rows, key) {
    return rows.reduce((total, row) => total + number(row[key]), 0);
  }
  function projectEmployeePlans(plans = [], people = [], registry = []) {
    const Departments = typeof require === 'function' ? require('./department-identity.js') : window.DepartmentIdentity;
    const resolver = Departments.createResolver(registry);
    return plans.map(plan => {
      const department = resolver.match(plan.departmentName || plan.departmentRaw || '', {
        hospitalId: plan.hospitalId,
        departmentId: plan.departmentId
      });
      const customerCandidates = people.filter(person => person.active !== false && person.hospitalId === plan.hospitalId && (!plan.sourceDimensions?.department || Departments.sharesDepartment(person, {
        departmentId: department.id
      })) && text(person.customerName) === text(plan.customerName));
      const explicit = customerCandidates.find(person => person.customerId === plan.customerId);
      const customer = explicit || (customerCandidates.length === 1 ? customerCandidates[0] : null);
      const customerMatchStatus = customer ? 'EXACT' : customerCandidates.length > 1 ? 'AMBIGUOUS' : 'UNMATCHED';
      return {
        ...plan,
        employeeId: text(plan.employeeId) || Sales.employeeIdentityId(plan.employee),
        departmentId: department.id,
        departmentMatchingQuality: department.matchingQuality,
        customerId: customer?.customerId || '',
        customerMatchStatus,
        customerBindingProvenance: customer ? {
          source: 'CUSTOMER_MASTER',
          evidence: 'EXACT_NAME_HOSPITAL_DEPARTMENT',
          customerId: customer.customerId
        } : null
      };
    });
  }
  function resolveActivityPlan(activity, plans = []) {
    const applicationDate = text(activity.applicationDate) ? dateKey(activity.applicationDate) : '';
    const planPeriod = applicationDate ? `${applicationDate.slice(0, 7)}-01` : null;
    const missing = reason => ({
      targetSales: null,
      planPeriod,
      reason,
      provenance: []
    });
    if (!plans.length) return missing('NOT_IMPORTED');
    if (!planPeriod) return missing('SOURCE_NOT_AVAILABLE');
    const productId = Sales.stableProductId(activity.productId || activity.product);
    if (!text(activity.employeeId) || !text(activity.hospitalId) || !productId) return missing('NOT_LINKED');
    const hasDimension = (plan, dimension) => plan.sourceDimensions ? Boolean(plan.sourceDimensions[dimension]) : Boolean(text(plan[`${dimension}Raw`] || plan[`${dimension}Name`]));
    const matches = plans.filter(plan => (!text(activity.planRecordId) || text(plan.id) === text(activity.planRecordId)) && text(plan.employeeId) === text(activity.employeeId) && text(plan.hospitalId) === text(activity.hospitalId) && Sales.stableProductId(plan.productId) === productId && !['AMBIGUOUS', 'PROBABLE', 'UNMATCHED'].includes(plan.hospitalMatchStatus) && (!hasDimension(plan, 'department') || Departments.sharesDepartment(activity, plan)) && (!hasDimension(plan, 'customer') || !['AMBIGUOUS', 'PROBABLE', 'UNMATCHED'].includes(plan.customerMatchStatus) && text(activity.customerId) && text(plan.customerId) === text(activity.customerId)));
    const candidates = matches.flatMap(plan => {
      const legacyMonth = Number(plan.month),
        legacyFiscalYear = Number(plan.fiscalYear);
      const legacyPeriod = legacyFiscalYear && legacyMonth >= 1 && legacyMonth <= 12 ? `${legacyMonth >= 10 ? legacyFiscalYear - 1 : legacyFiscalYear}-${String(legacyMonth).padStart(2, '0')}-01` : '';
      const targets = plan.planTargets || (plan.planPeriod || legacyPeriod ? [{
        planPeriod: plan.planPeriod || legacyPeriod,
        target: plan.currentTarget,
        source: plan.source,
        sourceRow: plan.sourceRow
      }] : []);
      return targets.filter(target => target.planPeriod === planPeriod).map(target => ({
        plan,
        target
      }));
    });
    if (!candidates.length) return missing(matches.length ? 'SOURCE_NOT_AVAILABLE' : 'NOT_LINKED');
    if (candidates.length > 1) return missing('MATCHING_AMBIGUOUS');
    const {
      plan,
      target
    } = candidates[0];
    if (target.target === null || target.target === undefined || text(target.target) === '' || !Number.isFinite(Number(target.target))) return missing('SOURCE_NOT_AVAILABLE');
    return {
      targetSales: Number(target.target),
      planPeriod,
      reason: null,
      provenance: [{
        planRecordId: plan.id,
        source: target.source || plan.source,
        sourceRow: target.sourceRow || plan.sourceRow,
        sourceColumn: target.sourceColumn,
        planPeriod
      }]
    };
  }
  function bindDerivedInputs(records, ledgerRows, hospitals) {
    if (!hospitals.length) return {
      boundRecords: records,
      boundLedgerRows: ledgerRows
    };
    const binder = typeof require === 'function' ? require('./hospital-maintenance-adapter.js') : window.HospitalMaintenanceAdapter;
    const boundLedgerRows = binder.bindHospitalRecords(ledgerRows, hospitals);
    const legacyRecords = records.filter(row => !text(row.hospitalId));
    if (!legacyRecords.length) return {
      boundRecords: records,
      boundLedgerRows
    };
    const boundLegacy = binder.bindHospitalRecords(legacyRecords, hospitals);
    const bindings = new Map(legacyRecords.map((row, index) => [row, boundLegacy[index]]));
    return {
      boundRecords: records.map(row => bindings.get(row) || row),
      boundLedgerRows
    };
  }
  function createDerivedRenderContext(records = [], ledgerRows = [], hospitals = [], plans = []) {
    let boundData = null;
    const byId = new Map(),
      byObject = new WeakMap();
    return Object.freeze({
      calculate(activity) {
        const key = text(activity.id) || activity;
        const cached = byId.get(key);
        if (cached?.activity === activity) return cached.value;
        if (byObject.has(activity)) return byObject.get(activity);
        if (!boundData && (dateKey(text(activity.applicationDate)) || dateKey(text(activity.activityDate)))) {
          boundData = bindDerivedInputs(records, ledgerRows, hospitals);
          boundData.personalRecords = Sales.personalSalesRecords(boundData.boundRecords);
          boundData.availableMonths = new Set(boundData.personalRecords.filter(Sales.isReliableHospitalRecord).map(row => text(row.date).slice(0, 7)));
          boundData.byHospital = new Map();
          boundData.personalRecords.forEach((row, index) => {
            const id = text(row.hospitalId);
            if (!boundData.byHospital.has(id)) boundData.byHospital.set(id, []);
            boundData.byHospital.get(id).push({
              row,
              index
            });
            const code = text(row.purchaseUnitId || row.hospitalCode);
            if (code) {
              const codeKey = 'code:' + code;
              if (!boundData.byHospital.has(codeKey)) boundData.byHospital.set(codeKey, []);
              boundData.byHospital.get(codeKey).push({
                row,
                index
              });
            }
          });
        }
        const scopedRecords = boundData ? [...new Set([text(activity.hospitalId), ...(activity.salesHospitalIds || []).map(text), ...[activity.purchaseUnitId, activity.hospitalCode].filter(Boolean).map(code => 'code:' + text(code))].filter(Boolean))].flatMap(id => boundData.byHospital.get(id) || []).sort((a, b) => a.index - b.index).map(item => item.row).filter((row, index, rows) => rows.indexOf(row) === index) : records;
        const value = calculateDerived(activity, scopedRecords, boundData?.boundLedgerRows || ledgerRows, hospitals, Boolean(boundData), Boolean(boundData), boundData?.availableMonths, plans);
        byId.set(key, {
          activity,
          value
        });
        byObject.set(activity, value);
        return value;
      }
    });
  }
  function hospitalAcademicConsumption(entity, ledgerRows = [], referenceDate = dateKey()) {
    const fiscalYear = fiscalYearForDate(referenceDate);
    const range = {
      fiscalYear,
      from: `${fiscalYear - 1}-10-01`,
      to: `${fiscalYear}-09-30`
    };
    const rows = ledgerRows.filter(row => {
      const date = text(row.activityDate || row.applicationDate).slice(0, 10);
      return Sales.hospitalIdentityMatches(entity, row) && Sales.isReliableHospitalRecord({
        ...row,
        hospitalId: row.hospitalId || entity.hospitalId
      }) && (Number(row.fiscalYear) === fiscalYear || !row.fiscalYear && date && date >= range.from && date <= range.to) && (!date || date >= range.from && date <= range.to);
    });
    const actual = row => Object.prototype.hasOwnProperty.call(row, 'actualExpense') ? row.actualExpense : row.actualExpenseTotal;
    const known = rows.filter(row => actual(row) != null && text(actual(row)) !== '' && Number.isFinite(Number(actual(row))));
    const reconciled = rows.filter(row => row.reconciled === true || row.markedYellow === true || known.includes(row));
    return {
      rows,
      known,
      reconciled,
      unknown: rows.length - known.length,
      amount: known.length ? known.reduce((sum, row) => sum + Number(actual(row)), 0) : null,
      provenance: {
        source: 'AcademicActivity / Activity Ledger',
        hospitalId: text(entity.hospitalId),
        fiscalYear,
        period: range,
        matchingQuality: rows.length ? 'EXACT_HOSPITAL_ID_OR_CODE' : 'SOURCE_NOT_AVAILABLE',
        amountField: 'ACTUAL_REIMBURSEMENT_ONLY',
        includedActivities: rows.map(row => ({
          id: row.id,
          sourceFile: row.sourceFile,
          sourceSheet: row.sourceSheet,
          sourceRow: row.sourceRow,
          activityDate: row.activityDate,
          actualAmount: actual(row) ?? null
        }))
      }
    };
  }
  function calculateDerived(activity, records = [], ledgerRows = [], hospitals = [], bindingResolved = false, personalRecordsPrepared = false, preparedAvailableMonths = null, plans = []) {
    const activityPlan = resolveActivityPlan(activity, plans);
    if (!dateKey(text(activity.applicationDate)) && !dateKey(text(activity.activityDate))) {
      return {
        activityDate: '',
        meetingMonth: '',
        targetMonth: '',
        currentSales: null,
        monthlySales: null,
        recentMonthlyAverage: null,
        salesScope: 'UNSET',
        averageWindow: null,
        targetSales: null,
        planPeriod: activityPlan.planPeriod,
        targetSalesReason: activityPlan.reason,
        planProvenance: activityPlan.provenance,
        fiscalYear: null,
        currentFiscalBoxes: null,
        currentFiscalSalesAmount: null,
        priorFiscalSalesAmount: null,
        actualReimbursementTotal: null,
        yoy: null,
        costEfficiency: null,
        assistanceSalesAmount: null,
        assistanceSource: null,
        personalSalesEligible: false,
        costEfficiencyStatus: 'DATA_INSUFFICIENT',
        bindingCompleteness: 'PENDING_CONFIRMATION',
        fiscalExpenseTotal: null,
        fyBudgetTotal: null,
        historyActivityCount: 0,
        reconciledCount: 0,
        incompleteReconciledRows: 0,
        incompleteExpenseRows: 0,
        actualExpenseCompleteness: 'DATA_INSUFFICIENT',
        expenseBasis: 'KNOWN_ACTUAL',
        costEfficiencyCompleteness: 'DATA_INSUFFICIENT',
        budgetTotal: number(activity.budgetMeal) + number(activity.budgetGift) + number(activity.budgetSpeaker),
        provenance: {
          currentSalesRecordIds: [],
          monthlySalesRecordIds: [],
          averageSalesRecordIds: [],
          fiscalSalesRecordIds: [],
          priorSalesRecordIds: [],
          expenseRecordIds: [],
          incompleteExpenseRecordIds: [],
          hospitalId: text(activity.hospitalId),
          departmentId: text(activity.departmentId),
          product: text(activity.product),
          salesScope: 'UNSET',
          fiscalSalesScope: 'HOSPITAL_PRODUCT',
          sourceRuntime: 'SALES_RUNTIME',
          fiscalRange: null
        }
      };
    }
    if (hospitals.length && !bindingResolved) {
      const bound = bindDerivedInputs(records, ledgerRows, hospitals);
      records = bound.boundRecords;
      ledgerRows = bound.boundLedgerRows;
    }
    if (!personalRecordsPrepared) records = Sales.personalSalesRecords(records);
    const activityDate = dateKey(text(activity.activityDate));
    const fiscal = Sales.activityFiscalWindow(activity.applicationDate || activityDate);
    const hospitalRows = records.filter(row => salesHospitalMatches(activity, row, ledgerRows) && productMatches(activity, row));
    const departmentRows = hospitalRows.filter(row => departmentMatches(activity, row));
    const salesScope = departmentRows.length ? 'DEPARTMENT' : 'HOSPITAL';
    const scopedRows = departmentRows.length ? departmentRows : hospitalRows;
    const explicitObservationMonth = text(activity.observationPeriod?.month || activity.observationPeriod?.from).slice(0, 7);
    const observation = Sales.salesObservation(scopedRows, {
      month: explicitObservationMonth
    });
    const month = observation.observationMonth;
    const monthlyRows = observation.monthlyRows,
      averageRows = observation.averageRows;
    const currentSalesRows = salesScope === 'DEPARTMENT' ? monthlyRows : [];
    const currentSales = currentSalesRows.length ? observation.monthlySales : null;
    const observationDate = month ? month + '-' + String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0') : fiscal.to;
    const fiscalSales = Sales.activityFiscalSales(activity, records, {
      preparedPersonalRecords: personalRecordsPrepared,
      observationDate
    });
    const product = (typeof require === 'function' ? require('./product-registry.js') : window.ProductRegistry).getProduct(activity.productId || activity.product);
    const assistance = (typeof require === 'function' ? require('./product-registry.js') : window.ProductRegistry).assistanceDenominator(activity.assistanceSalesDenominator, {
      hospitalId: text(activity.hospitalId),
      productId: product?.id,
      from: fiscal.from,
      to: fiscal.to
    });
    const fiscalRows = month ? fiscalSales.currentRows : [];
    const priorRows = month ? fiscalSales.priorRows : [];
    const amountValue = row => row.salesAmount ?? row.netAmount;
    const hasAmount = row => amountValue(row) !== '' && amountValue(row) != null && Number.isFinite(Number(amountValue(row)));
    const fiscalAmountRows = fiscalRows.filter(hasAmount);
    const priorAmountRows = priorRows.filter(hasAmount);
    const amountTotal = rows => rows.length ? rows.reduce((total, row) => total + Number(amountValue(row)), 0) : null;
    const currentFiscalSalesAmount = amountTotal(fiscalAmountRows);
    const priorFiscalSalesAmount = amountTotal(priorAmountRows);
    const currentFiscalBoxes = product?.role === 'AUXILIARY' || !fiscalRows.length ? null : sum(fiscalRows, 'orderBoxes');
    const priorFiscalBoxes = sum(priorRows, 'orderBoxes');
    const academic = hospitalAcademicConsumption(activity, ledgerRows, activity.applicationDate || activityDate);
    const historyRows = academic.rows,
      knownRows = academic.known;
    const reconciledRows = academic.reconciled;
    const incompleteReconciledRows = reconciledRows.length - knownRows.length;
    const fiscalExpenseTotal = academic.amount;
    const incompleteExpenseRows = academic.unknown;
    const actualExpenseCompleteness = !historyRows.length ? 'DATA_INSUFFICIENT' : incompleteExpenseRows ? 'INCOMPLETE' : 'COMPLETE';
    const budgetTotal = number(activity.budgetMeal) + number(activity.budgetGift) + number(activity.budgetSpeaker);
    return {
      activityDate,
      meetingMonth: monthLabel(activityDate),
      targetMonth: activityPlan.planPeriod ? monthLabel(activityPlan.planPeriod) : '',
      currentSales,
      monthlySales: observation.monthlySales,
      recentMonthlyAverage: observation.recentMonthlyAverage,
      observationMonth: month,
      salesScope,
      averageWindow: {
        from: observation.averageMonths.at(-1) || null,
        to: month,
        months: observation.averageMonths.length,
        effectiveMonths: observation.averageMonths
      },
      targetSales: activityPlan.targetSales,
      planPeriod: activityPlan.planPeriod,
      targetSalesReason: activityPlan.reason,
      planProvenance: activityPlan.provenance,
      fiscalYear: fiscal.fiscalYear,
      currentFiscalBoxes,
      currentFiscalSalesAmount,
      priorFiscalSalesAmount,
      actualReimbursementTotal: fiscalExpenseTotal,
      yoy: priorFiscalSalesAmount > 0 && currentFiscalSalesAmount !== null ? (currentFiscalSalesAmount - priorFiscalSalesAmount) / priorFiscalSalesAmount : null,
      costEfficiency: fiscalExpenseTotal !== null && (assistance?.amount || currentFiscalSalesAmount) > 0 ? fiscalExpenseTotal / (assistance?.amount || currentFiscalSalesAmount) : null,
      assistanceSalesAmount: assistance?.amount ?? null,
      assistanceSource: assistance,
      personalSalesEligible: product?.role === 'PRIMARY',
      costEfficiencyStatus: product?.role === 'AUXILIARY' ? assistance && fiscalExpenseTotal !== null ? 'ASSISTANCE' : 'DATA_INSUFFICIENT' : fiscalExpenseTotal !== null && currentFiscalSalesAmount > 0 ? 'AVAILABLE' : 'DATA_INSUFFICIENT',
      bindingCompleteness: fiscalSales.pendingRows.length || ledgerRows.some(row => text(row.hospitalId) === text(activity.hospitalId) && Number(row.fiscalYear) === fiscal.fiscalYear && text(row.activityDate) >= fiscal.from && text(row.activityDate).slice(0, 10) <= fiscal.to && !Sales.isReliableHospitalRecord(row) && productMatches(activity, row)) ? 'PENDING_CONFIRMATION' : 'COMPLETE',
      fiscalExpenseTotal,
      fyBudgetTotal: historyRows.length ? sum(historyRows, 'budgetTotal') : null,
      historyActivityCount: historyRows.length,
      reconciledCount: reconciledRows.length,
      incompleteReconciledRows,
      incompleteExpenseRows,
      actualExpenseCompleteness,
      expenseBasis: 'KNOWN_ACTUAL',
      costEfficiencyCompleteness: actualExpenseCompleteness,
      budgetTotal,
      provenance: {
        currentSalesRecordIds: currentSalesRows.map(row => row.id).filter(Boolean),
        monthlySalesRecordIds: monthlyRows.map(row => row.id).filter(Boolean),
        averageSalesRecordIds: averageRows.map(row => row.id).filter(Boolean),
        fiscalSalesRecordIds: fiscalAmountRows.map(row => row.id).filter(Boolean),
        priorSalesRecordIds: priorAmountRows.map(row => row.id).filter(Boolean),
        expenseRecordIds: knownRows.map(row => row.id).filter(Boolean),
        incompleteExpenseRecordIds: historyRows.filter(row => !knownRows.includes(row)).map(row => row.id),
        hospitalId: text(activity.hospitalId),
        departmentId: salesScope === 'DEPARTMENT' ? text(activity.departmentId) : '',
        product: text(activity.product),
        salesScope,
        fiscalSalesScope: 'HOSPITAL_PRODUCT',
        sourceRuntime: 'SALES_RUNTIME',
        aggregationRule: 'NET_BOXES_X_PRODUCT_REGISTRY_PRICE',
        salesAmountMethod: 'NET_BOXES_X_PRODUCT_REGISTRY_PRICE',
        fiscalRange: fiscalSales.range,
        observationMonth: month,
        academic: academic.provenance
      }
    };
  }
  function excelDate(value) {
    if (value instanceof Date) return dateKey(value);
    const digits = text(value).replace(/\D/g, '');
    if (/^20\d{6}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    return '';
  }
  function monthDate(value, fiscalYear, fallback = dateKey()) {
    const match = text(value).match(/(1[0-2]|[1-9])\s*月/);
    if (!match) return fallback;
    const month = Number(match[1]);
    const year = fiscalYear ? month >= 10 ? fiscalYear - 1 : fiscalYear : Number(fallback.slice(0, 4));
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }
  function cellValue(sheet, row, column, XLSX) {
    return sheet[XLSX.utils.encode_cell({
      r: row,
      c: column
    })]?.v ?? '';
  }
  function cellFormula(sheet, row, column, XLSX) {
    return sheet[XLSX.utils.encode_cell({
      r: row,
      c: column
    })]?.f || '';
  }
  function isYellow(cell) {
    const value = cell?.s?.fgColor?.rgb || cell?.s?.fill?.fgColor?.rgb || cell?.s?.fgColor?.indexed || cell?.s?.fill?.fgColor?.indexed;
    return /^(?:FF)?FFFF00$/i.test(String(value || '')) || Number(value) === 13;
  }
  function findHeaderRow(sheet, XLSX) {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const lastRow = Math.min(range.e.r, range.s.r + 50);
    for (let row = range.s.r; row <= lastRow; row += 1) {
      const values = Array.from({
        length: range.e.c - range.s.c + 1
      }, (_, offset) => cellValue(sheet, row, range.s.c + offset, XLSX));
      if (values.some(value => text(value) === '会议时间') && values.some(value => text(value) === '医院')) return row;
    }
    return -1;
  }
  function rowHasActivity(sheet, row, base, XLSX) {
    const type = text(cellValue(sheet, row, base.type, XLSX));
    return type !== '合计' && Boolean(text(cellValue(sheet, row, base.hospital, XLSX)) || text(cellValue(sheet, row, base.product, XLSX)));
  }
  function activityFromRow(sheet, row, columns, context, XLSX) {
    const applicationDate = excelDate(cellValue(sheet, row, columns.applicationDate, XLSX));
    const activityDate = monthDate(cellValue(sheet, row, columns.meetingMonth, XLSX), context.fiscalYear, applicationDate || dateKey());
    const activity = {
      id: '',
      activityDate,
      applicationDate,
      type: text(cellValue(sheet, row, columns.type, XLSX)) || context.sheetName,
      status: '草稿',
      office: text(cellValue(sheet, row, columns.office, XLSX)),
      hospitalCode: text(cellValue(sheet, row, columns.code, XLSX)),
      hospital: text(cellValue(sheet, row, columns.hospital, XLSX)),
      hospitalLevel: text(cellValue(sheet, row, columns.level, XLSX)),
      department: text(cellValue(sheet, row, columns.department, XLSX)),
      departmentDirector: text(cellValue(sheet, row, columns.director, XLSX)),
      attendees: number(cellValue(sheet, row, columns.attendees, XLSX)),
      product: text(cellValue(sheet, row, columns.product, XLSX)),
      topic: text(cellValue(sheet, row, columns.topic, XLSX)),
      speaker: text(cellValue(sheet, row, columns.speaker, XLSX)),
      dosageForm: text(cellValue(sheet, row, columns.dosageForm, XLSX)),
      currentSales: number(cellValue(sheet, row, columns.currentSales, XLSX)),
      targetSales: number(cellValue(sheet, row, columns.targetSales, XLSX)),
      targetMonth: text(cellValue(sheet, row, columns.targetMonth, XLSX)),
      budgetPerCapita: number(cellValue(sheet, row, columns.budgetPerCapita, XLSX)),
      budgetMeal: number(cellValue(sheet, row, columns.budgetMeal, XLSX)),
      budgetGift: number(cellValue(sheet, row, columns.budgetGift, XLSX)),
      budgetSpeaker: number(cellValue(sheet, row, columns.budgetSpeaker, XLSX)),
      budgetTotal: number(cellValue(sheet, row, columns.budgetTotal, XLSX)),
      actualLocation: text(cellValue(sheet, row, columns.actualLocation, XLSX)),
      actualPerCapita: number(cellValue(sheet, row, columns.actualPerCapita, XLSX)),
      actualMeal: number(cellValue(sheet, row, columns.actualMeal, XLSX)),
      actualGift: number(cellValue(sheet, row, columns.actualGift, XLSX)),
      actualSpeaker: number(cellValue(sheet, row, columns.actualSpeaker, XLSX)),
      actualExpenseTotal: number(cellValue(sheet, row, columns.actualTotal, XLSX)),
      fiscalExpenseTotal: number(cellValue(sheet, row, columns.fiscalExpense, XLSX)),
      currentFiscalSalesAmount: number(cellValue(sheet, row, columns.fiscalSales, XLSX)),
      priorFiscalSalesAmount: number(cellValue(sheet, row, columns.priorSales, XLSX)),
      yoyFormula: cellFormula(sheet, row, columns.yoy, XLSX),
      efficiencyFormula: cellFormula(sheet, row, columns.efficiency, XLSX),
      remarks: text(cellValue(sheet, row, columns.remarks, XLSX)),
      requestNumber: text(cellValue(sheet, row, columns.requestNumber, XLSX)),
      importedAt: context.importedAt,
      sourceFile: context.fileName,
      sourceSheet: context.sheetName,
      sourceRow: row + 1
    };
    if (!activity.budgetTotal) activity.budgetTotal = activity.budgetMeal + activity.budgetGift + activity.budgetSpeaker;
    return activity;
  }
  function columnsFor(hasOffice) {
    if (hasOffice) return {
      meetingMonth: 1,
      type: 2,
      office: 3,
      code: 4,
      hospital: 5,
      level: 6,
      department: 7,
      director: 8,
      attendees: 9,
      product: 10,
      topic: 11,
      speaker: 12,
      dosageForm: 13,
      currentSales: 14,
      targetSales: 15,
      targetMonth: 16,
      budgetPerCapita: 17,
      budgetMeal: 18,
      budgetGift: 19,
      budgetSpeaker: 20,
      budgetTotal: 21,
      actualLocation: 22,
      actualPerCapita: 23,
      actualMeal: 24,
      actualGift: 25,
      actualSpeaker: 26,
      actualTotal: 27,
      fiscalExpense: 28,
      fiscalSales: 29,
      priorSales: 30,
      yoy: 31,
      efficiency: 32,
      remarks: 33,
      requestNumber: 34,
      applicationDate: 35
    };
    return {
      meetingMonth: 1,
      type: 2,
      office: -1,
      code: 3,
      hospital: 4,
      level: 5,
      department: 6,
      director: 7,
      attendees: 8,
      product: 9,
      topic: 10,
      speaker: 11,
      dosageForm: 12,
      currentSales: 13,
      targetSales: 14,
      targetMonth: 15,
      budgetPerCapita: 16,
      budgetMeal: 17,
      budgetGift: 18,
      budgetSpeaker: 19,
      budgetTotal: 20,
      actualLocation: 21,
      actualPerCapita: 22,
      actualMeal: 23,
      actualGift: 24,
      actualSpeaker: 25,
      actualTotal: 26,
      fiscalExpense: 27,
      fiscalSales: 28,
      priorSales: 29,
      yoy: 30,
      efficiency: 31,
      remarks: 32,
      requestNumber: -1,
      applicationDate: -1
    };
  }
  function parseWorkbook(workbook, XLSX, fileName = '导入文件.xlsx', now = new Date()) {
    const importedAt = now.toISOString();
    const activities = [];
    const ledgerRows = [];
    const templates = [];
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const headerRow = findHeaderRow(sheet, XLSX);
      if (headerRow < 0) return;
      const fiscalYear = /^20\d{2}$/.test(sheetName) ? Number(sheetName) : null;
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      const hasOffice = Array.from({
        length: range.e.c - range.s.c + 1
      }, (_, offset) => cellValue(sheet, headerRow, range.s.c + offset, XLSX)).some(value => text(value) === '部门');
      const columns = columnsFor(hasOffice);
      for (let row = headerRow + 2; row <= range.e.r; row += 1) {
        if (!rowHasActivity(sheet, row, columns, XLSX)) continue;
        const activity = activityFromRow(sheet, row, columns, {
          fiscalYear,
          importedAt,
          fileName,
          sheetName
        }, XLSX);
        if (!fiscalYear) activities.push(activity);
        if (fiscalYear) {
          const hospitalCell = sheet[XLSX.utils.encode_cell({
            r: row,
            c: columns.hospital
          })];
          const rowMarked = isYellow(hospitalCell) || Array.from({
            length: range.e.c + 1
          }, (_, column) => sheet[XLSX.utils.encode_cell({
            r: row,
            c: column
          })]).some(isYellow);
          ledgerRows.push({
            id: `${fileName}|${sheetName}|${row + 1}`,
            fiscalYear,
            hospitalCode: activity.hospitalCode,
            hospital: activity.hospital,
            department: activity.department,
            product: activity.product,
            activityDate: activity.activityDate,
            applicationDate: activity.applicationDate,
            budgetTotal: activity.budgetTotal,
            actualExpense: text(cellValue(sheet, row, columns.actualTotal, XLSX)) === '' ? null : Number(cellValue(sheet, row, columns.actualTotal, XLSX)),
            actualExpenseTotal: text(cellValue(sheet, row, columns.actualTotal, XLSX)) === '' ? null : Number(cellValue(sheet, row, columns.actualTotal, XLSX)),
            actualExpenseCompleteness: text(cellValue(sheet, row, columns.actualTotal, XLSX)) === '' ? 'INCOMPLETE' : 'COMPLETE',
            reconciled: rowMarked,
            requestNo: activity.requestNumber,
            activityType: activity.type,
            markedYellow: rowMarked,
            importedAt,
            sourceFile: fileName,
            sourceSheet: sheetName,
            sourceRow: row + 1
          });
        }
      }
      if (!fiscalYear && ['内训会', '科室会'].includes(sheetName)) templates.push(sheetName);
    });
    return {
      activities,
      ledgerRows,
      templates,
      importedAt,
      fileName
    };
  }
  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;'
    })[char]);
  }
  function money(value) {
    return `¥${number(value).toLocaleString('zh-CN', {
      maximumFractionDigits: 0
    })}`;
  }
  function percent(value) {
    return `${Math.round(number(value))}%`;
  }
  function statusProgress(status) {
    return {
      草稿: 10,
      资料完整: 25,
      待执行: 40,
      执行中: 65,
      已完成: 85,
      已复盘: 100,
      暂停: 45,
      已取消: 0
    }[status] ?? 10;
  }
  function base64FromArrayBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  }
  function arrayBufferFromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }
  function xmlEscape(value) {
    return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function xmlUnescape(value) {
    return text(value).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }
  function xmlAttribute(tag, name) {
    return tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i'))?.[1] || '';
  }
  function packageText(packageFile, path, XLSX) {
    const entry = XLSX.CFB.find(packageFile, path);
    if (!entry?.content) throw new Error(`模板缺少 ${path}`);
    return new TextDecoder().decode(entry.content);
  }
  function setPackageText(packageFile, path, value, XLSX) {
    XLSX.CFB.utils.cfb_add(packageFile, path, new TextEncoder().encode(value));
  }
  function worksheetPackagePath(packageFile, sheetName, XLSX) {
    const workbookXml = packageText(packageFile, '/xl/workbook.xml', XLSX);
    const sheetTag = (workbookXml.match(/<sheet\b[^>]*\/?\s*>/gi) || []).find(tag => xmlUnescape(xmlAttribute(tag, 'name')) === sheetName);
    const relationshipId = sheetTag && xmlAttribute(sheetTag, 'r:id');
    if (!relationshipId) throw new Error(`模板中没有“${sheetName}”工作表关系`);
    const relationshipsXml = packageText(packageFile, '/xl/_rels/workbook.xml.rels', XLSX);
    const relationshipTag = (relationshipsXml.match(/<Relationship\b[^>]*\/?\s*>/gi) || []).find(tag => xmlAttribute(tag, 'Id') === relationshipId);
    const target = relationshipTag && xmlAttribute(relationshipTag, 'Target');
    if (!target) throw new Error(`模板中没有“${sheetName}”工作表文件`);
    if (target.startsWith('/')) return target;
    const parts = ['xl', ...target.replace(/\\/g, '/').split('/')];
    const normalized = [];
    parts.forEach(part => {
      if (part === '..') normalized.pop();else if (part && part !== '.') normalized.push(part);
    });
    return `/${normalized.join('/')}`;
  }
  function cellPattern(address) {
    return new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*?(?:\\s*/\\s*>|>[\\s\\S]*?<\\/c>)`, 'i');
  }
  function cellStyle(cellXml) {
    const style = cellXml?.match(/\bs="([^"]*)"/i)?.[1];
    return style === undefined ? '' : ` s="${style}"`;
  }
  function patchWorksheetCell(xml, address, value, formula = '') {
    const pattern = cellPattern(address);
    const existing = xml.match(pattern)?.[0] || '';
    const attributes = existing ? existing.match(/^<c\b([^>]*?)(?:\/?>)/i)[1].replace(/\s+t="[^"]*"/gi, '').replace(/\/\s*$/, '') : ` r="${address}"`;
    let replacement = `<c${attributes}/>`;
    if (formula) replacement = `<c${attributes}${typeof value === 'number' ? '' : ' t="str"'}><f>${xmlEscape(formula)}</f>${typeof value === 'number' ? `<v>${value}</v>` : '<v></v>'}</c>`;else if (value !== '' && value !== null && value !== undefined) {
      replacement = typeof value === 'number' ? `<c${attributes}><v>${Number.isFinite(value) ? value : 0}</v></c>` : `<c${attributes} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }
    if (existing) return xml.replace(pattern, replacement);
    const rowNumber = Number(address.match(/\d+$/)?.[0]);
    const rowPattern = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(<\\/row>)`, 'i');
    if (!rowPattern.test(xml)) throw new Error(`模板缺少第 ${rowNumber} 行`);
    return xml.replace(rowPattern, `$1$2${replacement}$3`);
  }
  function enableWorkbookRecalculation(xml) {
    if (/<calcPr\b[^>]*\/?\s*>/i.test(xml)) {
      return xml.replace(/<calcPr\b([^>]*?)\s*\/?>/i, (tag, attributes) => {
        const cleaned = attributes.replace(/\/\s*$/, '').replace(/\s(?:calcMode|fullCalcOnLoad|forceFullCalc)="[^"]*"/gi, '');
        return `<calcPr${cleaned} calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`;
      });
    }
    return xml.replace('</workbook>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
  }
  function discardCalculationChain(packageFile, XLSX) {
    if (XLSX.CFB.find(packageFile, '/xl/calcChain.xml')) XLSX.CFB.utils.cfb_del(packageFile, '/xl/calcChain.xml');
    const relationshipsPath = '/xl/_rels/workbook.xml.rels';
    const relationshipsXml = packageText(packageFile, relationshipsPath, XLSX).replace(/<Relationship\b(?=[^>]*\bType="[^"]*\/calcChain")[^>]*\/?\s*>/gi, '');
    setPackageText(packageFile, relationshipsPath, relationshipsXml, XLSX);
    const contentTypesPath = '/[Content_Types].xml';
    const contentTypesXml = packageText(packageFile, contentTypesPath, XLSX).replace(/<Override\b(?=[^>]*\bPartName="\/xl\/calcChain\.xml")[^>]*\/?\s*>/gi, '');
    setPackageText(packageFile, contentTypesPath, contentTypesXml, XLSX);
  }
  function exportActivityWorkbook(template, activity, XLSX) {
    if (!template?.dataBase64) throw new Error('PUBLIC_TEMPLATE_UNAVAILABLE');
    const values = [['Field', 'Value'], ['Activity ID', activity.id || ''], ['Topic', activity.topic || ''], ['Date', activity.activityDate || ''], ['Product', activity.product || ''], ['Hospital ID', activity.hospitalId || ''], ['Hospital', activity.hospital || ''], ['Department ID', activity.departmentId || ''], ['Customer ID', activity.customerId || activity.directorCustomerId || ''], ['Approval', activity.approvalStatus || '草稿'], ['Result', activity.status || '草稿'], ['Budget', number(activity.budgetMeal)+number(activity.budgetGift)+number(activity.budgetSpeaker)], ['Actual Meal', activity.actualMeal ?? null], ['Actual Gift', activity.actualGift ?? null], ['Actual Speaker', activity.actualSpeaker ?? null], ['Notes', activity.remarks || '']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(values), 'Public Activity');
    const bytes = XLSX.write(wb, {type:'array',bookType:'xlsx'}), file = XLSX.CFB.read(new Uint8Array(bytes),{type:'array'});
    const types = packageText(file,'/[Content_Types].xml',XLSX).replace(/<(?:Default|Override)\b[^>]*macroEnabled[^>]*\/>/gi,'');
    setPackageText(file,'/[Content_Types].xml',types,XLSX);
    return XLSX.CFB.write(file,{type:'array',fileType:'zip',compression:true});
  }
  function exportExpenseNotice(derived = {}) {
    if (derived.actualExpenseCompleteness !== 'INCOMPLETE') return '';
    const count = number(derived.incompleteExpenseRows ?? derived.incompleteReconciledRows);
    return `实际核销数据未完整；已知实际核销金额：${derived.fiscalExpenseTotal == null ? '待补' : number(derived.fiscalExpenseTotal)}元；实际金额待补记录：${count}条；费效比仅基于已知实际核销金额，非完整最终费效比`;
  }
  function wordElements(xml, tag) {
    const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'g');
    const elements = [];
    let depth = 0;
    let start = -1;
    for (const token of xml.matchAll(tokens)) {
      if (token[0].startsWith('</')) {
        if (--depth === 0) elements.push({
          start,
          end: token.index + token[0].length,
          xml: xml.slice(start, token.index + token[0].length)
        });
      } else if (!token[0].endsWith('/>')) {
        if (depth++ === 0) start = token.index;
      }
    }
    if (depth !== 0) throw new Error('Word 模板 XML 结构不完整');
    return elements;
  }
  function wordText(xml) {
    return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(match => xmlUnescape(match[1])).join('');
  }
  function replaceWordText(xml, value) {
    const nodes = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
    if (!nodes.length) {
      const paragraphs = wordElements(xml, 'w:p');
      if (paragraphs.length !== 1) throw new Error('空白 Word 栏位结构不符合原模板');
      const properties = paragraphs[0].xml.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/)?.[0].match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] || '';
      return xml.replace('</w:p>', `<w:r>${properties}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r></w:p>`);
    }
    let offset = 0;
    let index = 0;
    return xml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_, open, original, close) => {
      const length = ++index === nodes.length ? value.length - offset : Math.min(xmlUnescape(original).length, value.length - offset);
      const next = value.slice(offset, offset + Math.max(0, length));
      offset += Math.max(0, length);
      return open + xmlEscape(next) + close;
    });
  }
  function patchWordSlot(xml, tableIndex, rowIndex, cellIndex, paragraphIndex, value, expected) {
    const tags = ['w:tbl', 'w:tr', 'w:tc', 'w:p'];
    const indexes = [tableIndex, rowIndex, cellIndex, paragraphIndex];
    function patch(fragment, level) {
      const element = wordElements(fragment, tags[level])[indexes[level]];
      if (!element) throw new Error('原 Word 模板栏位缺失，停止导出');
      let replacement;
      if (level === 3) {
        if (expected && !expected.test(wordText(element.xml))) throw new Error('原 Word 模板栏位不匹配，停止导出');
        replacement = replaceWordText(element.xml, value);
      } else replacement = patch(element.xml, level + 1);
      return fragment.slice(0, element.start) + replacement + fragment.slice(element.end);
    }
    return patch(xml, 0);
  }
  function exportActivityWord(template, activity, XLSX) {
    if (!template?.dataBase64) throw new Error('PUBLIC_TEMPLATE_UNAVAILABLE');
    const file = XLSX.CFB.read(new Uint8Array(arrayBufferFromBase64(template.dataBase64)),{type:'array'});
    const fields = [['Activity ID',activity.id||''],['Topic',activity.topic||''],['Date',activity.activityDate||''],['Product',activity.product||''],['Hospital ID',activity.hospitalId||''],['Hospital',activity.hospital||''],['Department ID',activity.departmentId||''],['Customer ID',activity.customerId||activity.directorCustomerId||''],['Result',activity.status||'草稿'],['Budget',number(activity.budgetMeal)+number(activity.budgetGift)+number(activity.budgetSpeaker)],['Actual Meal',activity.actualMeal??'Unknown'],['Actual Gift',activity.actualGift??'Unknown'],['Actual Speaker',activity.actualSpeaker??'Unknown'],['Notes',activity.remarks||'']];
    const rows = fields.map(([label,value])=>'<w:tr><w:tc><w:p><w:r><w:t>'+xmlEscape(label)+'</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>'+xmlEscape(String(value))+'</w:t></w:r></w:p></w:tc></w:tr>').join('');
    const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Public Synthetic Activity</w:t></w:r></w:p><w:tbl>'+rows+'</w:tbl><w:sectPr/></w:body></w:document>';
    setPackageText(file,'/word/document.xml',xml,XLSX);
    return XLSX.CFB.write(file,{type:'array',fileType:'zip',compression:true});
  }
  function init(host) {
    const {
      state,
      persist,
      persistActivityState,
      directoryRecords,
      showToast,
      uid,
      getProductOptions = () => [],
      syncWheelTriggers = () => {},
      syncActivityTasks = () => {},
      syncAllActivityTasks = () => {},
      navigationCoordinator = null,
      onOpenCustomerContext = () => false,
      onOpenHospitalContext = () => false,
      onOpenSalesContext = () => false,
      onOpenTaskContext = () => false,
      onViewSales = () => {},
      onTimeContextChange = () => {},
      getHospitalDirectory: resolveHospitalDirectory = () => [],
      getCustomerEntities = () => [],
      ensureActivityPerson = () => null
    } = host;
    let draftUI = null, editorSeed = {}, formalSavePromise = null;
    let renderHospitalDirectory = null;
    let editorHospitalDirectory = null;
    let renderDerivedContext = null;
    let editorDepartmentCache = null;
    function getEmployeePlans() {
      return projectEmployeePlans(state.employeePlanRecords || [], getCustomerEntities(), state.settings?.departmentIdentityRegistry || []);
    }
    function getHospitalDirectory() {
      return renderHospitalDirectory || editorHospitalDirectory || resolveHospitalDirectory();
    }
    function renderDerived(activity) {
      return renderDerivedContext ? renderDerivedContext.calculate(activity) : calculateDerived(activity, state.records, state.activityLedgerEntries, getHospitalDirectory(), false, false, null, getEmployeePlans());
    }
    const APPROVAL_STATUSES = ['草稿', '已提交', '审批中', '已通过', '已取消'];
    const MOBILE_TYPE_ORDER = ['内训会', '科室会', '病例收集', '圆桌会', '片区会', '第三方赞助会', '全国会'];
    const LEGACY_STATUS_GROUP = {
      草稿: '草稿',
      资料完整: '已提交',
      已提交: '已提交',
      待执行: '审批中',
      执行中: '审批中',
      审批中: '审批中',
      已完成: '已通过',
      已复盘: '已通过',
      已通过: '已通过',
      暂停: '已取消',
      已取消: '已取消'
    };
    const initialDate = dateKey();
    const filters = {
      year: Number(initialDate.slice(0, 4)),
      month: Number(initialDate.slice(5, 7)),
      date: '',
      explicitDate: false,
      type: 'all',
      approval: 'all',
      product: 'all',
      query: ''
    };
    let moduleActive = false;
    const selectedActivityIds = new Set();
    let embeddedTemplates = null;
    let templateLoad = null;
    const pendingDocumentSaves = new Map();
    function onAndroidSaveResult(id, result) {
      const pending = pendingDocumentSaves.get(id);
      if (!pending) return;
      pendingDocumentSaves.delete(id);
      clearTimeout(pending.timer);
      if (result?.ok === true) pending.resolve(result);else pending.reject(new Error(result?.error || '申请文件尚未保存'));
    }
    async function saveApplicationPackage(content, filename, mime) {
      const bridge = window.AndroidBridge;
      if (!bridge) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([content], {
          type: mime
        }));
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        return;
      }
      if (!bridge.beginActivityDocumentTransfer || !bridge.appendActivityDocumentChunk || !bridge.finishActivityDocumentTransfer) throw new Error('当前 Android 版本不支持申请文件保存，请更新应用');
      const id = 'activity_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      const data = base64FromArrayBuffer(content);
      const complete = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingDocumentSaves.delete(id);
          bridge.cancelActivityDocumentTransfer?.(id);
          reject(new Error('申请文件保存超时，请重新生成并选择本地目录'));
        }, 120000);
        pendingDocumentSaves.set(id, {
          resolve,
          reject,
          timer
        });
      });
      complete.catch(() => {});
      try {
        const cleanName = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
        let error = await bridge.beginActivityDocumentTransfer(id, cleanName, data.length);
        if (error) throw new Error(error);
        for (let offset = 0, index = 0; offset < data.length; offset += 65536, index += 1) {
          error = await bridge.appendActivityDocumentChunk(id, index, data.slice(offset, offset + 65536));
          if (error) throw new Error(error);
        }
        error = await bridge.finishActivityDocumentTransfer(id);
        if (error) throw new Error(error);
        await complete;
      } catch (error) {
        const pending = pendingDocumentSaves.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingDocumentSaves.delete(id);
        }
        bridge.cancelActivityDocumentTransfer?.(id);
        throw error;
      }
    }
    const templateMaintenance = host.templateMaintenance === true;
    async function ensureEmbeddedTemplates() {
      if (embeddedTemplates) return embeddedTemplates;
      if (!templateLoad) {
        templateLoad = window.ActivityTemplateAssets.load().then(templates => {
          embeddedTemplates = templates;
          return templates;
        }).catch(error => {
          templateLoad = null;
          throw error;
        });
      }
      return templateLoad;
    }
    let currentSection = 'list';
    let returnSection = 'list';
    let editorCloseLocally = false;
    let importPreview = null;
    let pullStartY = null;
    const byId = id => document.getElementById(id);
    const el = {
      view: byId('activityView'),
      pageTitle: byId('activityPageTitle'),
      yearFilter: byId('activityYearFilter'),
      monthFilter: byId('activityMonthFilter'),
      dateFilter: byId('activityDateFilter'),
      currentMonthButton: byId('activityCurrentMonthButton'),
      dateToken: byId('activityDateToken'),
      typeFilter: byId('activityTypeFilter'),
      statusFilter: byId('activityStatusFilter'),
      productFilter: byId('activityProductFilter'),
      search: byId('activitySearch'),
      resetFilters: byId('resetActivityFilters'),
      typeChips: byId('activityTypeChips'),
      statusChips: byId('activityStatusChips'),
      kpis: byId('activityKpis'),
      list: byId('activityList'),
      tableRows: byId('activityTableRows'),
      count: byId('activityCount'),
      empty: byId('activityEmpty'),
      pullIndicator: byId('activityPullIndicator'),
      expenseKpis: byId('activityExpenseKpis'),
      expenseCharts: byId('activityExpenseCharts'),
      expenseCount: byId('activityExpenseCount'),
      expenseEmpty: byId('activityExpenseEmpty'),
      expenseDetails: byId('activityExpenseDetails'),
      expenseSource: byId('activityExpenseSourceNote'),
      typeExpenseChart: byId('activityTypeExpenseChart'),
      monthlyExpenseChart: byId('activityMonthlyExpenseChart'),
      typeCountChart: byId('activityTypeCountChart'),
      budgetActualChart: byId('activityBudgetActualChart'),
      importSummary: byId('activityImportSummary'),
      importHistory: byId('activityImportHistory'),
      newButton: byId('newActivityButton'),
      mobileNewButton: byId('newActivityMobileButton'),
      importButton: byId('importActivityButton'),
      ledgerButton: byId('importActivityLedgerButton'),
      file: byId('activityFileInput'),
      ledgerFile: byId('activityLedgerInput'),
      dialog: byId('activityDialog'),
      form: byId('activityForm'),
      title: byId('activityDialogTitle'),
      validation: byId('activityValidationMessage'),
      deleteButton: byId('deleteActivityButton'),
      exportButton: byId('exportActivityButton'),
      templateNotice: byId('activityTemplateNotice'),
      importDialog: byId('activityImportDialog'),
      importStatus: byId('activityImportStatus'),
      importRows: byId('activityImportRows'),
      confirmImport: byId('confirmActivityImport'),
      staffInput: byId('companyEmployeeInput'),
      addStaff: byId('addCompanyEmployee'),
      staffList: byId('companyEmployeeList'),
      hospitalList: byId('activityHospitalOptions'),
      customerList: byId('activityCustomerOptions')
    };
    if (!el.view) return {
      render() {},
      enter() {},
      leave() {}
    };
    [el.importButton, ...el.view.querySelectorAll('[data-trigger-activity-import="application"]')].forEach(button => {
      if (button) button.hidden = !templateMaintenance;
    });
    function ensureActivityState() {
      state.activities = Array.isArray(state.activities) ? state.activities : [];
      state.activityLedgerEntries = Array.isArray(state.activityLedgerEntries) ? state.activityLedgerEntries : [];
      state.settings = state.settings || {};
      state.settings.activityImportHistory = Array.isArray(state.settings.activityImportHistory) ? state.settings.activityImportHistory : [];
      const employees = Array.isArray(state.settings.companyEmployees) ? state.settings.companyEmployees : [];
      state.settings.companyEmployees = [...new Set([...employees, ...DEFAULT_COMPANY_EMPLOYEES])];
    }
    ensureActivityState();
    function displayStatus(activity) {
      if (activity.archivedAt || activity.voidedAt || [activity.approvalStatus, activity.status].some(status => ['已取消', '已作废', 'cancelled', 'canceled', 'voided', 'archived'].includes(text(status)))) return '已取消';
      return text(activity.approvalStatus) || LEGACY_STATUS_GROUP[text(activity.status)] || '未设置';
    }
    function statusClass(activity) {
      const value = typeof activity === 'string' ? activity : displayStatus(activity);
      return {
        草稿: 'draft',
        已提交: 'submitted',
        审批中: 'approving',
        已通过: 'approved',
        已取消: 'cancelled'
      }[value] || 'unset';
    }
    function configuredProducts() {
      const rows = [...(state.records || []), ...state.activityLedgerEntries, ...state.activities];
      const values = rows.flatMap(row => String(row.product || '').split(/[、,，/]/)).map(text).filter(Boolean);
      return [...new Set([...getProductOptions(), ...values, ...Object.keys(PRODUCT_TOPICS)])].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    }
    function monthText(key) {
      const [year, month] = String(key || '').split('-');
      return year && month ? year + '年' + Number(month) + '月' : '全部月份';
    }
    function scopeMonth() {
      return filters.year + '-' + String(filters.month).padStart(2, '0');
    }
    function availableYears() {
      return [...new Set([Number(initialDate.slice(0, 4)), ...state.activities.map(item => Number(text(item.activityDate).slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a);
    }
    function setOptions(select, options, allLabel, selected) {
      if (!select) return;
      select.innerHTML = '<option value="all">' + allLabel + '</option>' + options.map(value => '<option value="' + escapeHtml(value) + '">' + escapeHtml(/^\d{4}-\d{2}$/.test(value) ? monthText(value) : value) + '</option>').join('');
      select.value = options.includes(selected) ? selected : 'all';
    }
    function renderFilterControls() {
      const years = availableYears();
      el.yearFilter.innerHTML = years.map(year => '<option value="' + year + '">' + year + '年</option>').join('');
      el.yearFilter.value = String(filters.year);
      el.monthFilter.innerHTML = Array.from({
        length: 12
      }, (_, index) => index + 1).map(month => '<option value="' + month + '">' + month + '月</option>').join('');
      el.monthFilter.value = String(filters.month);
      const maximumDay = new Date(filters.year, filters.month, 0).getDate();
      el.dateFilter.min = scopeMonth() + '-01';
      el.dateFilter.max = scopeMonth() + '-' + String(maximumDay).padStart(2, '0');
      el.dateFilter.value = filters.date;
      el.dateToken.hidden = !filters.date;
      el.dateToken.textContent = filters.date ? '仅看 ' + Number(filters.date.slice(5, 7)) + '月' + Number(filters.date.slice(8, 10)) + '日 ×' : '';
      setOptions(el.typeFilter, ACTIVITY_TYPES, '全部类型', filters.type);
      setOptions(el.statusFilter, APPROVAL_STATUSES, '全部状态', filters.approval);
      setOptions(el.productFilter, configuredProducts(), '全部产品', filters.product);
      el.search.value = filters.query;
      el.typeChips.innerHTML = '<button type="button" data-activity-type-chip="all" aria-pressed="' + (filters.type === 'all') + '">全部</button>' + MOBILE_TYPE_ORDER.map(value => '<button type="button" data-activity-type-chip="' + escapeHtml(value) + '" aria-pressed="' + (filters.type === value) + '">' + escapeHtml(value) + '</button>').join('') + '<button type="button" class="clear" data-clear-activity-type>清除</button>';
      el.statusChips.innerHTML = ['all', ...APPROVAL_STATUSES].map(value => '<button type="button" data-activity-status-chip="' + value + '" aria-pressed="' + (filters.approval === value) + '">' + (value === 'all' ? '当前活动' : value === '已取消' ? '历史（已取消）' : value) + '</button>').join('');
    }
    function resetFilters() {
      Object.assign(filters, {
        type: 'all',
        approval: 'all',
        product: 'all',
        query: ''
      });
      render();
    }
    function setFilter(key, value) {
      filters[key] = value || 'all';
      render();
    }
    function setTimeContext(next = {}, options = {}) {
      if (options.notify === false && filters.explicitDate && !options.explicit) return;
      if (options.explicit) filters.explicitDate = true;
      if (options.notify !== false) filters.explicitDate = true;
      if (Number(next.year)) filters.year = Number(next.year);
      if (Number(next.month)) filters.month = Number(next.month);
      if (Object.prototype.hasOwnProperty.call(next, 'date')) filters.date = text(next.date);
      if (filters.date && !filters.date.startsWith(scopeMonth() + '-')) filters.date = '';
      if (moduleActive) render();
      if (options.notify !== false) onTimeContextChange({
        year: filters.year,
        month: filters.month,
        date: filters.date
      });
    }
    function defaultActivityDate() {
      if (filters.date) return filters.date;
      const today = dateKey();
      return today.startsWith(scopeMonth() + '-') ? today : scopeMonth() + '-01';
    }
    function hasOriginalTemplate(type) {
      return ['内训会', '科室会'].includes(text(type));
    }
    function updateTemplateAvailability(notify = false) {
      const supported = hasOriginalTemplate(byId('activityType')?.value);
      if (el.templateNotice) el.templateNotice.hidden = supported;
      if (el.exportButton) {
        el.exportButton.disabled = !supported;
        el.exportButton.setAttribute('aria-disabled', String(!supported));
        el.exportButton.title = supported ? '' : '当前活动类型暂无原模板，仅支持保存草稿和数据管理';
      }
      if (!supported && notify) showToast('当前活动类型暂无原模板，仅支持保存草稿和数据管理，暂不生成申请表。');
      return supported;
    }
    function renderSourcePlanOptions(selectedId = byId('activitySourcePlan')?.value || '') {
      const control = byId('activitySourcePlan');
      if (!control) return;
      const hospitalId = byId('activityHospital').dataset.entityId || '';
      const productId = Sales.stableProductId(byId('activityProduct').value);
      const period = dateKey(byId('activityApplicationDate').value).slice(0, 7);
      const plans = getEmployeePlans().filter(plan => plan.hospitalId === hospitalId && Sales.stableProductId(plan.productId) === productId && (plan.planTargets || [{
        planPeriod: plan.planPeriod || ''
      }]).some(target => text(target.planPeriod).slice(0, 7) === period));
      control.replaceChildren(new Option('未关联计划', ''));
      for (const plan of plans) control.add(new Option([plan.employee, plan.customerName, period].filter(Boolean).join(' · '), plan.id));
      if (selectedId && !plans.some(plan => plan.id === selectedId)) control.add(new Option('原计划当前不匹配（可保留草稿）', selectedId));
      control.value = selectedId;
    }
    function activityValues() {
      const fields = ['activityId', 'activityDate', 'activityType', 'activityStatus', 'activityApprovalStatus', 'activityOffice', 'activityHospitalCode', 'activityHospital', 'activityHospitalLevel', 'activityDepartment', 'activityDepartmentDirector', 'activityAttendees', 'activityProduct', 'activityTopic', 'activitySpeaker', 'activityDosageForm', 'activityBudgetPerCapita', 'activityBudgetMeal', 'activityBudgetGift', 'activityBudgetSpeaker', 'activityActualLocation', 'activityActualPerCapita', 'activityActualMeal', 'activityActualGift', 'activityActualSpeaker', 'activityRemarks', 'activityRequestNumber'];
      const values = {};
      fields.forEach(id => {
        values[id] = byId(id)?.value ?? '';
      });
      const sourcePlanId = byId('activitySourcePlan')?.value || '';
      const sourcePlan = getEmployeePlans().find(plan => plan.id === sourcePlanId);
      const previous = state.activities.find(activity => activity.id === values.activityId);
      const approvalControl = byId('activityApprovalStatus');
      const inferredUnchanged = approvalControl?.dataset.inferred === 'true' && approvalControl.value === approvalControl.dataset.initialValue;
      return {
        id: values.activityId,
        activityDate: values.activityDate,
        applicationDate: byId('activityApplicationDate').value,
        type: values.activityType,
        status: values.activityStatus,
        approvalStatus: inferredUnchanged ? '' : values.activityApprovalStatus,
        planRecordId: sourcePlanId,
        employeeId: sourcePlan?.employeeId || previous?.employeeId || editorSeed.employeeId || '',
        customerId: sourcePlan?.customerId || previous?.customerId || editorSeed.customerId || '',
        office: values.activityOffice,
        hospitalCode: values.activityHospitalCode,
        hospital: values.activityHospital,
        hospitalLevel: values.activityHospitalLevel,
        department: values.activityDepartment,
        departmentDirector: values.activityDepartmentDirector,
        attendees: number(values.activityAttendees),
        product: values.activityProduct,
        productId: Sales.stableProductId(values.activityProduct),
        assistanceSalesDenominator: state.activities.find(item => item.id === values.activityId)?.assistanceSalesDenominator || null,
        topic: values.activityTopic,
        speaker: values.activitySpeaker,
        dosageForm: values.activityDosageForm,
        budgetPerCapita: number(values.activityBudgetPerCapita),
        budgetMeal: number(values.activityBudgetMeal),
        budgetGift: number(values.activityBudgetGift),
        budgetSpeaker: number(values.activityBudgetSpeaker),
        actualLocation: values.activityActualLocation,
        actualPerCapita: text(values.activityActualPerCapita) ? number(values.activityActualPerCapita) : null,
        actualMeal: text(values.activityActualMeal) ? number(values.activityActualMeal) : null,
        actualGift: text(values.activityActualGift) ? number(values.activityActualGift) : null,
        actualSpeaker: text(values.activityActualSpeaker) ? number(values.activityActualSpeaker) : null,
        remarks: values.activityRemarks,
        requestNumber: values.activityRequestNumber,
        situationExplanation: byId('activitySituationExplanation').value,
        salesExplanationLine: byId('activitySalesExplanationLine').value,
        salesExplanationEdited: byId('activitySalesExplanationLine').dataset.edited === 'true',
        meetingCity: byId('activityMeetingCity').value,
        hospitalId: byId('activityHospital').dataset.entityId || '',
        salesHospitalIds: getHospitalDirectory().find(row => row.hospitalId === byId('activityHospital').dataset.entityId)?.salesHospitalIds || [],
        hospitalGradeEvidence: JSON.parse(byId('activityHospitalLevel').dataset.sourceEvidence || 'null'),
        departmentId: selectedDepartmentIds().length === 1 ? selectedDepartmentIds()[0] : '',
        departmentIds: selectedDepartmentIds(),
        departmentSourceLabel: byId('activityDepartment').dataset.sourceLabel || values.activityDepartment,
        departmentBindingEvidence: JSON.parse(byId('activityDepartment').dataset.bindingEvidence || 'null'),
        directorCustomerId: byId('activityDepartmentDirector').dataset.entityId || '',
        speakerCustomerId: byId('activitySpeaker').dataset.entityId || ''
      };
    }
    function updateDerivedPreview() {
      const activity = activityValues();
      const derived = calculateDerived(activity, state.records, state.activityLedgerEntries, getHospitalDirectory(), false, false, null, getEmployeePlans());
      const set = (id, value) => {
        if (byId(id)) byId(id).textContent = value;
      };
      set('activityMeetingMonth', derived.meetingMonth || '—');
      set('activityCurrentSales', derived.currentSales === null ? '待确认（无科室级证据）' : derived.currentSales.toLocaleString('zh-CN') + ' 盒');
      set('activityTargetSales', derived.targetSales === null ? {
        NOT_IMPORTED: '未导入计划',
        NOT_LINKED: '计划未关联',
        SOURCE_NOT_AVAILABLE: '无该期间计划来源',
        MATCHING_AMBIGUOUS: '计划匹配不唯一'
      }[derived.targetSalesReason] || '待确认' : derived.targetSales.toLocaleString('zh-CN') + ' 盒');
      set('activityTargetMonth', derived.targetMonth || '—');
      byId('activityBudgetPerCapita').value = activity.attendees > 0 ? activity.budgetMeal / activity.attendees : '';
      const amountLabel = value => value === null ? '无来源数据' : money(value);
      const ratioLabel = value => value === null ? '—' : (value * 100).toFixed(2) + '%';
      set('activityFiscalSalesQuantity', derived.currentFiscalBoxes == null ? '无累计销量来源' : '累计 ' + derived.currentFiscalBoxes + ' 盒');
      set('activityFiscalSalesPeriod', derived.provenance.fiscalRange ? 'FY' + derived.provenance.fiscalRange.fiscalYear + ' 累计销售金额' : '销售观察财年累计金额');
      set('activityFiscalSalesAmount', amountLabel(derived.currentFiscalSalesAmount));
      set('activityPriorFiscalSalesAmount', amountLabel(derived.priorFiscalSalesAmount));
      set('activityYoY', ratioLabel(derived.yoy));
      set('activityCostEfficiency', derived.costEfficiencyStatus === 'DATA_INSUFFICIENT' ? '数据不足' : ratioLabel(derived.costEfficiency));
      set('activityActualReimbursementTotal', amountLabel(derived.actualReimbursementTotal));
      set('activityActualReimbursementSource', '历史活动实际核销费用');
      set('activityFiscalExpenseTotal', amountLabel(derived.fiscalExpenseTotal));
      set('activityBudgetTotal', money(derived.budgetTotal));
      set('activityMonthlySales', derived.monthlySales === null ? '待补充销售数据' : derived.monthlySales.toLocaleString('zh-CN') + ' 盒');
      set('activityAverageSales', derived.recentMonthlyAverage === null ? '待补充销售数据' : derived.recentMonthlyAverage.toLocaleString('zh-CN', {
        maximumFractionDigits: 2
      }) + ' 盒');
      set('activitySalesObservationMonth', derived.observationMonth || '无完整月份');
      set('activityAverageSalesMonths', derived.averageWindow ? '最近 ' + derived.averageWindow.months + ' 个有效月' : '无有效历史月份');
      set('activitySalesScope', derived.salesScope === 'UNSET' ? '日期待补充' : derived.salesScope === 'DEPARTMENT' ? '科室级销售证据' : '医院级销售（无科室级证据）');
      set('activityFiscalBudgetTotal', amountLabel(derived.fyBudgetTotal));
      set('activityExpenseCompleteness', derived.actualExpenseCompleteness === 'INCOMPLETE' ? '实际核销数据未完整 · 待补核实 ' + derived.incompleteExpenseRows + ' 条' : derived.actualExpenseCompleteness === 'DATA_INSUFFICIENT' ? '实际核销数据不足' : '实际核销数据完整');
      set('activityExpenseCounts', '历史活动 ' + derived.historyActivityCount + ' 场 · 已核销 ' + derived.reconciledCount + ' 条');
      set('activityEfficiencyCompleteness', !derived.personalSalesEligible ? derived.costEfficiencyStatus === 'ASSISTANCE' ? '辅助产品 · 协助口径费效比，不计个人业绩' + (derived.actualExpenseCompleteness === 'INCOMPLETE' ? ' · 已知费用未完整' : '') : '辅助产品 · 不计个人业绩；缺少可靠外部或团队销售分母' : derived.bindingCompleteness === 'PENDING_CONFIRMATION' ? '医院绑定待确认' : derived.costEfficiencyCompleteness === 'INCOMPLETE' ? '已知费用费效比 · 未完整' : derived.costEfficiencyCompleteness === 'DATA_INSUFFICIENT' ? '实际费用数据不足' : '实际费用 / 累计销售金额');
      const line = byId('activitySalesExplanationLine');
      if (line.dataset.edited !== 'true') line.value = derived.provenance.fiscalSalesRecordIds.length ? activity.hospital + ' FY' + derived.provenance.fiscalRange.fiscalYear + ' ' + activity.product + '累计销售金额' + amountLabel(derived.currentFiscalSalesAmount) + '，上财年同期' + amountLabel(derived.priorFiscalSalesAmount) + '，同比' + ratioLabel(derived.yoy) + '；历史累计费用' + amountLabel(derived.fiscalExpenseTotal) + '，费效比' + ratioLabel(derived.costEfficiency) + '。' : '信息不足：尚无可追溯的同医院、同产品财年销售记录，请核验后填写。';
      byId('activitySalesExplanationSource').textContent = '来源：医院及产品累计净盒数 × 产品单价；费用 ' + (derived.actualExpenseCompleteness === 'INCOMPLETE' ? '已知实际费用 · 未完整' : derived.actualExpenseCompleteness === 'DATA_INSUFFICIENT' ? '数据不足' : '完整') + '。';
      const evidence = byId('activityDataEvidence');
      if (evidence) {
        evidence.hidden = !host.developerMode;
        const output = evidence.querySelector('pre');
        if (output) output.textContent = JSON.stringify(derived.provenance, null, 2);
      }
      const speaker = comparable(activity.speaker);
      const matchedStaff = state.settings.companyEmployees.find(name => comparable(name) === speaker);
      const note = byId('activitySpeakerProfileNote');
      if (note) note.textContent = matchedStaff ? matchedStaff + '属于公司员工，不会建立外部客户档案。' : activity.speaker ? '保存后会关联或新建讲者客户档案。' : '填写讲者后可自动建档。';
      const disclosure = byId('activityFactProvenance');
      if (disclosure) {
        const p = derived.provenance;
        const rows = state.records.filter(row => (p.fiscalSalesRecordIds || []).includes(row.id));
        const sourceRows = values => values.map(row => '<li>' + escapeHtml(row.sourceFile || row.sourceName || '已导入数据') + ' · ' + escapeHtml(row.sourceSheet || '数据表') + ' · 第 ' + escapeHtml(row.sourceRow || '未知') + ' 行</li>').join('');
        disclosure.innerHTML = '<summary>查看销售 / 学术消耗来源</summary><p>医院：' + escapeHtml(activity.hospital || '未选择') + ' · 产品：' + escapeHtml(activity.product || '未选择') + '</p><p>销售期间：' + escapeHtml(p.fiscalRange?.from || '') + ' 至 ' + escapeHtml(p.fiscalRange?.to || '') + ' · 纳入 ' + rows.length + ' 条 SalesRecord · 金额按现行产品价格合同</p><ul>' + sourceRows(rows) + '</ul><p>学术消耗：FY' + escapeHtml(p.academic?.fiscalYear || '') + ' · ' + escapeHtml(p.academic?.matchingQuality || '无来源') + ' · 仅实际核销字段</p><ul>' + sourceRows(p.academic?.includedActivities || []) + '</ul>';
      }
      return derived;
    }
    function findDirectoryHospital(value) {
      const query = text(value);
      if (!query) return null;
      const matches = getHospitalDirectory().filter(row => row.active !== false && [row.canonicalName, row.hospitalName, row.purchaseUnitId, row.hospitalCode, ...(row.aliases || []), ...(row.salesHospitalIds || [])].some(key => text(key) === query));
      return matches.length === 1 ? matches[0] : null;
    }
    function applyDirectoryValue(input, value) {
      if (!input) return;
      if (value) {
        input.value = value;
        input.dataset.activityAutofilled = 'true';
      } else if (input.dataset.activityAutofilled) {
        input.value = '';
        delete input.dataset.activityAutofilled;
      }
    }
    function updateHospitalLink(selectedHospitalId = '', {
      derive = true
    } = {}) {
      const hospitalInput = byId('activityHospital');
      const selectedId = selectedHospitalId || (hospitalInput.dataset.confirmedLabel === hospitalInput.value ? hospitalInput.dataset.entityId : '');
      const matched = selectedId ? getHospitalDirectory().find(row => row.hospitalId === selectedId && row.active !== false && !row.deletedAt) : null;
      if (matched) hospitalInput.value = matched.canonicalName || matched.hospitalName;
      const previousId = hospitalInput.dataset.entityId || '';
      hospitalInput.dataset.entityId = matched?.hospitalId || '';
      hospitalInput.dataset.confirmedLabel = matched ? (matched.canonicalName || matched.hospitalName) : '';
      hospitalInput.dataset.reliableIdentity = matched ? 'true' : 'false';
      applyDirectoryValue(byId('activityHospitalCode'), matched && (matched.hospitalCode || matched.code));
      if (matched) byId('activityHospitalLevel').value = matched.hospitalLevel || matched.level || '';
      applyDirectoryValue(byId('activityHospitalLevel'), matched && (matched.hospitalLevel || matched.level));
      byId('activityHospitalLevel').dataset.sourceEvidence = JSON.stringify(matched?.hospitalLevelEvidence || null);
      applyDirectoryValue(byId('activityOffice'), matched?.office);
      applyDirectoryValue(byId('activityMeetingCity'), matched?.city);
      if (previousId && previousId !== hospitalInput.dataset.entityId) {
        ['activityDepartment', 'activityDepartmentDirector', 'activitySpeaker'].forEach(id => {
          byId(id).value = '';
          delete byId(id).dataset.entityId;
          delete byId(id).dataset.departmentIds;
          delete byId(id).dataset.confirmedLabel;
        });
      }
      closeDirectoryCandidates('activityDepartment');
      updateDepartmentLink('', {
        derive
      });
      if (derive) renderSourcePlanOptions();
    }
    function closeDirectoryCandidates(inputId) {
      const input = byId(inputId),
        list = byId(inputId + 'Candidates');
      if (list) {
        list.hidden = true;
        list.replaceChildren();
      }
      input?.setAttribute('aria-expanded', 'false');
    }
    function closeHospitalCandidates() {
      closeDirectoryCandidates('activityHospital');
    }
    function renderDirectoryCandidates(inputId, entities, idField, nameFor, keysFor, onSelect) {
      const input = byId(inputId),
        list = byId(inputId + 'Candidates');
      if (!list) return;
      if (input.dataset.composing || !el.dialog.open) {
        closeDirectoryCandidates(inputId);
        return;
      }
      const query = text(input.value).toLocaleLowerCase();
      const candidates = entities.filter(row => row.active !== false && !row.deletedAt && row[idField] && keysFor(row).some(key => text(key).toLocaleLowerCase().includes(query)));
      const unique = [...new Map(candidates.map(row => [row[idField], row])).values()].sort((a, b) => text(nameFor(a)).localeCompare(text(nameFor(b)), 'zh-CN') || text(a[idField]).localeCompare(text(b[idField]))).slice(0, 30);
      list.replaceChildren();
      unique.forEach(row => {
        const option = document.createElement('button');
        option.type = 'button';
        option.setAttribute('role', 'option');
        const name = nameFor(row),
          sameName = unique.filter(candidate => nameFor(candidate) === name).length > 1;
        option.dataset[idField] = row[idField];
        option.textContent = name + (sameName ? ' · ' + (row.purchaseUnitId || row.hospitalCode || row[idField]) : '');
        option.addEventListener('pointerdown', event => event.preventDefault());
        option.addEventListener('click', () => {
          input.value = name;
          onSelect(row[idField]);
          closeDirectoryCandidates(inputId);
        });
        list.append(option);
      });
      list.hidden = !unique.length;
      input.setAttribute('aria-expanded', String(!list.hidden));
    }
    function renderHospitalCandidates() {
      renderDirectoryCandidates('activityHospital', getHospitalDirectory(), 'hospitalId', row => row.canonicalName || row.hospitalName, row => [row.canonicalName, row.hospitalName, row.hospitalCode, row.purchaseUnitId, ...(row.aliases || []), ...(row.salesHospitalIds || [])], updateHospitalLink);
    }
    function selectedDepartmentIds() {
      const input = byId('activityDepartment');
      return Departments.idsOf({
        departmentId: input.dataset.entityId,
        departmentIds: JSON.parse(input.dataset.departmentIds || '[]')
      });
    }
    function departmentResolver() {
      const hospital = getHospitalDirectory().find(row => row.hospitalId === byId('activityHospital').dataset.entityId);
      const hospitalId = byId('activityHospital').dataset.entityId,
        registry = state.settings.departmentIdentityRegistry;
      if (editorDepartmentCache?.hospitalId === hospitalId && editorDepartmentCache.registry === registry && editorDepartmentCache.hospital === hospital) return editorDepartmentCache.resolver;
      const resolver = Departments.createResolver([...(registry || []).filter(row => row.hospitalId === hospitalId), ...(hospital?.departments || []).map(row => ({
        ...row,
        hospitalId,
        referenceOnly: true
      }))]);
      editorDepartmentCache = {
        hospitalId,
        registry,
        hospital,
        resolver
      };
      return resolver;
    }
    function applyDepartmentSelection(ids, sourceLabel, evidence = null) {
      const input = byId('activityDepartment'),
        resolver = departmentResolver(),
        hospitalId = byId('activityHospital').dataset.entityId;
      const selected = resolver.departments.filter(row => row.hospitalId === hospitalId && ids.includes(row.departmentId));
      const previous = selectedDepartmentIds().slice().sort().join('|');
      input.dataset.departmentIds = JSON.stringify(selected.map(row => row.departmentId));
      input.dataset.entityId = selected.length === 1 ? selected[0].departmentId : '';
      input.value = selected.map(row => row.canonicalName).join('、');
      input.dataset.confirmedLabel = input.value;
      input.dataset.reliableIdentity = 'true';
      input.dataset.sourceLabel = sourceLabel || input.value;
      input.dataset.bindingEvidence = JSON.stringify(evidence);
      if (previous && previous !== selectedDepartmentIds().slice().sort().join('|')) {
        ['activityDepartmentDirector', 'activitySpeaker'].forEach(id => {
          delete byId(id).dataset.entityId;
        });
      }
    }
    function renderDepartmentCandidates() {
      const input = byId('activityDepartment'),
        list = byId('activityDepartmentCandidates'),
        hospitalId = byId('activityHospital').dataset.entityId;
      if (!hospitalId || input.dataset.composing || !el.dialog.open) {
        closeDirectoryCandidates('activityDepartment');
        return;
      }
      const resolver = departmentResolver(),
        sourceLabel = input.dataset.sourceLabel || input.value;
      const result = resolver.candidates(input.dataset.confirmedLabel === input.value ? '' : input.value, {
        hospitalId
      });
      const picked = new Set(selectedDepartmentIds());
      list.replaceChildren();
      list.setAttribute('aria-multiselectable', 'true');
      const hint = document.createElement('small');
      hint.textContent = result.fallbackAll ? '未找到相近名称，显示本院全部科室；可多选' : '选择关联科室（可多选），确认后保存映射';
      list.append(hint);
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.dataset.confirmDepartments = 'true';
      const update = () => {
        confirm.textContent = '确认关联' + (picked.size ? '（' + picked.size + '）' : '');
        confirm.disabled = !picked.size;
      };
      result.candidates.forEach(row => {
        const option = document.createElement('button');
        option.type = 'button';
        option.dataset.departmentId = row.departmentId;
        option.setAttribute('role', 'option');
        option.textContent = row.canonicalName;
        option.setAttribute('aria-selected', String(picked.has(row.departmentId)));
        option.addEventListener('pointerdown', event => event.preventDefault());
        option.addEventListener('click', () => {
          picked.has(row.departmentId) ? picked.delete(row.departmentId) : picked.add(row.departmentId);
          option.setAttribute('aria-selected', String(picked.has(row.departmentId)));
          update();
        });
        list.append(option);
      });
      confirm.addEventListener('pointerdown', event => event.preventDefault());
      confirm.addEventListener('click', async () => {
        const ids = [...picked],
          label = text(sourceLabel) || result.candidates.filter(row => picked.has(row.departmentId)).map(row => row.canonicalName).join('、');
        const evidence = {
          type: 'USER_CONFIRMED_SOURCE_LABEL',
          hospitalId,
          sourceLabel: label,
          departmentIds: ids,
          confirmedAt: new Date().toISOString()
        };
        applyDepartmentSelection(ids, label, evidence);
        closeDirectoryCandidates('activityDepartment');
        draftUI?.autosave();
        renderSourcePlanOptions();
        updateDerivedPreview();
      });
      update();
      list.append(confirm);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function updateDepartmentLink(selectedDepartmentId = '', {
      derive = true
    } = {}) {
      const input = byId('activityDepartment'),
        hospitalId = byId('activityHospital').dataset.entityId;
      if (!hospitalId) {
        input.dataset.entityId = '';
        input.dataset.departmentIds = '[]';
        if (derive) updateDerivedPreview();
        return;
      }
      const resolver = departmentResolver();
      if (selectedDepartmentId) applyDepartmentSelection([selectedDepartmentId], input.value);else if (input.dataset.confirmedLabel !== input.value) {
        input.dataset.entityId = ''; input.dataset.departmentIds = '[]';
        input.dataset.reliableIdentity = 'false';
        delete input.dataset.confirmedLabel;
      }
      ['activityDepartmentDirector', 'activitySpeaker'].forEach(id => renderPersonOptions(id));
      if (derive) updateDerivedPreview();
    }
    function renderPersonOptions(id) {
      const input = byId(id);
      const list = byId(id + 'Candidates');
      if (!list) return;
      const candidates = scopedPeople(getCustomerEntities(), {
        hospitalId: byId('activityHospital').dataset.entityId,
        departmentIds: selectedDepartmentIds()
      });
      const query = text(input.value).toLocaleLowerCase();
      const shown = candidates.filter(person => !query || text(person.customerName).toLocaleLowerCase().includes(query));
      list.replaceChildren();
      shown.forEach(person => {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'option';
        button.textContent = person.customerName + ' · ' + person.department;
        button.dataset.personId = person.customerId;
        button.addEventListener('click', () => {
          input.value = person.customerName;
          input.dataset.entityId = person.customerId;
          input.dataset.reliableIdentity = 'true';
          list.hidden = true;
          input.setAttribute('aria-expanded', 'false');
          updateDerivedPreview();
        });
        list.append(button);
      });
      list.hidden = document.activeElement !== input || !shown.length;
      input.setAttribute('aria-expanded', String(!list.hidden));
    }
    function defaultTopic() {
      const product = byId('activityProduct').value;
      const current = byId('activityTopic').value;
      if (!current || Object.values(PRODUCT_TOPICS).includes(current)) byId('activityTopic').value = PRODUCT_TOPICS[product] || product + '的临床应用';
      updateDerivedPreview();
    }
    function renderOptions() {
      if (el.hospitalList) el.hospitalList.replaceChildren();
      closeHospitalCandidates();
      closeDirectoryCandidates('activityDepartment');
      el.customerList.innerHTML = '';
      const productSelect = byId('activityProduct');
      const currentProduct = productSelect?.value;
      if (productSelect) {
        const products = (typeof require === 'function' ? require('./product-registry.js') : window.ProductRegistry).products;
        productSelect.innerHTML = '<option value="">请选择产品</option>' + products.map(({
          name
        }) => '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>').join('');
        if (currentProduct) productSelect.value = currentProduct;
      }
    }
    function fillForm(activity = {}) {
      editorSeed = {...activity};
      editorHospitalDirectory = resolveHospitalDirectory();
      renderOptions();
      const set = (id, value) => {
        if (byId(id)) byId(id).value = value ?? '';
      };
      [['activityHospital', 'hospitalId'], ['activityDepartment', 'departmentId'], ['activityDepartmentDirector', 'directorCustomerId'], ['activitySpeaker', 'speakerCustomerId']].forEach(([id, field]) => {
        byId(id).dataset.entityId = activity[field] || '';
        byId(id).dataset.reliableIdentity = String(Boolean(activity[field]));
      });
      byId('activityDepartment').dataset.departmentIds = JSON.stringify(departmentIds(activity));
      byId('activityDepartment').dataset.reliableIdentity = String(Boolean(departmentIds(activity).length));
      byId('activityDepartment').dataset.confirmedLabel = activity.department || '';
      byId('activityDepartment').dataset.sourceLabel = activity.departmentSourceLabel || activity.department || '';
      byId('activityDepartment').dataset.bindingEvidence = JSON.stringify(activity.departmentBindingEvidence || null);
      ['activityHospitalCode', 'activityHospitalLevel'].forEach(id => {
        if (byId(id)) delete byId(id).dataset.activityAutofilled;
      });
      set('activityId', activity.id || '');
      set('activityDate', activity.id ? activity.activityDate ?? '' : activity.activityDate || defaultActivityDate());
      set('activityApplicationDate', activity.id ? activity.applicationDate ?? '' : activity.applicationDate || dateKey());
      set('activityType', activity.type || '科室会');
      set('activityStatus', activity.status || '草稿');
      const approvalControl = byId('activityApprovalStatus');
      const shownApproval = text(activity.approvalStatus) || displayStatus(activity) || '草稿';
      approvalControl.value = shownApproval === '未设置' ? '草稿' : shownApproval;
      approvalControl.dataset.inferred = String(Boolean(activity.id && !text(activity.approvalStatus)));
      approvalControl.dataset.initialValue = approvalControl.value;
      set('activityOffice', activity.office);
      set('activityHospitalCode', activity.hospitalCode);
      set('activityHospital', activity.hospital);
      set('activityHospitalLevel', activity.hospitalLevel);
      set('activityDepartment', activity.department);
      set('activityDepartmentDirector', activity.departmentDirector);
      set('activityAttendees', activity.attendees || '');
      const defaultProduct = activity.product || '';
      set('activityProduct', defaultProduct);
      set('activityTopic', activity.id ? activity.topic ?? '' : activity.topic || PRODUCT_TOPICS[defaultProduct] || '');
      set('activitySpeaker', activity.speaker);
      set('activityDosageForm', activity.dosageForm);
      set('activityBudgetPerCapita', activity.budgetPerCapita || '');
      set('activityBudgetMeal', activity.budgetMeal || '');
      set('activityBudgetGift', activity.budgetGift || '');
      set('activityBudgetSpeaker', activity.budgetSpeaker || '');
      set('activityActualLocation', activity.actualLocation);
      set('activityActualPerCapita', activity.actualPerCapita ?? '');
      set('activityActualMeal', activity.actualMeal ?? '');
      set('activityActualGift', activity.actualGift ?? '');
      set('activityActualSpeaker', activity.actualSpeaker ?? '');
      set('activityRemarks', activity.remarks);
      set('activityRequestNumber', activity.requestNumber);
      set('activitySituationExplanation', activity.situationExplanation);
      set('activityMeetingCity', activity.meetingCity);
      set('activitySalesExplanationLine', activity.salesExplanationLine);
      byId('activitySalesExplanationLine').dataset.edited = String(Boolean(activity.salesExplanationEdited));
      el.title.textContent = activity.id ? '编辑活动申请' : '新建活动申请';
      el.deleteButton.hidden = !activity.id;
      el.deleteButton.textContent = window.DeletionPolicy.decide('activity', activity, state).action === 'DELETE' ? '删除草稿' : '取消活动';
      el.deleteButton.title = '正式活动及已有引用的草稿保留历史';
      el.validation.hidden = true;
      el.validation.textContent = '';
      el.form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
      updateTemplateAvailability();
      updateHospitalLink(activity.hospitalId || '');
      renderSourcePlanOptions(activity.planRecordId || '');
      updateDerivedPreview();
      syncWheelTriggers();
    }
    function ensureCustomerProfile(name, activity, role, {explicitCreate = false} = {}) {
      const person = text(name);
      if (!person || state.settings.companyEmployees.some(employee => comparable(employee) === comparable(person))) return false;
      const field = role === '科室主任' ? 'directorCustomerId' : 'speakerCustomerId';
      const record = ensureActivityPerson({
        ...activity,
        customerName: person,
        customerId: activity[field],
        role,
        explicitCreate
      });
      if (!record) return false;
      activity[field] = record.customerId;
      activity.hospitalId = record.hospitalId;
      if (record.source !== 'ACTIVITY_APPLICATION_DRAFT') return false;
      const existing = state.tasks.find(task => task.taskType === 'customer_profile_maintenance' && task.sourceId === record.customerId);
      if (existing) return false;
      const now = new Date().toISOString();
      state.tasks.push({
        id: uid(),
        title: '完善' + person + '人员资料',
        category: '资料维护',
        due: '',
        progress: 0,
        status: 'pending',
        customer: person,
        taskType: 'customer_profile_maintenance',
        sourceType: 'customer',
        sourceId: record.customerId,
        customerId: record.customerId,
        hospitalId: record.hospitalId,
        departmentId: record.departmentId,
        departmentIds: departmentIds(record),
        relatedActivityId: activity.id,
        hospital: activity.hospital,
        department: activity.department,
        employee: activity.office,
        product: activity.product,
        notes: '待完善；来源：活动申请；角色：' + role,
        weeklyOutputs: {},
        createdAt: now,
        updatedAt: now
      });
      return true;
    }
    function createCustomerFromEditor(role) {
      if (!byId('activityId').value || !state.activities.some(a=>a.id===byId('activityId').value)) return showToast('请先成功创建活动，再建立正式人员关系');
      const activity = activityValues();
      const isDirector = role === 'director';
      const person = isDirector ? activity.departmentDirector : activity.speaker;
      activity.id ||= uid();
      byId('activityId').value = activity.id;
      if (!activity.hospital || !person) return showToast('请先填写医院和' + (isDirector ? '科室主任' : '讲者') + '姓名');
      if (state.settings.companyEmployees.some(employee => comparable(employee) === comparable(person))) return showToast(person + '属于公司员工，不会建立外部客户档案');
      const created = ensureCustomerProfile(person, activity, isDirector ? '科室主任' : '讲者', {explicitCreate: true});
      if (created) {
        persist();
        renderOptions();
        showToast(person + '的客户档案已建立');
      } else showToast(person + '已在客户档案中');
    }
    function missingRequiredFields() {
      const required = [['activityDate', '会议日期'], ['activityApplicationDate', '申请日期'], ['activityType', '会议类型'], ['activityProduct', '产品'], ['activityTopic', '推广主题'], ['activityHospital', '医院'], ['activityDepartment', '科室']];
      el.form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
      const missing = required.filter(([id]) => !text(byId(id)?.value));
      missing.forEach(([id]) => byId(id)?.setAttribute('aria-invalid', 'true'));
      el.validation.hidden = missing.length === 0;
      el.validation.textContent = missing.length ? '请补充：' + missing.map(([, label]) => label).join('、') + '。已填写内容会保留。' : '';
      return missing;
    }
    async function commitEditorActivity({
      validation = 'draft'
    } = {}) {
      if (validation === 'final') {
        const missing = missingRequiredFields();
        if (missing.length) {
          byId(missing[0][0])?.focus();
          showToast(el.validation.textContent);
          return null;
        }
      } else {
        const fields = ['activityDate', 'activityApplicationDate', 'activityProduct', 'activityTopic', 'activityOffice', 'activityHospital', 'activityHospitalCode', 'activityHospitalLevel', 'activityDepartment', 'activityDepartmentDirector', 'activitySpeaker', 'activityAttendees', 'activityBudgetMeal', 'activityBudgetGift', 'activityBudgetSpeaker', 'activityActualLocation', 'activityActualMeal', 'activityActualGift', 'activityActualSpeaker', 'activityRemarks', 'activityRequestNumber', 'activitySituationExplanation', 'activityMeetingCity'];
        if (!fields.some(id => text(byId(id)?.value)) && !(byId('activitySalesExplanationLine').dataset.edited === 'true' && text(byId('activitySalesExplanationLine').value))) {
          showToast('请先填写任意活动内容再保存草稿');
          return null;
        }
        el.validation.hidden = true;
        el.form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
      }
      const prepared = await draftUI.prepareSave();
      const activity = {...prepared.snapshot, id: prepared.activityId};
      const now = new Date().toISOString();
      const existing = state.activities.find(item => item.id === activity.id);
      const derived = updateDerivedPreview();
      const next = {
        ...existing,
        ...activity,
        id: activity.id || uid(),
        applicationDate: activity.applicationDate,
        isDraft: existing?.isDraft === false ? false : validation === 'draft',
        derived,
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      if (!activity.approvalStatus && !existing?.approvalStatus) delete next.approvalStatus;
      if (validation === 'final') {
        try {
          const contextualPeople = scopedPeople(getCustomerEntities(), next);
          [['departmentDirector', 'directorCustomerId'], ['speaker', 'speakerCustomerId']].forEach(([nameField, idField]) => {
            const name = text(next[nameField]);
            if (!name || state.settings.companyEmployees.some(employee => comparable(employee) === comparable(name))) return;
            const people = contextualPeople;
            if (next[idField]) {
              const person = people.find(item => item.customerId === next[idField]);
              if (!person || person.hospitalId !== next.hospitalId || !Departments.sharesDepartment(person, next)) throw new Error('人员身份与当前医院/科室不一致，请重新选择');
              next[nameField] = person.customerName;
            } else {
              const matches = people.filter(person => text(person.customerName) === name);
              if (matches.length > 1) throw new Error('存在同名人员，请从当前医院/科室候选明确选择');
              throw new Error('请选择明确的稳定人员身份；姓名只产生候选，不会自动建档或绑定');
            }
          });
          if (text(next.departmentDirector) && text(next.departmentDirector) === text(next.speaker) && (!next.directorCustomerId || !next.speakerCustomerId)) throw new Error('主任与讲者同名，请确认人员身份后继续，不能仅按姓名推断为同一人');
          if ((text(next.departmentDirector) || text(next.speaker)) && (!next.hospitalId || !departmentIds(next).length)) throw new Error('请先明确医院和科室身份');
          // Validated references are committed with the Activity; no early master/task mutation.
        } catch (error) {
          showToast(error.message);
          return null;
        }
      } else if (existing?.isDraft !== false) {
        next.approvalStatus = '草稿';
        next.status = '草稿';
      }
      [['activityHospital', 'hospitalId'], ['activityDepartment', 'departmentId'], ['activityDepartmentDirector', 'directorCustomerId'], ['activitySpeaker', 'speakerCustomerId']].forEach(([id, field]) => {
        byId(id).dataset.entityId = next[field] || '';
      });
      const nextActivities = state.activities.map(item=>item.id===next.id?next:item);
      if (!existing) nextActivities.push(next);
      let nextTasks = state.tasks;
      if (validation === 'final' && window.ActivityTaskAdapter) nextTasks = window.ActivityTaskAdapter.syncActivityTasks(next, state.tasks).tasks;
      await persistActivityState(nextActivities, nextTasks);
      await draftUI.completed(next);
      return next;
    }
    function persistEditorActivity(options) {
      if (formalSavePromise) return formalSavePromise;
      const controls=[...el.form.querySelectorAll('input,select,textarea,button')].map(element=>({element,disabled:element.disabled}));
      controls.forEach(({element})=>element.disabled=true);
      formalSavePromise = commitEditorActivity(options).finally(()=>{controls.forEach(({element,disabled})=>element.disabled=disabled);formalSavePromise=null;});
      return formalSavePromise;
    }
    function captureNavigationState() {
      return {
        sourceWorkspace: 'activities',
        sourceRoute: location.hash || '#/activity/' + currentSection,
        activityId: el.dialog.open ? text(byId('activityId')?.value) : '',
        section: currentSection,
        year: filters.year,
        month: filters.month,
        date: filters.date,
        explicitDate: filters.explicitDate,
        activityType: filters.type,
        status: filters.approval,
        product: filters.product,
        hospital: filters.query,
        scrollY: window.scrollY || 0,
        editorScrollY: el.dialog.open ? el.form.scrollTop || el.dialog.scrollTop || 0 : 0,
        editorFormScrollY: el.dialog.open ? el.form.scrollTop : 0,
        editorDialogScrollY: el.dialog.open ? el.dialog.scrollTop : 0,
        editorDraft: el.dialog.open ? {...editorSeed,...activityValues(),customerMatchStatus:editorSeed.customerMatchStatus||''} : null,
        expandedSections: [...el.form.querySelectorAll('details')].map(section => section.open)
      };
    }
    function syncNavigationState() {
      navigationCoordinator?.syncActivityState?.(captureNavigationState());
    }
    function restoreNavigationState(snapshot = {}) {
      if (!snapshot || snapshot.sourceWorkspace !== 'activities') return false;
      Object.assign(filters, {
        year: Number(snapshot.year) || filters.year,
        month: Number(snapshot.month) || filters.month,
        date: text(snapshot.date),
        explicitDate: snapshot.explicitDate === true,
        type: snapshot.activityType || 'all',
        approval: snapshot.status || 'all',
        product: snapshot.product || 'all',
        query: text(snapshot.hospital)
      });
      currentSection = ['list', 'expenses', 'imports'].includes(snapshot.section) ? snapshot.section : 'list';
      render();
      if (snapshot.editorDraft && /^#\/activity\/(?:new|edit\/)/.test(location.hash)) openEditor(snapshot.editorDraft, false);
      if (snapshot.editorDraft && el.dialog.open && Array.isArray(snapshot.expandedSections)) el.form.querySelectorAll('details').forEach((section, index) => {
        if (typeof snapshot.expandedSections[index] === 'boolean') section.open = snapshot.expandedSections[index];
      });
      requestAnimationFrame(() => {
        if (snapshot.editorDraft && el.dialog.open) {
          if (Number.isFinite(snapshot.editorFormScrollY) && Number.isFinite(snapshot.editorDialogScrollY)) {
            el.form.scrollTop = snapshot.editorFormScrollY;
            el.dialog.scrollTop = snapshot.editorDialogScrollY;
          } else {
            const owner = /auto|scroll/.test(getComputedStyle(el.form).overflowY) ? el.form : el.dialog;
            owner.scrollTop = Number(snapshot.editorScrollY) || 0;
          }
        } else window.scrollTo({
          top: Number(snapshot.scrollY) || 0,
          behavior: 'instant'
        });
      });
      return true;
    }
    function setRoute(route, replace = false) {
      const hash = '#/activity/' + route;
      const method = replace ? 'replaceState' : 'pushState';
      history[method]({
        ...(history.state || {}),
        workspaceNavigationSourceSnapshot: captureNavigationState(),
        activityRoute: route
      }, '', location.pathname + location.search + hash);
    }
    function closeEditor(fromHistory = false) {
      if (editorCloseLocally) {
        editorCloseLocally = false;
        if (el.dialog.open) el.dialog.close();
        navigateSection(returnSection, false);
        render();
        syncNavigationState();
        return;
      }
      if (!fromHistory && navigationCoordinator?.back?.('activity-editor')) return;
      setRoute(returnSection, true);
      if (el.dialog.open) el.dialog.close();
      navigateSection(returnSection, false);
      render();
    }
    async function saveActivity(event) {
      event.preventDefault();
      let saved;
      try {
        saved = await persistEditorActivity();
      } catch (error) {
        showToast('本地保存失败，请重试');
        return;
      }
      if (!saved) return;
      const wasNew = saved.createdAt === saved.updatedAt;
      closeEditor();
      Object.assign(filters, {
        type: 'all',
        approval: 'all',
        product: 'all',
        query: '',
        date: '',
        explicitDate: false
      });
      if (/^\d{4}-\d{2}-\d{2}$/.test(saved.activityDate)) {
        filters.year = Number(saved.activityDate.slice(0, 4));
        filters.month = Number(saved.activityDate.slice(5, 7));
      }
      render();
      showToast(wasNew ? '活动草稿已保存' : '活动草稿已更新');
    }
    function removeActivity(inputId = '', options = {}) {
      const id = typeof inputId === 'string' && inputId ? inputId : byId('activityId').value;
      const activity = state.activities.find(item => item.id === id);
      if (!activity) return;
      const decision = window.DeletionPolicy.decide('activity', activity, state);
      if (!options.confirmed && !confirm(decision.action === 'DELETE' ? '确定删除此草稿？' : '取消此活动并保留业务历史？')) return;
      if (decision.action === 'ARCHIVE') {
        Object.assign(activity, {
          status: '已取消',
          approvalStatus: '已取消',
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        syncActivityTasks(activity, 'save');
        if (options.deferRender) return;
        persist();
        if (el.dialog.open) closeEditor();else render();
        showToast('活动已取消，历史已保留');
        return;
      }
      const deletedAt = new Date().toISOString();
      state.activities = state.activities.filter(item => item.id !== id);
      state.tombstones = [...(state.tombstones || []), {
        key: 'activity:' + id,
        kind: 'activity',
        id,
        deletedAt
      }];
      syncActivityTasks({
        ...activity,
        deleted: true,
        deletedAt
      }, 'delete');
      selectedActivityIds.delete(id);
      if (options.deferRender) return;
      persist();
      if (el.dialog.open) closeEditor();else render();
      showToast('活动申请已删除');
    }
    function filtered({
      includeDate = true
    } = {}) {
      const query = comparable(filters.query);
      return state.activities.filter(activity => (filters.approval === '已取消' || displayStatus(activity) !== '已取消') && (!filters.explicitDate && displayStatus(activity) === '草稿' || text(activity.activityDate).slice(0, 7) === scopeMonth() || !text(activity.activityDate) && displayStatus(activity) === '草稿') && (!filters.explicitDate && displayStatus(activity) === '草稿' || !includeDate || !filters.date || text(activity.activityDate).slice(0, 10) === filters.date || !text(activity.activityDate) && displayStatus(activity) === '草稿') && (filters.type === 'all' || activity.type === filters.type) && (filters.approval === 'all' || displayStatus(activity) === filters.approval) && (filters.product === 'all' || activity.product === filters.product) && (!query || [activity.hospital, activity.hospitalCode, activity.department, activity.speaker, activity.departmentDirector, activity.topic, activity.requestNumber].some(value => comparable(value).includes(query)))).sort((a, b) => text(b.activityDate).localeCompare(text(a.activityDate)) || text(b.updatedAt).localeCompare(text(a.updatedAt)));
    }
    function renderStaff() {
      el.staffList.innerHTML = (state.settings.companyEmployees || []).map(name => {
        const locked = DEFAULT_COMPANY_EMPLOYEES.some(value => comparable(value) === comparable(name));
        const remove = '<button type="button" data-remove-company-employee="' + escapeHtml(name) + '" aria-label="移除' + escapeHtml(name) + '">×</button>';
        return '<span class="activity-staff-chip">' + escapeHtml(name) + (locked ? '<small>固定排除</small>' : remove) + '</span>';
      }).join('');
    }
    function percentageDetail(current, previous) {
      if (!previous) return current ? {
        text: '较上月 新增',
        tone: 'positive'
      } : {
        text: '较上月 0%',
        tone: 'neutral'
      };
      const change = (current - previous) / previous * 100;
      return {
        text: '较上月 ' + (change >= 0 ? '+' : '') + change.toFixed(0) + '%',
        tone: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
      };
    }
    function currentFiscalLedgerRows() {
      const range = fiscalRange(dateKey());
      return state.activityLedgerEntries.filter(row => {
        const rowDate = text(row.applicationDate || row.activityDate).slice(0, 10);
        return Number(row.fiscalYear) === range.fiscalYear && (!rowDate || rowDate >= range.from && rowDate <= range.to);
      });
    }
    function renderDashboardKpis() {
      const currentMonth = scopeMonth();
      const previousDate = new Date(currentMonth + '-01T12:00:00');
      previousDate.setMonth(previousDate.getMonth() - 1);
      const previousMonth = dateKey(previousDate).slice(0, 7);
      const currentRows = state.activities.filter(row => displayStatus(row) !== '已取消' && text(row.activityDate).slice(0, 7) === currentMonth);
      const previousRows = state.activities.filter(row => displayStatus(row) !== '已取消' && text(row.activityDate).slice(0, 7) === previousMonth);
      const budget = rows => rows.reduce((total, row) => total + number(row.budgetMeal) + number(row.budgetGift) + number(row.budgetSpeaker), 0);
      const currentBudget = budget(currentRows);
      const previousBudget = budget(previousRows);
      const countChange = percentageDetail(currentRows.length, previousRows.length);
      const budgetChange = percentageDetail(currentBudget, previousBudget);
      const mistakenActivities = state.activities.filter(row => /^20\d{2}$/.test(text(row.sourceSheet))).length;
      const fiscalExpense = fiscalExpenseDisclosure(currentFiscalLedgerRows());
      const expenseDetail = 'FY' + fiscalYearForDate(dateKey()) + ' · 财年预算 ' + (fiscalExpense.fyBudgetTotal === null ? '暂无数据' : money(fiscalExpense.fyBudgetTotal)) + ' · 已核销 ' + fiscalExpense.reconciledCount + ' 条 · 待补实际金额 ' + fiscalExpense.incompleteExpenseRows + ' 条 · ' + fiscalExpense.expenseCompleteness;
      const cards = [{
        label: '本月申请活动',
        value: String(currentRows.length),
        unit: '场',
        detail: countChange.text,
        tone: countChange.tone,
        icon: '▣'
      }, {
        label: '本月预计费用',
        value: money(currentBudget),
        unit: '',
        detail: budgetChange.text,
        tone: budgetChange.tone,
        icon: '¥'
      }, {
        label: '已导入登记表',
        value: String(state.activityLedgerEntries.length),
        unit: '条',
        detail: mistakenActivities + ' 条误导入活动',
        tone: mistakenActivities ? 'negative' : 'positive',
        icon: '⇩'
      }, {
        label: '本财年累计费用（已知实际费用）',
        value: fiscalExpense.knownActualExpense === null ? '暂无已知实际金额' : money(fiscalExpense.knownActualExpense),
        unit: '',
        detail: expenseDetail,
        tone: fiscalExpense.incompleteExpenseRows ? 'negative' : 'neutral',
        icon: '▥'
      }];
      el.kpis.innerHTML = cards.map(card => '<article class="activity-kpi"><div><span>' + card.label + '</span><strong>' + card.value + (card.unit ? '<small>' + card.unit + '</small>' : '') + '</strong><p class="' + card.tone + '">' + card.detail + '</p></div><i aria-hidden="true">' + card.icon + '</i></article>').join('');
    }
    function renderList(rows) {
      let toolbar = byId('activityBulkActions');
      if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'activityBulkActions';
        toolbar.className = 'entry-bulk-actions';
        el.list.before(toolbar);
      }
      for (const id of [...selectedActivityIds]) if (!state.activities.some(a => a.id === id)) selectedActivityIds.delete(id);
      toolbar.innerHTML = '<button type="button" data-select-all-activities aria-label="全选活动">☑ 全选</button><span>已选 ' + selectedActivityIds.size + '</span><button type="button" data-bulk-remove-activities ' + (selectedActivityIds.size ? '' : 'disabled') + '>× 删除 / 取消</button>';
      const summary = activity => ({
        meetingMonth: monthLabel(dateKey(text(activity.activityDate))),
        budgetTotal: number(activity.budgetMeal) + number(activity.budgetGift) + number(activity.budgetSpeaker)
      });
      el.count.textContent = '共 ' + rows.length + ' 场';
      el.tableRows.innerHTML = rows.map((activity, index) => {
        const status = displayStatus(activity);
        const derived = summary(activity);
        return '<tr>' + '<td>' + (index + 1) + '</td>' + '<td>' + escapeHtml(derived.meetingMonth) + '</td>' + '<td>' + escapeHtml(activity.type) + '</td>' + '<td>' + escapeHtml(activity.hospitalCode || '—') + '</td>' + '<td><strong>' + escapeHtml(activity.hospital || '未填写医院') + '</strong></td>' + '<td>' + escapeHtml(activity.department || '—') + '</td>' + '<td>' + escapeHtml(activity.product || '—') + '</td>' + '<td>' + (number(activity.attendees) || '—') + '</td>' + '<td>' + money(derived.budgetTotal) + '</td>' + '<td><span class="activity-status ' + statusClass(status) + '" title="原执行进度：' + escapeHtml(activity.status || '未设置') + '">' + escapeHtml(status) + '</span></td>' + '<td><button type="button" class="activity-row-action" data-remove-activity="' + escapeHtml(activity.id) + '" aria-label="删除或归档活动">×</button><button type="button" class="activity-row-action" data-activity-sales="' + escapeHtml(activity.id) + '">查看销售</button><button type="button" class="activity-row-action" data-edit-activity="' + escapeHtml(activity.id) + '">编辑</button></td>' + '</tr>';
      }).join('');
      el.list.innerHTML = rows.map(activity => {
        const derived = summary(activity);
        const status = displayStatus(activity);
        const action = displayStatus(activity) === '草稿' ? 'DELETE' : 'ARCHIVE';
        return '<article class="activity-card"><button type="button" class="activity-card-select" data-select-activity="' + escapeHtml(activity.id) + '" aria-label="选择活动" aria-pressed="' + selectedActivityIds.has(activity.id) + '">' + (selectedActivityIds.has(activity.id) ? '☑' : '☐') + '</button><button type="button" class="activity-card-remove" data-remove-activity="' + escapeHtml(activity.id) + '" aria-label="' + (action === 'DELETE' ? '删除草稿' : '归档活动') + '" title="' + (action === 'DELETE' ? '删除草稿' : '取消并保留历史') + '">×</button><button type="button" class="activity-card-main" data-edit-activity="' + escapeHtml(activity.id) + '">' + '<span class="activity-card-header"><strong>' + escapeHtml(activity.hospital || '未填写医院') + '</strong><span class="activity-status ' + statusClass(status) + '">' + escapeHtml(status) + '</span></span>' + '<span class="activity-card-tags"><b>' + escapeHtml(derived.meetingMonth) + '</b><b>' + escapeHtml(activity.type) + '</b><b>' + escapeHtml(activity.product || '未填写产品') + '</b></span>' + '<span class="activity-card-department">' + escapeHtml(activity.department || '未填写科室') + '</span>' + '<span class="activity-card-footer">参会 ' + (number(activity.attendees) || 0) + '人 <i>｜</i> 费用 ' + money(derived.budgetTotal) + '</span>' + '</button><button type="button" class="activity-card-sales" data-activity-sales="' + escapeHtml(activity.id) + '">查看医院销售</button></article>';
      }).join('');
      el.empty.hidden = rows.length > 0;
    }
    function chartRows(items, maxValue, kind) {
      if (!items.length) return '<p class="activity-chart-empty">暂无数据</p>';
      return items.map(item => {
        const filterAttribute = kind === 'type' ? ' data-expense-filter-type="' + escapeHtml(item.key) + '"' : kind === 'month' ? ' data-expense-filter-month="' + escapeHtml(item.key) + '"' : '';
        return '<button type="button"' + filterAttribute + ' aria-label="' + escapeHtml(item.label) + ' ' + escapeHtml(item.valueLabel) + '">' + '<span>' + escapeHtml(item.label) + '</span><i><b style="width:' + (maxValue ? item.value / maxValue * 100 : 0) + '%"></b></i><strong>' + escapeHtml(item.valueLabel) + '</strong></button>';
      }).join('');
    }
    function renderExpenses(rows) {
      const derivedRows = rows.map(activity => ({
        activity,
        derived: renderDerived(activity)
      }));
      const totalBudget = derivedRows.reduce((total, row) => total + row.derived.budgetTotal, 0);
      const actualByHospitalProduct = new Map();
      derivedRows.forEach(row => {
        const hospitalKey = text(row.activity.hospitalCode) || comparable(row.activity.hospital);
        const key = row.derived.fiscalYear + '|' + hospitalKey + '|' + comparable(row.activity.product);
        const previous = actualByHospitalProduct.get(key);
        if (!previous || text(row.activity.activityDate) > text(previous.activity.activityDate)) actualByHospitalProduct.set(key, row);
      });
      const totalActual = [...actualByHospitalProduct.values()].reduce((total, row) => total + row.derived.actualReimbursementTotal, 0);
      el.expenseCount.textContent = '共 ' + rows.length + ' 场';
      if (el.expenseSource) el.expenseSource.textContent = '数据来源：活动申请 ' + state.activities.length + ' 场 · 销售数据 ' + (state.records || []).length + ' 条 · 佰+管登记表 ' + state.activityLedgerEntries.length + ' 条';
      const metrics = [['申请费用', money(totalBudget)], ['实际核销费用', money(totalActual)], ['活动数量', rows.length + ' 场'], ['平均单场费用', money(rows.length ? totalBudget / rows.length : 0)]];
      el.expenseKpis.innerHTML = metrics.map(([label, value]) => '<article><span>' + label + '</span><strong>' + value + '</strong></article>').join('');
      const typeItems = ACTIVITY_TYPES.map(type => ({
        key: type,
        label: type,
        value: derivedRows.filter(row => row.activity.type === type).reduce((total, row) => total + row.derived.budgetTotal, 0)
      })).filter(row => row.value > 0);
      const typeCountItems = ACTIVITY_TYPES.map(type => ({
        key: type,
        label: type,
        value: rows.filter(row => row.type === type).length
      })).filter(row => row.value > 0);
      const monthKeys = [...new Set(rows.map(row => text(row.activityDate).slice(0, 7)).filter(Boolean))].sort();
      const monthItems = monthKeys.map(month => ({
        key: month,
        label: monthText(month),
        value: derivedRows.filter(row => text(row.activity.activityDate).slice(0, 7) === month).reduce((total, row) => total + row.derived.budgetTotal, 0)
      }));
      const comparison = [{
        key: 'budget',
        label: '申请预算',
        value: totalBudget
      }, {
        key: 'actual',
        label: '实际核销',
        value: totalActual
      }];
      el.typeExpenseChart.innerHTML = chartRows(typeItems.map(row => ({
        ...row,
        valueLabel: money(row.value)
      })), Math.max(1, ...typeItems.map(row => row.value)), 'type');
      el.typeCountChart.innerHTML = chartRows(typeCountItems.map(row => ({
        ...row,
        valueLabel: row.value + ' 场'
      })), Math.max(1, ...typeCountItems.map(row => row.value)), 'type');
      el.monthlyExpenseChart.innerHTML = chartRows(monthItems.map(row => ({
        ...row,
        valueLabel: money(row.value)
      })), Math.max(1, ...monthItems.map(row => row.value)), 'month');
      el.budgetActualChart.innerHTML = chartRows(comparison.map(row => ({
        ...row,
        valueLabel: money(row.value)
      })), Math.max(1, ...comparison.map(row => row.value)), 'none');
      el.expenseDetails.innerHTML = rows.length ? '<div class="activity-list-heading"><div><h3>活动明细</h3><p class="muted">图表筛选结果</p></div></div><div class="activity-expense-detail-list">' + derivedRows.map(({
        activity,
        derived
      }) => '<button type="button" data-edit-activity="' + escapeHtml(activity.id) + '"><span><strong>' + escapeHtml(activity.hospital || '未填写医院') + '</strong><small>' + escapeHtml(monthLabel(activity.activityDate)) + ' · ' + escapeHtml(activity.type) + ' · ' + escapeHtml(activity.product || '') + '</small></span><b>' + money(derived.budgetTotal) + '</b></button>').join('') + '</div>' : '';
      const hasRows = rows.length > 0;
      el.expenseEmpty.hidden = hasRows;
      el.expenseKpis.hidden = !hasRows;
      el.expenseCharts.hidden = !hasRows;
      el.expenseDetails.hidden = !hasRows;
    }
    function virtualImportHistory() {
      if (state.settings.activityImportHistory.length) return state.settings.activityImportHistory;
      const records = [];
      const mistaken = state.activities.filter(row => /^20\d{2}$/.test(text(row.sourceSheet))).length;
      if (state.activityLedgerEntries.length) {
        records.push({
          id: 'ledger-snapshot',
          mode: 'ledger',
          fileName: '佰+管登记表',
          importedAt: Object.values(state.settings.activityLedgerSnapshotAt || {}).sort().pop() || '',
          recognized: state.activityLedgerEntries.length,
          success: state.activityLedgerEntries.length,
          skipped: 0,
          errors: 0,
          mistakenActivities: mistaken
        });
      }
      if (state.settings.activityTemplate?.importedAt) {
        const sourceCount = state.activities.filter(row => row.sourceFile === state.settings.activityTemplate.name).length;
        records.push({
          id: 'application-template',
          mode: 'application',
          fileName: state.settings.activityTemplate.name || '活动申请模板',
          importedAt: state.settings.activityTemplate.importedAt,
          recognized: sourceCount,
          success: sourceCount,
          skipped: 0,
          errors: 0,
          mistakenActivities: 0
        });
      }
      return records;
    }
    function renderImports() {
      const history = [...virtualImportHistory()].filter(item => !item.importedAt || text(item.importedAt).slice(0, 7) === scopeMonth()).sort((a, b) => text(b.importedAt).localeCompare(text(a.importedAt)));
      const latest = history[0];
      el.importSummary.innerHTML = latest ? [['识别总数', latest.recognized], ['成功', latest.success], ['跳过', latest.skipped], ['异常', latest.errors]].map(([label, value]) => '<article><span>' + label + '</span><strong>' + number(value) + '</strong></article>').join('') : '<div class="activity-import-empty">尚无导入记录</div>';
      el.importHistory.innerHTML = history.length ? history.map(item => {
        const date = item.importedAt ? new Date(item.importedAt).toLocaleString('zh-CN') : '历史快照';
        const guard = item.mode === 'ledger' ? '<span class="guard">' + number(item.mistakenActivities) + ' 条误导入活动</span>' : '';
        return '<article class="activity-import-record"><div><strong>' + (item.mode === 'ledger' ? '佰+管登记表导入' : 'Excel 活动申请导入') + '</strong><small>' + escapeHtml(item.fileName || '') + ' · ' + escapeHtml(date) + '</small></div><div>' + '<span>识别 ' + number(item.recognized) + '</span><span class="success">成功 ' + number(item.success) + '</span><span>跳过 ' + number(item.skipped) + '</span><span class="' + (number(item.errors) ? 'error' : '') + '">异常 ' + number(item.errors) + '</span>' + guard + '</div></article>';
      }).join('') : '<div class="empty-state compact"><p>导入后将在这里显示识别结果。</p></div>';
    }
    function navigateSection(section, updateRoute = true) {
      const previousSection = currentSection;
      currentSection = ['list', 'expenses', 'imports'].includes(section) ? section : 'list';
      el.view.querySelectorAll('[data-activity-panel]').forEach(panel => {
        panel.hidden = panel.dataset.activityPanel !== currentSection;
      });
      document.querySelectorAll('#activityView [data-activity-section]').forEach(button => {
        const active = button.hasAttribute('data-activity-root') || button.dataset.activitySection === currentSection;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');else button.removeAttribute('aria-current');
        if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', String(active));
      });
      if (updateRoute) setRoute(currentSection, previousSection !== 'list' && currentSection !== 'list');
      render();
    }
    function render() {
      const previousDirectory = renderHospitalDirectory;
      const previousDerived = renderDerivedContext;
      try {
        ensureActivityState();
        if (currentSection === 'expenses') {
          renderHospitalDirectory = resolveHospitalDirectory();
          renderDerivedContext = createDerivedRenderContext(state.records, state.activityLedgerEntries, renderHospitalDirectory, getEmployeePlans());
        }
        renderStaff();
        renderFilterControls();
        renderDashboardKpis();
        const listRows = filtered({
          includeDate: true
        });
        const monthRows = filtered({
          includeDate: false
        });
        renderList(listRows);
        if (currentSection === 'expenses') renderExpenses(monthRows);
        if (currentSection === 'imports') renderImports();
        el.view.dataset.activitySection = currentSection;
        syncWheelTriggers();
        syncNavigationState();
      } finally {
        renderHospitalDirectory = previousDirectory;
        renderDerivedContext = previousDerived;
      }
    }
    async function readWorkbookFile(file) {
      if (!file || !window.XLSX) throw new Error('Excel 解析组件未加载');
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, {
        type: 'array',
        cellStyles: true,
        cellFormula: true,
        cellDates: true
      });
      return {
        buffer,
        workbook,
        parsed: parseWorkbook(workbook, window.XLSX, file.name)
      };
    }
    async function previewImport(file, mode) {
      try {
        importPreview = null;
        const result = await readWorkbookFile(file);
        const p = result.parsed;
        if (mode === 'application' && p.templates.length === 0) throw new Error('这不是活动申请模板，请选择包含“内训会”或“科室会”工作表的文件');
        if (mode === 'ledger' && p.ledgerRows.length === 0) throw new Error('未识别到财年费用记录，请选择包含年度工作表的佰+管登记表');
        importPreview = {
          ...result,
          mode
        };
        el.importStatus.textContent = mode === 'ledger' ? '识别总数 ' + p.ledgerRows.length + ' 条；确认后更新费用快照，0 条活动误导入。' : p.activities.length ? '识别总数 ' + p.activities.length + ' 条活动。确认前不会写入。' : '识别总数 0 条活动；确认后仅保存原申请模板，供手工新建活动导出。';
        const previewRows = mode === 'ledger' ? p.ledgerRows : p.activities;
        const previewHeaders = mode === 'ledger' ? ['财年 / 标记', '医院 / 编码', '科室', '产品', '实际核销'] : ['类型', '医院 / 编码', '科室', '产品', '预算'];
        [...el.importRows.closest('table').querySelectorAll('th')].forEach((header, index) => {
          header.textContent = previewHeaders[index];
        });
        el.importRows.innerHTML = previewRows.slice(0, 12).map(row => {
          const first = mode === 'ledger' ? row.fiscalYear + ' 财年 · ' + (row.markedYellow ? '黄色项目' : '非黄色') : row.type;
          const amount = mode === 'ledger' ? row.actualExpenseTotal : row.budgetTotal;
          return '<tr><td data-label="' + previewHeaders[0] + '">' + escapeHtml(first) + '</td><td data-label="医院 / 编码">' + escapeHtml(row.hospital) + '<br><small>' + escapeHtml(row.hospitalCode) + '</small></td><td data-label="科室">' + escapeHtml(row.department) + '</td><td data-label="产品">' + escapeHtml(row.product) + '</td><td data-label="' + previewHeaders[4] + '">' + (amount === null ? '待补实际金额' : money(amount)) + '</td></tr>';
        }).join('') || '<tr><td colspan="5">未识别到明细。</td></tr>';
        el.confirmImport.disabled = mode === 'ledger' ? p.ledgerRows.length === 0 : p.templates.length === 0;
        el.importDialog.showModal();
      } catch (error) {
        const importedAt = new Date().toISOString();
        state.settings.activityImportHistory.push({
          id: uid(),
          mode,
          fileName: file?.name || '未选择文件',
          importedAt,
          recognized: 0,
          success: 0,
          skipped: 0,
          errors: 1,
          mistakenActivities: 0
        });
        state.settings.activityImportHistory = state.settings.activityImportHistory.slice(-30);
        state.settings.settingsUpdatedAt = importedAt;
        persist();
        renderImports();
        showToast(error.message);
      }
    }
    function activityFingerprint(activity) {
      return [activity.sourceFile, activity.sourceSheet, activity.sourceRow, text(activity.activityDate).slice(0, 7), activity.hospitalCode, activity.product, activity.department].map(text).join('|');
    }
    function activityBusinessKey(activity) {
      if (text(activity.requestNumber)) return 'request:' + comparable(activity.requestNumber);
      return [text(activity.activityDate).slice(0, 7), comparable(activity.type), text(activity.hospitalCode) || comparable(activity.hospital), comparable(activity.department), comparable(activity.product), comparable(activity.speaker)].join('|');
    }
    function confirmImport() {
      if (!importPreview) return;
      const {
        parsed,
        buffer,
        mode
      } = importPreview;
      let added = 0;
      let updated = 0;
      if (mode === 'ledger' && parsed.ledgerRows.length) {
        const fiscalYears = new Set(parsed.ledgerRows.map(row => Number(row.fiscalYear)).filter(Boolean));
        state.activityLedgerEntries = state.activityLedgerEntries.filter(row => !fiscalYears.has(Number(row.fiscalYear)));
        const binder = typeof require === 'function' ? require('./hospital-maintenance-adapter.js') : window.HospitalMaintenanceAdapter;
        const boundLedgerRows = binder.bindHospitalRecords(parsed.ledgerRows, getHospitalDirectory());
        state.activityLedgerEntries.push(...boundLedgerRows.map(row => ({
          ...row,
          snapshotAt: parsed.importedAt
        })));
        state.settings.activityLedgerSnapshotAt = {
          ...(state.settings.activityLedgerSnapshotAt || {})
        };
        fiscalYears.forEach(fiscalYear => {
          state.settings.activityLedgerSnapshotAt[fiscalYear] = parsed.importedAt;
        });
      }
      if (mode === 'application') {
        const bySource = new Map(state.activities.filter(activity => activity.sourceFile).map(activity => [activityFingerprint(activity), activity]));
        const byBusiness = new Map(state.activities.filter(activity => activity.sourceFile).map(activity => [activityBusinessKey(activity), activity]));
        parsed.activities.forEach(activity => {
          const existing = bySource.get(activityFingerprint(activity)) || byBusiness.get(activityBusinessKey(activity));
          if (existing) {
            const next = {
              ...existing,
              ...activity,
              id: existing.id,
              status: existing.status || activity.status,
              requestNumber: activity.requestNumber || existing.requestNumber,
              applicationDate: activity.applicationDate || existing.applicationDate,
              createdAt: existing.createdAt || parsed.importedAt,
              updatedAt: parsed.importedAt
            };
            next.derived = calculateDerived(next, state.records, state.activityLedgerEntries, getHospitalDirectory(), false, false, null, getEmployeePlans());
            Object.assign(existing, next);
            updated += 1;
            bySource.set(activityFingerprint(next), existing);
            byBusiness.set(activityBusinessKey(next), existing);
          } else {
            activity.id = uid();
            activity.createdAt = parsed.importedAt;
            activity.updatedAt = parsed.importedAt;
            activity.derived = calculateDerived(activity, state.records, state.activityLedgerEntries, getHospitalDirectory(), false, false, null, getEmployeePlans());
            state.activities.push(activity);
            bySource.set(activityFingerprint(activity), activity);
            byBusiness.set(activityBusinessKey(activity), activity);
            added += 1;
          }
          const saved = existing || activity;
          ensureCustomerProfile(saved.departmentDirector, saved, '科室主任');
          ensureCustomerProfile(saved.speaker, saved, '讲者');
        });
      }
      if (mode === 'application' && parsed.templates.length) {
        state.settings.activityTemplate = {
          name: parsed.fileName,
          dataBase64: base64FromArrayBuffer(buffer),
          sheets: parsed.templates,
          importedAt: parsed.importedAt
        };
        state.settings.activityTemplateUpdatedAt = parsed.importedAt;
      }
      const recognized = mode === 'ledger' ? parsed.ledgerRows.length : parsed.activities.length;
      const success = mode === 'ledger' ? parsed.ledgerRows.length : added + updated;
      state.settings.activityImportHistory.push({
        id: uid(),
        mode,
        fileName: parsed.fileName,
        importedAt: parsed.importedAt,
        recognized,
        success,
        skipped: Math.max(0, recognized - success),
        errors: 0,
        mistakenActivities: 0
      });
      state.settings.activityImportHistory = state.settings.activityImportHistory.slice(-30);
      state.settings.settingsUpdatedAt = parsed.importedAt;
      if (mode === 'application') syncAllActivityTasks('import');
      persist();
      importPreview = null;
      el.importDialog.close();
      navigateSection('imports');
      showToast(mode === 'ledger' ? '已更新 ' + parsed.ledgerRows.length + ' 条费用记录，0 条活动误导入' : '申请模板已保存；新增 ' + added + ' 条、更新 ' + updated + ' 条活动');
    }
    async function exportActivity(activity) {
      if (!activity) return false;
      if (!hasOriginalTemplate(activity.type)) {
        showToast('当前活动类型暂无原模板，仅支持保存草稿和数据管理，暂不生成申请表。');
        return false;
      }
      try {
        const templates = await ensureEmbeddedTemplates();
        const next = {
          ...activity,
          derived: calculateDerived(activity, state.records, state.activityLedgerEntries, getHospitalDirectory(), false, false, null, getEmployeePlans())
        };
        const bytes = exportActivityWorkbook(templates.excel, next, window.XLSX);
        const wordBytes = exportActivityWord(templates.word, next, window.XLSX);
        const name = next.activityDate.replaceAll('-', '') + '-' + (next.product || '产品') + '-' + next.type + '-' + (next.hospital || '医院');
        for (const [content, extension, mime] of [[wordBytes, '.docx', 'wordprocessingml.document'], [bytes, '.xlsx', 'spreadsheetml.sheet']]) {
          await saveApplicationPackage(content, name + extension, 'application/vnd.openxmlformats-officedocument.' + mime);
        }
        showToast('已生成公共通用 Word 与 Excel；不包含私人业务表单');
        return true;
      } catch (error) {
        showToast(error.message);
        return false;
      }
    }
    async function generateCurrent() {
      const missing = missingRequiredFields();
      if (missing.length) {
        byId(missing[0][0])?.focus();
        showToast(el.validation.textContent);
        return;
      }
      const draft = activityValues();
      if (!hasOriginalTemplate(draft.type)) {
        showToast('当前活动类型暂无原模板，仅支持保存草稿和数据管理，暂不生成申请表。');
        return;
      }
      try {
        await ensureEmbeddedTemplates();
      } catch (error) {
        showToast(error.message);
        return;
      }
      let saved;
      try { saved = await persistEditorActivity({validation: 'final'}); }
      catch { showToast('本地保存失败，编辑草稿已保留，请重试'); return; }
      if (saved && (await exportActivity(saved))) closeEditor();
    }
    function addStaff() {
      const name = text(el.staffInput.value);
      if (!name) return;
      if (!state.settings.companyEmployees.some(item => comparable(item) === comparable(name))) state.settings.companyEmployees.push(name);
      el.staffInput.value = '';
      state.settings.settingsUpdatedAt = new Date().toISOString();
      persist();
      renderStaff();
      updateDerivedPreview();
    }
    function openEditor(activity = null, updateRoute = true, options = {}) {
      returnSection = currentSection;
      const existing = activity?.id && state.activities.find(a=>a.id===activity.id);
      const seed = {...(activity || {}), id: existing ? existing.id : ''};
      fillForm(seed);
      draftUI?.activate(seed, options.draftRecord);
      editorCloseLocally = options.closeLocally === true;
      if (!el.dialog.open) el.dialog.showModal();
      el.dialog.scrollTop = 0;
      el.form.scrollTop = 0;
      if (updateRoute) setRoute(activity?.id ? 'edit/' + encodeURIComponent(activity.id) : 'new');
    }
    function openActivityById(id, options = {}) {
      const activity = state.activities.find(item => item.id === id);
      if (activity) openEditor(activity, options.updateRoute !== false, options);
    }
    function parseRoute() {
      const match = location.hash.match(/^#\/activity\/(list|expenses|imports|new|edit\/([^/]+))$/);
      return match ? {
        route: match[1],
        id: match[2] ? decodeURIComponent(match[2]) : ''
      } : null;
    }
    function handleRoute() {
      if (!moduleActive) return;
      const route = parseRoute();
      if (!route) {
        navigateSection('list', false);
        return;
      }
      if (['list', 'expenses', 'imports'].includes(route.route)) {
        currentSection = route.route;
        if (el.dialog.open) el.dialog.close();
        navigateSection(route.route, false);
        return;
      }
      if (route.route === 'new') openEditor(null, false);else if (route.route.startsWith('edit/')) {
        const activity = state.activities.find(item => item.id === route.id);
        if (activity) openEditor(activity, false);else {
          setRoute('list', true);
          navigateSection('list', false);
        }
      }
    }
    function enter(options = {}) {
      if (!moduleActive) {
        moduleActive = true;
        const route = parseRoute();
        currentSection = route && ['list', 'expenses', 'imports'].includes(route.route) ? route.route : 'list';
        if (!route && !options.preserveRoute) setRoute(currentSection, true);
      }
      handleRoute();
    }
    function leave(options = {}) {
      if (!moduleActive) return;
      moduleActive = false;
      editorCloseLocally = false;
      if (el.dialog.open) el.dialog.close();
      if (!options.preserveRoute && location.hash.startsWith('#/activity/')) history.replaceState(null, '', location.pathname + location.search);
    }
    [el.typeFilter, el.statusFilter, el.productFilter].forEach(control => control.addEventListener('change', () => {
      const key = control === el.typeFilter ? 'type' : control === el.statusFilter ? 'approval' : 'product';
      setFilter(key, control.value);
    }));
    el.yearFilter.addEventListener('change', () => setTimeContext({
      year: el.yearFilter.value,
      date: ''
    }));
    el.monthFilter.addEventListener('change', () => setTimeContext({
      month: el.monthFilter.value,
      date: ''
    }));
    el.dateFilter.addEventListener('change', () => setTimeContext({
      date: el.dateFilter.value
    }));
    el.dateToken.addEventListener('click', () => setTimeContext({
      date: ''
    }));
    el.currentMonthButton.addEventListener('click', () => {
      const today = dateKey();
      setTimeContext({
        year: Number(today.slice(0, 4)),
        month: Number(today.slice(5, 7)),
        date: ''
      });
    });
    el.search.addEventListener('input', () => {
      filters.query = el.search.value;
      render();
    });
    el.resetFilters.addEventListener('click', resetFilters);
    el.typeChips.addEventListener('click', event => {
      const clear = event.target.closest('[data-clear-activity-type]');
      const button = event.target.closest('[data-activity-type-chip]');
      if (clear) {
        setFilter('type', 'all');
        el.typeChips.scrollTo({
          left: 0,
          behavior: 'smooth'
        });
      } else if (button) {
        const value = button.dataset.activityTypeChip;
        setFilter('type', value);
        el.typeChips.querySelector('[data-activity-type-chip="' + CSS.escape(value) + '"]')?.scrollIntoView({
          block: 'nearest',
          inline: 'center'
        });
      }
    });
    el.statusChips.addEventListener('click', event => {
      const button = event.target.closest('[data-activity-status-chip]');
      if (button) setFilter('approval', button.dataset.activityStatusChip);
    });
    el.view.addEventListener('click', event => {
      const section = event.target.closest('button[data-activity-section]');
      if (section) {
        if (section.dataset.activitySection === 'list' && currentSection !== 'list' && navigationCoordinator?.back?.('activity-subpage')) return;
        navigateSection(section.dataset.activitySection);
        return;
      }
      const importer = event.target.closest('[data-trigger-activity-import]');
      if (importer) {
        (importer.dataset.triggerActivityImport === 'ledger' ? el.ledgerFile : el.file).click();
        return;
      }
      const select = event.target.closest('[data-select-activity]');
      if (select) {
        const id = select.dataset.selectActivity;
        selectedActivityIds.has(id) ? selectedActivityIds.delete(id) : selectedActivityIds.add(id);
        render();
        return;
      }
      if (event.target.closest('[data-select-all-activities]')) {
        const ids = filtered().map(a => a.id),
          all = ids.length && ids.every(id => selectedActivityIds.has(id));
        ids.forEach(id => all ? selectedActivityIds.delete(id) : selectedActivityIds.add(id));
        render();
        return;
      }
      if (event.target.closest('[data-bulk-remove-activities]')) {
        if (!selectedActivityIds.size || !confirm('删除无引用草稿；正式活动取消并保留历史。继续？')) return;
        for (const id of [...selectedActivityIds]) removeActivity(id, {
          confirmed: true,
          deferRender: true
        });
        selectedActivityIds.clear();
        persist();
        render();
        return;
      }
      const remove = event.target.closest('[data-remove-activity]');
      if (remove) {
        removeActivity(remove.dataset.removeActivity);
        return;
      }
      const edit = event.target.closest('[data-edit-activity]');
      if (edit) openActivityById(edit.dataset.editActivity);
      const sales = event.target.closest('[data-activity-sales]');
      if (sales) {
        const activity = state.activities.find(item => String(item.id) === String(sales.dataset.activitySales));
        if (activity) onViewSales(activity);
      }
    });
    [el.newButton, el.mobileNewButton].forEach(button => button.addEventListener('click', () => openEditor()));
    el.importButton.addEventListener('click', () => el.file.click());
    el.ledgerButton.addEventListener('click', () => el.ledgerFile.click());
    el.file.addEventListener('change', () => {
      previewImport(el.file.files?.[0], 'application');
      el.file.value = '';
    });
    el.ledgerFile.addEventListener('change', () => {
      previewImport(el.ledgerFile.files?.[0], 'ledger');
      el.ledgerFile.value = '';
    });
    el.confirmImport.addEventListener('click', confirmImport);
    el.form.addEventListener('submit', saveActivity);
    el.deleteButton.addEventListener('click', removeActivity);
    el.exportButton.addEventListener('click', generateCurrent);
    el.form.addEventListener('click', event => {
      if (event.target.closest('[data-close-activity-editor]')) {
        closeEditor();
        return;
      }
      const customerButton = event.target.closest('[data-new-customer-role]');
      if (customerButton) {
        createCustomerFromEditor(customerButton.dataset.newCustomerRole);
        return;
      }
      const customerContext = event.target.closest('[data-open-customer-role]');
      if (customerContext) {
        const activity = activityValues();
        const role = customerContext.dataset.openCustomerRole;
        const person = role === 'director' ? activity.departmentDirector : activity.speaker;
        if (!person) return showToast('请先填写' + (role === 'director' ? '科室主任' : '讲者') + '姓名');
        syncNavigationState();
        onOpenCustomerContext(person, activity, captureNavigationState());
        return;
      }
      const activityContext = event.target.closest('[data-open-activity-context]');
      if (activityContext) {
        const activity = activityValues();
        syncNavigationState();
        if (activityContext.dataset.openActivityContext === 'hospital') onOpenHospitalContext(activity, captureNavigationState());else if (activityContext.dataset.openActivityContext === 'sales') onOpenSalesContext(activity, captureNavigationState());else if (activityContext.dataset.openActivityContext === 'task') {
          if (!activity.id) showToast('请先保存活动，再查看关联任务');else onOpenTaskContext(activity, captureNavigationState());
        }
      }
    });
    el.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeEditor();
    });
    byId('activityApprovalStatus').addEventListener('change', event => {
      delete event.currentTarget.dataset.inferred;
    });
    el.addStaff.addEventListener('click', addStaff);
    el.staffInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addStaff();
      }
    });
    el.staffList.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-company-employee]');
      if (!button) return;
      if (DEFAULT_COMPANY_EMPLOYEES.some(name => comparable(name) === comparable(button.dataset.removeCompanyEmployee))) return;
      state.settings.companyEmployees = state.settings.companyEmployees.filter(name => name !== button.dataset.removeCompanyEmployee);
      state.settings.settingsUpdatedAt = new Date().toISOString();
      persist();
      renderStaff();
    });
    [el.typeExpenseChart, el.typeCountChart, el.monthlyExpenseChart].forEach(chart => chart.addEventListener('click', event => {
      const type = event.target.closest('[data-expense-filter-type]');
      const month = event.target.closest('[data-expense-filter-month]');
      if (type) setFilter('type', type.dataset.expenseFilterType);else if (month) {
        const [year, value] = month.dataset.expenseFilterMonth.split('-');
        setTimeContext({
          year,
          month: value,
          date: ''
        });
      }
    }));
    byId('activitySourcePlan')?.addEventListener('change', updateDerivedPreview);
    ['activityHospital', 'activityProduct', 'activityApplicationDate', 'activityDepartment'].forEach(id => byId(id)?.addEventListener('change', () => renderSourcePlanOptions()));
    ['activityDate', 'activityApplicationDate', 'activityAttendees', 'activityHospitalCode', 'activitySpeaker', 'activityDepartmentDirector', 'activityBudgetPerCapita', 'activityBudgetMeal', 'activityBudgetGift', 'activityBudgetSpeaker'].forEach(id => byId(id).addEventListener('change', updateDerivedPreview));
    [['activityHospital', updateHospitalLink, renderHospitalCandidates], ['activityDepartment', updateDepartmentLink, renderDepartmentCandidates]].forEach(([id, update, renderCandidates]) => {
      const input = byId(id),
        list = byId(id + 'Candidates');
      input.addEventListener('compositionstart', () => {
        input.dataset.composing = 'true';
        closeDirectoryCandidates(id);
      });
      input.addEventListener('compositionend', () => {
        delete input.dataset.composing;
        update('', {
          derive: false
        });
        renderCandidates();
      });
      input.addEventListener('input', event => {
        if (event.isComposing || input.dataset.composing) return;
        update('', {
          derive: false
        });
        renderCandidates();
      });
      input.addEventListener('change', () => update());
      input.addEventListener('focus', renderCandidates);
      input.addEventListener('keydown', event => {
        if (event.isComposing || input.dataset.composing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          closeDirectoryCandidates(id);
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          renderCandidates();
          list.querySelector('button')?.focus();
        }
      });
      list.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          input.focus();
          closeDirectoryCandidates(id);
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const buttons = [...list.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement);
          buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
      });
      input.parentElement.addEventListener('focusout', event => {
        if (!input.parentElement.contains(event.relatedTarget)) closeDirectoryCandidates(id);
      });
    });
    el.dialog.addEventListener('close', () => {
      editorHospitalDirectory = null;
      closeHospitalCandidates();
      closeDirectoryCandidates('activityDepartment');
    });
    window.visualViewport?.addEventListener('resize', () => {
      for (const id of ['activityHospital', 'activityDepartment']) {
        const list = byId(id + 'Candidates');
        if (list && !list.hidden) list.style.maxHeight = Math.max(44, Math.min(220, window.visualViewport.height * .3)) + 'px';
      }
    });
    byId('activitySalesExplanationLine').addEventListener('input', () => {
      byId('activitySalesExplanationLine').dataset.edited = 'true';
    });
    ['activityDepartmentDirector', 'activitySpeaker'].forEach(id => {
      const input = byId(id);
      const list = byId(id + 'Candidates');
      input.addEventListener('input', () => {
        delete input.dataset.entityId;
        renderPersonOptions(id);
      });
      input.addEventListener('focus', () => renderPersonOptions(id));
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          list.hidden = true;
          input.setAttribute('aria-expanded', 'false');
        }
      });
      input.parentElement.addEventListener('focusout', event => {
        if (!input.parentElement.contains(event.relatedTarget)) {
          list.hidden = true;
          input.setAttribute('aria-expanded', 'false');
        }
      });
    });
    ['activityHospitalCode', 'activityHospitalLevel'].forEach(id => byId(id).addEventListener('input', event => {
      if (event.isTrusted) delete event.currentTarget.dataset.activityAutofilled;
    }));
    byId('activityType').addEventListener('change', () => updateTemplateAvailability(true));
    byId('activityProduct').addEventListener('change', defaultTopic);
    byId('searchHospitalLevelButton').addEventListener('click', () => {
      const hospital = text(byId('activityHospital').value);
      if (!hospital) return showToast('请先填写Synthetic Hospital Example');
      window.open('https://www.baidu.com/s?wd=' + encodeURIComponent(hospital + ' 医院级别'), '_blank', 'noopener,noreferrer');
    });
    const listPanel = byId('activityListPanel');
    listPanel.addEventListener('touchstart', event => {
      if (window.scrollY <= 2) pullStartY = event.touches[0]?.clientY ?? null;
    }, {
      passive: true
    });
    listPanel.addEventListener('touchmove', event => {
      if (pullStartY === null) return;
      const distance = Math.max(0, (event.touches[0]?.clientY || 0) - pullStartY);
      if (distance > 12) {
        el.pullIndicator.classList.add('visible');
        el.pullIndicator.textContent = distance > 64 ? '松开刷新' : '下拉刷新';
      }
    }, {
      passive: true
    });
    listPanel.addEventListener('touchend', event => {
      if (pullStartY === null) return;
      const distance = Math.max(0, (event.changedTouches[0]?.clientY || 0) - pullStartY);
      pullStartY = null;
      if (distance > 64) {
        el.pullIndicator.textContent = '已刷新';
        render();
      }
      setTimeout(() => el.pullIndicator.classList.remove('visible'), 500);
    }, {
      passive: true
    });
    if (!navigationCoordinator) window.addEventListener('hashchange', handleRoute);

    function draftReferenceExists(field,id,snapshot){
      if (!id) return false;
      if (field==='hospitalId') return getHospitalDirectory().some(h=>h.hospitalId===id&&h.active!==false&&!h.deletedAt);
      if (field==='departmentId') return getHospitalDirectory().some(h=>h.hospitalId===snapshot.hospitalId&&(h.departments||[]).some(d=>d.departmentId===id));
      if (['customerId','directorCustomerId','speakerCustomerId'].includes(field)) {
        let people=getCustomerEntities();
        if (!people.length) {try{people=JSON.parse(WorkDeskPersistence.storage.getItem('customer-profile-v1-1-master-data')||'{}').records||[];}catch{return false;}}
        return people.some(p=>p.customerId===id&&p.active!==false&&(!snapshot.hospitalId||p.hospitalId===snapshot.hospitalId));
      }
      return field==='employeeId' && (state.employeePlanRecords||[]).some(p=>p.employeeId===id) || field==='employeeId'&&editorSeed.employeeId===id;
    }
    function captureDraft(record){
      const snapshot={...editorSeed,...activityValues()},references={};
      snapshot.id=record.mode==='EDIT'?record.sourceActivityId:'';
      snapshot.customerMatchStatus=editorSeed.customerMatchStatus||'';
      const fields={hospitalId:'activityHospital',departmentId:'activityDepartment',directorCustomerId:'activityDepartmentDirector',speakerCustomerId:'activitySpeaker'};
      for (const [key,input]of Object.entries(fields)) if(snapshot[key]&&byId(input).dataset.reliableIdentity==='true') references[key]={id:snapshot[key],status:'STABLE_ID',evidence:record.mode==='EDIT'?'SAVED_ACTIVITY':'USER_SELECTED_STABLE_ID'};
      if(snapshot.departmentIds?.length&&byId('activityDepartment').dataset.reliableIdentity==='true') references.departmentIds={ids:snapshot.departmentIds,status:'STABLE_ID',evidence:record.mode==='EDIT'?'SAVED_ACTIVITY':'USER_SELECTED_STABLE_ID'};
      for (const key of ['customerId','employeeId']) if(snapshot[key]&&record.mode==='EDIT'&&editorSeed[key]===snapshot[key]) references[key]={id:snapshot[key],status:'STABLE_ID',evidence:'SAVED_ACTIVITY'};
      if(record.mode==='CREATE'&&snapshot.customerId&&window.WorkspaceNavigation?.isReliableCustomerMatch?.({...editorSeed,customerId:snapshot.customerId})) references.customerId={id:snapshot.customerId,status:'STABLE_ID',evidence:'USER_SELECTED_STABLE_ID'};
      return {snapshot,reliableReferences:references};
    }
    draftUI=ActivityDraftUI.attach({form:el.form,dialog:el.dialog,capture:captureDraft,referenceExists:draftReferenceExists,showToast,existing:id=>state.activities.find(a=>a.id===id),formalId:uid,onCommitted:activity=>{editorSeed={...activity};},restore:(snapshot,record)=>openEditor(snapshot,true,{draftRecord:record})});

    if (!el.view.hidden) render();
    return {
      render,
      enter,
      leave,
      handleRoute,
      resetFilters,
      openActivityById,
      openEditor,
      navigateSection,
      onAndroidSaveResult,
      captureNavigationState,
      getNavigationState: captureNavigationState,
      getDraftStore: ()=>draftUI.getStore(),
      flushDraft: ()=>draftUI.flush(),
      restoreNavigationState,
      setTimeContext: (next, options = {}) => setTimeContext(next, {
        notify: false,
        explicit: options.explicit === true
      }),
      getSection: () => currentSection,
      isSecondaryPage: () => el.dialog.open || currentSection !== 'list',
      hasOpenLayer: () => Boolean(el.dialog.open),
      closeTopLayer: () => {
        if (!el.dialog.open) return false;
        const openCandidates = ['activityHospital', 'activityDepartment', 'activityDepartmentDirector', 'activitySpeaker'].filter(id => {
          const list = byId(id + 'Candidates');
          return list && !list.hidden;
        });
        if (openCandidates.length) {
          openCandidates.forEach(closeDirectoryCandidates);
          return true;
        }
        closeEditor();
        return true;
      }
    };
  }
  return {
    ACTIVITY_TYPES,
    ACTIVITY_STATUSES,
    DEFAULT_COMPANY_EMPLOYEES,
    UNIT_PRICE,
    PRODUCT_TOPICS,
    scopedPeople,
    monthLabel,
    nextMonthLabel,
    fiscalYearForDate,
    fiscalRange,
    fiscalExpenseDisclosure,
    projectEmployeePlans,
    resolveActivityPlan,
    calculateDerived,
    hospitalAcademicConsumption,
    createDerivedRenderContext,
    parseWorkbook,
    exportActivityWorkbook,
    exportActivityWord,
    init
  };
});
