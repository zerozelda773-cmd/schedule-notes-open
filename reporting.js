(function initQuarterlyReporting(root, factory) {
  const api = factory(root?.ProductRegistry || (typeof require === 'function' ? require('./product-registry.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuarterlyReporting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, Products => {
  if (!Products) throw new Error('Product Registry is required for reporting.');
  const DAY = 86400000;
  function pad(value) {
    return String(value).padStart(2, '0');
  }
  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function endOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0, 12);
  }
  function range(start, end, label) {
    return {
      from: dateKey(start),
      to: dateKey(end),
      label
    };
  }
  function fiscalYear(date) {
    return date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
  }
  function fiscalQuarter(date) {
    const month = date.getMonth() + 1;
    if (month >= 10) return 1;
    if (month <= 3) return 2;
    if (month <= 6) return 3;
    return 4;
  }
  function resolveFiscalPeriod(value) {
    const date = parseDate(value) || (value instanceof Date ? value : new Date());
    return {
      fiscalYear: fiscalYear(date),
      fiscalQuarter: fiscalQuarter(date),
      month: date.getMonth() + 1,
      date: dateKey(date)
    };
  }
  function stableProductId(value) {
    const text = String(value || '').trim().toLowerCase();
    return Products.getProduct(text)?.id || (text === 'all' || !text ? 'all' : 'unknown');
  }
  function monthRange(date) {
    return range(new Date(date.getFullYear(), date.getMonth(), 1, 12), endOfMonth(date.getFullYear(), date.getMonth()), `${date.getFullYear()}年${date.getMonth() + 1}月`);
  }
  function fiscalYearRange(date) {
    const year = fiscalYear(date);
    return range(new Date(year - 1, 9, 1, 12), new Date(year, 8, 30, 12), `FY${year}`);
  }
  function fiscalQuarterRange(date) {
    const year = fiscalYear(date);
    const quarter = fiscalQuarter(date);
    const starts = {
      1: [year - 1, 9],
      2: [year, 0],
      3: [year, 3],
      4: [year, 6]
    };
    const [startYear, startMonth] = starts[quarter];
    return range(new Date(startYear, startMonth, 1, 12), new Date(startYear, startMonth + 3, 0, 12), `FY${year} Q${quarter}`);
  }
  function shiftMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), 28), 12);
  }
  function priorRange(source, months, label) {
    const start = parseDate(source.from);
    const end = parseDate(source.to);
    const shiftedStart = new Date(start.getFullYear(), start.getMonth() + months, start.getDate(), 12);
    const shiftedEnd = new Date(end.getFullYear(), end.getMonth() + months + 1, 0, 12);
    return range(shiftedStart, shiftedEnd, label);
  }
  function alignedPriorRange(current, prior, asOfDate) {
    const currentStart = parseDate(current.from);
    const priorStart = parseDate(prior.from);
    const asOf = parseDate(asOfDate);
    const elapsedDays = Math.max(0, Math.round((asOf - currentStart) / DAY));
    const alignedEnd = new Date(priorStart.getTime() + elapsedDays * DAY);
    const priorEnd = parseDate(prior.to);
    return {
      ...prior,
      to: dateKey(alignedEnd > priorEnd ? priorEnd : alignedEnd)
    };
  }
  function createPeriodContext(referenceDate) {
    const reference = parseDate(referenceDate) || new Date();
    const fiscal = resolveFiscalPeriod(reference);
    const month = monthRange(reference);
    const quarter = fiscalQuarterRange(reference);
    const year = fiscalYearRange(reference);
    return {
      asOfDate: dateKey(reference),
      fiscalYear: fiscal.fiscalYear,
      fiscalQuarter: fiscal.fiscalQuarter,
      currentMonth: month,
      previousMonth: monthRange(shiftMonths(reference, -1)),
      sameMonthLastYear: monthRange(shiftMonths(reference, -12)),
      currentQuarter: quarter,
      previousQuarter: priorRange(quarter, -3, '上一财季'),
      sameQuarterLastYear: priorRange(quarter, -12, '上年同期财季'),
      currentFiscalYear: year,
      sameFiscalYearLastYear: priorRange(year, -12, `FY${fiscalYear(reference) - 1}`)
    };
  }
  function rowsInRange(records, target) {
    return records.filter(record => record.date >= target.from && record.date <= target.to);
  }
  function sum(records, key) {
    return records.reduce((total, record) => total + (Number(record[key]) || 0), 0);
  }
  function percentageChange(current, previous) {
    if (current === null || current === undefined || previous === null || previous === undefined || Number(previous) === 0) return null;
    return (Number(current) - Number(previous)) / Number(previous);
  }
  function formatMetricValue(value, metric, digits = 1) {
    const number = clampFinite(value);
    if (metric?.unit === '元' && Math.abs(number) >= 10000) return `${(number / 10000).toFixed(digits)}万元`;
    const maximumFractionDigits = metric?.unit === '盒' && Number.isInteger(number) ? 0 : digits;
    return `${number.toLocaleString('zh-CN', {
      maximumFractionDigits
    })}${metric?.unit || ''}`;
  }
  function formatShare(value) {
    return `${(clampFinite(value) * 100).toFixed(1)}%`;
  }
  function metricDefinition(fiscalRows) {
    const useSales = sum(fiscalRows, 'salesAmount') > 0;
    return useSales ? {
      key: 'salesAmount',
      label: '销售额',
      unit: '元',
      methodology: '优先汇总销售金额；盒数和明细数用于交叉核对。'
    } : {
      key: 'orderBoxes',
      label: '下单盒数',
      unit: '盒',
      methodology: '源数据无有效销售金额，按下单盒数汇总；明细数用于交叉核对。'
    };
  }
  function summarize(records, metric) {
    return {
      value: sum(records, metric.key),
      salesAmount: sum(records, 'salesAmount'),
      orderBoxes: sum(records, 'orderBoxes'),
      recordCount: records.length
    };
  }
  function monthKeys(from, to) {
    const start = parseDate(from);
    const end = parseDate(to);
    const result = [];
    for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      result.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
    }
    return result;
  }
  function dimensionRows(records, key, metric, limit = 10) {
    const groups = new Map();
    records.forEach(record => {
      const name = String(record[key] || `未填写${{
        product: '产品',
        hospital: '医院',
        employee: '员工',
        department: '科室'
      }[key] || ''}`).trim();
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(record);
    });
    const total = sum(records, metric.key);
    return [...groups.entries()].map(([name, rows]) => ({
      name,
      ...summarize(rows, metric),
      share: total ? sum(rows, metric.key) / total : 0
    })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN')).slice(0, limit);
  }
  function signedPercent(value) {
    if (value === null) return '缺少可比基期';
    return `${value >= 0 ? '增长' : '下降'}${Math.abs(value * 100).toFixed(1)}%`;
  }
  function dimensionConclusion(label, rows, periodLabel = '当前财季') {
    if (!rows.length || rows[0].value <= 0) return `${periodLabel}暂无可用于${label}分析的有效数据。`;
    return `${rows[0].name}位居${label}首位，占 ${periodLabel} 总量的 ${rows[0].share * 100 >= 0.05 ? (rows[0].share * 100).toFixed(1) : '<0.1'}%。`;
  }
  function selectedPeriodRanges(context, mode = 'quarter') {
    const definitions = {
      month: [context.currentMonth, context.previousMonth, context.sameMonthLastYear, '本月'],
      quarter: [context.currentQuarter, context.previousQuarter, context.sameQuarterLastYear, '本财季'],
      fiscalYear: [context.currentFiscalYear, context.sameFiscalYearLastYear, context.sameFiscalYearLastYear, '本财年']
    };
    const selectedMode = definitions[mode] ? mode : 'quarter';
    const [currentFull, previousFull, lastYearFull, shortLabel] = definitions[selectedMode];
    const current = {
      ...currentFull,
      to: context.asOfDate
    };
    const previous = alignedPriorRange(current, previousFull, context.asOfDate);
    const lastYear = alignedPriorRange(current, lastYearFull, context.asOfDate);
    const keyLabel = selectedMode === 'month' ? currentFull.from.slice(0, 7) : currentFull.label.replace(/\s+/g, '-');
    return {
      mode: selectedMode,
      key: `${selectedMode}:${keyLabel}`,
      label: currentFull.label,
      shortLabel,
      current,
      previous,
      lastYear
    };
  }
  function dimensionChanges(currentRows, previousRows, key, metric) {
    const totals = rows => {
      const values = new Map();
      rows.forEach(row => {
        const name = String(row[key] || '').trim();
        if (name) values.set(name, (values.get(name) || 0) + (Number(row[metric.key]) || 0));
      });
      return values;
    };
    const current = totals(currentRows);
    const previous = totals(previousRows);
    return [...new Set([...current.keys(), ...previous.keys()])].map(name => ({
      name,
      current: current.get(name) || 0,
      previous: previous.get(name) || 0,
      change: (current.get(name) || 0) - (previous.get(name) || 0)
    }));
  }
  function buildRuleInsights(selected, currentRows, previousRows, metric, productRows, hospitalRows, employeeRows) {
    if (!currentRows.length) return [`${selected.label}截至${selected.current.to}暂无销售明细，建议先导入或同步数据。`];
    const current = summarize(currentRows, metric);
    const previous = summarize(previousRows, metric);
    const lastYear = selected.lastYearSummary;
    const insights = [`${selected.shortLabel}${metric.label}同比${signedPercent(percentageChange(current.value, lastYear.value))}，环比${signedPercent(percentageChange(current.value, previous.value))}。`];
    const growth = dimensionChanges(currentRows, previousRows, 'product', metric).sort((a, b) => b.change - a.change)[0];
    if (growth?.change > 0) insights.push(`${growth.name}是主要增长来源，较上一期增加${growth.change.toFixed(1)}${metric.unit}。`);else if (productRows[0]) insights.push(`${productRows[0].name}为主要产品，占${selected.shortLabel}${(productRows[0].share * 100).toFixed(1)}%。`);
    const decline = dimensionChanges(currentRows, previousRows, 'hospital', metric).filter(item => item.change < 0).sort((a, b) => a.change - b.change)[0];
    if (decline) insights.push(`${decline.name}较上一期减少${Math.abs(decline.change).toFixed(1)}${metric.unit}，建议重点复核。`);else if (hospitalRows[0]) insights.push(`${hospitalRows[0].name}为医院贡献首位，占${(hospitalRows[0].share * 100).toFixed(1)}%。`);
    const topThreeShare = employeeRows.slice(0, 3).reduce((total, item) => total + item.share, 0);
    if (employeeRows.length) insights.push(`员工贡献前三名合计占${(topThreeShare * 100).toFixed(1)}%，${topThreeShare >= 0.7 ? '集中度较高' : '团队贡献相对均衡'}。`);
    return insights.slice(0, 5);
  }
  function buildQuarterlyReportMaterial(records = [], options = {}) {
    records = Products.reportingSalesRecords(records);
    const selectedProduct = String(options.product || '').trim();
    const validRecords = records.filter(record => parseDate(record.date) && (!selectedProduct || selectedProduct === 'all' || stableProductId(record.productId || record.product) === stableProductId(selectedProduct)));
    const latestDate = validRecords.map(record => record.date.slice(0, 10)).sort().pop();
    const context = createPeriodContext(options.asOfDate || latestDate || dateKey(new Date()));
    const selected = selectedPeriodRanges(context, options.periodMode);
    const monthCutoff = {
      ...context.currentMonth,
      to: context.asOfDate
    };
    const quarterCutoff = {
      ...context.currentQuarter,
      to: context.asOfDate
    };
    const fiscalCutoff = {
      ...context.currentFiscalYear,
      to: context.asOfDate
    };
    const previousMonthRange = alignedPriorRange(monthCutoff, context.previousMonth, context.asOfDate);
    const previousQuarterRange = alignedPriorRange(quarterCutoff, context.previousQuarter, context.asOfDate);
    const sameQuarterLastYearRange = alignedPriorRange(quarterCutoff, context.sameQuarterLastYear, context.asOfDate);
    const previousFiscalYearRange = alignedPriorRange(fiscalCutoff, context.sameFiscalYearLastYear, context.asOfDate);
    const fiscalRows = rowsInRange(validRecords, fiscalCutoff);
    const metric = metricDefinition(fiscalRows);
    const quarterRows = rowsInRange(validRecords, quarterCutoff);
    const currentQuarter = summarize(quarterRows, metric);
    const previousQuarter = summarize(rowsInRange(validRecords, previousQuarterRange), metric);
    const sameQuarterLastYear = summarize(rowsInRange(validRecords, sameQuarterLastYearRange), metric);
    const currentMonth = summarize(rowsInRange(validRecords, monthCutoff), metric);
    const previousMonth = summarize(rowsInRange(validRecords, previousMonthRange), metric);
    const currentFiscalYear = summarize(fiscalRows, metric);
    const previousFiscalYear = summarize(rowsInRange(validRecords, previousFiscalYearRange), metric);
    const months = monthKeys(context.currentFiscalYear.from, context.asOfDate);
    const monthlyTrend = months.map(month => {
      const rows = fiscalRows.filter(record => record.date.slice(0, 7) === month);
      return {
        period: month,
        ...summarize(rows, metric)
      };
    });
    const peak = monthlyTrend.reduce((best, item) => item.value > (best?.value || 0) ? item : best, null);
    const selectedRows = rowsInRange(validRecords, selected.current);
    const selectedPreviousRows = rowsInRange(validRecords, selected.previous);
    const selectedLastYearRows = rowsInRange(validRecords, selected.lastYear);
    const selectedCurrent = summarize(selectedRows, metric);
    const selectedPrevious = summarize(selectedPreviousRows, metric);
    const selectedLastYear = summarize(selectedLastYearRows, metric);
    selected.lastYearSummary = selectedLastYear;
    const productRows = dimensionRows(selectedRows, 'product', metric);
    const hospitalRows = dimensionRows(selectedRows, 'hospital', metric);
    const employeeRows = dimensionRows(selectedRows, 'employee', metric);
    const departmentRows = dimensionRows(selectedRows, 'department', metric);
    const quarterMom = percentageChange(currentQuarter.value, previousQuarter.value);
    const quarterYoy = percentageChange(currentQuarter.value, sameQuarterLastYear.value);
    const productId = stableProductId(selectedProduct);
    const commonMethodology = `${metric.methodology} 财年按10月1日至次年9月30日，财季依次为Q1=10–12月、Q2=1–3月、Q3=4–6月、Q4=7–9月；${selectedProduct && selectedProduct !== 'all' ? `仅统计${selectedProduct}；` : ''}统计截至${context.asOfDate}。`;
    const charts = [{
      id: 'fiscal-monthly-trend',
      chartType: 'line',
      title: `${context.currentFiscalYear.label} 月度${metric.label}趋势`,
      timeRange: `${context.currentFiscalYear.from} 至 ${context.asOfDate}`,
      methodology: commonMethodology,
      series: monthlyTrend,
      conclusion: peak && peak.value > 0 ? `${peak.period.replace('-', '年')}月为财年截至目前峰值。` : '当前财年暂无有效销售数据。'
    }, {
      id: 'quarter-comparison',
      chartType: 'comparison',
      title: `${context.currentQuarter.label} 同比 / 环比`,
      timeRange: `${context.currentQuarter.from} 至 ${context.asOfDate}`,
      methodology: commonMethodology,
      series: [{
        name: '当前财季',
        ...currentQuarter
      }, {
        name: '上一财季',
        ...previousQuarter
      }, {
        name: '上年同期',
        ...sameQuarterLastYear
      }],
      comparisons: {
        yoy: quarterYoy,
        mom: quarterMom
      },
      conclusion: `当前财季${metric.label}较上年同期${signedPercent(quarterYoy)}，较上一财季${signedPercent(quarterMom)}。`
    }, {
      id: 'product-performance',
      chartType: 'bars',
      title: `${selected.label} ${selectedProduct && selectedProduct !== 'all' ? selectedProduct : '产品'}表现`,
      timeRange: `${selected.current.from} 至 ${selected.current.to}`,
      methodology: commonMethodology,
      series: productRows,
      conclusion: productRows[0] ? `${selected.shortLabel}${productRows[0].name}${metric.label}${productRows[0].value.toFixed(1)}${metric.unit}。` : `${selected.shortLabel}暂无产品销售数据。`
    }, {
      id: 'hospital-ranking',
      chartType: 'bars',
      title: `${selected.label} 医院 TOP 排名`,
      timeRange: `${selected.current.from} 至 ${selected.current.to}`,
      methodology: commonMethodology,
      series: hospitalRows,
      conclusion: dimensionConclusion('医院排名', hospitalRows, selected.shortLabel)
    }, {
      id: 'employee-ranking',
      chartType: 'bars',
      title: `${selected.label} 员工贡献排名`,
      timeRange: `${selected.current.from} 至 ${selected.current.to}`,
      methodology: commonMethodology,
      series: employeeRows,
      conclusion: dimensionConclusion('员工贡献', employeeRows, selected.shortLabel)
    }, {
      id: 'department-distribution',
      chartType: 'bars',
      title: `${selected.label} 科室分布`,
      timeRange: `${selected.current.from} 至 ${selected.current.to}`,
      methodology: commonMethodology,
      series: departmentRows,
      conclusion: dimensionConclusion('科室分布', departmentRows, selected.shortLabel)
    }].map(chart => ({
      ...chart,
      fiscalYear: context.fiscalYear,
      fiscalQuarter: context.fiscalQuarter,
      month: options.periodMode === 'month' ? Number(context.asOfDate.slice(5, 7)) : null,
      cutoffDate: context.asOfDate,
      product: productId
    }));
    return {
      schemaVersion: 1,
      title: `${context.currentQuarter.label} 销售汇报素材包`,
      generatedAt: new Date().toISOString(),
      asOfDate: context.asOfDate,
      product: productId,
      periods: context,
      metric,
      methodology: commonMethodology,
      summaries: {
        currentMonth: {
          ...currentMonth,
          yoy: percentageChange(currentMonth.value, summarize(rowsInRange(validRecords, alignedPriorRange(monthCutoff, context.sameMonthLastYear, context.asOfDate)), metric).value),
          mom: percentageChange(currentMonth.value, previousMonth.value)
        },
        currentQuarter: {
          ...currentQuarter,
          yoy: quarterYoy,
          mom: quarterMom
        },
        currentFiscalYear: {
          ...currentFiscalYear,
          yoy: percentageChange(currentFiscalYear.value, previousFiscalYear.value),
          mom: percentageChange(currentFiscalYear.value, previousFiscalYear.value)
        }
      },
      dashboard: {
        selectedPeriod: {
          mode: selected.mode,
          key: selected.key,
          label: selected.label,
          shortLabel: selected.shortLabel,
          from: selected.current.from,
          to: selected.current.to,
          ...selectedCurrent,
          yoy: percentageChange(selectedCurrent.value, selectedLastYear.value),
          mom: percentageChange(selectedCurrent.value, selectedPrevious.value),
          activeHospitals: new Set(selectedRows.map(record => record.hospital).filter(Boolean)).size
        },
        insights: buildRuleInsights(selected, selectedRows, selectedPreviousRows, metric, productRows, hospitalRows, employeeRows)
      },
      charts
    };
  }
  function clampFinite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function addDays(date, days) {
    return new Date(date.getTime() + days * DAY);
  }
  function customRange(from, to, fallbackDate) {
    const end = parseDate(to) || parseDate(fallbackDate) || new Date();
    const start = parseDate(from) || new Date(fiscalYear(end) - 1, 9, 1, 12);
    const safeStart = start > end ? end : start;
    return range(safeStart, end, `${dateKey(safeStart)} 至 ${dateKey(end)}`);
  }
  function comparisonRanges(current) {
    const start = parseDate(current.from);
    const end = parseDate(current.to);
    const duration = Math.max(0, Math.round((end - start) / DAY));
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -duration);
    const yoyStart = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate(), 12);
    const yoyEnd = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate(), 12);
    return {
      previous: range(previousStart, previousEnd, '上一周期'),
      lastYear: range(yoyStart, yoyEnd, '上年同期')
    };
  }
  function normalizeEntityText(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s·•.。,_，()（）\-]/g, '');
  }
  function matchCustomerEntity(query = {}, candidates = []) {
    const hospitalId = normalizeEntityText(query.hospitalId);
    const departmentId = normalizeEntityText(query.departmentId);
    const hospital = normalizeEntityText(query.hospital);
    const department = normalizeEntityText(query.department);
    const name = normalizeEntityText(query.name || query.customer);
    const scoped = candidates.filter(candidate => {
      if (hospitalId && normalizeEntityText(candidate.hospitalId) !== hospitalId) return false;
      if (departmentId && normalizeEntityText(candidate.departmentId) !== departmentId) return false;
      if (!hospitalId && hospital && normalizeEntityText(candidate.hospital) !== hospital) return false;
      if (!departmentId && department && normalizeEntityText(candidate.department) !== department) return false;
      return true;
    });
    const named = name ? scoped.filter(candidate => {
      const candidateName = normalizeEntityText(candidate.name || candidate.customer);
      return name.length === 1 ? candidateName.includes(name) : candidateName === name || candidateName.includes(name) || name.includes(candidateName);
    }) : scoped;
    const matchCandidates = (name ? named : scoped).map(candidate => ({
      id: candidate.id || candidate.customerId || '',
      name: candidate.name || candidate.customer || '',
      hospitalId: candidate.hospitalId || '',
      departmentId: candidate.departmentId || '',
      hospital: candidate.hospital || '',
      department: candidate.department || ''
    }));
    const idMethod = hospitalId || departmentId;
    const method = [hospitalId ? 'hospitalId' : '', departmentId ? 'departmentId' : '', name ? name.length === 1 ? 'single-character-name' : 'name' : ''].filter(Boolean).join('+') || 'none';
    return {
      matchConfidence: matchCandidates.length === 1 ? idMethod || hospital && department ? 'high' : 'medium' : matchCandidates.length > 1 ? 'pending' : 'none',
      matchCandidates,
      matchMethod: method
    };
  }
  function applyDashboardFilters(records, filters = {}) {
    const selected = (key, value) => !value || value === 'all' || String(key || '').trim() === String(value).trim();
    const reliableCustomerId = record => {
      const statuses = [record.customerMatchStatus, record.matchType, record.matchConfidence, record.confidenceLevel, record.resolvedBy].map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
      if (statuses.some(value => /^(PROBABLE|AMBIGUOUS|UNMATCHED|LOW|FUZZY|MEDIUM|PENDING|NONE)$/.test(value))) return false;
      return Boolean(String(record.customerId || '').trim()) && (!statuses.length || statuses.some(value => /^(EXACT|CONFIRMED|HIGH|ACCEPTED|STABLE_ID|MANUAL_MAPPING)$/.test(value)));
    };
    const dimension = (record, idKey, nameKey) => {
      const id = String(filters[idKey] ?? '').trim();
      const name = filters[nameKey];
      if (!id) return selected(record[nameKey], name);
      const recordId = String(record[idKey] || '').trim();
      if (recordId) return recordId === id;
      if (!name || name === 'all' || !selected(record[nameKey], name)) return false;
      const exactNameRows = records.filter(item => selected(item[nameKey], name));
      const distinctIds = new Set(exactNameRows.map(item => String(item[idKey] || '').trim()).filter(Boolean));
      return distinctIds.size <= 1 && (!distinctIds.size || distinctIds.has(id));
    };
    return records.filter(record => (!filters.product || filters.product === 'all' || stableProductId(record.productId || record.product) === stableProductId(filters.product)) && selected(record.office, filters.office) && dimension(record, 'hospitalId', 'hospital') && dimension(record, 'departmentId', 'department') && dimension(record, 'employeeId', 'employee') && (!filters.customerId || reliableCustomerId(record) && String(record.customerId).trim() === String(filters.customerId).trim()));
  }
  function dimensionRankings(currentRows, previousRows, key, metric, limit = 10) {
    const values = rows => {
      const result = new Map();
      rows.forEach(row => {
        const name = String(row[key] || `未填写${{
          hospital: '医院',
          employee: '员工'
        }[key] || ''}`).trim();
        result.set(name, (result.get(name) || 0) + clampFinite(row[metric.key]));
      });
      return result;
    };
    const current = values(currentRows);
    const previous = values(previousRows);
    const total = [...current.values()].reduce((sumValue, value) => sumValue + value, 0);
    const all = [...new Set([...current.keys(), ...previous.keys()])].map(name => {
      const value = current.get(name) || 0;
      const prior = previous.get(name) || 0;
      return {
        name,
        value,
        previous: prior,
        change: value - prior,
        changeRate: prior ? (value - prior) / prior : null,
        share: total ? value / total : 0
      };
    });
    return {
      contribution: [...all].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN')).slice(0, limit),
      growth: [...all].sort((a, b) => b.change - a.change || b.value - a.value).slice(0, limit),
      decline: [...all].sort((a, b) => a.change - b.change || b.previous - a.previous).slice(0, limit)
    };
  }
  function finiteOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function planList(value) {
    if (Array.isArray(value)) return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
    return [...new Set(String(value || '').split(/[、,，;；\n]/).map(item => item.trim()).filter(Boolean))];
  }
  function planMonthKey(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : '';
  }
  function normalizeCustomerLevels(task) {
    const source = task.customerLevels || task.plannedCustomerLevels || {};
    const levels = {};
    ['A', 'B', 'C', 'D'].forEach(level => {
      const value = finiteOrNull(source[level] ?? task[`customer${level}`] ?? task[`planned${level}Customers`]);
      if (value !== null) levels[level] = Math.max(0, value);
    });
    return levels;
  }
  function normalizeEmployeePlan(task) {
    const employee = String(task.employee || task.employeeName || '').trim();
    const product = stableProductId(task.product || task.productId);
    const target = finiteOrNull(task.planTarget ?? task.targetBoxes ?? task.salesTarget ?? task.targetValue);
    const hospitals = planList(task.plannedHospitals ?? task.planHospitals ?? task.hospitals ?? task.hospital);
    const departments = planList(task.plannedDepartments ?? task.planDepartments ?? task.departments ?? task.department);
    const customerLevels = normalizeCustomerLevels(task);
    const text = String(task.planText || task.planContent || task.notes || task.title || '').trim();
    const month = planMonthKey(task.planPeriod || task.planMonth || task.due || task.date || task.createdAt);
    const explicit = task.isEmployeePlan === true || target !== null || hospitals.length > 1 || departments.length > 1 || Object.keys(customerLevels).length > 0 || /计划|目标|四定|规划/.test(`${task.category || ''}${task.title || ''}`);
    if (!explicit || !employee || !month || product === 'all') return null;
    return {
      id: task.id || `${employee}-${product}-${month}`,
      employee,
      office: String(task.office || '').trim(),
      product,
      month,
      target,
      hospitals,
      departments,
      customerLevels,
      plannedUpgrades: Math.max(0, finiteOrNull(task.plannedUpgrades ?? task.customerUpgrades) || 0),
      decomposedTarget: finiteOrNull(task.decomposedTarget ?? task.targetBreakdownTotal),
      text
    };
  }
  function textSimilarity(left, right) {
    const grams = value => {
      const text = String(value || '').replace(/[\s，。；、,.!?！？:：]/g, '');
      const result = new Set();
      if (text.length < 2) {
        if (text) result.add(text);
        return result;
      }
      for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
      return result;
    };
    const a = grams(left);
    const b = grams(right);
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter(item => b.has(item)).length;
    return intersection / (a.size + b.size - intersection);
  }
  function employeeRows(records, employee) {
    return records.filter(row => String(row.employee || '').trim() === employee);
  }
  function planValidationRange(month, cutoffDate) {
    const start = parseDate(`${month}-01`);
    const plannedEnd = endOfMonth(start.getFullYear(), start.getMonth() + 1);
    const cutoff = parseDate(cutoffDate) || plannedEnd;
    return range(start, cutoff < plannedEnd ? cutoff : plannedEnd, `${month}计划验证窗口`);
  }
  function historicalMonthlyAverage(records, employee, month, metric) {
    const start = parseDate(`${month}-01`);
    const values = [];
    for (let offset = 3; offset >= 1; offset -= 1) {
      const date = new Date(start.getFullYear(), start.getMonth() - offset, 1, 12);
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      const rows = employeeRows(records, employee).filter(row => row.date.slice(0, 7) === key);
      if (rows.length) values.push(sum(rows, metric.key));
    }
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }
  function scoreVolumeFit(plans, records, employee, metric, cutoffDate) {
    const comparable = plans.filter(plan => plan.target !== null);
    if (!comparable.length) return {
      score: null,
      issues: [],
      positives: [],
      evidence: {}
    };
    const periods = comparable.map(plan => {
      const monthStart = parseDate(`${plan.month}-01`);
      const monthEnd = endOfMonth(monthStart.getFullYear(), monthStart.getMonth());
      const cutoff = parseDate(cutoffDate) || monthEnd;
      const actual = sum(rowsInRange(employeeRows(records, employee), range(monthStart, cutoff < monthEnd ? cutoff : monthEnd, `${plan.month}实际`)), metric.key);
      const historicalAverage = historicalMonthlyAverage(records, employee, plan.month, metric);
      const actualFit = 100 * (1 - Math.min(1, Math.abs(actual - plan.target) / Math.max(plan.target, actual, 1)));
      const historyFit = historicalAverage === null ? null : 100 * (1 - Math.min(1, Math.abs(plan.target - historicalAverage) / Math.max(plan.target, historicalAverage, 1)));
      return {
        month: plan.month,
        target: plan.target,
        actual,
        historicalAverage,
        score: historyFit === null ? actualFit : actualFit * .7 + historyFit * .3
      };
    });
    let score = periods.reduce((total, item) => total + item.score, 0) / periods.length;
    const targets = periods.map(item => item.target);
    const repeated = periods.length >= 3 && Math.max(...targets) - Math.min(...targets) <= Math.max(1, Math.abs(targets[0]) * .03);
    const consistentlyLow = periods.length >= 3 && periods.every(item => item.target > 0 && item.actual / item.target < .5);
    if (repeated && consistentlyLow) score -= 24;
    const latest = periods.at(-1);
    const issues = [];
    const positives = [];
    if (repeated && consistentlyLow) issues.push({
      severity: 95,
      code: 'persistent-overestimate',
      text: `连续${periods.length}期目标基本不变，但实际长期低于目标50%。`
    });
    if (latest.target > 0 && latest.actual / latest.target < .6) issues.push({
      severity: 82,
      code: 'target-gap',
      text: `计划目标${latest.target.toFixed(1)}${metric.unit}，验证期实际${latest.actual.toFixed(1)}${metric.unit}，偏差较大。`
    });else if (latest.target > 0 && Math.abs(latest.actual - latest.target) / latest.target <= .2) positives.push(`计划目标与实际${metric.label}偏差在20%以内。`);
    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      positives,
      evidence: {
        periods,
        planTarget: latest.target,
        actualSales: latest.actual,
        historicalAverage: latest.historicalAverage
      }
    };
  }
  function scoreHospitalDepartmentFit(plans, records, employee, metric, cutoffDate) {
    const comparable = plans.filter(plan => plan.hospitals.length || plan.departments.length);
    if (!comparable.length) return {
      score: null,
      issues: [],
      positives: [],
      evidence: {}
    };
    const plannedHospitals = [...new Set(comparable.flatMap(plan => plan.hospitals))];
    const plannedDepartments = [...new Set(comparable.flatMap(plan => plan.departments))];
    const validationRows = comparable.flatMap(plan => rowsInRange(employeeRows(records, employee), planValidationRange(plan.month, cutoffDate)));
    const uniqueRows = [...new Map(validationRows.map((row, index) => [`${row.id || ''}|${row.date}|${row.hospital}|${row.department}|${index}`, row])).values()];
    const matchedHospitals = plannedHospitals.filter(name => uniqueRows.some(row => String(row.hospital || '').trim() === name && clampFinite(row[metric.key]) > 0));
    const matchedDepartments = plannedDepartments.filter(name => uniqueRows.some(row => String(row.department || '').trim() === name && clampFinite(row[metric.key]) > 0));
    const plannedCount = plannedHospitals.length + plannedDepartments.length;
    const matchedCount = matchedHospitals.length + matchedDepartments.length;
    const coverage = plannedCount ? matchedCount / plannedCount : 0;
    const actualHospitals = dimensionRows(uniqueRows, 'hospital', metric, 20).filter(item => item.value > 0);
    const actualDepartments = dimensionRows(uniqueRows, 'department', metric, 20).filter(item => item.value > 0);
    const mainHospital = actualHospitals[0]?.name;
    const mainDepartment = actualDepartments[0]?.name;
    const mainCaptured = (!mainHospital || plannedHospitals.includes(mainHospital)) && (!mainDepartment || plannedDepartments.includes(mainDepartment));
    const score = Math.max(0, Math.min(100, coverage * 75 + (mainCaptured ? 25 : 0)));
    const issues = [];
    const positives = [];
    const missingHospitals = plannedHospitals.filter(name => !matchedHospitals.includes(name));
    if (missingHospitals.length) issues.push({
      severity: 88,
      code: 'planned-hospital-no-sales',
      text: `计划重点医院中${missingHospitals.slice(0, 2).join('、')}在验证窗口暂无销售产出。`
    });
    if (mainHospital && !plannedHospitals.includes(mainHospital)) issues.push({
      severity: 78,
      code: 'unplanned-growth-source',
      text: `实际主要销售来源${mainHospital}未在重点医院计划中体现。`
    });
    if (mainDepartment && plannedDepartments.length && !plannedDepartments.includes(mainDepartment)) issues.push({
      severity: 72,
      code: 'department-mismatch',
      text: `实际主要科室${mainDepartment}与计划重点方向不一致。`
    });
    if (matchedCount) positives.push(`${matchedCount}个计划医院/科室方向在验证窗口出现实际产出。`);
    return {
      score,
      issues,
      positives,
      evidence: {
        plannedHospitals,
        plannedDepartments,
        matchedHospitals,
        matchedDepartments,
        actualGrowthHospitals: actualHospitals.slice(0, 5),
        actualGrowthDepartments: actualDepartments.slice(0, 5)
      }
    };
  }
  function scoreCustomerLevelFit(plans, actualValue, metric) {
    const withLevels = plans.filter(plan => Object.keys(plan.customerLevels).length);
    if (!withLevels.length) return {
      score: null,
      issues: [],
      positives: [],
      evidence: {}
    };
    const latest = withLevels.at(-1);
    const levels = latest.customerLevels;
    const high = (levels.A || 0) + (levels.B || 0);
    const total = Object.values(levels).reduce((sumValue, value) => sumValue + value, 0);
    const expectedMinimum = high * 10;
    let score = 100;
    if (high && actualValue < expectedMinimum) score -= Math.min(70, (expectedMinimum - actualValue) / expectedMinimum * 70);
    if (latest.plannedUpgrades > 0 && actualValue <= 0) score -= 20;
    const issues = [];
    if (high && actualValue < expectedMinimum) issues.push({
      severity: 68,
      code: 'customer-level-scale',
      text: `计划登记${high}名A/B类客户，但实际${metric.label}${actualValue.toFixed(1)}${metric.unit}，结构合理性偏低。`
    });
    const positives = high && actualValue >= expectedMinimum ? ['高等级客户数量与当前实际产出规模基本匹配。'] : [];
    return {
      score: Math.max(0, score),
      issues,
      positives,
      evidence: {
        plannedCustomerLevels: levels,
        plannedCustomerTotal: total,
        highLevelCustomers: high,
        actualSales: actualValue
      }
    };
  }
  function scorePlanQuality(plans) {
    if (!plans.length) return {
      score: null,
      issues: [],
      positives: [],
      evidence: {}
    };
    let score = 100;
    const issues = [];
    const positives = [];
    const missingFields = plans.reduce((total, plan) => total + [plan.target !== null, plan.hospitals.length > 0, plan.departments.length > 0, Boolean(plan.text)].filter(value => !value).length, 0);
    const missingRate = missingFields / (plans.length * 4);
    score -= missingRate * 35;
    const similarities = [];
    for (let index = 1; index < plans.length; index += 1) similarities.push(textSimilarity(plans[index - 1].text, plans[index].text));
    const averageSimilarity = similarities.length ? similarities.reduce((total, value) => total + value, 0) / similarities.length : 0;
    if (plans.length >= 3 && averageSimilarity >= .8) {
      score -= 30;
      issues.push({
        severity: 84,
        code: 'repeated-plan-text',
        text: `连续${plans.length}期计划内容高度重复（相似度${(averageSimilarity * 100).toFixed(0)}%）。`
      });
    }
    const targets = plans.map(plan => plan.target).filter(value => value !== null);
    const repeatedTargets = targets.length >= 3 && Math.max(...targets) === Math.min(...targets);
    if (repeatedTargets) {
      score -= 15;
      issues.push({
        severity: 62,
        code: 'repeated-target',
        text: `连续${targets.length}期计划目标完全一致，建议复核是否结合实际变化更新。`
      });
    }
    const rounded = targets.length ? targets.filter(value => value % 5 === 0).length / targets.length : 0;
    if (targets.length >= 3 && rounded === 1) score -= 8;
    const decompositionMismatch = plans.find(plan => plan.target !== null && plan.decomposedTarget !== null && Math.abs(plan.target - plan.decomposedTarget) > Math.max(1, plan.target * .05));
    if (decompositionMismatch) {
      score -= 20;
      issues.push({
        severity: 76,
        code: 'target-breakdown-mismatch',
        text: '目标分解合计与员工总目标不一致。'
      });
    }
    if (missingRate <= .15 && averageSimilarity < .65) positives.push('计划字段较完整，连续周期内容有实际调整。');
    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      positives,
      evidence: {
        missingRate,
        planSimilarity: averageSimilarity,
        repeatedTargets,
        roundedTargetRate: rounded
      }
    };
  }
  function fitStatus(score, kind = '') {
    if (kind === 'unfilled') return {
      key: 'unfilled',
      label: '未填写'
    };
    if (score === null) return {
      key: 'insufficient',
      label: '数据不足'
    };
    if (score >= 80) return {
      key: 'trusted',
      label: '较可信'
    };
    if (score >= 60) return {
      key: 'partial',
      label: '部分符合'
    };
    if (score >= 40) return {
      key: 'review',
      label: '需复核'
    };
    return {
      key: 'low',
      label: '低拟合'
    };
  }
  function buildEmployeePlanFitAnalysis(records = [], tasks = [], options = {}) {
    const filters = options.filters || options;
    const selection = options.selection || fiscalSelection(filters, filters.cutoffDate);
    const selectedProduct = stableProductId(filters.product);
    const metric = options.planMetric || {
      key: 'orderBoxes',
      label: '下单盒数',
      unit: '盒',
      methodology: '员工计划拟合 V1 按盒数验证；医院与科室仅做结构匹配，不映射到具体客户个人。'
    };
    const cutoffDate = selection.cutoffDate || selection.current.to;
    const scopedRecords = applyDashboardFilters(records, filters);
    const productRecords = scopedRecords.filter(row => stableProductId(row.product) === selectedProduct && row.date <= cutoffDate);
    const currentRows = rowsInRange(productRecords, selection.current);
    const planMatchesFilters = plan => plan.product === selectedProduct && (!filters.office || filters.office === 'all' || plan.office === filters.office) && (!filters.employee || filters.employee === 'all' || plan.employee === filters.employee) && (!filters.hospital || filters.hospital === 'all' || plan.hospitals.includes(filters.hospital)) && (!filters.department || filters.department === 'all' || plan.departments.includes(filters.department));
    const normalized = tasks.map(normalizeEmployeePlan).filter(Boolean).filter(planMatchesFilters);
    const normalizedPlans = normalized.filter(plan => `${plan.month}-01` >= selection.current.from && `${plan.month}-01` <= selection.current.to);
    const planHistoryCutoff = selection.current.to < cutoffDate ? selection.current.to : cutoffDate;
    const allProductPlans = normalized.filter(plan => `${plan.month}-01` <= planHistoryCutoff);
    const employees = [...new Set([...currentRows.map(row => String(row.employee || '').trim()), ...normalizedPlans.map(plan => plan.employee)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const ranking = employees.map(employee => {
      const plans = normalizedPlans.filter(plan => plan.employee === employee).sort((a, b) => a.month.localeCompare(b.month));
      const historyPlans = allProductPlans.filter(plan => plan.employee === employee).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
      const actualRows = employeeRows(currentRows, employee);
      const actualValue = sum(actualRows, metric.key);
      const office = plans.find(plan => plan.office)?.office || actualRows.find(row => row.office)?.office || '';
      if (!plans.length) return {
        employeeId: employee,
        employeeName: employee,
        name: employee,
        office,
        product: selectedProduct,
        fitScore: null,
        status: fitStatus(null, 'unfilled'),
        scores: {
          volumeFit: null,
          hospitalDepartmentFit: null,
          customerLevelFit: null,
          planQuality: null
        },
        issues: [],
        positives: [],
        planSummary: '当前筛选周期未填写员工计划。',
        actualSummary: `实际${metric.label}${actualValue.toFixed(1)}${metric.unit}。`,
        evidence: {
          actualSales: actualValue
        },
        dataState: 'unfilled'
      };
      const volume = scoreVolumeFit(historyPlans, productRecords, employee, metric, cutoffDate);
      const hospitalDepartment = scoreHospitalDepartmentFit(plans, productRecords, employee, metric, cutoffDate);
      const customerLevelFit = scoreCustomerLevelFit(plans, actualValue, metric);
      const quality = scorePlanQuality(historyPlans);
      const weighted = [[volume.score, .3], [hospitalDepartment.score, .3], [customerLevelFit.score, .2], [quality.score, .2]].filter(([score]) => score !== null);
      const scoredWeight = weighted.reduce((total, [, weight]) => total + weight, 0);
      const fitScore = scoredWeight >= .5 && currentRows.length ? weighted.reduce((total, [score, weight]) => total + score * weight, 0) / scoredWeight : null;
      const issues = [...volume.issues, ...hospitalDepartment.issues, ...customerLevelFit.issues, ...quality.issues].sort((a, b) => b.severity - a.severity).slice(0, 5);
      const positives = [...volume.positives, ...hospitalDepartment.positives, ...customerLevelFit.positives, ...quality.positives].slice(0, 5);
      const latest = plans.at(-1);
      return {
        employeeId: employee,
        employeeName: employee,
        name: employee,
        office,
        product: selectedProduct,
        fiscalYear: selection.fiscalYear,
        fiscalQuarter: selection.fiscalQuarter,
        month: selection.month,
        cutoffDate,
        fitScore,
        status: fitStatus(fitScore),
        scoredWeight,
        scores: {
          volumeFit: volume.score,
          hospitalDepartmentFit: hospitalDepartment.score,
          customerLevelFit: customerLevelFit.score,
          planQuality: quality.score
        },
        issues,
        positives,
        planSummary: latest.target === null ? `已填写计划，未提供可比较的量化目标。` : `最新计划目标${latest.target.toFixed(1)}${metric.unit}，重点医院${latest.hospitals.length}家、重点科室${latest.departments.length}个。`,
        actualSummary: `当前筛选周期实际${metric.label}${actualValue.toFixed(1)}${metric.unit}。`,
        evidence: {
          planTarget: volume.evidence.planTarget ?? latest.target,
          actualSales: actualValue,
          historicalAverage: volume.evidence.historicalAverage ?? null,
          plannedHospitals: hospitalDepartment.evidence.plannedHospitals || latest.hospitals,
          actualGrowthHospitals: hospitalDepartment.evidence.actualGrowthHospitals || [],
          plannedDepartments: hospitalDepartment.evidence.plannedDepartments || latest.departments,
          actualGrowthDepartments: hospitalDepartment.evidence.actualGrowthDepartments || [],
          volumePeriods: volume.evidence.periods || [],
          customerLevels: customerLevelFit.evidence,
          planQuality: quality.evidence
        },
        dataState: fitScore === null ? 'insufficient' : 'normal'
      };
    });
    const scored = ranking.filter(item => item.fitScore !== null);
    const teamAverage = scored.length ? scored.reduce((total, item) => total + item.fitScore, 0) / scored.length : null;
    const lowFit = scored.filter(item => item.fitScore < 60).sort((a, b) => a.fitScore - b.fitScore);
    const trusted = scored.filter(item => item.fitScore >= 80);
    const issueCounts = new Map();
    ranking.flatMap(item => item.issues).forEach(issue => issueCounts.set(issue.code, {
      code: issue.code,
      text: issue.text,
      count: (issueCounts.get(issue.code)?.count || 0) + 1
    }));
    const majorIssues = [...issueCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const statusCounts = ranking.reduce((counts, item) => ({
      ...counts,
      [item.status.key]: (counts[item.status.key] || 0) + 1
    }), {
      trusted: 0,
      partial: 0,
      review: 0,
      low: 0,
      unfilled: 0,
      insufficient: 0
    });
    const coverageRate = employees.length ? normalizedPlans.filter(plan => employees.includes(plan.employee)).reduce((set, plan) => set.add(plan.employee), new Set()).size / employees.length : 0;
    const summary = !employees.length ? '当前筛选范围暂无员工销售或计划数据。' : !scored.length ? `当前周期共 ${employees.length} 名员工，员工计划覆盖率不足，本项仅供参考。` : `当前周期 ${scored.length} 名员工可评分，团队平均拟合度 ${teamAverage.toFixed(1)} 分；${lowFit.length} 名低于 60 分，建议人工复核。`;
    return {
      product: selectedProduct,
      fiscalYear: selection.fiscalYear,
      fiscalQuarter: selection.fiscalQuarter,
      month: selection.month,
      cutoffDate,
      metric,
      weights: {
        volumeFit: .3,
        hospitalDepartmentFit: .3,
        customerLevelFit: .2,
        planQuality: .2
      },
      teamAverage,
      scoredCount: scored.length,
      employeeCount: employees.length,
      coverageRate,
      trustedCount: trusted.length,
      lowFitCount: lowFit.length,
      statusCounts,
      ranking: [...ranking].sort((a, b) => (a.fitScore === null) - (b.fitScore === null) || (a.fitScore ?? 101) - (b.fitScore ?? 101) || a.employeeName.localeCompare(b.employeeName, 'zh-CN')),
      lowFit,
      unfilled: ranking.filter(item => item.dataState === 'unfilled'),
      majorIssues,
      summary,
      detailedAnalysis: coverageRate < .5 ? [summary, `当前仅有${scored.length}名员工具备可评分计划，不能据此判断团队计划质量。`, '待补充计划目标、重点医院、重点科室和客户等级后，再进行拟合诊断。', '未填写或数据不足不计入低拟合名单。'] : [summary, lowFit.length ? `低拟合员工：${lowFit.slice(0, 5).map(item => `${item.employeeName} ${item.fitScore.toFixed(0)}%`).join('、')}。` : '当前没有低于60分的员工。', majorIssues.length ? `主要异常类型：${majorIssues.slice(0, 3).map(item => item.text).join('；')}` : '当前没有可汇总的主要异常。', trusted.length ? `计划参考价值较高：${trusted.slice(0, 5).map(item => item.employeeName).join('、')}。` : '当前没有达到“较可信”阈值的员工。']
    };
  }
  function customerLevel(value) {
    if (value > 30) return 'A';
    if (value >= 20) return 'B';
    if (value >= 10) return 'C';
    return 'D';
  }
  function customerGradeProgress(value) {
    const currentBoxes = Math.max(0, clampFinite(value));
    const currentGrade = customerLevel(currentBoxes);
    const next = {
      D: ['C', 10],
      C: ['B', 20],
      B: ['A', 31],
      A: [null, null]
    }[currentGrade];
    return {
      currentBoxes,
      currentGrade,
      nextGrade: next[0],
      nextGradeThreshold: next[1],
      upgradeGap: next[1] === null ? 0 : Math.max(0, next[1] - currentBoxes)
    };
  }
  function customerPlanActuals(tasks = [], selectedProduct = '') {
    const productId = stableProductId(selectedProduct);
    const months = new Map();
    tasks.filter(task => task?.recordType === 'customerUpgradePlan' && (!selectedProduct || productId === 'all' || stableProductId(task.product) === productId)).forEach(task => {
      const upgrade = task.customerUpgrade || {};
      const source = upgrade.actuals || {};
      const planYear = Number(String(task.planPeriod || task.due || '').slice(0, 4)) || Number(task.fiscalYear);
      if (!planYear) return;
      const identity = String(task.customerId || [task.employee, task.hospital, task.department, task.customer].map(value => String(value || '').trim().toLowerCase()).join('|'));
      [['june', 6], ['july', 7]].forEach(([field, month]) => {
        if (source[field] === null || source[field] === undefined || source[field] === '' || !Number.isFinite(Number(source[field]))) return;
        const period = `${planYear}-${String(month).padStart(2, '0')}`;
        const key = `${identity}|${period}`;
        const candidate = {
          id: identity,
          customerId: task.customerId || identity,
          customerPlanProvider: task.customerPlanProvider || 'customer-upgrade-workbook',
          customerProfileRoute: task.customerProfileRoute || '',
          customer: String(task.customer || '').trim(),
          hospital: String(task.hospital || '').trim(),
          department: String(task.department || '').trim(),
          employee: String(task.employee || '').trim(),
          office: String(task.office || '').trim(),
          product: task.product,
          period,
          date: `${period}-01`,
          boxes: Math.max(0, Number(source[field])),
          reportedSalesGrade: String(upgrade.reportedSalesGrade || '').toUpperCase(),
          nextMonthTarget: upgrade.nextMonthTarget === null || upgrade.nextMonthTarget === undefined || upgrade.nextMonthTarget === '' ? null : Number(upgrade.nextMonthTarget),
          academicInvestment: String(upgrade.academicInvestment || ''),
          problem: String(upgrade.problem || ''),
          followUp: String(upgrade.followUp || ''),
          updatedAt: task.updatedAt || task.createdAt || ''
        };
        const prior = months.get(key);
        if (!prior || String(candidate.updatedAt) >= String(prior.updatedAt)) months.set(key, candidate);
      });
    });
    return [...months.values()];
  }
  function customerPlanAnalytics(tasks, fiscal, selectedProduct, metric, filters = {}) {
    const equals = (value, expected) => !expected || expected === 'all' || String(value || '').trim() === String(expected).trim();
    const actuals = customerPlanActuals(tasks, selectedProduct).filter(item => equals(item.office, filters.office) && equals(item.hospital, filters.hospital) && equals(item.department, filters.department) && equals(item.employee, filters.employee) && (!filters.customerId || String(item.customerId || '').trim() === String(filters.customerId).trim()));
    const inRange = target => actuals.filter(item => item.date >= target.from && item.date <= target.to);
    const latestByCustomer = rows => {
      const map = new Map();
      rows.forEach(item => {
        const prior = map.get(item.customerId);
        if (!prior || item.period > prior.period) map.set(item.customerId, item);
      });
      return map;
    };
    const current = latestByCustomer(inRange(fiscal.current));
    const previous = latestByCustomer(inRange(fiscal.previous));
    if (!current.size) return null;
    const levels = ['A', 'B', 'C', 'D'].map(level => ({
      level,
      count: 0,
      value: 0,
      share: 0,
      countShare: 0
    }));
    const customers = new Map();
    current.forEach((item, id) => {
      const progress = customerGradeProgress(item.boxes);
      const reported = item.reportedSalesGrade;
      const row = {
        ...item,
        ...progress,
        computedSalesGrade: progress.currentGrade,
        gradeCheck: !reported ? 'INSUFFICIENT_DATA' : reported === progress.currentGrade ? 'MATCH' : 'MISMATCH'
      };
      customers.set(id, row);
      const level = levels.find(entry => entry.level === progress.currentGrade);
      level.count += 1;
      level.value += item.boxes;
    });
    const totalValue = levels.reduce((total, item) => total + item.value, 0);
    levels.forEach(item => {
      item.share = totalValue ? item.value / totalValue : 0;
      item.countShare = customers.size ? item.count / customers.size : 0;
    });
    const order = {
      D: 0,
      C: 1,
      B: 2,
      A: 3
    };
    const transitions = {
      new: 0,
      'D-C': 0,
      'C-B': 0,
      'B-A': 0
    };
    let contribution = 0;
    customers.forEach((item, id) => {
      const prior = previous.get(id);
      if (!prior) {
        transitions.new += 1;
        return;
      }
      const priorGrade = customerLevel(prior.boxes);
      if (order[item.currentGrade] > order[priorGrade]) {
        const key = `${priorGrade}-${item.currentGrade}`;
        if (Object.hasOwn(transitions, key)) transitions[key] += 1;
        contribution += item.boxes;
      }
    });
    const opportunities = [...customers.values()].map(item => {
      let status = '暂无计划';
      if (item.nextGrade === null) status = '当前最高等级';else if (item.upgradeGap <= 3) status = '接近升级';else if (item.nextMonthTarget === null || !Number.isFinite(item.nextMonthTarget)) status = '暂无计划';else if (item.nextMonthTarget < item.nextGradeThreshold) status = '升级目标不足';else if (item.nextMonthTarget > item.nextGradeThreshold * 1.5) status = '升级目标偏高';else status = '有升级计划';
      return {
        ...item,
        status,
        targetReasonable: status === '接近升级' || status === '有升级计划',
        hasPlan: item.nextMonthTarget !== null && Number.isFinite(item.nextMonthTarget),
        hasResourceWithoutPlan: Boolean(item.academicInvestment) && (item.nextMonthTarget === null || !Number.isFinite(item.nextMonthTarget))
      };
    }).sort((a, b) => (a.nextGrade === null) - (b.nextGrade === null) || a.upgradeGap - b.upgradeGap || b.boxes - a.boxes || a.customer.localeCompare(b.customer, 'zh-CN'));
    const monthlyPeriods = [...new Set(actuals.filter(item => item.date >= fiscal.fiscalYearRange.from && item.date <= fiscal.cutoffDate).map(item => item.period))].sort();
    const monthly = monthlyPeriods.map(period => {
      const rows = actuals.filter(item => item.period === period);
      const counts = {
        A: 0,
        B: 0,
        C: 0,
        D: 0
      };
      rows.forEach(item => {
        counts[customerLevel(item.boxes)] += 1;
      });
      return {
        period,
        levels: ['A', 'B', 'C', 'D'].map(level => ({
          level,
          count: counts[level]
        }))
      };
    });
    const mismatchCount = [...customers.values()].filter(item => item.gradeCheck === 'MISMATCH').length;
    return {
      customers: {
        total: customers.size,
        levels,
        customers,
        previousCustomers: previous,
        source: 'customer-upgrade-workbook',
        mismatchCount,
        monthly
      },
      upgrades: {
        hasHistory: previous.size > 0,
        transitions,
        contribution,
        contributionShare: totalValue ? contribution / totalValue : 0,
        opportunities,
        topOpportunities: opportunities.filter(item => item.nextGrade).slice(0, 10),
        summary: {
          upgradeable: opportunities.filter(item => item.nextGrade).length,
          gapWithin3: opportunities.filter(item => item.nextGrade && item.upgradeGap <= 3).length,
          gapWithin5: opportunities.filter(item => item.nextGrade && item.upgradeGap <= 5).length,
          withTarget: opportunities.filter(item => item.hasPlan).length,
          reasonableTarget: opportunities.filter(item => item.targetReasonable).length,
          missingPlan: opportunities.filter(item => item.nextGrade && !item.hasPlan).length,
          resourceWithoutPlan: opportunities.filter(item => item.hasResourceWithoutPlan).length,
          mismatchCount
        },
        source: 'customer-upgrade-workbook',
        monthly
      }
    };
  }
  function customerLevelStructure(rows, metric) {
    const customers = new Map();
    rows.forEach(row => {
      const name = String(row.customer || '').trim();
      if (!name) return;
      const current = customers.get(name) || {
        name,
        boxes: 0,
        value: 0
      };
      current.boxes += clampFinite(row.orderBoxes);
      current.value += clampFinite(row[metric.key]);
      customers.set(name, current);
    });
    const levels = ['A', 'B', 'C', 'D'].map(level => ({
      level,
      count: 0,
      value: 0,
      share: 0
    }));
    customers.forEach(customer => {
      const item = levels.find(entry => entry.level === customerLevel(customer.boxes));
      item.count += 1;
      item.value += customer.value;
    });
    const totalValue = levels.reduce((total, item) => total + item.value, 0);
    levels.forEach(item => {
      item.share = totalValue ? item.value / totalValue : 0;
    });
    return {
      total: customers.size,
      levels,
      customers
    };
  }
  function customerUpgradeStructure(currentRows, previousRows, metric) {
    const current = customerLevelStructure(currentRows, metric);
    const previous = customerLevelStructure(previousRows, metric);
    const order = {
      D: 0,
      C: 1,
      B: 2,
      A: 3
    };
    const transitions = {
      new: 0,
      'D-C': 0,
      'C-B': 0,
      'B-A': 0
    };
    let contribution = 0;
    current.customers.forEach((customer, name) => {
      const prior = previous.customers.get(name);
      const level = customerLevel(customer.boxes);
      if (!prior) {
        transitions.new += 1;
        contribution += customer.value;
        return;
      }
      const previousLevel = customerLevel(prior.boxes);
      if (order[level] > order[previousLevel]) {
        const key = `${previousLevel}-${level}`;
        if (Object.hasOwn(transitions, key)) transitions[key] += 1;
        contribution += customer.value;
      }
    });
    const total = current.levels.reduce((value, item) => value + item.value, 0);
    return {
      hasHistory: previous.customers.size > 0,
      transitions,
      contribution,
      contributionShare: total ? contribution / total : 0
    };
  }
  function periodSeries(rows, current, grain, metric) {
    const keys = [];
    if (grain === 'quarter') {
      const start = parseDate(current.from);
      const end = parseDate(current.to);
      let cursor = parseDate(fiscalQuarterRange(start).from);
      while (cursor <= end) {
        const quarter = fiscalQuarterRange(cursor);
        const period = resolveFiscalPeriod(cursor);
        keys.push({
          key: `FY${period.fiscalYear}-Q${period.fiscalQuarter}`,
          from: quarter.from < current.from ? current.from : quarter.from,
          to: quarter.to > current.to ? current.to : quarter.to
        });
        cursor = shiftMonths(cursor, 3);
      }
    } else monthKeys(current.from, current.to).forEach(key => keys.push({
      key,
      from: `${key}-01`,
      to: dateKey(endOfMonth(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1))
    }));
    return keys.map(item => {
      const scoped = rowsInRange(rows, item);
      const summary = summarize(scoped, metric);
      const start = parseDate(item.from);
      const end = parseDate(item.to);
      const previous = range(new Date(start.getFullYear(), start.getMonth() - (grain === 'quarter' ? 3 : 1), start.getDate(), 12), new Date(end.getFullYear(), end.getMonth() - (grain === 'quarter' ? 3 : 1), end.getDate(), 12), '上一期');
      const lastYear = range(new Date(start.getFullYear() - 1, start.getMonth(), start.getDate(), 12), new Date(end.getFullYear() - 1, end.getMonth(), end.getDate(), 12), '上年同期');
      const products = dimensionRows(scoped, 'product', metric, 8).map(entry => ({
        name: entry.name,
        value: entry.value
      }));
      return {
        period: item.key,
        ...summary,
        products,
        mom: percentageChange(summary.value, summarize(rowsInRange(rows, previous), metric).value),
        yoy: percentageChange(summary.value, summarize(rowsInRange(rows, lastYear), metric).value)
      };
    });
  }
  function waterfallStructure(currentRows, previousRows, metric) {
    const previous = sum(previousRows, metric.key);
    const current = sum(currentRows, metric.key);
    const hospitalChanges = dimensionChanges(currentRows, previousRows, 'hospital', metric);
    const newHospitals = hospitalChanges.filter(item => item.previous === 0 && item.current > 0).reduce((value, item) => value + item.current, 0);
    const retainedGrowth = hospitalChanges.filter(item => item.previous > 0 && item.change > 0).reduce((value, item) => value + item.change, 0);
    const hospitalLoss = hospitalChanges.filter(item => item.previous > 0 && item.current > 0 && item.change < 0).reduce((value, item) => value + item.change, 0);
    const stoppedOutput = hospitalChanges.filter(item => item.previous > 0 && item.current === 0).reduce((value, item) => value + item.change, 0);
    const explained = newHospitals + retainedGrowth + hospitalLoss + stoppedOutput;
    const other = current - previous - explained;
    return {
      totalChange: current - previous,
      changeRate: percentageChange(current, previous),
      series: [{
        name: '上期',
        value: previous,
        kind: 'total'
      }, {
        name: '新增医院',
        value: newHospitals,
        kind: 'positive'
      }, {
        name: '存量医院增长',
        value: retainedGrowth,
        kind: 'positive'
      }, {
        name: '医院掉量',
        value: hospitalLoss,
        kind: 'negative'
      }, {
        name: '停止产出',
        value: stoppedOutput,
        kind: 'negative'
      }, {
        name: '其他',
        value: other,
        kind: other >= 0 ? 'positive' : 'negative'
      }, {
        name: '本期',
        value: current,
        kind: 'total'
      }],
      details: hospitalChanges.filter(item => item.change < 0).sort((a, b) => a.change - b.change).slice(0, 10)
    };
  }
  function executionProgress(tasks = []) {
    const definitions = [['专家网络建设', /专家|客户拜访|医院信息/], ['学术推广活动', /活动|培训|课件/], ['病例收集进度', /病例|病历|收集/], ['费用使用进度', /费用|预算|报销/]];
    return definitions.map(([label, matcher]) => {
      const matched = tasks.filter(task => matcher.test(`${task.category || ''}${task.title || ''}`));
      const rate = matched.length ? matched.reduce((value, task) => value + Math.max(0, Math.min(100, clampFinite(task.progress))), 0) / matched.length : null;
      return {
        label,
        rate,
        status: rate === null ? '暂无数据' : rate >= 75 ? '进度良好' : rate >= 50 ? '需关注' : '滞后',
        count: matched.length
      };
    });
  }
  const ALERT_TYPES = Object.freeze({
    HOSPITAL_DECLINE: 'HOSPITAL_DECLINE',
    STOPPED_OUTPUT: 'STOPPED_OUTPUT',
    CONSECUTIVE_DECLINE: 'CONSECUTIVE_DECLINE',
    HOSPITAL_CONCENTRATION: 'HOSPITAL_CONCENTRATION',
    DEPARTMENT_CONCENTRATION: 'DEPARTMENT_CONCENTRATION',
    EMPLOYEE_DECLINE: 'EMPLOYEE_DECLINE',
    TARGET_UNDERPERFORMANCE: 'TARGET_UNDERPERFORMANCE',
    CUSTOMER_COUNT_DECLINE: 'CUSTOMER_COUNT_DECLINE',
    CUSTOMER_DOWNGRADE: 'CUSTOMER_DOWNGRADE',
    RETURN_INCREASE: 'RETURN_INCREASE',
    VISIT_NO_OUTPUT: 'VISIT_NO_OUTPUT',
    DATA_QUALITY: 'DATA_QUALITY'
  });
  const DEFAULT_ALERT_THRESHOLDS = Object.freeze({
    minimumBaselineBoxes: 10,
    minimumDeclineBoxes: 5,
    declineRate: .25,
    severeDeclineRate: .5,
    consecutiveDeclineMonths: 2,
    hospitalTop1Share: .5,
    hospitalTop3Share: .8,
    departmentTop1Share: .65,
    minimumConcentrationBoxes: 20,
    targetAchievementRate: .6,
    minimumTargetBoxes: 10,
    customerCountDeclineRate: .25,
    minimumCustomerCount: 4,
    minimumCustomerDecline: 2,
    returnIncreaseRate: .5,
    minimumReturnBoxes: 3,
    minimumVisitsWithoutOutput: 3,
    maximumAlerts: 12
  });
  function normalizeAlertThresholds(overrides = {}) {
    return Object.fromEntries(Object.entries(DEFAULT_ALERT_THRESHOLDS).map(([key, fallback]) => {
      const value = finiteOrNull(overrides[key]);
      return [key, value === null ? fallback : value];
    }));
  }
  function alertPeriod(label, target) {
    return {
      label,
      from: target?.from || '',
      to: target?.to || ''
    };
  }
  function alertConfidence(rows = []) {
    const statuses = rows.flatMap(row => [row.hospitalMatchStatus, row.departmentMatchStatus, row.customerMatchStatus, row.matchConfidence]).map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
    if (statuses.some(status => /AMBIGUOUS|MULTIPLE|PENDING|UNMATCHED|NONE|LOW/.test(status))) return 'LOW';
    if (statuses.some(status => /PROBABLE|FUZZY|MEDIUM/.test(status))) return 'MEDIUM';
    return 'HIGH';
  }
  function alertSeverity(deltaRate, stopped = false) {
    if (stopped || deltaRate !== null && deltaRate <= -.5) return 'HIGH';
    return 'MEDIUM';
  }
  function alertValueText(value, unit = '盒') {
    if (value === null || value === undefined) return '—';
    return `${Number(value).toLocaleString('zh-CN', {
      maximumFractionDigits: 1
    })}${unit}`;
  }
  function makeAlertFinding({
    alertType,
    severity = 'MEDIUM',
    title,
    subjectType,
    subjectId,
    subjectName,
    currentValue = null,
    baselineValue = null,
    delta = null,
    deltaRate = null,
    evidence = [],
    sourceTypes = [],
    sourcePeriods = [],
    confidence = 'HIGH',
    recommendedChecks = [],
    details = {}
  }) {
    const normalizedSubject = String(subjectId || subjectName || subjectType || 'dataset').trim();
    const compactEvidence = evidence.filter(Boolean);
    const detail = compactEvidence.slice(0, 2).map(item => `${item.label}：${alertValueText(item.value, item.unit || '')}`).join('；');
    const impact = Math.abs(clampFinite(delta));
    const cautiousTitle = confidence === 'LOW' && alertType !== ALERT_TYPES.DATA_QUALITY ? `${title}（低置信度，需人工复核）` : title;
    return {
      alertId: `${String(alertType || 'ALERT').toLowerCase()}-${normalizeEntityText(subjectType || 'dataset') || 'dataset'}-${normalizeEntityText(normalizedSubject) || 'dataset'}`,
      alertType,
      severity,
      level: severity === 'HIGH' ? 'risk' : 'warning',
      title: cautiousTitle,
      subjectType,
      subjectId: subjectId || normalizedSubject,
      subjectName: subjectName || normalizedSubject,
      currentValue,
      baselineValue,
      delta,
      deltaRate,
      evidence: compactEvidence,
      sourceTypes: [...new Set(sourceTypes)],
      sourcePeriods,
      confidence,
      recommendedChecks: recommendedChecks.filter(Boolean),
      details,
      detail,
      query: subjectName || normalizedSubject,
      priorityScore: (severity === 'HIGH' ? 80 : severity === 'MEDIUM' ? 55 : 30) + Math.min(20, impact)
    };
  }
  function boxChanges(currentRows, previousRows, key) {
    return dimensionChanges(currentRows, previousRows, key, {
      key: 'orderBoxes'
    }).map(item => ({
      ...item,
      changeRate: percentageChange(item.current, item.previous)
    }));
  }
  function subjectBreakdown(currentRows, previousRows, subjectKey, subjectName) {
    const matches = row => String(row[subjectKey] || '').trim() === subjectName;
    const current = currentRows.filter(matches);
    const previous = previousRows.filter(matches);
    const changes = key => boxChanges(current, previous, key).filter(item => item.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8);
    return {
      departments: changes('department'),
      employees: changes('employee'),
      hospitals: changes('hospital'),
      customers: changes('customer'),
      currentRecords: current.length,
      baselineRecords: previous.length
    };
  }
  function monthWindow(endDate, declineCount) {
    const end = parseDate(endDate);
    if (!end) return [];
    const start = new Date(end.getFullYear(), end.getMonth() - declineCount, 1, 12);
    return monthKeys(dateKey(start), dateKey(endOfMonth(end.getFullYear(), end.getMonth())));
  }
  function consecutiveDeclineAlerts(rows, fiscal, thresholds, key, subjectType) {
    const periods = monthWindow(fiscal.current.to, thresholds.consecutiveDeclineMonths);
    if (periods.length < thresholds.consecutiveDeclineMonths + 1) return [];
    const names = [...new Set(rows.map(row => String(row[key] || '').trim()).filter(Boolean))];
    return names.map(name => {
      const values = periods.map(period => sum(rows.filter(row => row.date.slice(0, 7) === period && String(row[key] || '').trim() === name), 'orderBoxes'));
      const deltas = values.slice(1).map((value, index) => value - values[index]);
      const isDeclining = deltas.length >= thresholds.consecutiveDeclineMonths && deltas.every(value => value < 0);
      if (!isDeclining || values.at(-1) <= 0 || values[0] < thresholds.minimumBaselineBoxes) return null;
      const delta = values.at(-1) - values[0];
      const deltaRate = percentageChange(values.at(-1), values[0]);
      const subjectRows = rows.filter(row => String(row[key] || '').trim() === name && periods.includes(row.date.slice(0, 7)));
      return makeAlertFinding({
        alertType: ALERT_TYPES.CONSECUTIVE_DECLINE,
        severity: alertSeverity(deltaRate),
        title: `${name}连续${thresholds.consecutiveDeclineMonths}个月掉量`,
        subjectType,
        subjectName: name,
        currentValue: values.at(-1),
        baselineValue: values[0],
        delta,
        deltaRate,
        evidence: periods.map((period, index) => ({
          label: period,
          value: values[index],
          unit: '盒',
          period
        })),
        sourceTypes: ['SalesRecord'],
        sourcePeriods: [{
          label: '连续月度',
          from: `${periods[0]}-01`,
          to: fiscal.current.to
        }],
        confidence: alertConfidence(subjectRows),
        recommendedChecks: ['核对连续下降月份对应医院、科室与员工变化。', '确认是否存在停止出单、退货或数据缺失。'],
        details: {
          kind: 'monthly-trend',
          periods,
          values,
          deltas
        }
      });
    }).filter(Boolean);
  }
  function concentrationAlert(currentRows, key, subjectType, alertType, threshold, thresholds, fiscal) {
    const rankings = dimensionRows(currentRows, key, {
      key: 'orderBoxes'
    }, 50).filter(item => !item.name.startsWith('未填写'));
    const total = sum(currentRows, 'orderBoxes');
    if (!rankings.length || total < thresholds.minimumConcentrationBoxes) return null;
    const top1Share = rankings[0].share;
    const top3Share = rankings.slice(0, 3).reduce((value, item) => value + item.share, 0);
    const triggered = top1Share >= threshold || key === 'hospital' && top3Share >= thresholds.hospitalTop3Share;
    if (!triggered) return null;
    const subjectRows = currentRows.filter(row => String(row[key] || '').trim() === rankings[0].name);
    return makeAlertFinding({
      alertType,
      severity: top1Share >= Math.min(.9, threshold + .2) ? 'HIGH' : 'MEDIUM',
      title: `${key === 'hospital' ? '医院' : '科室'}销售集中度较高`,
      subjectType,
      subjectName: rankings[0].name,
      currentValue: rankings[0].value,
      baselineValue: total,
      delta: rankings[0].value,
      deltaRate: top1Share,
      evidence: [{
        label: 'TOP1占比',
        value: top1Share * 100,
        unit: '%'
      }, {
        label: 'TOP3占比',
        value: top3Share * 100,
        unit: '%'
      }, {
        label: '当前总销量',
        value: total,
        unit: '盒'
      }, {
        label: '触发阈值',
        value: threshold * 100,
        unit: '%'
      }],
      sourceTypes: ['SalesRecord'],
      sourcePeriods: [alertPeriod('当前期', fiscal.current)],
      confidence: alertConfidence(subjectRows),
      recommendedChecks: [`核对头部${key === 'hospital' ? '医院' : '科室'}的持续产出能力。`, `评估其他${key === 'hospital' ? '医院' : '科室'}的增长空间。`],
      details: {
        kind: 'concentration',
        rankings: rankings.slice(0, 10),
        total,
        top1Share,
        top3Share,
        threshold
      }
    });
  }
  function reliableCustomerSales(currentRows, previousRows) {
    const rows = [...currentRows, ...previousRows];
    if (!currentRows.length || !previousRows.length || !rows.length) return false;
    return rows.every(row => String(row.customerId || '').trim()) && !rows.some(row => /AMBIGUOUS|MULTIPLE|PENDING|UNMATCHED|NONE|LOW/i.test(String(row.customerMatchStatus || row.matchConfidence || '')));
  }
  function dataQualityAlert(rawRows, currentRows, fiscal, filters) {
    const selectedProduct = stableProductId(filters.product);
    const productScoped = rawRows.filter(row => selectedProduct === 'all' || stableProductId(row.product) === selectedProduct);
    const issues = [];
    const invalidDate = productScoped.filter(row => !parseDate(row.date)).length;
    const missingHospital = currentRows.filter(row => !String(row.hospital || '').trim()).length;
    const missingDepartment = currentRows.filter(row => !String(row.department || '').trim()).length;
    const ambiguousMatch = currentRows.filter(row => [row.hospitalMatchStatus, row.departmentMatchStatus, row.customerMatchStatus, row.matchConfidence].some(value => /AMBIGUOUS|MULTIPLE|PENDING|UNMATCHED|NONE|LOW/i.test(String(value || '')))).length;
    const probableMatch = currentRows.filter(row => [row.hospitalMatchStatus, row.departmentMatchStatus, row.customerMatchStatus, row.matchConfidence].some(value => /PROBABLE|FUZZY|MEDIUM/i.test(String(value || '')))).length;
    if (invalidDate) issues.push({
      label: '日期异常',
      value: invalidDate,
      unit: '条'
    });
    if (missingHospital) issues.push({
      label: '医院缺失',
      value: missingHospital,
      unit: '条'
    });
    if (missingDepartment) issues.push({
      label: '科室缺失',
      value: missingDepartment,
      unit: '条'
    });
    if (ambiguousMatch) issues.push({
      label: '实体匹配歧义',
      value: ambiguousMatch,
      unit: '条'
    });
    if (probableMatch) issues.push({
      label: '实体可能匹配',
      value: probableMatch,
      unit: '条'
    });
    if (!issues.length) return null;
    const confidence = ambiguousMatch ? 'LOW' : probableMatch ? 'MEDIUM' : 'HIGH';
    const total = issues.reduce((value, item) => value + item.value, 0);
    return makeAlertFinding({
      alertType: ALERT_TYPES.DATA_QUALITY,
      severity: ambiguousMatch || invalidDate ? 'HIGH' : 'MEDIUM',
      title: '销售数据存在质量问题',
      subjectType: 'dataset',
      subjectName: filters.product || '当前产品',
      currentValue: total,
      baselineValue: currentRows.length,
      delta: total,
      deltaRate: currentRows.length ? total / currentRows.length : null,
      evidence: issues,
      sourceTypes: ['SalesRecord'],
      sourcePeriods: [alertPeriod('当前期', fiscal.current)],
      confidence,
      recommendedChecks: ['在数据管理中查看异常明细并修正缺失字段。', '对可能匹配或多重匹配记录进行人工确认。'],
      details: {
        kind: 'data-quality',
        issues
      }
    });
  }
  function dashboardAlerts({
    rawRows = [],
    filteredRows = [],
    currentRows = [],
    previousRows = [],
    fiscal,
    filters = {},
    employeePlanRecords = [],
    fourThreeExecution,
    thresholds: thresholdOverrides = {}
  }) {
    const thresholds = normalizeAlertThresholds(thresholdOverrides);
    const findings = [];
    const currentPeriod = alertPeriod('当前期', fiscal.current);
    const previousPeriod = alertPeriod('上期', fiscal.previous);
    const addDeclines = (key, subjectType, alertType, limit = 2) => {
      const allChanges = boxChanges(currentRows, previousRows, key);
      const totalDecline = allChanges.filter(item => item.change < 0).reduce((value, item) => value + Math.abs(item.change), 0);
      allChanges.filter(item => item.previous >= thresholds.minimumBaselineBoxes && item.current > 0 && item.change <= -thresholds.minimumDeclineBoxes && item.changeRate <= -thresholds.declineRate).sort((a, b) => a.change - b.change).slice(0, limit).forEach(item => {
        const scopedRows = [...currentRows, ...previousRows].filter(row => String(row[key] || '').trim() === item.name);
        const declineContribution = totalDecline ? Math.abs(item.change) / totalDecline : null;
        findings.push(makeAlertFinding({
          alertType,
          severity: alertSeverity(item.changeRate),
          title: `${item.name}明显掉量`,
          subjectType,
          subjectName: item.name,
          currentValue: item.current,
          baselineValue: item.previous,
          delta: item.change,
          deltaRate: item.changeRate,
          evidence: [{
            label: '上期实际',
            value: item.previous,
            unit: '盒'
          }, {
            label: '本期实际',
            value: item.current,
            unit: '盒'
          }, {
            label: '减少',
            value: Math.abs(item.change),
            unit: '盒'
          }, {
            label: '降幅',
            value: Math.abs(item.changeRate) * 100,
            unit: '%'
          }, {
            label: '掉量贡献',
            value: declineContribution === null ? null : declineContribution * 100,
            unit: '%'
          }],
          sourceTypes: ['SalesRecord'],
          sourcePeriods: [previousPeriod, currentPeriod],
          confidence: alertConfidence(scopedRows),
          recommendedChecks: [`核对${subjectType === 'hospital' ? '医院' : '员工'}对应的科室和客户产出变化。`, '核对退货、实体匹配和同期数据完整性。'],
          details: {
            kind: subjectType === 'hospital' ? 'hospital-decline' : 'employee-decline',
            totalDecline,
            declineContribution,
            breakdown: subjectBreakdown(currentRows, previousRows, key, item.name)
          }
        }));
      });
    };
    boxChanges(currentRows, previousRows, 'hospital').filter(item => item.previous >= thresholds.minimumBaselineBoxes && item.current === 0).sort((a, b) => b.previous - a.previous).slice(0, 2).forEach(item => {
      const scopedRows = previousRows.filter(row => String(row.hospital || '').trim() === item.name);
      findings.push(makeAlertFinding({
        alertType: ALERT_TYPES.STOPPED_OUTPUT,
        severity: 'HIGH',
        title: `${item.name}本期停止产出`,
        subjectType: 'hospital',
        subjectName: item.name,
        currentValue: 0,
        baselineValue: item.previous,
        delta: -item.previous,
        deltaRate: -1,
        evidence: [{
          label: '上期实际',
          value: item.previous,
          unit: '盒'
        }, {
          label: '本期实际',
          value: 0,
          unit: '盒'
        }],
        sourceTypes: ['SalesRecord'],
        sourcePeriods: [previousPeriod, currentPeriod],
        confidence: alertConfidence(scopedRows),
        recommendedChecks: ['核对终端是否仍在正常出单。', '核对Synthetic Hospital Example匹配、退货及数据同步完整性。'],
        details: {
          kind: 'stopped-output',
          breakdown: subjectBreakdown(currentRows, previousRows, 'hospital', item.name)
        }
      }));
    });
    addDeclines('hospital', 'hospital', ALERT_TYPES.HOSPITAL_DECLINE, 3);
    addDeclines('employee', 'employee', ALERT_TYPES.EMPLOYEE_DECLINE, 3);
    const historyRows = filteredRows.filter(row => row.date <= fiscal.current.to);
    findings.push(...consecutiveDeclineAlerts(historyRows, fiscal, thresholds, 'hospital', 'hospital'));
    findings.push(...consecutiveDeclineAlerts(historyRows, fiscal, thresholds, 'department', 'department'));
    findings.push(...consecutiveDeclineAlerts(historyRows, fiscal, thresholds, 'employee', 'employee'));
    findings.push(concentrationAlert(currentRows, 'hospital', 'hospital', ALERT_TYPES.HOSPITAL_CONCENTRATION, thresholds.hospitalTop1Share, thresholds, fiscal));
    findings.push(concentrationAlert(currentRows, 'department', 'department', ALERT_TYPES.DEPARTMENT_CONCENTRATION, thresholds.departmentTop1Share, thresholds, fiscal));
    const execution = fourThreeExecution || buildFourThreeExecutionDetail(employeePlanRecords, fiscal, filters);
    (execution.dimensions?.employee || []).filter(item => item.targetBoxes >= thresholds.minimumTargetBoxes && item.achievementRate !== null && item.achievementRate < thresholds.targetAchievementRate).sort((a, b) => a.achievementRate - b.achievementRate || b.gapBoxes - a.gapBoxes).slice(0, 3).forEach(item => {
      const employeeExecution = buildFourThreeExecutionDetail(employeePlanRecords.filter(record => String(record.employee || '').trim() === item.name), fiscal, filters);
      findings.push(makeAlertFinding({
        alertType: ALERT_TYPES.TARGET_UNDERPERFORMANCE,
        severity: item.achievementRate < .4 ? 'HIGH' : 'MEDIUM',
        title: `${item.name}目标执行明显低于计划`,
        subjectType: 'employee',
        subjectName: item.name,
        currentValue: item.actualBoxes,
        baselineValue: item.targetBoxes,
        delta: item.actualBoxes - item.targetBoxes,
        deltaRate: item.achievementRate - 1,
        evidence: [{
          label: '目标',
          value: item.targetBoxes,
          unit: '盒'
        }, {
          label: '实际',
          value: item.actualBoxes,
          unit: '盒'
        }, {
          label: '缺口',
          value: item.gapBoxes,
          unit: '盒'
        }, {
          label: '达成率',
          value: item.achievementRate * 100,
          unit: '%'
        }],
        sourceTypes: ['EmployeePlanRecord'],
        sourcePeriods: [currentPeriod],
        confidence: 'HIGH',
        recommendedChecks: ['按医院、科室和客户计划核对主要缺口。', '复核目标是否已按当前产品和办事处正确填写。'],
        details: {
          kind: 'target-gap',
          employee: item,
          dimensions: employeeExecution.dimensions
        }
      }));
    });
    const customerReliable = reliableCustomerSales(currentRows, previousRows);
    if (customerReliable) {
      const customerTotals = rows => {
        const result = new Map();
        rows.forEach(row => {
          const id = String(row.customerId).trim();
          result.set(id, (result.get(id) || 0) + clampFinite(row.orderBoxes));
        });
        return result;
      };
      const currentCustomers = customerTotals(currentRows);
      const previousCustomers = customerTotals(previousRows);
      const customerDelta = currentCustomers.size - previousCustomers.size;
      const customerRate = percentageChange(currentCustomers.size, previousCustomers.size);
      if (previousCustomers.size >= thresholds.minimumCustomerCount && customerDelta <= -thresholds.minimumCustomerDecline && customerRate <= -thresholds.customerCountDeclineRate) findings.push(makeAlertFinding({
        alertType: ALERT_TYPES.CUSTOMER_COUNT_DECLINE,
        severity: customerRate <= -.5 ? 'HIGH' : 'MEDIUM',
        title: '实际出单客户数明显减少',
        subjectType: 'customer-set',
        subjectName: filters.product || '当前产品',
        currentValue: currentCustomers.size,
        baselineValue: previousCustomers.size,
        delta: customerDelta,
        deltaRate: customerRate,
        evidence: [{
          label: '上期出单客户',
          value: previousCustomers.size,
          unit: '位'
        }, {
          label: '本期出单客户',
          value: currentCustomers.size,
          unit: '位'
        }, {
          label: '减少',
          value: Math.abs(customerDelta),
          unit: '位'
        }],
        sourceTypes: ['SalesRecord'],
        sourcePeriods: [previousPeriod, currentPeriod],
        confidence: 'HIGH',
        recommendedChecks: ['核对未复购客户及对应医院、科室。', '确认客户 ID 映射在两期内保持一致。'],
        details: {
          kind: 'customer-count',
          currentCustomers: currentCustomers.size,
          previousCustomers: previousCustomers.size
        }
      }));
      const grades = {
        D: 0,
        C: 1,
        B: 2,
        A: 3
      };
      const downgrades = [...previousCustomers.entries()].map(([customerId, previousBoxes]) => {
        const currentBoxes = currentCustomers.get(customerId);
        if (currentBoxes === undefined) return null;
        const previousGrade = customerLevel(previousBoxes);
        const currentGrade = customerLevel(currentBoxes);
        return grades[currentGrade] < grades[previousGrade] ? {
          customerId,
          previousBoxes,
          currentBoxes,
          previousGrade,
          currentGrade
        } : null;
      }).filter(Boolean).sort((a, b) => b.previousBoxes - b.currentBoxes - (a.previousBoxes - a.currentBoxes));
      if (downgrades.length) findings.push(makeAlertFinding({
        alertType: ALERT_TYPES.CUSTOMER_DOWNGRADE,
        severity: downgrades.some(item => item.previousGrade === 'A') ? 'HIGH' : 'MEDIUM',
        title: `${downgrades.length}位客户销量等级下降`,
        subjectType: 'customer-set',
        subjectName: filters.product || '当前产品',
        currentValue: downgrades.length,
        baselineValue: previousCustomers.size,
        delta: -downgrades.length,
        deltaRate: previousCustomers.size ? -downgrades.length / previousCustomers.size : null,
        evidence: [{
          label: '降级客户',
          value: downgrades.length,
          unit: '位'
        }, {
          label: '可比客户',
          value: previousCustomers.size,
          unit: '位'
        }],
        sourceTypes: ['SalesRecord'],
        sourcePeriods: [previousPeriod, currentPeriod],
        confidence: 'HIGH',
        recommendedChecks: ['逐一核对客户前后期实际盒数及等级变化。', 'R1-R4认知等级保持独立，不与销量等级混用。'],
        details: {
          kind: 'customer-downgrade',
          customers: downgrades.slice(0, 20)
        }
      }));
    }
    const currentReturns = Math.abs(sum(currentRows.filter(row => clampFinite(row.orderBoxes) < 0), 'orderBoxes'));
    const previousReturns = Math.abs(sum(previousRows.filter(row => clampFinite(row.orderBoxes) < 0), 'orderBoxes'));
    const returnDelta = currentReturns - previousReturns;
    const returnRate = percentageChange(currentReturns, previousReturns);
    if (previousReturns >= thresholds.minimumReturnBoxes && returnDelta >= thresholds.minimumReturnBoxes && returnRate >= thresholds.returnIncreaseRate) findings.push(makeAlertFinding({
      alertType: ALERT_TYPES.RETURN_INCREASE,
      severity: returnRate >= 1 ? 'HIGH' : 'MEDIUM',
      title: '退货盒数较上期明显增加',
      subjectType: 'order-set',
      subjectName: filters.product || '当前产品',
      currentValue: currentReturns,
      baselineValue: previousReturns,
      delta: returnDelta,
      deltaRate: returnRate,
      evidence: [{
        label: '上期退货',
        value: previousReturns,
        unit: '盒'
      }, {
        label: '本期退货',
        value: currentReturns,
        unit: '盒'
      }, {
        label: '增加',
        value: returnDelta,
        unit: '盒'
      }],
      sourceTypes: ['SalesRecord'],
      sourcePeriods: [previousPeriod, currentPeriod],
      confidence: 'HIGH',
      recommendedChecks: ['核对退货订单、医院和日期明细。', '确认净销售盒数口径未重复扣减。'],
      details: {
        kind: 'returns',
        currentReturns,
        previousReturns
      }
    }));
    const visitGroups = new Map();
    currentRows.forEach(row => {
      const name = String(row.hospital || '').trim();
      if (!name || clampFinite(row.visitCount) <= 0) return;
      const item = visitGroups.get(name) || {
        visits: 0,
        boxes: 0,
        rows: []
      };
      item.visits += clampFinite(row.visitCount);
      item.boxes += clampFinite(row.orderBoxes);
      item.rows.push(row);
      visitGroups.set(name, item);
    });
    visitGroups.forEach((item, name) => {
      if (item.visits < thresholds.minimumVisitsWithoutOutput || item.boxes !== 0) return;
      findings.push(makeAlertFinding({
        alertType: ALERT_TYPES.VISIT_NO_OUTPUT,
        severity: 'MEDIUM',
        title: `${name}已登记拜访但本期未观察到产出`,
        subjectType: 'hospital',
        subjectName: name,
        currentValue: 0,
        baselineValue: item.visits,
        delta: null,
        deltaRate: null,
        evidence: [{
          label: '真实拜访记录',
          value: item.visits,
          unit: '次'
        }, {
          label: '同期净销量',
          value: 0,
          unit: '盒'
        }],
        sourceTypes: ['Visit', 'SalesRecord'],
        sourcePeriods: [currentPeriod],
        confidence: alertConfidence(item.rows),
        recommendedChecks: ['核对终端阶段与后续出单观察期。', '这里只表示同期未观察到产出，不认定拜访无效。'],
        details: {
          kind: 'visit-no-output',
          visits: item.visits,
          boxes: item.boxes
        }
      }));
    });
    findings.push(dataQualityAlert(rawRows, currentRows, fiscal, filters));
    const unique = new Map();
    findings.filter(Boolean).sort((a, b) => b.priorityScore - a.priorityScore || a.alertId.localeCompare(b.alertId)).forEach(item => {
      const key = `${item.alertType}|${item.subjectType}|${normalizeEntityText(item.subjectName)}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return {
      findings: [...unique.values()].slice(0, thresholds.maximumAlerts),
      thresholds,
      dataAvailability: {
        customerSales: customerReliable ? 'available' : 'insufficient',
        customerMessage: customerReliable ? '客户级销售数据可用于实际出单客户分析。' : '客户级销售数据不足，未计算出单客户数变化或客户降级。',
        academicActivity: 'reserved',
        academicActivityMessage: '实际学术活动尚未接入，不根据资源计划推断活动效果。'
      }
    };
  }
  function analysisFinding(id, topic, conclusion, evidence, severity = 'info', confidence = .8, recommendedAction = '', extra = {}) {
    const severityScore = {
      info: 20,
      watch: 45,
      high: 70,
      critical: 90
    }[severity] || 20;
    return {
      id,
      topic,
      conclusion,
      evidence: (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean),
      severity,
      severityScore,
      confidence: Math.max(0, Math.min(1, clampFinite(confidence, .8))),
      recommendedAction,
      ...extra
    };
  }
  function findingText(item) {
    return item ? `${item.conclusion}${item.recommendedAction ? ` 建议：${item.recommendedAction}` : ''}` : '';
  }
  function uniqueFindings(items, limit = Infinity) {
    const seen = new Set();
    const result = [];
    items.filter(Boolean).forEach(item => {
      const key = `${item.topic || ''}|${String(item.conclusion || '').replace(/[\d.,，。%％]/g, '')}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });
    return result.slice(0, limit);
  }
  function monthlyDirection(series = []) {
    const actual = series.filter(item => !item.future && clampFinite(item.total) > 0);
    if (!actual.length) return {
      actual,
      peak: null,
      low: null,
      growthRun: 0,
      declineRun: 0,
      recentDirection: 'insufficient'
    };
    const peak = actual.reduce((best, item) => item.total > best.total ? item : best, actual[0]);
    const low = actual.reduce((best, item) => item.total < best.total ? item : best, actual[0]);
    let growthRun = 0;
    let declineRun = 0;
    let currentGrowth = 0;
    let currentDecline = 0;
    for (let index = 1; index < actual.length; index += 1) {
      const delta = actual[index].total - actual[index - 1].total;
      currentGrowth = delta > 0 ? currentGrowth + 1 : 0;
      currentDecline = delta < 0 ? currentDecline + 1 : 0;
      growthRun = Math.max(growthRun, currentGrowth);
      declineRun = Math.max(declineRun, currentDecline);
    }
    const lastDelta = actual.length > 1 ? actual.at(-1).total - actual.at(-2).total : 0;
    return {
      actual,
      peak,
      low,
      growthRun,
      declineRun,
      recentDirection: lastDelta > 0 ? 'improving' : lastDelta < 0 ? 'weakening' : 'stable'
    };
  }
  function orderDepthStructure(rows, metric) {
    const values = rows.map(row => clampFinite(row.orderBoxes)).filter(value => value > 0).sort((a, b) => a - b);
    const quantile = fraction => {
      if (!values.length) return null;
      const index = (values.length - 1) * fraction;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      return lower === upper ? values[lower] : values[lower] + (values[upper] - values[lower]) * (index - lower);
    };
    const groupRows = definitions => definitions.map(group => {
      const matched = rows.filter(row => group.test(clampFinite(row.orderBoxes)));
      return {
        key: group.key,
        label: group.label,
        count: matched.length,
        share: rows.length ? matched.length / rows.length : 0,
        value: sum(matched, metric.key)
      };
    });
    const groups = groupRows([{
      key: 'one',
      label: '1盒',
      test: value => value === 1
    }, {
      key: 'two',
      label: '2盒',
      test: value => value === 2
    }, {
      key: 'threePlus',
      label: '3盒及以上',
      test: value => value >= 3
    }]);
    const buckets = groupRows([{
      key: 'one',
      label: '1盒',
      test: value => value === 1
    }, {
      key: 'two',
      label: '2盒',
      test: value => value === 2
    }, {
      key: 'threeFive',
      label: '3–5盒',
      test: value => value >= 3 && value <= 5
    }, {
      key: 'sixTen',
      label: '6–10盒',
      test: value => value >= 6 && value <= 10
    }, {
      key: 'overTen',
      label: '>10盒',
      test: value => value > 10
    }]);
    const averageBy = key => dimensionRows(rows, key, {
      key: 'orderBoxes',
      label: '下单盒数',
      unit: '盒'
    }, 30).map(item => ({
      ...item,
      average: item.recordCount ? item.orderBoxes / item.recordCount : 0
    }));
    const average = values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    const median = quantile(.5);
    return {
      groups,
      buckets,
      employee: averageBy('employee'),
      hospital: averageBy('hospital'),
      department: averageBy('department'),
      count: values.length,
      average,
      median,
      p25: quantile(.25),
      p75: quantile(.75),
      minimum: values[0] ?? null,
      maximum: values.at(-1) ?? null,
      largeOrderSkew: average !== null && median !== null && median > 0 && average >= median * 1.5
    };
  }
  function dimensionMonthlyTrend(rows, period, key, metric, limit = 10) {
    const leaders = dimensionRows(rows, key, metric, limit).map(item => item.name);
    const periods = monthKeys(period.from, period.to);
    return leaders.map(name => ({
      name,
      values: periods.map(month => ({
        period: month,
        value: sum(rows.filter(row => row.date.slice(0, 7) === month && String(row[key] || '').trim() === name), metric.key)
      }))
    }));
  }
  function enrichMonthlyTrend(rows = []) {
    return rows.map(item => {
      const values = item.values || [];
      const numbers = values.map(entry => clampFinite(entry.value));
      const deltas = numbers.slice(1).map((value, index) => value - numbers[index]);
      const mean = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
      const variance = numbers.length ? numbers.reduce((total, value) => total + (value - mean) ** 2, 0) / numbers.length : 0;
      const direction = deltas.length && deltas.every(value => value > 0) ? 'continuous-growth' : deltas.length && deltas.every(value => value < 0) ? 'continuous-decline' : deltas.some(value => value > 0) && deltas.some(value => value < 0) ? 'volatile' : 'stable';
      const peakIndex = numbers.length ? numbers.indexOf(Math.max(...numbers)) : -1;
      return {
        ...item,
        total: numbers.reduce((a, b) => a + b, 0),
        deltas,
        latestChange: deltas.at(-1) || 0,
        direction,
        volatility: mean ? Math.sqrt(variance) / mean : 0,
        peakPeriod: peakIndex >= 0 ? values[peakIndex]?.period : null
      };
    });
  }
  function normalizeTargetPlan(rawTarget, fiscal, metric) {
    const raw = rawTarget && typeof rawTarget === 'object' ? rawTarget : {};
    const months = monthKeys(fiscal.fiscalYearRange.from, fiscal.fiscalYearRange.to);
    const monthlyTargets = {};
    months.forEach(key => {
      const monthNumber = Number(key.slice(5));
      const value = finiteOrNull(raw.monthlyTargets?.[key] ?? raw.monthlyTargets?.[String(monthNumber)] ?? raw.months?.[key] ?? raw.months?.[String(monthNumber)]);
      monthlyTargets[key] = value !== null && value >= 0 ? value : null;
    });
    const configuredMonthly = Object.values(monthlyTargets).filter(value => value !== null);
    const explicitAnnual = finiteOrNull(raw.annualTarget ?? raw.value);
    const canDeriveAnnual = configuredMonthly.length && (!raw.strictSelectedMonths || configuredMonthly.length === months.length);
    const annualTarget = explicitAnnual !== null && explicitAnnual > 0 ? explicitAnnual : canDeriveAnnual ? configuredMonthly.reduce((a, b) => a + b, 0) : null;
    const selectedKeys = months.filter(key => `${key}-01` <= fiscal.current.to && dateKey(endOfMonth(Number(key.slice(0, 4)), Number(key.slice(5)) - 1)) >= fiscal.current.from);
    const selectedValues = selectedKeys.map(key => monthlyTargets[key]);
    const selectedTarget = selectedValues.length && selectedValues.every(value => value !== null) ? selectedValues.reduce((a, b) => a + b, 0) : raw.strictSelectedMonths ? null : annualTarget;
    let cumulative = 0;
    const cumulativeTargets = months.map(period => {
      const monthlyTarget = monthlyTargets[period];
      if (monthlyTarget !== null) cumulative += monthlyTarget;
      return {
        period,
        monthlyTarget,
        cumulativeTarget: monthlyTarget === null ? null : cumulative
      };
    });
    return {
      schemaVersion: 2,
      fiscalYear: fiscal.fiscalYear,
      product: stableProductId(raw.product),
      office: raw.office || 'all',
      metricKey: raw.metricKey || metric.key,
      annualTarget,
      selectedTarget,
      monthlyTargets,
      cumulativeTargets,
      source: raw.source || (configuredMonthly.length ? 'monthly' : annualTarget ? 'annual-only' : 'missing')
    };
  }
  const BOX_TARGET_METRIC = Object.freeze({
    key: 'orderBoxes',
    label: '下单盒数',
    unit: '盒',
    methodology: '月度目标、实际、差距与达成率统一按下单盒数统计。'
  });
  function employeePlanPeriod(record, next = false) {
    let month = Number(record.month);
    let fiscalYear = Number(record.fiscalYear);
    if (!Number.isInteger(month) || !Number.isInteger(fiscalYear)) return '';
    if (next) {
      month += 1;
      if (month === 13) month = 1;
      if (Number(record.month) === 9) fiscalYear += 1;
    }
    const year = month >= 10 ? fiscalYear - 1 : fiscalYear;
    return `${year}-${pad(month)}`;
  }
  function employeePlanMatches(record, fiscal, filters = {}) {
    const product = stableProductId(filters.product);
    const equals = (value, expected) => !expected || expected === 'all' || String(value || '').trim() === String(expected).trim();
    const period = employeePlanPeriod(record);
    return Number(record.fiscalYear) === Number(fiscal.fiscalYear) && period >= fiscal.current.from.slice(0, 7) && period <= fiscal.current.to.slice(0, 7) && (!product || product === 'all' || stableProductId(record.productId || record.productName || record.product) === product) && equals(record.office, filters.office) && equals(record.employee, filters.employee) && equals(record.hospitalName || record.hospital, filters.hospital) && equals(record.departmentName || record.department, filters.department) && equals(record.customerName || record.customer, filters.customer) && (!filters.customerId || String(record.customerId || '').trim() === String(filters.customerId).trim());
  }
  function buildEmployeePlanTargetPlan(records = [], fiscal, filters = {}) {
    const scoped = records.filter(record => Number(record.fiscalYear) === Number(fiscal.fiscalYear)).filter(record => {
      const product = stableProductId(filters.product);
      const equals = (value, expected) => !expected || expected === 'all' || String(value || '').trim() === String(expected).trim();
      return (!product || product === 'all' || stableProductId(record.productId || record.productName || record.product) === product) && equals(record.office, filters.office) && equals(record.employee, filters.employee) && equals(record.hospitalName || record.hospital, filters.hospital) && equals(record.departmentName || record.department, filters.department) && equals(record.customerName || record.customer, filters.customer) && (!filters.customerId || String(record.customerId || '').trim() === String(filters.customerId).trim());
    });
    const current = new Map();
    const next = new Map();
    scoped.forEach(record => {
      const currentValue = finiteOrNull(record.monthlyTargetBoxes ?? record.currentTarget);
      const nextValue = finiteOrNull(record.nextMonthTargetBoxes ?? record.nextMonthTarget);
      const currentPeriod = employeePlanPeriod(record);
      const nextPeriod = employeePlanPeriod(record, true);
      if (currentPeriod && currentValue !== null && currentValue >= 0) current.set(currentPeriod, clampFinite(current.get(currentPeriod)) + currentValue);
      if (nextPeriod && nextValue !== null && nextValue >= 0) next.set(nextPeriod, clampFinite(next.get(nextPeriod)) + nextValue);
    });
    const monthlyTargets = {};
    monthKeys(fiscal.fiscalYearRange.from, fiscal.fiscalYearRange.to).forEach(period => {
      monthlyTargets[period] = current.has(period) ? current.get(period) : next.has(period) ? next.get(period) : null;
    });
    return {
      monthlyTargets,
      employeePlanMonths: Object.entries(monthlyTargets).filter(([, value]) => value !== null).map(([period]) => period),
      source: 'employee-plan-record'
    };
  }
  function buildFourThreeExecutionDetail(records = [], fiscal, filters = {}) {
    const recordPeriodKey = (record, period = employeePlanPeriod(record)) => [period, stableProductId(record.productId || record.productName || record.product), record.office, record.employee, record.hospitalName || record.hospital, record.departmentName || record.department, record.customerName || record.customer].map(value => String(value || '').trim()).join('|');
    const currentPeriods = new Set(records.map(record => recordPeriodKey(record)));
    const expanded = records.flatMap(record => {
      const rows = [record];
      const nextPeriod = employeePlanPeriod(record, true);
      const nextTarget = finiteOrNull(record.nextMonthTargetBoxes ?? record.nextMonthTarget);
      if (nextTarget !== null && !currentPeriods.has(recordPeriodKey(record, nextPeriod))) {
        const nextMonth = Number(record.month) === 12 ? 1 : Number(record.month) + 1;
        const nextFiscalYear = Number(record.month) === 9 ? Number(record.fiscalYear) + 1 : Number(record.fiscalYear);
        rows.push({
          ...record,
          fiscalYear: nextFiscalYear,
          month: nextMonth,
          currentTarget: nextTarget,
          monthlyTargetBoxes: nextTarget,
          currentActual: null,
          monthlyActualBoxes: null,
          achievementStatus: 'MISSING_ACTUAL',
          derivedFromNextMonthTarget: true
        });
      }
      return rows;
    });
    const scoped = expanded.filter(record => employeePlanMatches(record, fiscal, filters));
    const statusOf = record => {
      const target = finiteOrNull(record.monthlyTargetBoxes ?? record.currentTarget);
      const actual = finiteOrNull(record.monthlyActualBoxes ?? record.currentActual);
      if (target === null || actual === null) return 'MISSING';
      return actual >= target ? 'ACHIEVED' : 'NOT_ACHIEVED';
    };
    const targetOf = record => finiteOrNull(record.monthlyTargetBoxes ?? record.currentTarget);
    const actualOf = record => finiteOrNull(record.monthlyActualBoxes ?? record.currentActual);
    const identity = record => record.customerId || [record.employee, record.hospitalName || record.hospital, record.departmentName || record.department, record.customerName || record.customer].filter(Boolean).join('|');
    const totals = {
      employees: new Set(scoped.map(row => row.employee).filter(Boolean)).size,
      plannedCustomers: new Set(scoped.map(identity).filter(Boolean)).size,
      targetBoxes: scoped.reduce((sum, row) => sum + clampFinite(targetOf(row)), 0),
      actualBoxes: scoped.reduce((sum, row) => sum + clampFinite(actualOf(row)), 0),
      achieved: scoped.filter(row => statusOf(row) === 'ACHIEVED').length,
      notAchieved: scoped.filter(row => statusOf(row) === 'NOT_ACHIEVED').length,
      missing: scoped.filter(row => statusOf(row) === 'MISSING').length
    };
    totals.achievementRate = totals.targetBoxes > 0 ? totals.actualBoxes / totals.targetBoxes : null;
    const groupBy = (key, label) => {
      const grouped = new Map();
      scoped.forEach(record => {
        const name = String(key(record) || `未填写${label}`).trim();
        const item = grouped.get(name) || {
          name,
          records: 0,
          targetBoxes: 0,
          actualBoxes: 0,
          achieved: 0,
          notAchieved: 0,
          missing: 0
        };
        item.records += 1;
        item.targetBoxes += clampFinite(targetOf(record));
        item.actualBoxes += clampFinite(actualOf(record));
        const status = statusOf(record);
        if (status === 'ACHIEVED') item.achieved += 1;else if (status === 'NOT_ACHIEVED') item.notAchieved += 1;else item.missing += 1;
        grouped.set(name, item);
      });
      return [...grouped.values()].map(item => ({
        ...item,
        gapBoxes: item.targetBoxes - item.actualBoxes,
        achievementRate: item.targetBoxes > 0 ? item.actualBoxes / item.targetBoxes : null,
        status: item.missing === item.records ? '数据缺失' : item.actualBoxes >= item.targetBoxes ? '已达成' : '未达成'
      })).sort((a, b) => b.targetBoxes - a.targetBoxes || b.actualBoxes - a.actualBoxes);
    };
    const resourceLabels = {
      HOME_VISIT: '家访',
      VISIT_INCREASE: '加强拜访',
      DIRECTOR_VISIT: '主任协访',
      PRODUCT_MANAGER_VISIT: '产品经理协访',
      INTERNAL_TRAINING: '内训会',
      DEPARTMENT_MEETING: '科室会',
      JOINT_VISIT: '协访',
      OTHER: '其他'
    };
    const reasonLabels = {
      PATIENT_SHORTAGE: '患者不足',
      CUSTOMER_CAUTION: '客户谨慎',
      ADHERENCE: '依从性',
      PRICE: '价格因素',
      POLICY: '政策因素',
      VISIT_GAP: '拜访不足',
      RECOMMENDATION_GAP: '推荐不足',
      PRODUCT_AWARENESS: '产品认知',
      COMPETITION: '竞争因素',
      OTHER: '其他'
    };
    const summarizeTaggedPlans = (rows, tagField, rawFields, labels, includeGap = false) => {
      const grouped = new Map();
      rows.forEach(row => {
        const rawTexts = rawFields.map(field => String(row[field] || '').trim()).filter(Boolean);
        const manualTag = tagField === 'resourceTags' ? row.manualResourceTag : row.manualReasonTag;
        const tags = (manualTag ? [manualTag] : row[tagField]?.length ? row[tagField] : rawTexts.length ? ['OTHER'] : []).filter(Boolean);
        tags.forEach(tag => {
          const item = grouped.get(tag) || {
            tag,
            label: labels[tag] || tag,
            records: 0,
            employees: new Set(),
            hospitals: new Set(),
            departments: new Set(),
            customers: new Set(),
            rawTexts: new Set(),
            boxGap: 0
          };
          item.records += 1;
          if (row.employee) item.employees.add(row.employee);
          if (row.hospitalId || row.hospitalName || row.hospital) item.hospitals.add(row.hospitalId || row.hospitalName || row.hospital);
          if (row.departmentId || row.departmentName || row.department) item.departments.add(row.departmentId || row.departmentName || row.department);
          if (identity(row)) item.customers.add(identity(row));
          rawTexts.forEach(text => item.rawTexts.add(text));
          if (includeGap) item.boxGap += Math.max(0, clampFinite(targetOf(row)) - clampFinite(actualOf(row)));
          grouped.set(tag, item);
        });
      });
      return [...grouped.values()].map(item => ({
        ...item,
        text: item.label,
        count: item.records,
        employees: item.employees.size,
        hospitals: item.hospitals.size,
        departments: item.departments.size,
        customers: item.customers.size,
        rawTexts: [...item.rawTexts]
      })).sort((a, b) => b.records - a.records || b.boxGap - a.boxGap);
    };
    const resources = summarizeTaggedPlans(scoped, 'resourceTags', ['resourcePlan'], resourceLabels);
    const reasons = summarizeTaggedPlans(scoped.filter(row => statusOf(row) === 'NOT_ACHIEVED'), 'reasonTags', ['problemAnalysis', 'nextAction'], reasonLabels, true);
    const summaryCards = [{
      label: '目标盒数',
      value: totals.targetBoxes,
      unit: '盒',
      rate: null,
      status: totals.targetBoxes > 0 ? '已读取' : '未设置'
    }, {
      label: '实际盒数',
      value: totals.actualBoxes,
      unit: '盒',
      rate: totals.achievementRate,
      status: totals.achievementRate === null ? '暂无数据' : totals.achievementRate >= 1 ? '已达成' : '需关注'
    }, {
      label: '客户覆盖',
      value: totals.plannedCustomers,
      unit: '位',
      rate: null,
      status: `${totals.employees}名员工`
    }, {
      label: '资源计划',
      value: resources.length,
      unit: '项',
      rate: null,
      status: resources.length ? '计划记录' : '暂无数据'
    }];
    return {
      state: scoped.length ? 'normal' : 'empty',
      records: scoped,
      totals,
      summaryCards,
      dimensions: {
        employee: groupBy(row => row.employee, '员工'),
        hospital: groupBy(row => row.hospitalName || row.hospital, '医院'),
        department: groupBy(row => row.departmentName || row.department, '科室'),
        customer: groupBy(row => row.customerName || row.customer, '客户')
      },
      resources,
      reasons
    };
  }
  function buildDeepBusinessAnalysis(input = {}) {
    const {
      fiscal,
      selected,
      metric,
      currentRows = [],
      previousRows = [],
      lastYearRows = [],
      fiscalTrend = [],
      comparisonTrend = [],
      current = summarize(currentRows, metric),
      previous = summarize(previousRows, metric),
      lastYear = summarize(lastYearRows, metric),
      targetValue = null,
      targetPlan = null,
      hospitals = {
        contribution: [],
        growth: [],
        decline: []
      },
      employees = {
        contribution: [],
        growth: [],
        decline: []
      },
      departments = [],
      customers = {
        total: 0,
        levels: [],
        customers: new Map()
      },
      upgrades = {
        hasHistory: false,
        transitions: {},
        contribution: 0,
        contributionShare: 0
      },
      waterfall = {
        totalChange: 0,
        series: [],
        details: []
      },
      employeePlanFit = {
        ranking: [],
        teamAverage: null,
        lowFit: [],
        unfilled: [],
        majorIssues: []
      },
      execution = [],
      alerts = [],
      tasks = [],
      product = 'all',
      validRecords = []
    } = input;
    const productId = stableProductId(product);
    const productLabel = productId === "Primary Product A" ? "Primary Product A" : productId === "Primary Product B" ? "Primary Product B" : '全部产品';
    const fmt = (value, digits = 1) => formatMetricValue(value, metric, digits).replace(metric.unit || '', '');
    const pct = (value, digits = 1) => value === null ? '缺少基期' : `${(value * 100).toFixed(digits)}%`;
    const yoy = percentageChange(current.value, lastYear.value);
    const mom = percentageChange(current.value, previous.value);
    const trendState = monthlyDirection(fiscalTrend);
    const completedFiscal = fiscalTrend.filter(item => !item.future);
    const fiscalActual = completedFiscal.reduce((total, item) => total + clampFinite(item.total), 0);
    const elapsedMonths = completedFiscal.filter(item => item.period <= fiscal.cutoffDate.slice(0, 7)).length;
    const remainingMonths = Math.max(0, 12 - elapsedMonths);
    const currentMonthlyPace = elapsedMonths ? fiscalActual / elapsedMonths : 0;
    const annualTarget = targetPlan?.annualTarget ?? targetValue;
    const remainingGap = annualTarget === null ? null : Math.max(0, annualTarget - fiscalActual);
    const requiredMonthly = annualTarget === null || !remainingMonths ? null : remainingGap / remainingMonths;
    const forecast = annualTarget === null ? null : fiscalActual + currentMonthlyPace * remainingMonths;
    const projectedGap = annualTarget === null ? null : Math.max(0, annualTarget - forecast);
    let cumulativeActual = 0;
    const cumulativePlan = fiscalTrend.map(item => {
      if (!item.future) cumulativeActual += clampFinite(item.total);
      const target = targetPlan?.cumulativeTargets?.find(entry => entry.period === item.period);
      return {
        period: item.period,
        actual: item.future ? null : cumulativeActual,
        target: target?.cumulativeTarget ?? null,
        monthlyTarget: target?.monthlyTarget ?? null,
        future: item.future
      };
    });
    const targetGap = {
      state: annualTarget === null ? 'missing' : 'normal',
      target: annualTarget,
      actual: fiscalActual,
      completionRate: annualTarget ? fiscalActual / annualTarget : null,
      gap: remainingGap,
      elapsedMonths,
      remainingMonths,
      requiredMonthly,
      currentMonthlyPace,
      forecast,
      projectedGap,
      cumulativePlan,
      conclusion: annualTarget === null ? `${productLabel}财年目标未设置，不能推算达标路径。` : remainingMonths ? `${productLabel}财年已完成${pct(fiscalActual / annualTarget)}，剩余${remainingMonths}个月需月均${fmt(requiredMonthly)}${metric.unit}；当前月均${fmt(currentMonthlyPace)}${metric.unit}，${projectedGap > 0 ? `按当前速度预计仍有${fmt(projectedGap)}${metric.unit}缺口` : '按当前速度预计可达到目标'}。` : `${productLabel}财年完成率${pct(fiscalActual / annualTarget)}，最终缺口${fmt(remainingGap)}${metric.unit}。`
    };
    const growthBy = key => dimensionChanges(currentRows, previousRows, key, metric).filter(item => item.change > 0).sort((a, b) => b.change - a.change);
    const lossBy = key => dimensionChanges(currentRows, previousRows, key, metric).filter(item => item.change < 0).sort((a, b) => a.change - b.change);
    const growthDrivers = waterfall.series.filter(item => item.kind === 'positive' && item.value > 0);
    const lossDrivers = waterfall.series.filter(item => item.kind === 'negative' && item.value < 0);
    const employeeBoxRows = dimensionRows(currentRows, 'employee', {
      key: 'orderBoxes',
      label: '下单盒数',
      unit: '盒'
    }, 100);
    const employeeTotal = employeeBoxRows.reduce((total, item) => total + item.value, 0);
    const employeeSegmentation = ['head', 'middle', 'tail'].map(key => {
      const labels = {
        head: '头部',
        middle: '腰部',
        tail: '尾部'
      };
      const matched = employeeBoxRows.filter(item => key === 'head' ? item.value >= 30 : key === 'middle' ? item.value >= 10 && item.value < 30 : item.value < 10);
      const value = matched.reduce((total, item) => total + item.value, 0);
      const fit = matched.map(item => employeePlanFit.ranking.find(entry => entry.employeeName === item.name)?.fitScore).filter(score => score !== null && score !== undefined);
      return {
        key,
        label: labels[key],
        count: matched.length,
        value,
        share: employeeTotal ? value / employeeTotal : 0,
        averageFit: fit.length ? fit.reduce((a, b) => a + b, 0) / fit.length : null,
        employees: matched
      };
    });
    const scoredEmployees = employeePlanFit.ranking.filter(item => item.fitScore !== null);
    const performanceFitMatrix = {
      A: [],
      B: [],
      C: [],
      D: [],
      insufficient: []
    };
    employeePlanFit.ranking.forEach(fit => {
      const contribution = employees.contribution.find(item => item.name === fit.employeeName)?.value || clampFinite(fit.evidence?.actualSales);
      if (fit.fitScore === null) {
        performanceFitMatrix.insufficient.push({
          ...fit,
          contribution
        });
        return;
      }
      const highPerformance = contribution >= 30;
      const highFit = fit.fitScore >= 60;
      performanceFitMatrix[highPerformance ? highFit ? 'A' : 'B' : highFit ? 'C' : 'D'].push({
        ...fit,
        contribution
      });
    });
    const top3HospitalShare = hospitals.contribution.slice(0, 3).reduce((total, item) => total + item.share, 0);
    const hospitalDeclineLinks = hospitals.decline.filter(item => item.change < 0).map(item => {
      const currentHospital = currentRows.filter(row => String(row.hospital || '').trim() === item.name);
      const previousHospital = previousRows.filter(row => String(row.hospital || '').trim() === item.name);
      const employeeChanges = dimensionChanges(currentHospital, previousHospital, 'employee', metric).sort((a, b) => a.change - b.change);
      const departmentChanges = dimensionChanges(currentHospital, previousHospital, 'department', metric).sort((a, b) => a.change - b.change);
      const owners = employeeChanges.filter(entry => entry.change < 0).slice(0, 3).map(entry => ({
        ...entry,
        planFit: employeePlanFit.ranking.find(fit => fit.employeeName === entry.name) || null
      }));
      return {
        ...item,
        responsibleEmployees: owners,
        departments: departmentChanges.filter(entry => entry.change < 0).slice(0, 3)
      };
    });
    const hospitalDiagnosis = {
      top: hospitals.contribution,
      growth: hospitals.growth.filter(item => item.change > 0),
      decline: hospitalDeclineLinks,
      top3Share: top3HospitalShare,
      concentrationRisk: top3HospitalShare >= .6,
      newHospitals: growthBy('hospital').filter(item => item.previous === 0),
      continuousNoOutput: []
    };
    const departmentTotal = departments.reduce((total, item) => total + item.value, 0);
    const topDepartmentShare = departmentTotal && departments[0] ? departments[0].value / departmentTotal : 0;
    const departmentDiagnosis = {
      top: departments,
      growth: growthBy('department'),
      decline: lossBy('department'),
      topShare: topDepartmentShare,
      concentrationRisk: topDepartmentShare >= .6
    };
    const customerLevels = customers.levels || [];
    const highCustomer = customerLevels.filter(item => item.level === 'A' || item.level === 'B');
    const dLevel = customerLevels.find(item => item.level === 'D');
    const customerStructureDiagnosis = {
      total: customers.total,
      levels: customerLevels,
      highCount: highCustomer.reduce((total, item) => total + item.count, 0),
      highContributionShare: highCustomer.reduce((total, item) => total + item.share, 0),
      dShare: customers.total && dLevel ? dLevel.count / customers.total : 0,
      actions: {
        D: '验证是否形成稳定推荐。',
        C: '推动推荐量形成规律。',
        B: '识别突破20–30盒瓶颈的可执行动作。',
        A: '稳定产出并复盘可复制的影响因素。'
      }
    };
    const customerUpgradeDiagnosis = {
      ...upgrades,
      successCount: Object.entries(upgrades.transitions || {}).filter(([key]) => key !== 'new').reduce((total, [, value]) => total + value, 0)
    };
    const orderDepthDiagnosis = orderDepthStructure(currentRows, metric);
    const findings = [];
    findings.push(analysisFinding('sales-result', 'sales', `${productLabel} ${selected.label} ${metric.label} ${formatMetricValue(current.value, metric)}，同比${signedPercent(yoy)}，环比${signedPercent(mom)}。`, [`本期 ${formatMetricValue(current.value, metric)}`, `上年同期 ${formatMetricValue(lastYear.value, metric)}`, `上一周期 ${formatMetricValue(previous.value, metric)}`], mom !== null && mom < 0 ? 'high' : 'info', .95, mom !== null && mom < 0 ? '优先定位本期掉量对象并设定次期恢复指标。' : '保留增长来源并验证其可持续性。'));
    if (annualTarget !== null) findings.push(analysisFinding('target-gap', 'target', targetGap.conclusion, [`财年目标${fmt(annualTarget)}${metric.unit}`, `财年至今${fmt(fiscalActual)}${metric.unit}`], projectedGap > 0 ? 'critical' : 'info', .92, projectedGap > 0 ? '将缺口拆分到剩余月份、办事处和责任员工。' : '按月监控达标速度，防止后续回落。'));
    if (trendState.peak) findings.push(analysisFinding('trend-turning', 'trend', `${trendState.peak.period.slice(5)}月为财年阶段高点${fmt(trendState.peak.total)}${metric.unit}；近期走势${trendState.recentDirection === 'weakening' ? '转弱' : trendState.recentDirection === 'improving' ? '改善' : '平稳'}${trendState.declineRun >= 2 ? `，最长连续下降${trendState.declineRun}个月` : ''}。`, [`最高月${trendState.peak.period}`, `最低月${trendState.low?.period || '无'}`, `最长连续下降${trendState.declineRun}个月`], trendState.recentDirection === 'weakening' ? 'high' : 'info', .88, trendState.recentDirection === 'weakening' ? '拆解最近两个月的办事处、医院和员工变化。' : '复盘峰值月份的可复制来源。'));
    if (lastYear.value > 0 && lastYear.value < Math.max(1, current.value * .2) && yoy !== null && yoy > .5) findings.push(analysisFinding('low-base-yoy', 'comparison', `同比${pct(yoy)}较高，但上年同期基数仅${fmt(lastYear.value)}${metric.unit}，需结合绝对增量判断。`, [`上年同期${fmt(lastYear.value)}${metric.unit}`, `绝对增量${fmt(current.value - lastYear.value)}${metric.unit}`], 'watch', .95, '汇报时同时展示绝对增量，避免只用百分比判断。'));
    if (hospitalDiagnosis.concentrationRisk) findings.push(analysisFinding('hospital-concentration', 'hospital', `Top3医院贡献${pct(top3HospitalShare)}，医院集中度较高。`, hospitals.contribution.slice(0, 3).map(item => `${item.name} ${fmt(item.value)}${metric.unit}`), 'high', .9, '为Top3医院建立掉量预警，同时培育第二梯队医院。'));
    if (departmentDiagnosis.concentrationRisk) findings.push(analysisFinding('department-concentration', 'department', `${departments[0]?.name || '单一科室'}贡献${pct(topDepartmentShare)}，科室结构集中。`, departments.slice(0, 3).map(item => `${item.name} ${pct(item.share)}`), topDepartmentShare >= .85 ? 'high' : 'watch', .9, '核对可拓展科室是否已有医院、员工和计划承接。'));
    if (customerStructureDiagnosis.dShare >= .5) findings.push(analysisFinding('customer-d-heavy', 'customer', `D级客户占${pct(customerStructureDiagnosis.dShare)}，客户结构偏弱。`, customerLevels.map(item => `${item.level}级${item.count}人、贡献${pct(item.share)}`), 'high', .86, '从最接近升级阈值的C/B客户中确定优先升级对象。'));
    if (employeePlanFit.lowFit?.length) findings.push(analysisFinding('employee-plan-low-fit', 'employeePlanFit', `${employeePlanFit.lowFit.length}名员工计划与实际拟合度低于60分，建议人工复核。`, employeePlanFit.lowFit.slice(0, 5).map(item => `${item.employeeName} ${fmt(item.fitScore, 0)}分：${item.issues?.[0]?.text || '需复核'}`), 'high', .84, '逐人核对目标、重点医院/科室与实际产出；低拟合不等同于虚假填写。'));
    if (lossDrivers[0]) findings.push(analysisFinding('largest-loss', 'loss', `${lossDrivers[0].name}是当前最大掉量维度，影响${fmt(Math.abs(lossDrivers[0].value))}${metric.unit}。`, [`业务维度：${lossDrivers[0].name}`, `影响量${fmt(Math.abs(lossDrivers[0].value))}${metric.unit}`, `净变化${fmt(waterfall.totalChange)}${metric.unit}`], 'critical', .9, '在明细页继续定位对应医院、科室、员工和员工计划。'));
    if (growthDrivers[0]) findings.push(analysisFinding('largest-growth', 'growth', `${growthDrivers[0].name}是当前最大增长维度，贡献${fmt(growthDrivers[0].value)}${metric.unit}。`, [`业务维度：${growthDrivers[0].name}`, `贡献量${fmt(growthDrivers[0].value)}${metric.unit}`, `净变化${fmt(waterfall.totalChange)}${metric.unit}`], 'info', .9, '复盘增长对象与月份，确认新增或存量提升是否可持续。'));
    const executionReview = execution.map(item => ({
      ...item,
      planned: item.count,
      actual: item.rate,
      gap: item.rate === null ? null : 100 - item.rate,
      diagnosis: item.rate === null ? '暂无可用于复盘的任务数据。' : item.rate >= 75 ? '执行进度总体正常。' : '计划与实际存在差距，需核对未完成任务。',
      nextAction: item.rate === null ? '补充计划与进度数据。' : item.rate >= 75 ? '保持节奏并验证销售结果。' : '按责任人逐项确认差距原因和补救时间。'
    }));
    const activityRows = currentRows.filter(row => clampFinite(row.activityCost) > 0 || clampFinite(row.visitCount) > 0);
    const activityReview = {
      count: activityRows.length,
      cost: sum(activityRows, 'activityCost'),
      visits: sum(activityRows, 'visitCount'),
      hospitals: new Set(activityRows.map(row => row.hospital).filter(Boolean)).size,
      conclusion: activityRows.length ? `当前周期记录${activityRows.length}条活动/拜访相关明细，活动后观察到的销售变化需结合基期和其他因素判断，不能直接认定因果。` : '当前筛选范围暂无可用于活动效果复盘的数据。'
    };
    const coreProblems = uniqueFindings(findings.filter(item => item.severityScore >= 45).map(item => ({
      ...item,
      priorityScore: Math.round(item.severityScore * .5 + item.confidence * 25 + (item.recommendedAction ? 15 : 0) + (item.evidence.length >= 2 ? 10 : 0))
    })).sort((a, b) => b.priorityScore - a.priorityScore), 5);
    const executiveSummary = uniqueFindings([...coreProblems, ...findings.filter(item => item.severity === 'info')], 8);
    const nextQuarterActions = coreProblems.slice(0, 5).map((item, index) => ({
      priority: `P${index + 1}`,
      object: ['loss', 'growth'].includes(item.topic) ? item.conclusion.split('是当前')[0] : item.evidence[0] || productLabel,
      problem: item.conclusion,
      action: item.recommendedAction,
      owner: item.topic === 'employeePlanFit' ? '直属负责人/员工' : item.topic === 'hospital' || item.topic === 'loss' ? '对应信息员' : '业务负责人',
      timing: '下一季度首月启动',
      metric: item.topic === 'target' ? `月均达到${requiredMonthly === null ? '目标拆解值' : `${fmt(requiredMonthly)}${metric.unit}`}` : '按同口径复核改善幅度',
      reviewDate: '下一月度复盘',
      evidence: item.evidence
    }));
    const scopedPlans = tasks.map(normalizeEmployeePlan).filter(Boolean).filter(plan => plan.product === productId);
    const customerFilled = currentRows.filter(row => String(row.customer || '').trim()).length;
    const employeeFilled = currentRows.filter(row => String(row.employee || '').trim()).length;
    const historyMonths = new Set(validRecords.filter(row => stableProductId(row.product) === productId && row.date <= fiscal.cutoffDate).map(row => row.date.slice(0, 7))).size;
    const dataCompleteness = {
      salesRecords: currentRows.length,
      employeeCoverage: currentRows.length ? employeeFilled / currentRows.length : 0,
      customerCoverage: currentRows.length ? customerFilled / currentRows.length : 0,
      employeePlanCoverage: employeePlanFit.employeeCount ? (employeePlanFit.employeeCount - employeePlanFit.unfilled.length) / employeePlanFit.employeeCount : 0,
      historyMonths,
      targetConfigured: annualTarget !== null,
      executionItems: execution.reduce((total, item) => total + item.count, 0),
      limitations: [!currentRows.length ? '当前筛选范围无销售明细。' : '', annualTarget === null ? '未设置产品财年目标，无法生成达标预测。' : '', employeePlanFit.coverageRate < .5 && employeePlanFit.employeeCount ? `员工计划覆盖率${formatShare(employeePlanFit.coverageRate)}，本项仅供参考。` : employeePlanFit.unfilled?.length ? `${employeePlanFit.unfilled.length}名员工未填写计划。` : '', historyMonths < 6 ? `仅有${historyMonths}个月历史数据，趋势结论置信度有限。` : '', customerFilled < currentRows.length ? '部分销售明细缺少客户字段，客户等级分析仅覆盖已填写记录。' : '', !execution.some(item => item.count) ? '四定表任务数据不足。' : ''].filter(Boolean)
    };
    const risks = uniqueFindings([...findings.filter(item => item.severityScore >= 45), ...alerts.map((alert, index) => analysisFinding(`alert-${index + 1}`, 'alert', alert.title, alert.detail, alert.level === 'risk' ? 'high' : 'watch', .75, '打开明细核对责任对象与后续动作。'))], 8);
    return {
      schemaVersion: 1,
      product: productId,
      fiscalYear: fiscal.fiscalYear,
      fiscalQuarter: fiscal.fiscalQuarter,
      month: fiscal.month,
      cutoffDate: fiscal.cutoffDate,
      executiveSummary,
      salesDiagnosis: findings.filter(item => ['sales', 'trend', 'comparison'].includes(item.topic)),
      targetDiagnosis: findings.filter(item => item.topic === 'target'),
      targetGap,
      growthDrivers,
      lossDrivers,
      employeeSegmentation,
      employeePlanFit,
      performanceFitMatrix,
      hospitalDiagnosis: {
        ...hospitalDiagnosis,
        monthlyTrend: enrichMonthlyTrend(dimensionMonthlyTrend(currentRows, selected, 'hospital', metric, 10))
      },
      departmentDiagnosis,
      customerStructureDiagnosis,
      customerUpgradeDiagnosis,
      orderDepthDiagnosis,
      employeeMonthlyTrend: enrichMonthlyTrend(dimensionMonthlyTrend(currentRows, selected, 'employee', metric, 10)),
      coreProblems,
      executionReview,
      activityReview,
      risks,
      priorities: coreProblems,
      nextQuarterActions,
      dataCompleteness,
      academicResourceInvestment: {
        state: 'reserved',
        records: [],
        fields: ['employee', 'hospital', 'department', 'customer', 'project', 'amount', 'date', 'purpose', 'expectedTarget']
      },
      narrative: {
        executiveSummary: executiveSummary.map(findingText),
        coreProblems: coreProblems.map(findingText),
        risks: risks.map(findingText)
      }
    };
  }
  function fiscalSelection(options = {}, fallbackDate = dateKey(new Date())) {
    const cutoff = parseDate(options.cutoffDate || options.to || fallbackDate) || new Date();
    const selectedFiscalYear = Number(String(options.fiscalYear || fiscalYear(cutoff)).replace(/\D/g, '')) || fiscalYear(cutoff);
    const selectedQuarter = options.fiscalQuarter === null || options.fiscalQuarter === '' ? null : Number(String(options.fiscalQuarter || fiscalQuarter(cutoff)).replace(/\D/g, ''));
    const selectedMonth = options.month === null || options.month === '' ? null : Number(String(options.month || cutoff.getMonth() + 1).replace(/\D/g, ''));
    const fy = range(new Date(selectedFiscalYear - 1, 9, 1, 12), new Date(selectedFiscalYear, 8, 30, 12), `FY${selectedFiscalYear}`);
    const starts = {
      1: [selectedFiscalYear - 1, 9],
      2: [selectedFiscalYear, 0],
      3: [selectedFiscalYear, 3],
      4: [selectedFiscalYear, 6]
    };
    let full = fy;
    if (selectedQuarter && starts[selectedQuarter]) {
      const [year, monthIndex] = starts[selectedQuarter];
      full = range(new Date(year, monthIndex, 1, 12), new Date(year, monthIndex + 3, 0, 12), `FY${selectedFiscalYear} Q${selectedQuarter}`);
    }
    if (selectedMonth) {
      const calendarYear = selectedMonth >= 10 ? selectedFiscalYear - 1 : selectedFiscalYear;
      full = monthRange(new Date(calendarYear, selectedMonth - 1, 1, 12));
    }
    const cutoffKey = dateKey(cutoff);
    const effectiveTo = cutoffKey < full.from ? full.from : cutoffKey > full.to ? full.to : cutoffKey;
    const current = {
      ...full,
      to: effectiveTo,
      label: selectedMonth ? `${selectedFiscalYear}财年${selectedMonth}月` : selectedQuarter ? `${selectedFiscalYear}财年 Q${selectedQuarter}` : `${selectedFiscalYear}财年`
    };
    return {
      fiscalYear: selectedFiscalYear,
      fiscalQuarter: selectedQuarter,
      month: selectedMonth,
      cutoffDate: cutoffKey,
      current,
      fiscalYearRange: fy,
      previous: comparisonRanges(current).previous,
      lastYear: comparisonRanges(current).lastYear
    };
  }
  function fiscalMonthSeries(records, selection, metric) {
    return monthKeys(selection.fiscalYearRange.from, selection.fiscalYearRange.to).map(period => {
      const rows = records.filter(record => record.date.slice(0, 7) === period && record.date <= selection.cutoffDate);
      const [year, month] = period.split('-').map(Number);
      const priorPeriod = `${year - 1}-${pad(month)}`;
      const cutoff = parseDate(selection.cutoffDate);
      const isCutoffMonth = selection.cutoffDate.slice(0, 7) === period;
      const priorCutoff = isCutoffMonth ? dateKey(new Date(cutoff.getFullYear() - 1, cutoff.getMonth(), cutoff.getDate(), 12)) : `${priorPeriod}-${pad(endOfMonth(year - 1, month - 1).getDate())}`;
      const priorRows = records.filter(record => record.date.slice(0, 7) === priorPeriod && record.date <= priorCutoff);
      const offices = dimensionRows(rows, 'office', metric, 20);
      const officeOne = offices.filter(item => /一部|一办/.test(item.name)).reduce((total, item) => total + item.value, 0);
      const officeTwo = offices.filter(item => /二部|二办/.test(item.name)).reduce((total, item) => total + item.value, 0);
      const future = `${period}-01` > selection.cutoffDate;
      return {
        period,
        ...summarize(rows, metric),
        officeOne: future ? null : officeOne,
        officeTwo: future ? null : officeTwo,
        total: future ? null : sum(rows, metric.key),
        priorPeriod,
        priorTotal: priorRows.length ? sum(priorRows, metric.key) : null,
        hasData: rows.length > 0,
        priorAvailable: priorRows.length > 0,
        future
      };
    });
  }
  function comparisonMonthSeries(records, selection, metric) {
    const current = fiscalMonthSeries(records, selection, metric);
    return current.map(item => {
      const [year, month] = item.period.split('-').map(Number);
      const previousPeriod = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
      const currentRows = records.filter(record => record.date.slice(0, 7) === item.period && record.date <= selection.cutoffDate);
      const previousRows = records.filter(record => record.date.slice(0, 7) === previousPeriod);
      const currentValue = item.future ? null : sum(currentRows, metric.key);
      const priorValue = item.priorTotal;
      const previousValue = previousRows.length ? sum(previousRows, metric.key) : null;
      return {
        period: item.period,
        current: currentValue,
        prior: priorValue,
        previous: previousValue,
        yoy: percentageChange(currentValue, priorValue),
        mom: percentageChange(currentValue, previousValue),
        currentAvailable: currentRows.length > 0,
        priorAvailable: item.priorAvailable,
        previousAvailable: previousRows.length > 0,
        future: item.future
      };
    });
  }
  function validateChartData(chartType, series, options = {}) {
    const rows = Array.isArray(series) ? series : series && typeof series === 'object' ? Object.values(series).flatMap(value => Array.isArray(value) ? value : []) : [];
    const invalidValues = [];
    const walk = (value, path) => {
      if (typeof value === 'number' && !Number.isFinite(value)) invalidValues.push(path);else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, `${path}.${key}`));
    };
    walk(series, 'series');
    const categories = rows.filter(row => row && (row.period || row.name || row.level || row.label || row.quarter || row.product)).length;
    const missing = [];
    if (!categories) missing.push('categories');
    if (!rows.length) missing.push('series');
    if (['donut', 'funnel'].includes(chartType) && !rows.some(row => ['value', 'count', 'actual', 'current', 'total'].some(key => Number.isFinite(Number(row?.[key])) && Number(row[key]) !== 0))) missing.push('有效数值');
    if (chartType === 'dual-axis-bars-lines' && rows.some(row => !row.future && !row.priorAvailable)) missing.push('同比基期');
    if (chartType === 'dual-axis-bars-lines' && rows.some(row => !row.future && !row.previousAvailable)) missing.push('环比基期');
    if ((chartType === 'grouped-bars' || chartType === 'progress') && options.targetMissing) missing.push('目标');
    return {
      categories,
      seriesCount: rows.length,
      invalidValues,
      missing: [...new Set(missing)],
      state: invalidValues.length ? 'error' : missing.length ? 'partial' : 'normal'
    };
  }
  const ANALYSIS_TYPE_BY_CHART = Object.freeze({
    'fiscal-sales-trend': 'fiscal-trend',
    'yoy-mom-analysis': 'period-comparison',
    'quarter-target': 'target-achievement',
    'product-target': 'target-achievement',
    'hospital-ranking': 'hospital-analysis',
    'employee-ranking': 'employee-analysis',
    'department-distribution': 'department-analysis',
    'customer-levels': 'customer-structure',
    'customer-upgrades': 'customer-upgrade',
    'average-order': 'order-size',
    waterfall: 'decline-analysis'
  });
  function detailFinding(findingType, title, conclusion, evidence = [], severity = 'info', confidence = .8) {
    return {
      findingType,
      title,
      conclusion,
      evidence: (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean),
      severity,
      confidence
    };
  }
  function detailTable(tableId, title, columns, rows) {
    return {
      tableId,
      title,
      columns,
      rows
    };
  }
  function detailContract(analysisType, title, input, detail = {}) {
    const {
      fiscal,
      product,
      filters = {},
      metric
    } = input;
    return {
      analysisType,
      title,
      subtitle: detail.subtitle || `${metric.label}口径`,
      period: {
        ...fiscal.current
      },
      product: stableProductId(product),
      filters: {
        ...filters,
        product: stableProductId(product),
        fiscalYear: fiscal.fiscalYear,
        fiscalQuarter: fiscal.fiscalQuarter,
        month: fiscal.month,
        cutoffDate: fiscal.cutoffDate
      },
      headline: detail.headline || '当前数据不足，暂不能形成分析结论。',
      summaryCards: detail.summaryCards || [],
      findings: detail.findings || [],
      tables: detail.tables || [],
      sections: detail.sections || [],
      limitations: detail.limitations || [],
      methodology: detail.methodology || `${metric.methodology} 所有明细使用与主图一致的财年、财季、月份、截止日期、产品和组织筛选。`
    };
  }
  function detailGroup(rows, key, metric) {
    const grouped = new Map();
    rows.forEach(row => {
      const raw = typeof key === 'function' ? key(row) : row[key];
      const id = String(raw?.id ?? raw ?? '').trim();
      if (!id) return;
      const prior = grouped.get(id) || {
        id,
        name: String(raw?.name ?? raw ?? '').trim(),
        rows: [],
        value: 0,
        boxes: 0
      };
      prior.rows.push(row);
      prior.value += clampFinite(row[metric.key]);
      prior.boxes += clampFinite(row.orderBoxes);
      grouped.set(id, prior);
    });
    return grouped;
  }
  function detailChanges(currentRows, baselineRows, key, metric) {
    const current = detailGroup(currentRows, key, metric);
    const baseline = detailGroup(baselineRows, key, metric);
    return [...new Set([...current.keys(), ...baseline.keys()])].map(id => {
      const a = current.get(id);
      const b = baseline.get(id);
      const value = a?.value || 0;
      const baselineValue = b?.value || 0;
      return {
        id,
        name: a?.name || b?.name || id,
        current: value,
        baseline: baselineValue,
        delta: value - baselineValue,
        deltaRate: percentageChange(value, baselineValue),
        currentRows: a?.rows || [],
        baselineRows: b?.rows || []
      };
    });
  }
  function acceptableCustomerMatch(row) {
    const id = String(row.customerId || '').trim();
    if (!id) return false;
    const status = String(row.customerMatchStatus || row.matchStatus || row.matchConfidence || '').trim().toUpperCase();
    return !status || ['EXACT', 'MATCH', 'CONFIRMED', 'ACCEPTED', 'HIGH'].includes(status);
  }
  function customerIdentity(row) {
    return acceptableCustomerMatch(row) ? {
      id: String(row.customerId),
      name: String(row.customer || row.customerName || row.customerId)
    } : null;
  }
  function hospitalIdentity(row) {
    const name = String(row.hospital || row.hospitalName || '').trim();
    return name ? {
      id: String(row.hospitalId || name),
      name
    } : null;
  }
  function employeeIdentity(row) {
    const name = String(row.employee || '').trim();
    return name ? {
      id: String(row.employeeId || name),
      name
    } : null;
  }
  function departmentIdentity(row) {
    const hospital = String(row.hospital || row.hospitalName || '').trim();
    const department = String(row.department || row.departmentName || '').trim();
    if (!department) return null;
    return {
      id: `${String(row.hospitalId || hospital)}|${String(row.departmentId || department)}`,
      name: department,
      hospital
    };
  }
  function detailChangeTable(rows, unit) {
    return rows.map(item => ({
      subjectId: item.id,
      subject: item.name,
      baseline: item.baseline,
      current: item.current,
      delta: item.delta,
      deltaRate: item.deltaRate,
      unit
    }));
  }
  function sourceRowsByMonth(rows, period) {
    return rows.filter(row => row.date.slice(0, 7) === period);
  }
  function buildFiscalTrendAnalysis(input) {
    const actual = input.fiscalTrend.filter(item => !item.future);
    const totals = actual.filter(item => item.hasData);
    const total = totals.reduce((sumValue, item) => sumValue + clampFinite(item.total), 0);
    const average = totals.length ? total / totals.length : null;
    const peak = totals.length ? [...totals].sort((a, b) => b.total - a.total)[0] : null;
    const low = totals.length ? [...totals].sort((a, b) => a.total - b.total)[0] : null;
    const transitions = actual.map((item, index) => {
      const previous = index ? actual[index - 1] : null;
      const delta = previous ? clampFinite(item.total) - clampFinite(previous.total) : null;
      return {
        period: item.period,
        previousPeriod: previous?.period || null,
        previous: previous?.total ?? null,
        current: item.total,
        delta,
        deltaRate: previous ? percentageChange(item.total, previous.total) : null,
        officeOne: previous ? clampFinite(item.officeOne) - clampFinite(previous.officeOne) : null,
        officeTwo: previous ? clampFinite(item.officeTwo) - clampFinite(previous.officeTwo) : null
      };
    });
    const comparable = transitions.filter(item => item.delta !== null);
    const maxGrowth = [...comparable].sort((a, b) => b.delta - a.delta)[0];
    const maxDecline = [...comparable].sort((a, b) => a.delta - b.delta)[0];
    const turning = [...comparable].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    const trend = monthlyDirection(input.fiscalTrend);
    const currentMonthRows = turning ? sourceRowsByMonth(input.filteredRows, turning.period) : [];
    const priorMonthRows = turning?.previousPeriod ? sourceRowsByMonth(input.filteredRows, turning.previousPeriod) : [];
    const sourceTable = (key, id, title) => detailTable(id, title, ['对象', '上月', '本月', '变化', '变化率'], detailChangeTable(detailChanges(currentMonthRows, priorMonthRows, key, input.metric).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10), input.metric.unit));
    const findings = [];
    if (totals.length) findings.push(detailFinding('fiscal-total', '财年累计', `FY${input.fiscal.fiscalYear}截至${input.fiscal.cutoffDate}累计${formatMetricValue(total, input.metric)}，月均${formatMetricValue(average, input.metric)}。`, [`峰值月${peak?.period || '暂无'}`, `低点月${low?.period || '暂无'}`], 'info', .98));
    if (maxGrowth?.delta > 0) findings.push(detailFinding('largest-monthly-growth', '最大增长月', `${maxGrowth.period}较上月增加${formatMetricValue(maxGrowth.delta, input.metric)}。`, [`Synthetic Office A变化${formatMetricValue(maxGrowth.officeOne, input.metric)}`, `Synthetic Office B变化${formatMetricValue(maxGrowth.officeTwo, input.metric)}`], 'info', .92));
    if (maxDecline?.delta < 0) findings.push(detailFinding('largest-monthly-decline', '最大掉量月', `${maxDecline.period}较上月减少${formatMetricValue(Math.abs(maxDecline.delta), input.metric)}。`, [`Synthetic Office A变化${formatMetricValue(maxDecline.officeOne, input.metric)}`, `Synthetic Office B变化${formatMetricValue(maxDecline.officeTwo, input.metric)}`], 'high', .92));
    return detailContract('fiscal-trend', '财年销售趋势详细分析', input, {
      headline: totals.length ? `财年累计${formatMetricValue(total, input.metric)}，趋势${trend.recentDirection === 'improving' ? '近期改善' : trend.recentDirection === 'weakening' ? '近期转弱' : trend.recentDirection === 'stable' ? '近期平稳' : '数据不足'}。` : '当前财年暂无可分析的销售明细。',
      summaryCards: [{
        label: '财年累计',
        value: total,
        unit: input.metric.unit
      }, {
        label: '月均',
        value: average,
        unit: input.metric.unit
      }, {
        label: '峰值月',
        value: peak?.period || null
      }, {
        label: '低点月',
        value: low?.period || null
      }],
      findings,
      tables: [detailTable('fiscal-monthly-turning', '月度拐点', ['月份', '上月', '本月', '变化', 'Synthetic Office A贡献', 'Synthetic Office B贡献'], transitions), sourceTable(hospitalIdentity, 'fiscal-turning-hospitals', '最大拐点医院来源'), sourceTable(departmentIdentity, 'fiscal-turning-departments', '最大拐点科室来源'), sourceTable(employeeIdentity, 'fiscal-turning-employees', '最大拐点员工来源')],
      sections: [{
        sectionId: 'runs',
        title: '趋势诊断',
        data: {
          continuousGrowth: trend.growthRun,
          continuousDecline: trend.declineRun,
          largestGrowthPeriod: maxGrowth?.period || null,
          largestDeclinePeriod: maxDecline?.period || null
        }
      }],
      limitations: totals.length < 2 ? ['历史月份不足，无法判断连续趋势或拐点。'] : []
    });
  }
  function comparisonDimensionTables(prefix, label, currentRows, baselineRows, input) {
    const make = (key, dimension) => {
      const changes = detailChanges(currentRows, baselineRows, key, input.metric);
      return [detailTable(`${prefix}-${dimension}-growth`, `${label}${dimension === 'hospital' ? '医院' : '员工'}增长来源`, ['对象', '基期', '本期', '变化', '变化率'], detailChangeTable(changes.filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10), input.metric.unit)), detailTable(`${prefix}-${dimension}-decline`, `${label}${dimension === 'hospital' ? '医院' : '员工'}掉量来源`, ['对象', '基期', '本期', '变化', '变化率'], detailChangeTable(changes.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10), input.metric.unit))];
    };
    return [...make(hospitalIdentity, 'hospital'), ...make(employeeIdentity, 'employee')];
  }
  function buildComparisonAnalysis(input) {
    const current = summarize(input.currentRows, input.metric);
    const yoyBase = summarize(input.lastYearRows, input.metric);
    const momBase = summarize(input.previousRows, input.metric);
    const yoyDelta = current.value - yoyBase.value;
    const momDelta = current.value - momBase.value;
    const yoyRate = percentageChange(current.value, yoyBase.value);
    const momRate = percentageChange(current.value, momBase.value);
    const comparisonFinding = (kind, label, base, delta, rate) => detailFinding(kind, `${label}判断`, base.recordCount ? `本期${formatMetricValue(current.value, input.metric)}，${label}基期${formatMetricValue(base.value, input.metric)}，变化${formatMetricValue(delta, input.metric)}（${rate === null ? '基期为0，无法计算变化率' : signedPercent(rate)}）。` : `${label}基期数据不足，暂不能计算变化率。`, [`本期${current.recordCount}条明细`, `${label}基期${base.recordCount}条明细`], delta < 0 ? 'high' : 'info', base.recordCount ? .98 : .5);
    return detailContract('period-comparison', '同比 / 环比详细分析', input, {
      headline: `同比与环比分开解释：同比用于判断相对上年变化，环比用于判断近期走势。`,
      summaryCards: [{
        label: '本期',
        value: current.value,
        unit: input.metric.unit
      }, {
        label: '同比基期',
        value: yoyBase.recordCount ? yoyBase.value : null,
        unit: input.metric.unit
      }, {
        label: '同比变化率',
        value: yoyRate,
        format: 'percent'
      }, {
        label: '环比基期',
        value: momBase.recordCount ? momBase.value : null,
        unit: input.metric.unit
      }, {
        label: '环比变化率',
        value: momRate,
        format: 'percent'
      }],
      findings: [comparisonFinding('yoy', '同比', yoyBase, yoyDelta, yoyRate), comparisonFinding('mom', '环比', momBase, momDelta, momRate)],
      tables: [...comparisonDimensionTables('yoy', '同比', input.currentRows, input.lastYearRows, input), ...comparisonDimensionTables('mom', '环比', input.currentRows, input.previousRows, input)],
      sections: [{
        sectionId: 'yoy',
        title: '同比',
        data: {
          current: current.value,
          baseline: yoyBase.recordCount ? yoyBase.value : null,
          delta: yoyBase.recordCount ? yoyDelta : null,
          deltaRate: yoyRate
        }
      }, {
        sectionId: 'mom',
        title: '环比',
        data: {
          current: current.value,
          baseline: momBase.recordCount ? momBase.value : null,
          delta: momBase.recordCount ? momDelta : null,
          deltaRate: momRate
        }
      }],
      limitations: [!yoyBase.recordCount ? '缺少上财年同期数据。' : '', !momBase.recordCount ? '缺少上一周期数据。' : ''].filter(Boolean)
    });
  }
  function buildTargetAnalysis(input) {
    const target = input.targetPlan?.selectedTarget ?? null;
    const actual = sum(input.currentRows, 'orderBoxes');
    const gap = target === null ? null : Math.max(0, target - actual);
    const rate = target > 0 ? actual / target : null;
    const execution = input.fourThreeExecution || {
      state: 'empty',
      records: [],
      dimensions: {}
    };
    const targetRows = (rows = []) => rows.map(item => ({
      subject: item.name,
      target: item.targetBoxes,
      actual: item.actualBoxes,
      gap: item.gapBoxes,
      achievementRate: item.achievementRate,
      status: item.status,
      unit: '盒'
    }));
    const reliableActuals = detailGroup(input.currentRows.filter(acceptableCustomerMatch), customerIdentity, {
      key: 'orderBoxes'
    });
    const customerPlans = detailGroup(execution.records || [], row => {
      const name = String(row.customerName || row.customer || '').trim();
      const id = String(row.customerId || '').trim();
      return name || id ? {
        id: id || `${row.employee}|${row.hospitalName || row.hospital}|${row.departmentName || row.department}|${name}`,
        name: name || id
      } : null;
    }, {
      key: 'monthlyTargetBoxes'
    });
    const reliableCustomers = reliableActuals.size > 0;
    const customerRows = [...customerPlans.values()].map(item => ({
      customerId: item.id,
      customer: item.name,
      target: item.rows.reduce((sumValue, row) => sumValue + clampFinite(row.monthlyTargetBoxes ?? row.currentTarget), 0),
      actual: reliableCustomers && reliableActuals.has(item.id) ? reliableActuals.get(item.id).boxes : null,
      status: reliableCustomers ? reliableActuals.has(item.id) ? '已匹配实际' : '未匹配实际' : '仅展示计划目标',
      source: 'EmployeePlanRecord'
    }));
    const forecast = input.deepAnalysis?.targetGap;
    return detailContract('target-achievement', '目标达成详细分析', input, {
      headline: target === null ? '当前筛选周期目标未设置，无法计算缺口或达成率。' : `目标${target.toFixed(1)}盒，实际${actual.toFixed(1)}盒，${gap > 0 ? `缺口${gap.toFixed(1)}盒` : '已达到目标'}。`,
      summaryCards: [{
        label: '目标',
        value: target,
        unit: '盒'
      }, {
        label: '实际',
        value: actual,
        unit: '盒'
      }, {
        label: '缺口',
        value: gap,
        unit: '盒'
      }, {
        label: '达成率',
        value: rate,
        format: 'percent'
      }, {
        label: '按当前速度预计',
        value: forecast?.forecast ?? null,
        unit: '盒'
      }],
      findings: target === null ? [] : [detailFinding('target-gap', '目标与缺口', `完成率${(rate * 100).toFixed(1)}%，剩余目标${gap.toFixed(1)}盒。${forecast?.remainingMonths ? `剩余${forecast.remainingMonths}个月需月均${forecast.requiredMonthly?.toFixed(1) ?? '—'}盒；按当前速度预计${forecast.projectedGap > 0 ? `仍有${forecast.projectedGap.toFixed(1)}盒缺口` : '可达到目标'}。` : ''}`, [`目标${target.toFixed(1)}盒`, `实际${actual.toFixed(1)}盒`], gap > 0 ? 'high' : 'info', .96)],
      tables: [detailTable('target-employees', '员工目标达成', ['员工', '目标', '实际', '缺口', '达成率', '状态'], targetRows(execution.dimensions?.employee)), detailTable('target-hospitals', '医院目标达成', ['医院', '计划目标', '实际', '缺口', '达成率', '状态'], targetRows(execution.dimensions?.hospital)), detailTable('target-customers', '计划客户目标', ['计划客户', '目标', '实际', '状态', '来源'], customerRows)],
      limitations: [target === null ? '目标未设置，不生成虚假达成分析。' : '', customerRows.length && !reliableCustomers ? '客户级实际销售数据不足，仅展示计划目标。' : '', execution.state === 'empty' ? '当前范围无 EmployeePlanRecord，员工、医院和客户目标明细不可用。' : ''].filter(Boolean),
      methodology: '目标、实际、缺口和达成率统一按盒数。趋势推演只描述“按当前速度预计”，不构成完成保证。'
    });
  }
  function declineHospitalRows(input) {
    const reliableCurrent = input.currentRows.filter(acceptableCustomerMatch);
    const reliablePrevious = input.previousRows.filter(acceptableCustomerMatch);
    const customerReliable = reliableCurrent.length > 0 && reliablePrevious.length > 0;
    const changes = detailChanges(input.currentRows, input.previousRows, hospitalIdentity, input.metric);
    const totalLoss = changes.filter(item => item.delta < 0).reduce((total, item) => total + Math.abs(item.delta), 0);
    return {
      customerReliable,
      totalLoss,
      rows: changes.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).map(item => {
        const currentCustomers = customerReliable ? detailGroup(item.currentRows.filter(acceptableCustomerMatch), customerIdentity, {
          key: 'orderBoxes'
        }).size : null;
        const previousCustomers = customerReliable ? detailGroup(item.baselineRows.filter(acceptableCustomerMatch), customerIdentity, {
          key: 'orderBoxes'
        }).size : null;
        return {
          hospitalId: item.id,
          hospital: item.name,
          previous: item.baseline,
          current: item.current,
          delta: item.delta,
          deltaRate: item.deltaRate,
          lossContributionRate: totalLoss ? Math.abs(item.delta) / totalLoss : null,
          previousCustomers,
          currentCustomers,
          customerDelta: customerReliable ? currentCustomers - previousCustomers : null,
          status: item.current === 0 && item.baseline > 0 ? '停止产出' : '掉量'
        };
      })
    };
  }
  function declineReason(item, input, customerReliable) {
    if (item.current === 0 && item.previous > 0) return '医院停止产出型';
    if (customerReliable && item.previousCustomers > 0 && item.currentCustomers < item.previousCustomers) {
      const previousPerCustomer = item.previous / item.previousCustomers;
      const currentPerCustomer = item.currentCustomers ? item.current / item.currentCustomers : 0;
      if (currentPerCustomer >= previousPerCustomer * .8) return '客户数减少型';
      if (item.currentCustomers >= item.previousCustomers * .8) return '单客产出下降型';
    }
    const scopedCurrent = input.currentRows.filter(row => hospitalIdentity(row)?.id === item.hospitalId);
    const scopedPrevious = input.previousRows.filter(row => hospitalIdentity(row)?.id === item.hospitalId);
    const departments = detailChanges(scopedCurrent, scopedPrevious, departmentIdentity, input.metric).filter(entry => entry.delta < 0);
    if (departments.length >= 2 && Math.abs(departments.reduce((total, entry) => total + entry.delta, 0)) >= Math.abs(item.delta) * .7) return '科室整体下降型';
    if (customerReliable) {
      const customers = detailChanges(scopedCurrent.filter(acceptableCustomerMatch), scopedPrevious.filter(acceptableCustomerMatch), customerIdentity, input.metric).filter(entry => entry.delta < 0).sort((a, b) => a.delta - b.delta);
      if (customers[0] && Math.abs(customers[0].delta) >= Math.abs(item.delta) * .5) return '重点客户掉量型';
    }
    return '当前数据不足以确认掉量原因';
  }
  function buildDeclineAnalysis(input) {
    const current = sum(input.currentRows, input.metric.key);
    const previous = sum(input.previousRows, input.metric.key);
    const changes = detailChanges(input.currentRows, input.previousRows, hospitalIdentity, input.metric);
    const totalLoss = changes.filter(item => item.delta < 0).reduce((total, item) => total + Math.abs(item.delta), 0);
    const totalGrowth = changes.filter(item => item.delta > 0).reduce((total, item) => total + item.delta, 0);
    const net = current - previous;
    const hospitalLoss = declineHospitalRows(input);
    const hospitalRows = hospitalLoss.rows.map(item => ({
      ...item,
      reasonCategory: declineReason(item, input, hospitalLoss.customerReliable)
    }));
    const departmentRows = detailChangeTable(detailChanges(input.currentRows, input.previousRows, departmentIdentity, input.metric).filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 20), input.metric.unit);
    const employeeRows = detailChangeTable(detailChanges(input.currentRows, input.previousRows, employeeIdentity, input.metric).filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 20), input.metric.unit);
    const drilldowns = hospitalRows.slice(0, 10).map(hospital => {
      const currentRows = input.currentRows.filter(row => hospitalIdentity(row)?.id === hospital.hospitalId);
      const previousRows = input.previousRows.filter(row => hospitalIdentity(row)?.id === hospital.hospitalId);
      return {
        sectionId: `decline-${hospital.hospitalId}`,
        title: hospital.hospital,
        summary: `${hospital.previous.toFixed(1)}→${hospital.current.toFixed(1)}${input.metric.unit}，变化${hospital.delta.toFixed(1)}${input.metric.unit}`,
        reasonCategory: hospital.reasonCategory,
        tables: [detailTable('department', '科室变化', ['科室', '上期', '本期', '变化', '变化率'], detailChangeTable(detailChanges(currentRows, previousRows, departmentIdentity, input.metric).sort((a, b) => a.delta - b.delta), input.metric.unit)), detailTable('employee', '员工变化', ['员工', '上期', '本期', '变化', '变化率'], detailChangeTable(detailChanges(currentRows, previousRows, employeeIdentity, input.metric).sort((a, b) => a.delta - b.delta), input.metric.unit)), detailTable('customer', '客户变化', ['客户', '上期', '本期', '变化', '变化率'], hospitalLoss.customerReliable ? detailChangeTable(detailChanges(currentRows.filter(acceptableCustomerMatch), previousRows.filter(acceptableCustomerMatch), customerIdentity, input.metric).sort((a, b) => a.delta - b.delta), input.metric.unit) : [])]
      };
    });
    const trend = monthlyDirection(input.fiscalTrend);
    const findings = [];
    if (hospitalRows[0]) findings.push(detailFinding('largest-hospital-loss', '首要掉量医院', `${hospitalRows[0].hospital}减少${formatMetricValue(Math.abs(hospitalRows[0].delta), input.metric)}，占可识别总掉量${formatShare(hospitalRows[0].lossContributionRate)}。`, [`上期${formatMetricValue(hospitalRows[0].previous, input.metric)}`, `本期${formatMetricValue(hospitalRows[0].current, input.metric)}`, `数据分类：${hospitalRows[0].reasonCategory}`], 'high', .96));
    if (totalLoss > 0 && totalGrowth > 0) findings.push(detailFinding('structural-offset', '结构性抵消', `识别到${formatMetricValue(totalLoss, input.metric)}掉量，同时有${formatMetricValue(totalGrowth, input.metric)}增长抵消，净变化${formatMetricValue(net, input.metric)}。`, ['部分医院掉量', '其他医院增长'], 'watch', .9));
    return detailContract('decline-analysis', '掉量分析详细分析', input, {
      headline: previous ? `本期${formatMetricValue(current, input.metric)}，上期${formatMetricValue(previous, input.metric)}；总掉量${formatMetricValue(totalLoss, input.metric)}、总增长${formatMetricValue(totalGrowth, input.metric)}、净变化${formatMetricValue(net, input.metric)}。` : '上一周期数据不足，暂不能完成掉量拆解。',
      summaryCards: [{
        label: '本期',
        value: current,
        unit: input.metric.unit
      }, {
        label: '上期',
        value: input.previousRows.length ? previous : null,
        unit: input.metric.unit
      }, {
        label: '总掉量',
        value: totalLoss,
        unit: input.metric.unit
      }, {
        label: '总增长',
        value: totalGrowth,
        unit: input.metric.unit
      }, {
        label: '净变化',
        value: net,
        unit: input.metric.unit
      }],
      findings,
      tables: [detailTable('decline-hospitals', '医院掉量清单', ['医院', '上期', '本期', '变化', '掉幅', '总掉量贡献率', '上期出单客户', '本期出单客户', '客户变化', '状态', '数据分类'], hospitalRows), detailTable('decline-departments', '科室掉量', ['科室', '上期', '本期', '变化', '变化率'], departmentRows), detailTable('decline-employees', '员工关联变化', ['员工', '上期', '本期', '变化', '变化率'], employeeRows)],
      sections: drilldowns,
      limitations: [!input.previousRows.length ? '上一周期无可比明细。' : '', !hospitalLoss.customerReliable ? '客户级销售数据不足，当前分析到医院/科室层级。' : '', trend.declineRun < 2 ? '当前未观察到至少连续两个月掉量。' : ''].filter(Boolean),
      methodology: '总掉量为所有负向医院变化绝对值之和，总增长为所有正向医院变化之和，净变化=总增长-总掉量。原因分类只使用销售明细中的可验证结构变化，不推断客情、竞争、政策或人员积极性。'
    });
  }
  function entityAnalysisRows(input, identity, dimension) {
    const current = detailGroup(input.currentRows, identity, input.metric);
    const previous = detailGroup(input.previousRows, identity, input.metric);
    const lastYear = detailGroup(input.lastYearRows, identity, input.metric);
    const total = sum(input.currentRows, input.metric.key);
    return [...new Set([...current.keys(), ...previous.keys(), ...lastYear.keys()])].map(id => {
      const a = current.get(id);
      const b = previous.get(id);
      const y = lastYear.get(id);
      const rows = a?.rows || [];
      const baselineRows = b?.rows || [];
      const monthly = monthKeys(input.fiscal.current.from, input.fiscal.current.to).map(period => ({
        period,
        value: sum(sourceRowsByMonth(rows, period), input.metric.key)
      }));
      const departments = detailChanges(rows, baselineRows, departmentIdentity, input.metric).sort((x, z) => Math.abs(z.delta) - Math.abs(x.delta));
      const employees = detailChanges(rows, baselineRows, employeeIdentity, input.metric).sort((x, z) => Math.abs(z.delta) - Math.abs(x.delta));
      const customers = detailChanges(rows.filter(acceptableCustomerMatch), baselineRows.filter(acceptableCustomerMatch), customerIdentity, input.metric).sort((x, z) => Math.abs(z.delta) - Math.abs(x.delta));
      const value = a?.value || 0;
      const prior = b?.value || 0;
      const yoyBase = y?.value || 0;
      return {
        id,
        name: a?.name || b?.name || y?.name || id,
        value,
        share: total ? value / total : 0,
        previous: prior,
        lastYear: yoyBase,
        mom: b ? percentageChange(value, prior) : null,
        yoy: y ? percentageChange(value, yoyBase) : null,
        monthly,
        departments,
        employees,
        customers,
        departmentCount: new Set(rows.map(row => departmentIdentity(row)?.id).filter(Boolean)).size,
        employeeCount: new Set(rows.map(row => employeeIdentity(row)?.id).filter(Boolean)).size,
        customerCount: rows.some(acceptableCustomerMatch) ? new Set(rows.filter(acceptableCustomerMatch).map(row => row.customerId)).size : null,
        status: prior > 0 && value === 0 ? '中断' : value > prior ? '增长' : value < prior ? '下降' : '稳定',
        dimension
      };
    }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN'));
  }
  function buildHospitalAnalysis(input) {
    const hospitals = entityAnalysisRows(input, hospitalIdentity, 'hospital');
    const reliable = input.currentRows.some(acceptableCustomerMatch);
    return detailContract('hospital-analysis', '医院经营详细分析', input, {
      headline: hospitals.length ? `当前共${hospitals.filter(item => item.value > 0).length}家有产出医院；${hospitals.filter(item => item.status === '下降' || item.status === '中断').length}家下降或中断。` : '当前范围暂无医院销售明细。',
      summaryCards: [{
        label: '有产出医院',
        value: hospitals.filter(item => item.value > 0).length,
        unit: '家'
      }, {
        label: '增长',
        value: hospitals.filter(item => item.status === '增长').length,
        unit: '家'
      }, {
        label: '下降/中断',
        value: hospitals.filter(item => ['下降', '中断'].includes(item.status)).length,
        unit: '家'
      }, {
        label: 'Top3集中度',
        value: hospitals.slice(0, 3).reduce((sumValue, item) => sumValue + item.share, 0),
        format: 'percent'
      }],
      findings: hospitals.slice(0, 5).map(item => detailFinding(`hospital-${item.status}`, item.name, `${item.name}本期${formatMetricValue(item.value, input.metric)}，占比${formatShare(item.share)}，环比${item.mom === null ? '缺少基期' : signedPercent(item.mom)}、同比${item.yoy === null ? '缺少基期' : signedPercent(item.yoy)}，状态为${item.status}。`, [`科室${item.departmentCount}个`, `关联员工${item.employeeCount}名`, reliable ? `实际出单客户${item.customerCount ?? 0}位` : '客户级实际销售数据不足'], item.status === '下降' || item.status === '中断' ? 'high' : 'info', .9)),
      tables: [detailTable('hospital-summary', '医院经营清单', ['医院', '本期', '占比', '同比', '环比', '科室数', '员工数', '实际客户数', '状态'], hospitals.map(item => ({
        hospitalId: item.id,
        hospital: item.name,
        current: item.value,
        share: item.share,
        yoy: item.yoy,
        mom: item.mom,
        departments: item.departmentCount,
        employees: item.employeeCount,
        customers: item.customerCount,
        status: item.status
      })))],
      sections: hospitals.slice(0, 10).map(item => ({
        sectionId: `hospital-${item.id}`,
        title: item.name,
        summary: `${item.status}｜本期${formatMetricValue(item.value, input.metric)}`,
        monthly: item.monthly,
        tables: [detailTable('departments', '科室变化', ['科室', '上期', '本期', '变化', '变化率'], detailChangeTable(item.departments, input.metric.unit)), detailTable('employees', '关联员工变化', ['员工', '上期', '本期', '变化', '变化率'], detailChangeTable(item.employees, input.metric.unit)), detailTable('customers', '实际客户变化', ['客户', '上期', '本期', '变化', '变化率'], reliable ? detailChangeTable(item.customers, input.metric.unit) : [])]
      })),
      limitations: reliable ? [] : ['客户级销售数据不足，医院详情只分析到科室和员工层级。']
    });
  }
  function buildEmployeeAnalysis(input) {
    const employees = entityAnalysisRows(input, employeeIdentity, 'employee');
    const execution = input.fourThreeExecution || {
      dimensions: {}
    };
    const reliable = input.currentRows.some(acceptableCustomerMatch);
    const targetMap = new Map((execution.dimensions?.employee || []).map(item => [item.name, item]));
    const fitMap = new Map((input.employeePlanFit?.ranking || []).map(item => [item.employeeName, item]));
    const alertMap = new Map();
    (input.alerts || []).filter(item => item.subjectType === 'employee').forEach(item => {
      const list = alertMap.get(item.subjectName) || [];
      list.push(item);
      alertMap.set(item.subjectName, list);
    });
    const rows = employees.map(item => ({
      ...item,
      target: targetMap.get(item.name)?.targetBoxes ?? null,
      targetActual: targetMap.get(item.name)?.actualBoxes ?? null,
      achievementRate: targetMap.get(item.name)?.achievementRate ?? null,
      fit: fitMap.get(item.name) || null,
      alerts: alertMap.get(item.name) || []
    }));
    return detailContract('employee-analysis', '员工经营详细分析', input, {
      headline: rows.length ? `当前共${rows.filter(item => item.value > 0).length}名员工有销售产出，${rows.filter(item => item.status === '下降' || item.status === '中断').length}名出现下降或中断。` : '当前范围暂无员工销售明细。',
      summaryCards: [{
        label: '有产出员工',
        value: rows.filter(item => item.value > 0).length,
        unit: '人'
      }, {
        label: '下降/中断',
        value: rows.filter(item => ['下降', '中断'].includes(item.status)).length,
        unit: '人'
      }, {
        label: '计划可评分',
        value: input.employeePlanFit?.scoredCount ?? 0,
        unit: '人'
      }, {
        label: '经营预警',
        value: [...alertMap.values()].flat().length,
        unit: '条'
      }],
      findings: rows.slice(0, 8).map(item => detailFinding(`employee-${item.status}`, item.name, `${item.name}本期${formatMetricValue(item.value, input.metric)}，同比${item.yoy === null ? '缺少基期' : signedPercent(item.yoy)}、环比${item.mom === null ? '缺少基期' : signedPercent(item.mom)}；${item.target === null ? '月目标未设置' : `目标达成率${item.achievementRate === null ? '缺少实际' : formatShare(item.achievementRate)}`}。`, [item.fit?.fitScore === null || item.fit?.fitScore === undefined ? '计划拟合数据不足' : `计划拟合${item.fit.fitScore.toFixed(1)}分`, item.departments[0] ? `主要变化科室${item.departments[0].name} ${item.departments[0].delta.toFixed(1)}${input.metric.unit}` : '', item.alerts[0] ? `经营预警：${item.alerts[0].title}` : ''], item.status === '下降' || item.alerts.length ? 'high' : 'info', .88)),
      tables: [detailTable('employee-summary', '员工经营清单', ['员工', '本期', '占比', '同比', '环比', '目标', '达成率', '计划拟合', '预警', '状态'], rows.map(item => ({
        employeeId: item.id,
        employee: item.name,
        current: item.value,
        share: item.share,
        yoy: item.yoy,
        mom: item.mom,
        target: item.target,
        achievementRate: item.achievementRate,
        fitScore: item.fit?.fitScore ?? null,
        alerts: item.alerts.length,
        status: item.status
      })))],
      sections: rows.slice(0, 10).map(item => ({
        sectionId: `employee-${item.id}`,
        title: item.name,
        summary: `${item.status}｜本期${formatMetricValue(item.value, input.metric)}`,
        monthly: item.monthly,
        planFit: item.fit,
        alerts: item.alerts,
        tables: [detailTable('hospitals', '负责医院变化', ['医院', '上期', '本期', '变化', '变化率'], detailChangeTable(detailChanges(input.currentRows.filter(row => employeeIdentity(row)?.id === item.id), input.previousRows.filter(row => employeeIdentity(row)?.id === item.id), hospitalIdentity, input.metric).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)), input.metric.unit)), detailTable('customers', '实际客户变化', ['客户', '上期', '本期', '变化', '变化率'], reliable ? detailChangeTable(item.customers, input.metric.unit) : [])]
      })),
      limitations: reliable ? [] : ['客户级销售数据不足，员工详情不计算实际出单客户数或ABCD变化。']
    });
  }
  function buildDepartmentAnalysis(input) {
    const rows = entityAnalysisRows(input, departmentIdentity, 'department').map(item => {
      const sample = input.currentRows.find(row => departmentIdentity(row)?.id === item.id) || input.previousRows.find(row => departmentIdentity(row)?.id === item.id);
      return {
        ...item,
        hospital: String(sample?.hospital || sample?.hospitalName || '').trim()
      };
    });
    const reliable = input.currentRows.some(acceptableCustomerMatch);
    return detailContract('department-analysis', '科室经营详细分析', input, {
      headline: rows.length ? `按医院与科室唯一键拆分后共有${rows.length}个科室单元，避免同名科室跨医院合并。` : '当前范围暂无科室销售明细。',
      summaryCards: [{
        label: '科室单元',
        value: rows.length,
        unit: '个'
      }, {
        label: '增长',
        value: rows.filter(item => item.status === '增长').length,
        unit: '个'
      }, {
        label: '下降/中断',
        value: rows.filter(item => ['下降', '中断'].includes(item.status)).length,
        unit: '个'
      }],
      findings: rows.slice(0, 8).map(item => detailFinding(`department-${item.status}`, `${item.hospital}｜${item.name}`, `本期${formatMetricValue(item.value, input.metric)}，占比${formatShare(item.share)}，同比${item.yoy === null ? '缺少基期' : signedPercent(item.yoy)}、环比${item.mom === null ? '缺少基期' : signedPercent(item.mom)}。`, [`关联员工${item.employeeCount}名`, reliable ? `实际客户${item.customerCount ?? 0}位` : '客户级实际销售数据不足'], item.status === '下降' || item.status === '中断' ? 'high' : 'info', .9)),
      tables: [detailTable('department-summary', '科室清单', ['医院', '科室', '本期', '占比', '同比', '环比', '员工数', '实际客户数', '状态'], rows.map(item => ({
        departmentId: item.id,
        hospital: item.hospital,
        department: item.name,
        current: item.value,
        share: item.share,
        yoy: item.yoy,
        mom: item.mom,
        employees: item.employeeCount,
        customers: item.customerCount,
        status: item.status
      })))],
      sections: rows.slice(0, 10).map(item => ({
        sectionId: `department-${item.id}`,
        title: `${item.hospital}｜${item.name}`,
        monthly: item.monthly,
        tables: [detailTable('employees', '员工变化', ['员工', '上期', '本期', '变化', '变化率'], detailChangeTable(item.employees, input.metric.unit)), detailTable('customers', '客户变化', ['客户', '上期', '本期', '变化', '变化率'], reliable ? detailChangeTable(item.customers, input.metric.unit) : [])]
      })),
      limitations: reliable ? [] : ['客户级销售数据不足，科室详情只分析到员工层级。']
    });
  }
  function reliableCustomerSnapshots(input) {
    const fromRows = rows => {
      const grouped = detailGroup(rows.filter(acceptableCustomerMatch), customerIdentity, {
        key: 'orderBoxes'
      });
      const result = new Map();
      grouped.forEach((item, id) => result.set(id, {
        id,
        name: item.name,
        boxes: item.boxes,
        value: item.value,
        grade: customerLevel(item.boxes),
        rows: item.rows
      }));
      return result;
    };
    if (input.customerAnalytics?.customers?.source === 'customer-upgrade-workbook') return {
      reliable: true,
      current: input.customerAnalytics.customers.customers || new Map(),
      previous: input.customerAnalytics.customers.previousCustomers || new Map(),
      source: 'customer-upgrade-workbook'
    };
    const current = fromRows(input.currentRows);
    const previous = fromRows(input.previousRows);
    return {
      reliable: current.size > 0,
      current,
      previous,
      source: 'SalesRecord.customerId'
    };
  }
  function buildCustomerStructureAnalysis(input) {
    const snapshots = reliableCustomerSnapshots(input);
    const levels = ['A', 'B', 'C', 'D'];
    if (!snapshots.reliable) return detailContract('customer-structure', 'ABCD 客户结构详细分析', input, {
      headline: '客户级销售数据不足，当前不能可靠计算ABCD人数及等级变化。',
      limitations: ['缺少可靠 customerId；不会使用4+3计划客户数代替真实出单客户数。'],
      methodology: 'ABCD按实际出单盒数计算：D<10、C=10–19、B=20–30、A≥31；R1–R4保持独立。'
    });
    const summary = levels.map(level => ({
      level,
      current: [...snapshots.current.values()].filter(item => (item.currentGrade || item.grade) === level).length,
      previous: [...snapshots.previous.values()].filter(item => (item.currentGrade || item.grade) === level).length
    }));
    summary.forEach(item => {
      item.delta = item.current - item.previous;
      item.share = snapshots.current.size ? item.current / snapshots.current.size : 0;
    });
    const order = {
      D: 0,
      C: 1,
      B: 2,
      A: 3
    };
    const transitions = [];
    snapshots.current.forEach((item, id) => {
      const prior = snapshots.previous.get(id);
      if (!prior) return;
      const currentGrade = item.currentGrade || item.grade || customerLevel(item.currentBoxes ?? item.boxes);
      const previousGrade = prior.currentGrade || prior.grade || customerLevel(prior.currentBoxes ?? prior.boxes);
      const currentBoxes = item.currentBoxes ?? item.boxes;
      const previousBoxes = prior.currentBoxes ?? prior.boxes;
      const direction = order[currentGrade] > order[previousGrade] ? '升级' : order[currentGrade] < order[previousGrade] ? '降级' : '保持';
      transitions.push({
        customerId: id,
        customer: item.customer || item.name || id,
        previousGrade,
        currentGrade,
        previousBoxes,
        currentBoxes,
        delta: currentBoxes - previousBoxes,
        direction
      });
    });
    const nearUpgrade = [...snapshots.current.values()].map(item => ({
      ...item,
      ...customerGradeProgress(item.currentBoxes ?? item.boxes)
    })).filter(item => item.nextGrade).sort((a, b) => a.upgradeGap - b.upgradeGap).slice(0, 20);
    return detailContract('customer-structure', 'ABCD 客户结构详细分析', input, {
      headline: `本期可靠识别${snapshots.current.size}位实际出单客户；升级${transitions.filter(item => item.direction === '升级').length}位、降级${transitions.filter(item => item.direction === '降级').length}位、保持${transitions.filter(item => item.direction === '保持').length}位。`,
      summaryCards: summary.map(item => ({
        label: `${item.level}级客户`,
        value: item.current,
        unit: '位',
        delta: item.delta,
        share: item.share
      })),
      findings: summary.map(item => detailFinding(`customer-level-${item.level}`, `${item.level}级客户`, `本期${item.current}位，占${formatShare(item.share)}，较上期${item.delta >= 0 ? '增加' : '减少'}${Math.abs(item.delta)}位。`, [`上期${item.previous}位`, `本期${item.current}位`], item.level === 'D' && item.share >= .5 ? 'high' : 'info', .95)),
      tables: [detailTable('customer-level-change', '等级人数变化', ['等级', '上期人数', '本期人数', '变化', '占比'], summary), detailTable('customer-upgraded', '升级客户', ['客户', '前等级', '当前等级', '前期盒数', '本期盒数', '销量变化'], transitions.filter(item => item.direction === '升级')), detailTable('customer-downgraded', '降级客户', ['客户', '前等级', '当前等级', '前期盒数', '本期盒数', '销量变化'], transitions.filter(item => item.direction === '降级')), detailTable('customer-near-upgrade', '接近升级客户', ['客户', '当前盒数', '下一等级', '升级缺口'], nearUpgrade.map(item => ({
        customerId: item.customerId || item.id,
        customer: item.customer || item.name || item.id,
        currentBoxes: item.currentBoxes,
        nextGrade: item.nextGrade,
        upgradeGap: item.upgradeGap
      })))],
      limitations: snapshots.previous.size ? [] : ['历史客户数据不足，无法判断升级、降级和保持。'],
      methodology: `数据来源：${snapshots.source}。ABCD按实际出单盒数计算：D<10、C=10–19、B=20–30、A≥31；R1–R4不参与销量等级判断。`
    });
  }
  function buildCustomerUpgradeAnalysis(input) {
    const snapshots = reliableCustomerSnapshots(input);
    const opportunities = input.upgrades?.topOpportunities || [];
    const reliable = snapshots.reliable && (input.upgrades?.source === 'customer-upgrade-workbook' || opportunities.every(item => item.customerId));
    const rows = opportunities.map(item => ({
      customerId: item.customerId,
      customer: item.customer,
      currentGrade: item.currentGrade,
      currentBoxes: reliable ? item.currentBoxes : null,
      nextGrade: item.nextGrade,
      threshold: item.nextGradeThreshold,
      gap: reliable ? item.upgradeGap : null,
      trend: snapshots.previous.has(item.customerId) ? item.currentBoxes - (snapshots.previous.get(item.customerId).currentBoxes ?? snapshots.previous.get(item.customerId).boxes) : null,
      targetBoxes: item.nextMonthTarget,
      targetSource: item.nextMonthTarget === null ? null : '计划目标',
      employee: item.employee,
      hospital: item.hospital,
      department: item.department,
      planStatus: item.status,
      actualState: reliable ? '实际销量已匹配' : '实际销量不足'
    }));
    return detailContract('customer-upgrade', '客户升级详细分析', input, {
      headline: reliable ? `当前识别${rows.length}位升级机会客户，按距下一等级缺口从小到大排列。` : '客户实际销量无法可靠匹配，当前仅展示可识别的计划信息。',
      summaryCards: [{
        label: '升级机会',
        value: reliable ? rows.length : null,
        unit: '位'
      }, {
        label: '≤3盒',
        value: reliable ? rows.filter(item => item.gap <= 3).length : null,
        unit: '位'
      }, {
        label: '≤5盒',
        value: reliable ? rows.filter(item => item.gap <= 5).length : null,
        unit: '位'
      }, {
        label: '有计划目标',
        value: rows.filter(item => item.targetBoxes !== null).length,
        unit: '位'
      }],
      findings: reliable && rows[0] ? [detailFinding('closest-upgrade', '最接近升级', `${rows[0].customer}当前${rows[0].currentGrade}级${rows[0].currentBoxes}盒，距${rows[0].nextGrade}级还差${rows[0].gap}盒。`, [`负责人${rows[0].employee || '未填写'}`, `医院${rows[0].hospital || '未填写'}`, `计划状态${rows[0].planStatus}`], 'info', .96)] : [],
      tables: [detailTable('customer-upgrade-opportunities', '客户升级机会', ['客户', '当前等级', '当前销量', '下一等级', '阈值', '缺口', '近期变化', '目标盒数', '目标来源', '负责人', '医院', '科室', '计划状态', '实际状态'], rows)],
      limitations: reliable ? [] : ['实际销量不足，不展示实际盒数、升级缺口或趋势，不伪造客户级结果。'],
      methodology: '升级缺口=下一等级阈值-当前可靠实际盒数；4+3中的目标仅标记为计划目标，不替代实际销量。'
    });
  }
  function buildOrderAnalysis(input) {
    const order = input.orderDepth || orderDepthStructure(input.currentRows, input.metric);
    const buckets = order.buckets || order.groups || [];
    const highHospitals = [...order.hospital].sort((a, b) => b.average - a.average).slice(0, 10);
    const highEmployees = [...order.employee].sort((a, b) => b.average - a.average).slice(0, 10);
    return detailContract('order-size', '单笔订单详细分析', input, {
      headline: order.count ? `共${order.count}笔订单，平均${order.average.toFixed(1)}盒，中位数${order.median.toFixed(1)}盒${order.largeOrderSkew ? '；大单对均值影响明显' : '。'}` : '当前范围暂无有效订单。',
      summaryCards: [{
        label: '平均数',
        value: order.average,
        unit: '盒'
      }, {
        label: '中位数',
        value: order.median,
        unit: '盒'
      }, {
        label: 'P25',
        value: order.p25,
        unit: '盒'
      }, {
        label: 'P75',
        value: order.p75,
        unit: '盒'
      }, {
        label: '最大订单',
        value: order.maximum,
        unit: '盒'
      }, {
        label: '最小订单',
        value: order.minimum,
        unit: '盒'
      }, {
        label: '订单数',
        value: order.count,
        unit: '笔'
      }],
      findings: order.count ? [detailFinding('order-distribution', '订单分布', order.largeOrderSkew ? `平均数${order.average.toFixed(1)}盒明显高于中位数${order.median.toFixed(1)}盒，大单对均值影响明显。` : `平均数${order.average.toFixed(1)}盒与中位数${order.median.toFixed(1)}盒接近，均值受极端大单影响有限。`, buckets.map(item => `${item.label}${item.count}笔（${formatShare(item.share)}）`), 'info', .98)] : [],
      tables: [detailTable('order-distribution', '订单盒数分布', ['区间', '订单数', '占比', '销售值'], buckets), detailTable('order-hospitals', '医院平均单笔盒数', ['医院', '订单数', '总盒数', '平均单笔'], highHospitals.map(item => ({
        hospital: item.name,
        orders: item.recordCount,
        boxes: item.orderBoxes,
        average: item.average
      }))), detailTable('order-employees', '员工平均单笔盒数', ['员工', '订单数', '总盒数', '平均单笔'], highEmployees.map(item => ({
        employee: item.name,
        orders: item.recordCount,
        boxes: item.orderBoxes,
        average: item.average
      })))],
      methodology: '仅统计订单盒数大于0的销售明细；平均数、中位数和四分位数用于描述分布，不据此认定异常行为。'
    });
  }
  function buildExecutionAnalysis(input) {
    const execution = input.fourThreeExecution || {
      state: 'empty',
      totals: {},
      dimensions: {},
      resources: [],
      reasons: []
    };
    const totals = execution.totals || {};
    const rows = (items = []) => items.map(item => ({
      subject: item.name,
      target: item.targetBoxes,
      actual: item.actualBoxes,
      gap: item.gapBoxes,
      achievementRate: item.achievementRate,
      status: item.status
    }));
    return detailContract('execution-analysis', '四定表执行详细分析', input, {
      headline: execution.state === 'empty' ? '当前筛选范围暂无真实4+3 EmployeePlanRecord。' : `目标${clampFinite(totals.targetBoxes).toFixed(1)}盒，实际${clampFinite(totals.actualBoxes).toFixed(1)}盒，达成率${totals.achievementRate === null ? '未设置' : formatShare(totals.achievementRate)}。`,
      summaryCards: [{
        label: '目标',
        value: totals.targetBoxes ?? null,
        unit: '盒'
      }, {
        label: '实际',
        value: totals.actualBoxes ?? null,
        unit: '盒'
      }, {
        label: '达成率',
        value: totals.achievementRate ?? null,
        format: 'percent'
      }, {
        label: '未达成',
        value: totals.notAchieved ?? null,
        unit: '项'
      }, {
        label: '数据缺失',
        value: totals.missing ?? null,
        unit: '项'
      }],
      findings: (execution.reasons || []).slice(0, 5).map(item => detailFinding('execution-reason', item.label, `${item.records}项未达标记录提及${item.label}，关联缺口${clampFinite(item.boxGap).toFixed(1)}盒。`, (item.rawTexts || []).slice(0, 3), 'watch', .85)),
      tables: [detailTable('execution-employees', '员工执行', ['员工', '目标', '实际', '缺口', '达成率', '状态'], rows(execution.dimensions?.employee)), detailTable('execution-hospitals', '医院执行', ['医院', '目标', '实际', '缺口', '达成率', '状态'], rows(execution.dimensions?.hospital)), detailTable('execution-departments', '科室执行', ['科室', '目标', '实际', '缺口', '达成率', '状态'], rows(execution.dimensions?.department)), detailTable('execution-customers', '客户计划执行', ['客户', '目标', '实际', '缺口', '达成率', '状态'], rows(execution.dimensions?.customer)), detailTable('execution-resources', '资源计划', ['类型', '记录数', '员工数', '医院数', '科室数', '客户数'], execution.resources || []), detailTable('execution-reasons', '未达标原因', ['原因', '记录数', '缺口'], execution.reasons || [])],
      limitations: execution.state === 'empty' ? ['当前无 EmployeePlanRecord，不接回销售通用分析。'] : [],
      methodology: '四定详情仅使用真实4+3 EmployeePlanRecord，目标、实际、缺口和达成率按盒数计算。原因文本仅来自员工真实填写。'
    });
  }
  function buildAlertAnalysis(input) {
    const alerts = input.alerts || [];
    const severity = level => alerts.filter(item => item.severity === level || item.level === level).length;
    return detailContract('alert-analysis', '经营异常详细分析', input, {
      headline: alerts.length ? `当前筛选范围识别${alerts.length}条有业务证据的经营异常。` : '当前筛选范围未识别到有充分业务证据的经营异常。',
      summaryCards: [{
        label: '异常总数',
        value: alerts.length,
        unit: '条'
      }, {
        label: '严重',
        value: severity('CRITICAL') + severity('critical'),
        unit: '条'
      }, {
        label: '高风险',
        value: severity('HIGH') + severity('high'),
        unit: '条'
      }, {
        label: '需观察',
        value: severity('MEDIUM') + severity('watch'),
        unit: '条'
      }],
      findings: alerts.map(item => detailFinding(item.alertType, item.title, item.detail || item.title, item.evidence || [], String(item.severity || item.level || 'watch').toLowerCase(), item.confidence === 'HIGH' ? .95 : item.confidence === 'MEDIUM' ? .75 : .6)),
      tables: [detailTable('alert-list', '异常清单', ['类型', '对象', '问题', '严重度', '置信度', '数据来源'], alerts.map(item => ({
        alertId: item.alertId,
        alertType: item.alertType,
        subject: item.subjectName,
        title: item.title,
        severity: item.severity,
        confidence: item.confidence,
        sources: item.sourceTypes
      })))],
      limitations: input.alertMeta?.customerSales === 'insufficient' ? [input.alertMeta.customerMessage] : [],
      methodology: '异常预警只消费 AlertFinding；任务进度、截止日期和完成状态不参与经营异常判定。点击具体异常继续使用对应 alertType 的专属证据详情。'
    });
  }
  function buildDashboardAnalyses(input) {
    const deepAnalysis = input.deepAnalysis || {};
    const enriched = {
      ...input,
      deepAnalysis,
      orderDepth: deepAnalysis.orderDepthDiagnosis || orderDepthStructure(input.currentRows, input.metric)
    };
    return {
      'fiscal-trend': buildFiscalTrendAnalysis(enriched),
      'period-comparison': buildComparisonAnalysis(enriched),
      'target-achievement': buildTargetAnalysis(enriched),
      'decline-analysis': buildDeclineAnalysis(enriched),
      'hospital-analysis': buildHospitalAnalysis(enriched),
      'employee-analysis': buildEmployeeAnalysis(enriched),
      'department-analysis': buildDepartmentAnalysis(enriched),
      'customer-structure': buildCustomerStructureAnalysis(enriched),
      'customer-upgrade': buildCustomerUpgradeAnalysis(enriched),
      'order-size': buildOrderAnalysis(enriched),
      'execution-analysis': buildExecutionAnalysis(enriched),
      'alert-analysis': buildAlertAnalysis(enriched)
    };
  }
  function chartContract(id, chartType, title, selection, filters, metric, series, summary, detailed, subtitle = '') {
    const dataQuality = validateChartData(chartType, series, {
      targetMissing: /target/.test(id) && !series?.some?.(item => item?.target)
    });
    return {
      chartId: id,
      chartType,
      title,
      subtitle,
      fiscalYear: selection.fiscalYear,
      fiscalQuarter: selection.fiscalQuarter,
      month: selection.month,
      cutoffDate: selection.cutoffDate,
      product: stableProductId(filters.product),
      office: filters.office || 'all',
      filters: {
        ...filters,
        product: stableProductId(filters.product)
      },
      period: selection.current,
      metric: metric.key,
      unit: metric.unit,
      series,
      summary,
      conclusion: summary,
      detailedAnalysis: Array.isArray(detailed) ? detailed : [detailed || summary],
      analysisType: ANALYSIS_TYPE_BY_CHART[id] || null,
      dataQuality
    };
  }
  function buildSalesDashboardV2(records = [], tasks = [], options = {}) {
    records = Products.reportingSalesRecords(records);
    const validRecords = records.filter(record => parseDate(record.date));
    const latestDate = validRecords.map(record => record.date.slice(0, 10)).sort().pop() || dateKey(new Date());
    const fiscal = fiscalSelection({
      ...(options.filters || {}),
      ...options
    }, options.cutoffDate || options.to || dateKey(new Date()));
    const selected = fiscal.current;
    const comparisons = {
      previous: fiscal.previous,
      lastYear: fiscal.lastYear
    };
    const filtered = applyDashboardFilters(validRecords, options.filters);
    const currentRows = rowsInRange(filtered, selected);
    const previousRows = rowsInRange(filtered, comparisons.previous);
    const lastYearRows = rowsInRange(filtered, comparisons.lastYear);
    const productScopedRecords = applyDashboardFilters(validRecords, {
      product: options.filters?.product || options.product
    });
    const metric = metricDefinition(productScopedRecords);
    const current = summarize(currentRows, metric);
    const previous = summarize(previousRows, metric);
    const lastYear = summarize(lastYearRows, metric);
    const employeePlanFit = buildEmployeePlanFitAnalysis(validRecords, tasks, {
      filters: {
        ...(options.filters || {}),
        product: options.filters?.product || options.product
      },
      selection: fiscal
    });
    const products = dimensionRows(currentRows, 'product', metric);
    const departments = dimensionRows(currentRows, 'department', metric);
    const hospitals = dimensionRankings(currentRows, previousRows, 'hospital', metric);
    const employees = dimensionRankings(currentRows, previousRows, 'employee', metric);
    const customerPlans = customerPlanAnalytics(tasks, fiscal, options.filters?.product || options.product, metric, options.filters || options);
    const customers = customerPlans?.customers || customerLevelStructure(currentRows, metric);
    const upgrades = customerPlans?.upgrades || customerUpgradeStructure(currentRows, previousRows, metric);
    const waterfall = waterfallStructure(currentRows, previousRows, metric);
    const monthly = periodSeries(filtered, selected, 'month', metric);
    const quarterly = periodSeries(filtered, selected, 'quarter', metric);
    const fiscalTrend = fiscalMonthSeries(filtered, fiscal, metric);
    const comparisonTrend = comparisonMonthSeries(filtered, fiscal, metric);
    const activeHospitals = new Set(currentRows.map(record => record.hospital).filter(Boolean)).size;
    const customerCount = customers.total;
    const employeeCount = new Set(currentRows.map(record => record.employee).filter(Boolean)).size;
    const avgOrder = current.recordCount ? current.orderBoxes / current.recordCount : 0;
    const targetMetric = BOX_TARGET_METRIC;
    const employeePlanTarget = buildEmployeePlanTargetPlan(options.employeePlanRecords || [], fiscal, options.filters || options);
    const storedTarget = options.targetPlan || (options.targetValue ? {
      value: options.targetValue,
      metricKey: targetMetric.key
    } : {});
    const mergedMonthlyTargets = {
      ...(storedTarget.monthlyTargets || {})
    };
    employeePlanTarget.employeePlanMonths.forEach(period => {
      mergedMonthlyTargets[period] = employeePlanTarget.monthlyTargets[period];
    });
    const targetPlan = normalizeTargetPlan({
      ...storedTarget,
      product: stableProductId(options.filters?.product || options.product),
      metricKey: targetMetric.key,
      monthlyTargets: mergedMonthlyTargets,
      strictSelectedMonths: Object.values(mergedMonthlyTargets).some(value => finiteOrNull(value) !== null),
      source: employeePlanTarget.employeePlanMonths.length ? 'employee-plan-record' : storedTarget.source
    }, fiscal, targetMetric);
    targetPlan.employeePlanMonths = employeePlanTarget.employeePlanMonths;
    const targetValue = targetPlan.selectedTarget;
    const annualTarget = targetPlan.annualTarget;
    const targetActual = current.orderBoxes;
    const targetRate = targetValue ? targetActual / targetValue : null;
    const filterOptions = key => [...new Set(validRecords.map(record => String(record[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const fiscalContext = createPeriodContext(selected.to);
    const quarterTargets = options.quarterTargets || {};
    const quarters = [1, 2, 3, 4].map(quarter => {
      const starts = {
        1: [fiscal.fiscalYear - 1, 9],
        2: [fiscal.fiscalYear, 0],
        3: [fiscal.fiscalYear, 3],
        4: [fiscal.fiscalYear, 6]
      };
      const [year, month] = starts[quarter];
      const targetRange = range(new Date(year, month, 1, 12), new Date(year, month + 3, 0, 12), `Q${quarter}`);
      const targetMonths = monthKeys(targetRange.from, targetRange.to).map(key => targetPlan.monthlyTargets[key]);
      const monthlyTarget = targetMonths.length && targetMonths.every(value => value !== null) ? targetMonths.reduce((a, b) => a + b, 0) : null;
      return {
        quarter: `Q${quarter}`,
        actual: sum(rowsInRange(filtered, targetRange), targetMetric.key),
        target: monthlyTarget ?? (clampFinite(quarterTargets[`Q${quarter}`], 0) || null)
      };
    });
    const yoy = percentageChange(current.value, lastYear.value);
    const mom = percentageChange(current.value, previous.value);
    const selectedProduct = String(options.filters?.product || options.product || '').trim();
    const fourThreeExecution = buildFourThreeExecutionDetail(options.employeePlanRecords || [], fiscal, options.filters || options);
    const taskMatchesContext = task => {
      const same = (field, filter) => !filter || filter === 'all' || String(field || '').trim() === String(filter).trim();
      const sameIdOrName = (idKey, nameKey) => {
        const filterId = String(options.filters?.[idKey] || '').trim();
        const taskId = String(task[idKey] || '').trim();
        if (filterId && taskId) return taskId === filterId;
        if (filterId) {
          const filterName = String(options.filters?.[nameKey] || '').trim();
          const taskName = String(task[nameKey] || task[`${nameKey}Name`] || '').trim();
          if (!filterName || taskName !== filterName) return false;
          const idsForExactName = new Set(tasks.filter(candidate => String(candidate[nameKey] || candidate[`${nameKey}Name`] || '').trim() === filterName).map(candidate => String(candidate[idKey] || '').trim()).filter(Boolean));
          return idsForExactName.size === 0 || idsForExactName.size === 1 && idsForExactName.has(filterId);
        }
        return same(task[nameKey] || task[`${nameKey}Name`], options.filters?.[nameKey]);
      };
      const customerId = String(options.filters?.customerId || '').trim();
      const taskCustomerId = String(task.customerId || '').trim();
      return (!selectedProduct || selectedProduct === 'all' || String(task.product || '').trim() === selectedProduct) && same(task.office, options.filters?.office) && sameIdOrName('hospitalId', 'hospital') && sameIdOrName('departmentId', 'department') && sameIdOrName('employeeId', 'employee') && (!customerId || taskCustomerId === customerId) && (!task.due || task.due >= selected.from && task.due <= selected.to);
    };
    const scopedTasks = tasks.filter(taskMatchesContext);
    const alertResult = dashboardAlerts({
      rawRows: records,
      filteredRows: filtered,
      currentRows,
      previousRows,
      fiscal,
      filters: options.filters || options,
      employeePlanRecords: options.employeePlanRecords || [],
      fourThreeExecution,
      thresholds: options.alertThresholds || {}
    });
    const alerts = alertResult.findings;
    const execution = executionProgress(scopedTasks);
    const attention = scopedTasks.filter(task => clampFinite(task.progress) < 100).length;
    const productLabel = selectedProduct && selectedProduct !== 'all' ? selectedProduct : '当前产品';
    const topHospitalGrowth = hospitals.growth.find(item => item.change > 0);
    const topHospitalDecline = hospitals.decline.find(item => item.change < 0);
    const insights = [currentRows.length ? `${productLabel}${selected.label}${metric.label}${current.value.toFixed(1)}${metric.unit}。` : `${productLabel}${selected.label}暂无销售明细。`, targetValue ? `${productLabel}当前筛选周期盒数目标达成率${(targetRate * 100).toFixed(1)}%，目标${targetValue.toFixed(1)}盒。` : annualTarget ? `${productLabel}已设置财年盒数目标，但当前周期缺少完整月目标。` : `${productLabel}当前财年盒数目标未设置。`, `${productLabel}同比${signedPercent(yoy)}，环比${signedPercent(mom)}。`, topHospitalGrowth ? `${topHospitalGrowth.name}为最大增长来源，增加${topHospitalGrowth.change.toFixed(1)}${metric.unit}。` : `${productLabel}当前没有明确增长来源。`, topHospitalDecline ? `${topHospitalDecline.name}为最大掉量来源，减少${Math.abs(topHospitalDecline.change).toFixed(1)}${metric.unit}。` : `${productLabel}当前没有明确掉量来源。`, alerts[0] ? `主要风险：${alerts[0].title}。` : `${productLabel}当前未发现明显风险。`, `员工计划可信度：${employeePlanFit.summary}`];
    const pptFilters = {
      ...(options.filters || {}),
      fiscalYear: fiscal.fiscalYear,
      fiscalQuarter: fiscal.fiscalQuarter,
      month: fiscal.month,
      cutoffDate: fiscal.cutoffDate,
      from: selected.from,
      to: selected.to
    };
    const methodology = `${metric.methodology} 财年为 10 月 1 日至次年 9 月 30 日；当前范围为 ${selected.from} 至 ${selected.to}；同比固定使用上一财年对应月份/财季，环比使用等长上一周期。`;
    const fiscalTotal = fiscalTrend.reduce((total, item) => total + item.total, 0);
    const fiscalTargetActual = fiscalTrend.reduce((total, item) => total + clampFinite(item.orderBoxes), 0);
    const officeOneTotal = fiscalTrend.reduce((total, item) => total + item.officeOne, 0);
    const officeTwoTotal = fiscalTrend.reduce((total, item) => total + item.officeTwo, 0);
    const actualFiscalMonths = fiscalTrend.filter(item => !item.future && item.hasData);
    const peak = actualFiscalMonths.reduce((best, item) => !best || item.total > best.total ? item : best, null);
    const low = actualFiscalMonths.reduce((best, item) => !best || item.total < best.total ? item : best, null);
    const trendDirection = monthlyDirection(fiscalTrend);
    const priorFiscalTotal = fiscalTrend.reduce((total, item) => total + clampFinite(item.priorTotal), 0);
    const fiscalSummary = fiscalTotal ? `${productLabel} FY${fiscal.fiscalYear} 截至 ${selected.to} 累计${metric.label} ${formatMetricValue(fiscalTotal, metric)}；Synthetic Office A ${formatMetricValue(officeOneTotal, metric)}，Synthetic Office B ${formatMetricValue(officeTwoTotal, metric)}。` : `${productLabel} FY${fiscal.fiscalYear} 截至 ${selected.to} 暂无${metric.label}数据。`;
    const fiscalTrendDetail = fiscalTotal ? [`事实：FY${fiscal.fiscalYear} 截至 ${selected.to} 累计${metric.label} ${formatMetricValue(fiscalTotal, metric)}，上财年同期 ${priorFiscalTotal ? formatMetricValue(priorFiscalTotal, metric) : '缺少可比数据'}。`, `变化：${peak ? `${Number(peak.period.slice(5))} 月为阶段高点 ${formatMetricValue(peak.total, metric)}` : '暂无峰值'}；${low ? `${Number(low.period.slice(5))} 月为阶段低点 ${formatMetricValue(low.total, metric)}` : '暂无低点'}${trendDirection.declineRun >= 2 ? `，最长连续下降 ${trendDirection.declineRun} 个月` : ''}。`, `结构：Synthetic Office A贡献 ${formatShare(fiscalTotal ? officeOneTotal / fiscalTotal : 0)}，Synthetic Office B贡献 ${formatShare(fiscalTotal ? officeTwoTotal / fiscalTotal : 0)}。`, `判断：近期走势${trendDirection.recentDirection === 'weakening' ? '转弱，需优先定位下滑办事处及其重点医院' : trendDirection.recentDirection === 'improving' ? '改善，应验证增长来源能否延续' : '基本平稳，需继续观察下一月变化'}。`] : [fiscalSummary];
    const comparableMonths = comparisonTrend.filter(item => !item.future && item.current !== null);
    const bestYoy = comparableMonths.filter(item => item.yoy !== null).sort((a, b) => b.yoy - a.yoy)[0];
    const worstYoy = comparableMonths.filter(item => item.yoy !== null).sort((a, b) => a.yoy - b.yoy)[0];
    const latestComparison = comparableMonths.at(-1);
    const lowBase = bestYoy && bestYoy.prior !== null && bestYoy.prior < Math.max(1, bestYoy.current * .2) && bestYoy.yoy > .5;
    const comparisonSummary = current.value ? `${productLabel} ${selected.label} 共 ${formatMetricValue(current.value, metric)}，同比${signedPercent(yoy)}，环比${signedPercent(mom)}。` : `${productLabel} ${selected.label} 暂无可用于同比/环比分析的数据。`;
    const comparisonDetail = current.value ? [`事实：${selected.label} 当前实际 ${formatMetricValue(current.value, metric)}，上一财年同期 ${lastYear.value ? formatMetricValue(lastYear.value, metric) : '缺少可比数据'}。`, `同比：${bestYoy ? `${Number(bestYoy.period.slice(5))} 月表现最好（${signedPercent(bestYoy.yoy)}）` : '缺少有效同比基期'}${worstYoy ? `；${Number(worstYoy.period.slice(5))} 月表现最弱（${signedPercent(worstYoy.yoy)}）` : ''}。`, `环比：${latestComparison?.mom === null || latestComparison?.mom === undefined ? '最新月份缺少环比基期' : `${Number(latestComparison.period.slice(5))} 月${signedPercent(latestComparison.mom)}`}，用于判断当前走势${latestComparison?.mom < 0 ? '仍在恶化' : '有所改善'}。`, lowBase ? `判断：${Number(bestYoy.period.slice(5))} 月同比增幅较高但基期较低，应同时参考绝对增量。` : `判断：同比用于判断相对上年进步，环比用于判断近期改善或恶化，两者需结合绝对量。`] : [comparisonSummary];
    const orderBuckets = [[0, 10], [10, 20], [20, 40], [40, 60], [60, 80], [80, 100], [100, Infinity]].map(([min, max]) => ({
      label: max === Infinity ? '100+' : `${min}-${max}`,
      count: currentRows.filter(row => clampFinite(row.orderBoxes) >= min && clampFinite(row.orderBoxes) < max).length
    }));
    const selectedMonths = monthKeys(selected.from, selected.to);
    const departmentMonthly = selectedMonths.map(period => ({
      period,
      values: dimensionRows(currentRows.filter(row => row.date.slice(0, 7) === period), 'department', metric, 8).map(item => ({
        name: item.name,
        value: item.value
      }))
    }));
    const customerLevelMonthly = customerPlans?.customers?.monthly || selectedMonths.map(period => ({
      period,
      levels: customerLevelStructure(currentRows.filter(row => row.date.slice(0, 7) === period), metric).levels.map(item => ({
        level: item.level,
        count: item.count,
        value: item.value
      }))
    }));
    const orderMonthly = selectedMonths.map(period => {
      const rows = currentRows.filter(row => row.date.slice(0, 7) === period);
      const boxes = sum(rows, 'orderBoxes');
      return {
        period,
        orderCount: rows.length,
        boxes,
        average: rows.length ? boxes / rows.length : 0
      };
    });
    let hospitalCumulative = 0;
    const hospitalPareto = hospitals.contribution.map(item => {
      hospitalCumulative += item.share;
      return {
        ...item,
        cumulativeShare: hospitalCumulative
      };
    });
    const detail = [employees.contribution[0] ? `员工分析：${employees.contribution[0].name}贡献最高，占${(employees.contribution[0].share * 100).toFixed(1)}%。` : '员工分析：当前筛选范围暂无员工贡献数据。', hospitals.contribution[0] ? `医院分析：${hospitals.contribution[0].name}贡献最高，占${(hospitals.contribution[0].share * 100).toFixed(1)}%。` : '医院分析：当前筛选范围暂无医院贡献数据。', departments[0] ? `科室分析：${departments[0].name}贡献最高，占${(departments[0].share * 100).toFixed(1)}%。` : '科室分析：当前筛选范围暂无科室贡献数据。', current.recordCount ? `单笔订单盒数分析：平均${avgOrder.toFixed(1)}盒，共${current.recordCount}笔销售明细。` : '单笔订单盒数分析：当前筛选范围暂无订单数据。', customers.total ? `客户等级分析：共${customers.total}位客户，A类${customers.levels.find(item => item.level === 'A')?.count || 0}位。` : '客户等级分析：当前筛选范围暂无可分级客户数据。', upgrades.hasHistory ? `客户升级分析：升级客户贡献${upgrades.contribution.toFixed(1)}${metric.unit}，占${(upgrades.contributionShare * 100).toFixed(1)}%。` : '客户升级分析：历史数据不足，未生成升级结论。', waterfall.totalChange ? `掉量分析：较上期净变化${waterfall.totalChange.toFixed(1)}${metric.unit}（${signedPercent(waterfall.changeRate)}）。` : '掉量分析：当前没有可确认的净变化。', `员工计划执行与拟合分析：${employeePlanFit.summary}`, ...employeePlanFit.detailedAnalysis.slice(1, 4)].map(text => `${productLabel}｜${text}`);
    let runningActual = 0;
    const targetCumulativeSeries = targetPlan.cumulativeTargets.map(target => {
      const actualMonth = fiscalTrend.find(item => item.period === target.period);
      if (actualMonth && !actualMonth.future) runningActual += clampFinite(actualMonth.orderBoxes);
      return {
        ...target,
        actual: actualMonth?.future ? null : runningActual,
        future: actualMonth?.future ?? false
      };
    });
    const charts = [chartContract('fiscal-sales-trend', 'office-bars-total-line', '财年销售趋势', fiscal, pptFilters, metric, fiscalTrend, fiscalSummary, fiscalTrendDetail), chartContract('yoy-mom-analysis', 'dual-axis-bars-lines', '同比 / 环比分析', fiscal, pptFilters, metric, comparisonTrend, comparisonSummary, comparisonDetail), chartContract('quarter-target', 'actual-target-cumulative', '任务达成进度', fiscal, pptFilters, targetMetric, targetCumulativeSeries, annualTarget ? '按月盒数目标生成累计实际与累计目标轨迹。' : '尚未设置目标。', annualTarget ? detail : ['当前筛选范围尚未设置盒数目标，不能推算达成率。']), chartContract('product-target', 'progress', `${productLabel}达成情况`, fiscal, pptFilters, targetMetric, [{
      product: stableProductId(selectedProduct),
      actual: targetActual,
      target: targetValue,
      rate: targetRate,
      yoy: percentageChange(current.orderBoxes, lastYear.orderBoxes),
      mom: percentageChange(current.orderBoxes, previous.orderBoxes)
    }], targetValue ? `${productLabel}当前盒数目标达成率${(targetRate * 100).toFixed(1)}%。` : `${productLabel}盒数目标未设置。`, targetValue ? detail : [`${productLabel}盒数目标未设置，未推算达成率。`, ...detail]), chartContract('hospital-ranking', 'ranking', '医院分析 TOP10', fiscal, pptFilters, metric, hospitals, dimensionConclusion('医院排名', hospitals.contribution, selected.label), detail), chartContract('employee-ranking', 'ranking', '员工分析 TOP10', fiscal, pptFilters, metric, {
      ...employees,
      fit: employeePlanFit.ranking
    }, dimensionConclusion('员工贡献', employees.contribution, selected.label), detail), chartContract('department-distribution', 'donut', '科室分析', fiscal, pptFilters, metric, departments, dimensionConclusion('科室分布', departments, selected.label), detail), chartContract('customer-levels', 'stair-bars', 'ABCD 客户结构', fiscal, pptFilters, metric, customers.levels, customers.total ? `本期共有${customers.total}位客户；A+B占${formatShare(customers.levels.filter(item => item.level === 'A' || item.level === 'B').reduce((total, item) => total + item.count, 0) / customers.total)}，D级占${formatShare((customers.levels.find(item => item.level === 'D')?.count || 0) / customers.total)}。` : '当前范围暂无客户数据。', customers.mismatchCount ? [`填写等级与销量计算结果有${customers.mismatchCount}项不一致，建议复核。`, ...detail] : detail), chartContract('customer-upgrades', 'stacked-bar', '客户升级情况', fiscal, pptFilters, metric, upgrades.topOpportunities || [], upgrades.topOpportunities?.length ? `可升级客户${upgrades.summary.upgradeable}位，其中距下一等级不超过3盒${upgrades.summary.gapWithin3}位、不超过5盒${upgrades.summary.gapWithin5}位。` : upgrades.hasHistory ? '当前没有待升级客户。' : '历史数据不足。', upgrades.topOpportunities?.length ? detail : ['暂无足够客户实际销量数据，未生成升级机会。']), chartContract('average-order', 'distribution-bars', '单笔订单盒数分析', fiscal, pptFilters, metric, orderBuckets, currentRows.length ? `平均单笔订单${avgOrder.toFixed(1)}盒，共${currentRows.length}笔。` : '当前范围暂无订单数据。', detail), chartContract('waterfall', 'waterfall', '掉量分析', fiscal, pptFilters, metric, waterfall.series, waterfall.totalChange >= 0 ? '本期较上期增长。' : '本期较上期出现掉量。', detail)];
    const deepAnalysis = buildDeepBusinessAnalysis({
      fiscal,
      selected,
      metric,
      currentRows,
      previousRows,
      lastYearRows,
      fiscalTrend,
      comparisonTrend,
      current,
      previous,
      lastYear,
      targetValue: annualTarget,
      targetPlan,
      hospitals,
      employees,
      departments,
      customers,
      upgrades,
      waterfall,
      employeePlanFit,
      execution,
      alerts,
      tasks: scopedTasks,
      product: selectedProduct,
      validRecords
    });
    deepAnalysis.hospitalDiagnosis.pareto = hospitalPareto;
    deepAnalysis.departmentDiagnosis.monthly = departmentMonthly;
    deepAnalysis.customerStructureDiagnosis.monthly = customerLevelMonthly;
    deepAnalysis.orderDepthDiagnosis.monthly = orderMonthly;
    const analyses = buildDashboardAnalyses({
      fiscal,
      selected,
      metric,
      filters: pptFilters,
      product: selectedProduct,
      filteredRows: filtered,
      currentRows,
      previousRows,
      lastYearRows,
      fiscalTrend,
      comparisonTrend,
      current,
      previous,
      lastYear,
      targetPlan,
      fourThreeExecution,
      employeePlanFit,
      customerAnalytics: customerPlans,
      customers,
      upgrades,
      waterfall,
      alerts,
      alertMeta: alertResult.dataAvailability,
      deepAnalysis
    });
    return {
      schemaVersion: 3,
      generatedAt: new Date().toISOString(),
      range: selected,
      comparisons,
      fiscal,
      filters: pptFilters,
      metric,
      methodology,
      performanceScope: Products.getProduct(selectedProduct)?.role === 'AUXILIARY' ? 'AUXILIARY_NON_PERSONAL' : 'PERSONAL_PRIMARY',
      unassignedHospitalRecords: currentRows.filter(row => row.hospitalAssignmentPending).length,
      summary: {
        ...current,
        yoy,
        mom,
        activeHospitals,
        customerCount,
        employeeCount,
        avgOrder,
        targetValue,
        targetActual,
        annualTarget,
        targetRate
      },
      kpis: {
        sales: current.salesAmount,
        boxes: current.orderBoxes,
        targetRate,
        yoy,
        mom,
        activeHospitals,
        hospitalCount: activeHospitals,
        customerCount,
        employeeCount,
        attention,
        alerts: alerts.length,
        avgOrder,
        A: customers.levels[0].count,
        B: customers.levels[1].count,
        C: customers.levels[2].count,
        D: customers.levels[3].count
      },
      insights,
      marketSummary: {
        headline: insights.slice(0, 4),
        detailedAnalysis: detail
      },
      trend: {
        monthly,
        quarterly,
        fiscal: fiscalTrend,
        comparison: comparisonTrend
      },
      products,
      departments,
      hospitals,
      employees: {
        ...employees,
        fit: employeePlanFit.ranking
      },
      employeePlanFit,
      deepAnalysis,
      customers: {
        total: customers.total,
        levels: customers.levels,
        source: customers.source || 'sales-records',
        mismatchCount: customers.mismatchCount || 0,
        monthly: customers.monthly || customerLevelMonthly
      },
      upgrades,
      waterfall,
      orderBuckets,
      targetMetric,
      targets: {
        plan: targetPlan,
        fiscalYear: {
          label: `FY${fiscal.fiscalYear}`,
          target: annualTarget,
          actual: fiscalTargetActual,
          rate: annualTarget ? fiscalTargetActual / annualTarget : null
        },
        quarters,
        offices: options.officeTargets || []
      },
      alerts,
      alertMeta: alertResult.dataAvailability,
      alertThresholds: alertResult.thresholds,
      execution,
      fourThreeExecution,
      analyses,
      charts,
      filterOptions: {
        product: filterOptions('product'),
        office: filterOptions('office'),
        hospital: filterOptions('hospital'),
        department: filterOptions('department'),
        employee: filterOptions('employee')
      },
      states: {
        data: currentRows.length ? 'normal' : 'empty',
        target: targetValue ? 'normal' : 'empty',
        upgrades: upgrades.hasHistory ? 'normal' : 'partial'
      }
    };
  }
  return {
    createPeriodContext,
    resolveFiscalPeriod,
    fiscalSelection,
    stableProductId,
    matchCustomerEntity,
    validateChartData,
    normalizeTargetPlan,
    buildEmployeePlanTargetPlan,
    buildFourThreeExecutionDetail,
    buildDashboardAlerts: dashboardAlerts,
    alertTypes: ALERT_TYPES,
    salesGradeForBoxes: customerLevel,
    customerGradeProgress,
    buildQuarterlyReportMaterial,
    buildEmployeePlanFitAnalysis,
    buildDashboardAnalyses,
    buildSalesDashboardV2,
    buildSalesDashboardV3: buildSalesDashboardV2,
    percentageChange
  };
});
