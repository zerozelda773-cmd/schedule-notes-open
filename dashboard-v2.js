(function initSalesDashboardV2(root) {
  const STORAGE_KEY = 'sales-dashboard-v2-kpi-layout';
  const DEFAULT_KPIS = ['primary', 'target', 'boxes', 'hospitals', 'attention', 'alerts', 'average'];
  const state = {
    editKpis: false,
    ranking: {
      hospital: 'contribution',
      employee: 'contribution'
    },
    employeeFitOrder: 'asc',
    trendType: 'combo',
    trendGrain: 'monthly',
    moreFilters: false,
    customerGradeFilter: ''
  };
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[char]);
  }
  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function pct(value, empty = '—') {
    return value === null || value === undefined ? empty : `${value >= 0 ? '+' : ''}${(finite(value) * 100).toFixed(1)}%`;
  }
  function formatValue(value, metric, compact = false) {
    const number = finite(value);
    if (metric?.key === 'salesAmount') {
      if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(compact ? 1 : 2)}万`;
      return `¥${new Intl.NumberFormat('zh-CN', {
        maximumFractionDigits: 1
      }).format(number)}`;
    }
    return `${new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 1
    }).format(number)}盒`;
  }
  function icon(name) {
    const paths = {
      dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"></path>',
      database: '<ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path>',
      export: '<path d="M12 15V3m0 0-4 4m4-4 4 4"></path><path d="M5 13v7h14v-7"></path>',
      refresh: '<path d="M20 6v5h-5M4 18v-5h5"></path><path d="M18 9a7 7 0 0 0-12-2l-2 2m2 6a7 7 0 0 0 12 2l2-2"></path>',
      filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"></path>',
      drag: '<circle cx="8" cy="6" r="1"></circle><circle cx="16" cy="6" r="1"></circle><circle cx="8" cy="12" r="1"></circle><circle cx="16" cy="12" r="1"></circle><circle cx="8" cy="18" r="1"></circle><circle cx="16" cy="18" r="1"></circle>',
      sales: '<path d="M5 19V9m7 10V5m7 14v-7M3 19h18"></path>',
      target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><path d="m15 9 5-5"></path>',
      boxes: '<path d="m4 8 8-4 8 4-8 4-8-4Z"></path><path d="M4 8v8l8 4 8-4V8M12 12v8"></path>',
      hospital: '<path d="M5 21V7h14v14M9 7V3h6v4M9 12h6M12 9v6M8 21v-3h8v3"></path>',
      alert: '<path d="M12 3 2.8 19h18.4L12 3ZM12 9v4m0 3h.01"></path>',
      users: '<circle cx="9" cy="8" r="3"></circle><path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 4a3 3 0 0 1 0 6m1 4c2.5.5 4 2.7 4 6"></path>',
      average: '<path d="M4 7h16M7 4v6M17 4v6M5 13h4v6H5v-6Zm10 0h4v6h-4v-6Z"></path>',
      plus: '<path d="M12 5v14M5 12h14"></path>',
      back: '<path d="m15 18-6-6 6-6"></path>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.dashboard}</svg>`;
  }
  function layout() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(stored)) return stored.filter(id => KPI_LIBRARY[id]);
    } catch {}
    return [...DEFAULT_KPIS];
  }
  function saveLayout(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
  const KPI_LIBRARY = {
    primary: {
      label: '销售额 / 净盒数',
      icon: 'sales',
      value: m => m.performanceScope === 'AUXILIARY_NON_PERSONAL' ? '数据不足' : formatValue(m.summary.value, m.metric, true),
      meta: m => m.performanceScope === 'AUXILIARY_NON_PERSONAL' ? '辅助产品 · 不计个人业绩' : `同比 ${pct(m.summary.yoy)}　环比 ${pct(m.summary.mom)}`
    },
    sales: {
      label: '销售额',
      icon: 'sales',
      value: m => m.performanceScope === 'AUXILIARY_NON_PERSONAL' ? '数据不足' : m.summary.salesAmount ? formatValue(m.summary.salesAmount, {
        key: 'salesAmount'
      }, true) : '—',
      meta: () => '净盒数 × 产品单价'
    },
    boxes: {
      label: '净盒数',
      icon: 'boxes',
      value: m => m.performanceScope === 'AUXILIARY_NON_PERSONAL' ? '不计个人业绩' : `${new Intl.NumberFormat('zh-CN').format(m.summary.orderBoxes)}盒`,
      meta: m => `同比 ${pct(m.summary.yoy)}`
    },
    target: {
      label: '目标达成率',
      icon: 'target',
      value: m => m.summary.targetRate === null ? '未设置' : `${(m.summary.targetRate * 100).toFixed(1)}%`,
      meta: m => m.summary.targetValue ? `目标 ${formatValue(m.summary.targetValue, m.targetMetric, true)}` : '在数据管理中设置盒数目标',
      progress: m => m.summary.targetRate
    },
    yoy: {
      label: '同比',
      icon: 'target',
      value: m => pct(m.summary.yoy),
      meta: () => '上年同期对比'
    },
    mom: {
      label: '环比',
      icon: 'target',
      value: m => pct(m.summary.mom),
      meta: () => '等长上一周期对比'
    },
    hospitals: {
      label: '活跃医院',
      icon: 'hospital',
      value: m => `${m.summary.activeHospitals}家`,
      meta: () => '本期有销售记录'
    },
    hospitalCount: {
      label: '医院数量',
      icon: 'hospital',
      value: m => `${m.kpis.hospitalCount}家`,
      meta: () => '按当前筛选范围'
    },
    customerCount: {
      label: '客户数量',
      icon: 'users',
      value: m => `${m.kpis.customerCount}位`,
      meta: () => '已填写客户姓名'
    },
    attention: {
      label: '重点关注',
      icon: 'users',
      value: m => `${m.kpis.attention}条`,
      meta: () => '任务与数据需复核'
    },
    alerts: {
      label: '异常预警',
      icon: 'alert',
      value: m => `${m.kpis.alerts}条`,
      meta: () => '仅基于真实业务数据'
    },
    average: {
      label: '单笔订单平均盒数',
      icon: 'average',
      value: m => `${m.summary.avgOrder.toFixed(1)}盒`,
      meta: () => '按销售明细平均'
    },
    employeeCount: {
      label: '员工数量',
      icon: 'users',
      value: m => `${m.kpis.employeeCount}人`,
      meta: () => '本期有销售记录'
    },
    A: {
      label: 'A类客户数',
      icon: 'users',
      value: m => `${m.kpis.A}位`,
      meta: () => '本期盒数 >30'
    },
    B: {
      label: 'B类客户数',
      icon: 'users',
      value: m => `${m.kpis.B}位`,
      meta: () => '本期盒数 20–30'
    },
    C: {
      label: 'C类客户数',
      icon: 'users',
      value: m => `${m.kpis.C}位`,
      meta: () => '本期盒数 10–20'
    },
    D: {
      label: 'D类客户数',
      icon: 'users',
      value: m => `${m.kpis.D}位`,
      meta: () => '本期盒数 <10'
    }
  };
  function DashboardHeader(model) {
    return `<header class="v2-header">
      <button class="v2-mobile-back" type="button" data-action="back" aria-label="返回日程">${icon('back')}</button>
      <span class="v2-title-icon">${icon('dashboard')}</span>
      <div class="v2-title"><h1>销售仪表盘 <small>V3 · 修正版</small></h1><p>数据更新：${esc(model.fiscal.cutoffDate)} 12:00　数据来源：企业微信智能表格</p></div>
      <div class="v2-header-actions">
        <button type="button" data-action="data" aria-label="数据管理">${icon('database')}<span>数据管理</span></button>
        <button type="button" data-action="report" aria-label="导出汇报">${icon('export')}<span>导出汇报</span></button>
        <button type="button" data-action="refresh" aria-label="刷新数据">${icon('refresh')}<span>刷新数据</span></button>
      </div>
    </header>`;
  }
  function optionList(values, selected, allLabel = '全部') {
    return `<option value="all">${allLabel}</option>${values.map(value => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('')}`;
  }
  function DashboardFilterBar(model) {
    const f = model.filters;
    const fy = Number(model.fiscal.fiscalYear);
    const fyOptions = [fy - 2, fy - 1, fy, fy + 1].map(year => `<option value="${year}"${year === fy ? ' selected' : ''}>${year}财年</option>`).join('');
    const quarter = model.fiscal.fiscalQuarter;
    const month = model.fiscal.month;
    return `<section class="v2-filter-card" aria-label="全局筛选" data-filter-context="fiscal">
      <label><span>财年</span><select data-filter="fiscalYear">${fyOptions}</select></label>
      <label class="v3-clearable"><span>财季</span><select data-filter="fiscalQuarter">${quarter ? '' : '<option value="" hidden selected>—</option>'}${[1, 2, 3, 4].map(value => `<option value="${value}"${quarter === value ? ' selected' : ''}>Q${value}</option>`).join('')}</select>${quarter ? '<button type="button" data-clear-filter="fiscalQuarter" aria-label="清除财季">×</button>' : ''}</label>
      <label class="v3-clearable"><span>月份</span><select data-filter="month">${month ? '' : '<option value="" hidden selected>—</option>'}${[10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => `<option value="${value}"${month === value ? ' selected' : ''}>${value}月</option>`).join('')}</select>${month ? '<button type="button" data-clear-filter="month" aria-label="清除月份">×</button>' : ''}</label>
      <label><span>截止日期</span><input type="date" data-filter="cutoffDate" value="${esc(model.fiscal.cutoffDate)}"></label>
      <div class="v3-product-switch" role="group" aria-label="产品切换"><span>产品</span><div>${["Primary Product A", "Primary Product B"].map(product => `<button type="button" data-product-switch="${product}" class="${f.product === product ? 'active' : ''}" aria-pressed="${f.product === product}">${product}</button>`).join('')}</div></div>
      <p class="v3-filter-hint">ⓘ 默认读取现实日期；清除月份后按财季，清除财季与月份后按整个财年。所有图表、总结和详细分析同步刷新。</p>
    </section>`;
  }
  function KpiCard(id, model) {
    const definition = KPI_LIBRARY[id];
    if (!definition) return '';
    const progress = definition.progress?.(model);
    return `<article class="v2-kpi-card" data-kpi-id="${id}" data-editing="${state.editKpis}">
      <span class="v2-kpi-icon" data-kpi-tone="${id === 'alerts' ? 'risk' : id === 'attention' ? 'warning' : 'normal'}">${icon(definition.icon)}</span>
      <div class="v2-kpi-copy"><span>${definition.label}</span><strong>${esc(definition.value(model))}</strong><small>${esc(definition.meta(model))}</small>${progress === null || progress === undefined ? '' : `<i><b style="width:${Math.min(100, Math.max(0, progress * 100))}%"></b></i>`}</div>
      <button class="v2-kpi-drag" type="button" aria-label="拖动指标">${icon('drag')}</button>
      <button class="v2-kpi-remove" type="button" data-action="remove-kpi" aria-label="隐藏指标">×</button>
    </article>`;
  }
  function AddKpiCard() {
    return `<button class="v2-add-kpi" type="button" data-action="add-kpi">${icon('plus')}<span>添加指标</span></button>`;
  }
  function EditableKpiGrid(model) {
    return `<section class="v2-kpi-section"><header><h2>关键指标 <small>（长按卡片可拖动排序或删除）</small></h2><button type="button" data-action="reset-kpis">${icon('refresh')}重置布局</button></header><div class="v2-kpi-grid">${layout().map(id => KpiCard(id, model)).join('')}${AddKpiCard()}</div></section>`;
  }
  function InsightPanel(model) {
    const items = model.insights.slice(0, 6);
    return `<article class="v2-card v2-insights v3-market-summary"><header><h2>销售态势总结 <small>· ${esc(model.filters.product)}</small></h2><span>截至 ${esc(model.fiscal.cutoffDate)}</span></header><div class="v3-summary-columns"><section><h3>当前销售表现</h3>${items.slice(0, 2).map(text => `<p>• ${esc(text)}</p>`).join('')}</section><section><h3>增长与掉量</h3>${items.slice(2, 5).map(text => `<p>• ${esc(text)}</p>`).join('')}</section><section><h3>主要风险</h3>${items.slice(5, 6).map(text => `<p>• ${esc(text)}</p>`).join('')}<p>• ${esc(model.employeePlanFit?.summary || '员工计划数据不足，暂不评分。')}</p></section></div><button type="button" data-analysis-id="market-summary">展开市场多维分析报告 ›</button></article>`;
  }
  function TargetProgressCard(model) {
    const target = model.targets.fiscalYear;
    const rate = target.rate;
    const metric = model.targetMetric;
    return `<article class="v2-card v2-target"><header><h2>任务达成进度 <small>（财年：${esc(target.label)}）</small></h2><button type="button" data-analysis-type="target-achievement">查看详情 ›</button></header>
      <p>财年总目标：<strong>${target.target ? formatValue(target.target, metric, true) : '未设置'}</strong></p>
      <div class="v2-target-numbers"><span>完成 <b>${formatValue(target.actual, metric, true)}</b></span><span>达成率 <b>${rate === null ? '未设置' : `${(rate * 100).toFixed(1)}%`}</b></span></div>
      <div class="v2-progress"><i style="width:${rate === null ? 0 : Math.min(100, rate * 100)}%"></i></div>
      <div class="v2-progress-scale"><span>0</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
      <div class="v2-office-progress">${model.targets.offices.length ? model.targets.offices.map(item => `<span>${esc(item.name)} <b>${item.rate === null ? '未设置' : `${(item.rate * 100).toFixed(1)}%`}</b></span>`).join('') : '<span>办事处目标：<b>未设置</b></span>'}</div>${AnalysisFooter(chartById(model, 'quarter-target'))}
    </article>`;
  }
  function ProductAchievementCard(model) {
    const chart = chartById(model, 'product-target');
    const row = chart?.series?.[0] || {};
    const metric = model.targetMetric;
    return `<article class="v2-card v3-product-achievement"><header><h2>${esc(model.filters.product)}达成情况</h2><small>盒数口径</small></header><div class="v3-product-achievement-value"><span>当前完成</span><strong>${formatValue(row.actual, metric, true)}</strong></div><div class="v3-product-achievement-meta"><span>目标 <b>${row.target ? formatValue(row.target, metric, true) : '未设置'}</b></span><span>达成率 <b>${row.rate === null ? '未设置' : `${(row.rate * 100).toFixed(1)}%`}</b></span><span>同比 <b>${pct(row.yoy)}</b></span><span>环比 <b>${pct(row.mom)}</b></span></div><div class="v2-progress"><i style="width:${row.rate === null ? 0 : Math.min(100, row.rate * 100)}%"></i></div>${AnalysisFooter(chart)}</article>`;
  }
  function quarterChart(model) {
    const max = Math.max(...model.targets.quarters.flatMap(item => [item.actual, item.target || 0]), 1);
    return `<article class="v2-card v2-quarter"><header><h2>季度达成 <small>（盒）</small></h2><span><i></i>实际　<i></i>目标</span></header><div class="v2-quarter-bars">${model.targets.quarters.map(item => `<div><span class="actual" style="height:${item.actual / max * 100}%"><b>${item.actual ? formatValue(item.actual, model.targetMetric, true) : '0'}</b></span><span class="target" style="height:${item.target ? item.target / max * 100 : 72}%"><b>${item.target ? formatValue(item.target, model.targetMetric, true) : '未设置'}</b></span><small>${item.quarter}</small></div>`).join('')}</div></article>`;
  }
  function comboTrendSvg(series, metric) {
    if (!series.length || !series.some(item => item.value > 0)) return ChartEmptyState('当前筛选范围暂无销售趋势数据');
    const width = 720;
    const height = 220;
    const left = 38;
    const right = 36;
    const top = 18;
    const bottom = 36;
    const max = Math.max(...series.map(item => item.value), 1);
    const step = (width - left - right) / series.length;
    const points = (key, color) => {
      const valid = series.map((item, index) => ({
        value: item[key],
        x: left + step * index + step / 2
      })).filter(item => item.value !== null);
      if (!valid.length) return '';
      const y = value => top + (height - top - bottom) * (1 - (value + 1) / 2);
      return `<polyline points="${valid.map(item => `${item.x},${y(item.value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"></polyline>${valid.map(item => `<circle cx="${item.x}" cy="${y(item.value)}" r="3" fill="${color}"></circle>`).join('')}`;
    };
    return `<svg class="v2-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="销售趋势">${series.map((item, index) => {
      const barHeight = item.value / max * (height - top - bottom);
      return `<rect x="${left + step * index + step * .18}" y="${height - bottom - barHeight}" width="${step * .28}" height="${barHeight}" rx="3"></rect><rect class="secondary" x="${left + step * index + step * .5}" y="${height - bottom - item.orderBoxes / Math.max(...series.map(row => row.orderBoxes), 1) * (height - top - bottom) * .65}" width="${step * .22}" height="${item.orderBoxes / Math.max(...series.map(row => row.orderBoxes), 1) * (height - top - bottom) * .65}" rx="3"></rect><text x="${left + step * index + step / 2}" y="${height - 12}" text-anchor="middle">${esc(item.period.replace(/^\d{4}-/, ''))}</text>`;
    }).join('')}${points('yoy', '#2f7ee6')}${points('mom', '#f28b20')}<line x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line></svg>`;
  }
  function stackedTrend(model, series) {
    if (!series.length || !series.some(item => item.value > 0)) return ChartEmptyState('当前筛选范围暂无销售趋势数据');
    const products = [...new Set(series.flatMap(item => item.products.map(entry => entry.name)))].slice(0, 4);
    const max = Math.max(...series.map(item => item.value), 1);
    return `<div class="v2-stacked-chart">${series.map(item => `<div><span>${item.period.replace(/^\d{4}-/, '')}</span><i>${products.map((product, index) => {
      const value = item.products.find(entry => entry.name === product)?.value || 0;
      return `<b data-color="${index}" style="height:${value / max * 100}%" title="${esc(product)} ${formatValue(value, model.metric)}"></b>`;
    }).join('')}</i></div>`).join('')}</div>`;
  }
  function ChartEmptyState(message) {
    return `<div class="v2-empty"><span>${icon('sales')}</span><p>${esc(message)}</p></div>`;
  }
  function ChartLegend(model) {
    return `<div class="v2-chart-legend"><span data-color="sales">${'●'} ${esc(model.metric.label)}</span><span data-color="boxes">● 下单盒数</span><span data-color="yoy">— 同比</span><span data-color="mom">— 环比</span></div>`;
  }
  function chartById(model, id) {
    return model.charts.find(chart => chart.chartId === id);
  }
  function fiscalTrendSvg(series) {
    const width = 700,
      height = 245,
      left = 38,
      right = 18,
      top = 24,
      bottom = 34,
      step = (width - left - right) / 12;
    const max = Math.max(...series.flatMap(item => [item.officeOne, item.officeTwo, item.total]), 1);
    const y = value => top + (height - top - bottom) * (1 - value / max);
    const points = series.filter(item => !item.future && item.total > 0).map((item, index) => `${left + step * index + step / 2},${y(item.total)}`).join(' ');
    return `<svg class="v2-trend-svg v3-fiscal-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="财年销售趋势">${series.map((item, index) => {
      const x = left + step * index;
      return `<g class="${item.future ? 'future' : ''}"><rect x="${x + step * .16}" y="${y(item.officeOne)}" width="${step * .27}" height="${height - bottom - y(item.officeOne)}" rx="2"></rect><rect class="secondary" x="${x + step * .48}" y="${y(item.officeTwo)}" width="${step * .27}" height="${height - bottom - y(item.officeTwo)}" rx="2"></rect><text x="${x + step / 2}" y="${height - 11}" text-anchor="middle">${Number(item.period.slice(5))}月</text></g>`;
    }).join('')}<polyline points="${points}" fill="none" stroke="#2f7ee6" stroke-width="2.5"></polyline><line x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line></svg>`;
  }
  function comparisonSvg(series) {
    const width = 700,
      height = 245,
      left = 42,
      right = 38,
      top = 22,
      bottom = 34,
      step = (width - left - right) / 12;
    const max = Math.max(...series.flatMap(item => [item.current, item.prior]), 1);
    const y = value => top + (height - top - bottom) * (1 - value / max);
    const py = value => top + (height - top - bottom) * (1 - (finite(value) + 1) / 2);
    const line = (key, color) => {
      const points = series.map((item, index) => ({
        value: item[key],
        x: left + step * index + step / 2
      })).filter(item => item.value !== null);
      return `<polyline points="${points.map(item => `${item.x},${py(item.value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"></polyline>${points.map(item => `<circle cx="${item.x}" cy="${py(item.value)}" r="2.7" fill="${color}"></circle>`).join('')}`;
    };
    return `<svg class="v2-trend-svg v3-comparison-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="同比环比分析">${series.map((item, index) => {
      const x = left + step * index;
      return `<g class="${item.future ? 'future' : ''}"><rect x="${x + step * .17}" y="${y(item.prior)}" width="${step * .27}" height="${height - bottom - y(item.prior)}" rx="2"></rect><rect class="current" x="${x + step * .49}" y="${y(item.current)}" width="${step * .27}" height="${height - bottom - y(item.current)}" rx="2"></rect><text x="${x + step / 2}" y="${height - 11}" text-anchor="middle">${Number(item.period.slice(5))}月</text></g>`;
    }).join('')}${line('yoy', '#07875f')}${line('mom', '#f28b20')}<line x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line></svg>`;
  }
  function AnalysisFooter(chart) {
    return `<footer class="v3-chart-footer"><p>${esc(chart?.summary || '暂无可用分析结论。')}</p><button type="button" data-analysis-id="${esc(chart?.chartId || '')}" data-analysis-type="${esc(chart?.analysisType || '')}">查看详细分析 ›</button></footer>`;
  }
  function SalesTrendCard(model) {
    const chart = chartById(model, 'fiscal-sales-trend');
    return `<article class="v2-card v2-sales-trend v3-core-chart" data-chart-id="fiscal-sales-trend"><header><h2>A. 财年销售趋势 <small>· ${esc(model.filters.product)}（${model.fiscal.fiscalYear - 1}.10–${model.fiscal.fiscalYear}.09）</small></h2><span class="v3-legend"><i></i>Synthetic Office A　<i></i>Synthetic Office B　<b>—</b>两办合计</span></header>${model.trend.fiscal.some(item => item.total > 0) ? fiscalTrendSvg(model.trend.fiscal) : ChartEmptyState('所选财年截至当前日期暂无销售数据')}${AnalysisFooter(chart)}</article>`;
  }
  function ComparisonTrendCard(model) {
    const chart = chartById(model, 'yoy-mom-analysis');
    return `<article class="v2-card v2-sales-trend v3-core-chart" data-chart-id="yoy-mom-analysis"><header><h2>B. 同比 / 环比分析 <small>· ${esc(model.filters.product)}</small></h2><span class="v3-legend"><i></i>${model.fiscal.fiscalYear - 1}财年同期　<i></i>${model.fiscal.fiscalYear}财年同期　<b>—</b>同比 / 环比</span></header>${model.trend.comparison.some(item => item.current > 0 || item.prior > 0) ? comparisonSvg(model.trend.comparison) : ChartEmptyState('当前范围暂无同期或本期销售数据')}${AnalysisFooter(chart)}</article>`;
  }
  function donutGradient(items, colors) {
    let cursor = 0;
    const total = items.reduce((value, item) => value + finite(item.value ?? item.count), 0) || 1;
    return items.map((item, index) => {
      const start = cursor;
      cursor += finite(item.value ?? item.count) / total * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    }).join(',');
  }
  function CustomerLevelCard(model) {
    const colors = {
      D: '#dfe5e6',
      C: '#79cfaa',
      B: '#23aa79',
      A: '#07875f'
    };
    const levels = [...model.customers.levels].sort((a, b) => 'DCBA'.indexOf(a.level) - 'DCBA'.indexOf(b.level));
    const max = Math.max(...levels.map(item => item.count), 1);
    const high = levels.filter(item => item.level === 'A' || item.level === 'B').reduce((total, item) => total + item.count, 0);
    const d = levels.find(item => item.level === 'D')?.count || 0;
    return `<article class="v2-card v3-customer-stairs" data-customer-source="${esc(model.customers.source || 'sales-records')}"><header><h2>ABCD 客户结构 <small>（系统按实际销量计算）</small></h2>${model.customers.mismatchCount ? `<span class="v3-grade-warning">${model.customers.mismatchCount}项待复核</span>` : ''}</header>${model.customers.total ? `<div class="v3-customer-stair-chart" role="img" aria-label="ABCD客户阶梯柱形图">${levels.map(item => `<button type="button" data-customer-grade="${item.level}" class="${state.customerGradeFilter === item.level ? 'active' : ''}" aria-label="筛选${item.level}级客户"><span>${item.count}人<small>${(item.count / model.customers.total * 100).toFixed(0)}%</small></span><i style="height:${Math.max(12, item.count / max * 100)}%;background:${colors[item.level]}"></i><b>${item.level}</b></button>`).join('')}</div><div class="v3-customer-summary"><span>客户总数 <b>${model.customers.total}</b></span><span>A+B占比 <b>${(high / model.customers.total * 100).toFixed(1)}%</b></span><span>D级占比 <b>${(d / model.customers.total * 100).toFixed(1)}%</b></span></div>${model.customers.monthly?.length >= 2 ? `<div class="v3-customer-monthly">${model.customers.monthly.map(month => {
      const total = month.levels.reduce((sum, item) => sum + item.count, 0) || 1;
      return `<span title="${esc(month.period)}">${month.levels.map(item => `<i data-grade="${item.level}" style="width:${item.count / total * 100}%"></i>`).join('')}<small>${esc(month.period.slice(5))}月</small></span>`;
    }).join('')}</div>` : ''}` : ChartEmptyState('当前范围暂无可分级客户数据')}${AnalysisFooter(chartById(model, 'customer-levels'))}</article>`;
  }
  function CustomerUpgradeCard(model) {
    const all = model.upgrades.topOpportunities || [];
    const rows = state.customerGradeFilter ? all.filter(item => item.currentGrade === state.customerGradeFilter) : all;
    const summary = model.upgrades.summary || {};
    const max = Math.max(...rows.map(item => item.nextGradeThreshold || item.currentBoxes), 1);
    return `<article class="v2-card v3-upgrade-opportunities"><header><h2>客户升级 TOP10 <small>${state.customerGradeFilter ? `· ${state.customerGradeFilter}→下一等级` : '（按升级缺口）'}</small></h2><button type="button" data-action="upgrade-manage">管理计划 ›</button></header>${rows.length ? `<div class="v3-upgrade-list">${rows.map(item => `<button type="button" data-customer-id="${esc(item.customerId)}"><span title="${esc(item.customer)}"><b>${esc(item.customer)}</b><small>${esc(item.hospital)} · ${esc(item.employee)}</small></span><i><em style="width:${item.currentBoxes / max * 100}%"></em><u style="width:${item.upgradeGap / max * 100}%"></u></i><strong>${item.currentBoxes} + ${item.upgradeGap}<small>${item.currentGrade}→${item.nextGrade} · ${esc(item.status)}</small></strong></button>`).join('')}</div><div class="v3-upgrade-summary"><span>可升级 <b>${summary.upgradeable || 0}</b></span><span>≤3盒 <b>${summary.gapWithin3 || 0}</b></span><span>≤5盒 <b>${summary.gapWithin5 || 0}</b></span><span>目标合理 <b>${summary.reasonableTarget || 0}</b></span></div>` : ChartEmptyState(state.customerGradeFilter ? `${state.customerGradeFilter}级暂无升级机会客户` : '当前范围暂无可计算升级机会的客户实际销量')}${AnalysisFooter(chartById(model, 'customer-upgrades'))}</article>`;
  }
  function RankingCard(model, dimension) {
    const mode = state.ranking[dimension];
    const source = model[dimension === 'hospital' ? 'hospitals' : 'employees'];
    const fitRows = model.employeePlanFit?.ranking || [];
    const rows = mode === 'fit' ? [...fitRows].sort((a, b) => state.employeeFitOrder === 'asc' ? (a.fitScore === null) - (b.fitScore === null) || (a.fitScore ?? 101) - (b.fitScore ?? 101) : (a.fitScore !== null) - (b.fitScore !== null) || (b.fitScore ?? -1) - (a.fitScore ?? -1)) : source[mode];
    const title = dimension === 'hospital' ? '医院分析 TOP10' : '员工分析 TOP10';
    const max = mode === 'fit' ? 100 : Math.max(...rows.map(item => mode === 'contribution' ? item.value : Math.abs(item.change)), 1);
    const chartId = dimension === 'hospital' ? 'hospital-ranking' : 'employee-ranking';
    const tabs = [['contribution', '贡献榜'], ['growth', '增长榜'], ['decline', '掉量榜'], ...(dimension === 'employee' ? [['fit', '拟合度']] : [])];
    const fitSort = mode === 'fit' ? `<button class="v3-fit-sort" type="button" data-fit-order="${state.employeeFitOrder === 'asc' ? 'desc' : 'asc'}">${state.employeeFitOrder === 'asc' ? '从低到高' : '从高到低'} ↕</button>` : '';
    return `<article class="v2-card v2-ranking ${mode === 'fit' ? 'v3-fit-ranking' : ''}" data-ranking="${dimension}"><header><h2>${title} <small>（${mode === 'fit' ? '计划 vs 实际' : `按${esc(model.metric.label)}`}）</small></h2>${fitSort}</header><div class="v2-ranking-tabs">${tabs.map(([value, label]) => `<button type="button" data-ranking-mode="${value}" class="${mode === value ? 'active' : ''}">${label}</button>`).join('')}</div>${rows.length ? `<ol>${rows.slice(0, 8).map((item, index) => {
      if (mode === 'fit') {
        const score = item.fitScore;
        const reason = item.issues?.[0]?.text || (item.dataState === 'unfilled' ? '当前周期未填写计划' : item.dataState === 'insufficient' ? '数据不足，暂不评分' : item.positives?.[0] || '计划与实际基本匹配');
        return `<li tabindex="0" data-employee-fit="${esc(item.employeeId)}" data-fit-status="${esc(item.status.key)}"><b>${index + 1}</b><span title="${esc(item.employeeName)}"><strong>${esc(item.employeeName)}</strong><small>${esc(item.office || '未填写办事处')}</small></span><i><em style="width:${score === null ? 0 : score}%" data-tone="${item.status.key}"></em></i><strong>${score === null ? esc(item.status.label) : `${score.toFixed(0)}%`}<small>${esc(item.status.label)}</small></strong><p>${esc(reason)}</p></li>`;
      }
      const value = mode === 'contribution' ? item.value : item.change;
      return `<li tabindex="0" data-ranking-name="${esc(item.name)}"><b>${index + 1}</b><span title="${esc(item.name)}">${esc(item.name)}</span><i><em style="width:${Math.abs(value) / max * 100}%" data-tone="${value < 0 ? 'down' : 'up'}"></em></i><strong>${value >= 0 && mode !== 'contribution' ? '+' : ''}${formatValue(value, model.metric, true)}</strong></li>`;
    }).join('')}</ol>` : ChartEmptyState(mode === 'fit' ? '当前范围暂无员工计划或销售数据' : '当前范围暂无排名数据')}${mode === 'fit' ? `<footer class="v3-fit-summary">${esc(model.employeePlanFit?.summary || '数据不足，暂不评分。')}</footer>` : AnalysisFooter(chartById(model, chartId))}</article>`;
  }
  function employeeFitDetailMarkup(item, model) {
    const scoreLabel = value => value === null ? '数据不足' : `${value.toFixed(0)}%`;
    const fitMetric = model.employeePlanFit?.metric || model.metric;
    const cards = [['volumeFit', '总量拟合'], ['hospitalDepartmentFit', '医院/科室拟合'], ['customerLevelFit', '客户等级合理性'], ['planQuality', '填写质量']];
    const actualHospitals = item.evidence.actualGrowthHospitals || [];
    return `<section class="v3-fit-detail"><div class="v3-fit-hero" data-fit-status="${esc(item.status.key)}"><div><span>${esc(item.office || '未填写办事处')} · ${esc(model.filters.product)}</span><h3>${esc(item.employeeName)}</h3><small>FY${model.fiscal.fiscalYear}${model.fiscal.fiscalQuarter ? ` Q${model.fiscal.fiscalQuarter}` : ''}${model.fiscal.month ? ` · ${model.fiscal.month}月` : ''} · 截至${esc(model.fiscal.cutoffDate)}</small></div><strong>${item.fitScore === null ? '—' : `${item.fitScore.toFixed(0)}%`}<small>${esc(item.status.label)}</small></strong></div>
      <div class="v3-fit-score-grid">${cards.map(([key, label]) => `<article><span>${label}</span><strong>${scoreLabel(item.scores[key])}</strong><i><b style="width:${item.scores[key] || 0}%"></b></i></article>`).join('')}</div>
      <section class="v3-fit-compare"><h3>计划 vs 实际</h3><div><p><span>计划目标</span><strong>${item.evidence.planTarget === null || item.evidence.planTarget === undefined ? '未填写' : `${item.evidence.planTarget.toFixed(1)}${esc(fitMetric.unit)}`}</strong></p><p><span>实际销售</span><strong>${finite(item.evidence.actualSales).toFixed(1)}${esc(fitMetric.unit)}</strong></p><p><span>历史月均</span><strong>${item.evidence.historicalAverage === null || item.evidence.historicalAverage === undefined ? '数据不足' : `${item.evidence.historicalAverage.toFixed(1)}${esc(fitMetric.unit)}`}</strong></p></div><div class="v3-fit-columns"><p><b>重点医院计划</b>${(item.evidence.plannedHospitals || []).length ? item.evidence.plannedHospitals.map(name => `<span>${esc(name)}</span>`).join('') : '<span>未填写</span>'}</p><p><b>实际主要医院</b>${actualHospitals.length ? actualHospitals.slice(0, 4).map(row => `<span>${esc(row.name)} · ${formatValue(row.value, fitMetric, true)}</span>`).join('') : '<span>暂无实际医院产出</span>'}</p></div></section>
      <section class="v3-fit-findings"><h3>主要判断依据</h3>${item.issues.length ? `<ol>${item.issues.map(issue => `<li><span>!</span><p>${esc(issue.text)}</p></li>`).join('')}</ol>` : `<p class="v3-fit-empty">${item.dataState === 'unfilled' ? '当前周期未填写计划，不纳入低拟合评分。' : item.dataState === 'insufficient' ? '数据不足，暂不评分。' : '当前未发现需要优先复核的明显不一致。'}</p>`}${item.positives.length ? `<h3>符合项</h3><ul>${item.positives.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}</section>
      <footer><strong>数据限制</strong><p>销售验证只匹配到员工、医院和科室层级，不推断具体客户个人；拟合度仅用于筛选建议复核项，不用于认定计划真实性。</p></footer></section>`;
  }
  function WaterfallCard(model) {
    const series = model.waterfall.series;
    const max = Math.max(...series.map(item => Math.abs(item.value)), 1);
    return `<article class="v2-card v2-waterfall"><header><h2>掉量分析 <small>（本期 vs 上期）</small></h2></header><p>${model.metric.label}变化：<strong data-tone="${model.waterfall.totalChange >= 0 ? 'up' : 'down'}">${formatValue(model.waterfall.totalChange, model.metric, true)}（${pct(model.waterfall.changeRate)}）</strong></p><div class="v2-waterfall-chart">${series.map(item => `<div><b style="height:${Math.max(8, Math.abs(item.value) / max * 100)}%" data-kind="${item.kind}"></b><span>${item.value >= 0 && item.kind !== 'total' ? '+' : ''}${formatValue(item.value, model.metric, true)}</span><small>${item.name}</small></div>`).join('')}</div>${AnalysisFooter(chartById(model, 'waterfall'))}</article>`;
  }
  function DepartmentDistributionCard(model) {
    const colors = ['#07875f', '#2f7ee6', '#55a5ec', '#f2a43a', '#dfe5e6'];
    const items = model.departments.slice(0, 5);
    const total = items.reduce((value, item) => value + item.value, 0);
    return `<article class="v2-card v2-donut-card"><header><h2>科室分析 <small>（按${esc(model.metric.label)}）</small></h2></header>${items.length ? `<div class="v2-donut-layout"><div class="v2-donut" style="--donut:${donutGradient(items, colors)}"></div><ul>${items.map((item, index) => `<li><i style="background:${colors[index]}"></i><span title="${esc(item.name)}">${esc(item.name)}</span><strong>${total ? (item.value / total * 100).toFixed(1) : 0}%</strong></li>`).join('')}</ul></div>` : ChartEmptyState('当前范围暂无科室数据')}${AnalysisFooter(chartById(model, 'department-distribution'))}</article>`;
  }
  function OrderSizeCard(model) {
    const max = Math.max(...model.orderBuckets.map(item => item.count), 1);
    const chart = chartById(model, 'average-order');
    return `<article class="v2-card v3-order-size"><header><h2>单笔订单盒数分析</h2><strong>平均 ${model.summary.avgOrder.toFixed(1)}盒</strong></header><div>${model.orderBuckets.map(item => `<span><i style="height:${Math.max(3, item.count / max * 100)}%"></i><small>${esc(item.label)}</small></span>`).join('')}</div>${AnalysisFooter(chart)}</article>`;
  }
  function alertMetric(value, unit = '') {
    if (value === null || value === undefined) return '—';
    return `${new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 1
    }).format(finite(value))}${unit}`;
  }
  function alertEvidenceMarkup(alert) {
    return `<div class="v5-alert-evidence">${(alert.evidence || []).map(item => `<article><span>${esc(item.label)}</span><strong>${esc(alertMetric(item.value, item.unit || ''))}</strong></article>`).join('')}</div>`;
  }
  function alertChangeRows(rows = [], primaryLabel = '对象') {
    return rows.length ? `<div class="v5-alert-table"><header><span>${esc(primaryLabel)}</span><span>上期</span><span>本期</span><span>变化</span></header>${rows.map(item => `<p><strong title="${esc(item.name)}">${esc(item.name)}</strong><span>${alertMetric(item.previous, '盒')}</span><span>${alertMetric(item.current, '盒')}</span><span data-tone="${item.change < 0 ? 'down' : 'up'}">${item.change > 0 ? '+' : ''}${alertMetric(item.change, '盒')}</span></p>`).join('')}</div>` : '<p class="v5-alert-detail-empty">当前数据不足以继续下钻。</p>';
  }
  function alertTargetRows(rows = [], primaryLabel = '对象') {
    return rows.length ? `<div class="v5-alert-table"><header><span>${esc(primaryLabel)}</span><span>目标</span><span>实际</span><span>缺口</span></header>${rows.slice(0, 10).map(item => `<p><strong title="${esc(item.name)}">${esc(item.name)}</strong><span>${alertMetric(item.targetBoxes, '盒')}</span><span>${alertMetric(item.actualBoxes, '盒')}</span><span data-tone="${item.gapBoxes > 0 ? 'down' : 'up'}">${alertMetric(item.gapBoxes, '盒')}</span></p>`).join('')}</div>` : '<p class="v5-alert-detail-empty">当前维度暂无目标明细。</p>';
  }
  function alertSpecificDetail(alert) {
    const detail = alert.details || {};
    if (detail.kind === 'hospital-decline' || detail.kind === 'stopped-output') return `<section><h3>科室变化</h3>${alertChangeRows(detail.breakdown?.departments, '科室')}</section><section><h3>关联员工</h3>${alertChangeRows(detail.breakdown?.employees, '员工')}</section>${detail.breakdown?.customers?.length ? `<section><h3>实际出单客户变化</h3>${alertChangeRows(detail.breakdown.customers, '客户')}</section>` : ''}`;
    if (detail.kind === 'employee-decline') return `<section><h3>医院变化</h3>${alertChangeRows(detail.breakdown?.hospitals, '医院')}</section><section><h3>科室变化</h3>${alertChangeRows(detail.breakdown?.departments, '科室')}</section>`;
    if (detail.kind === 'monthly-trend') return `<section><h3>连续月度趋势</h3><div class="v5-alert-months">${detail.periods.map((period, index) => `<article><span>${esc(period)}</span><strong>${alertMetric(detail.values[index], '盒')}</strong>${index ? `<small data-tone="${detail.deltas[index - 1] < 0 ? 'down' : 'up'}">${detail.deltas[index - 1] > 0 ? '+' : ''}${alertMetric(detail.deltas[index - 1], '盒')}</small>` : '<small>基期</small>'}</article>`).join('')}</div></section>`;
    if (detail.kind === 'concentration') return `<section><h3>贡献结构</h3>${detail.rankings?.length ? `<div class="v5-alert-ranking">${detail.rankings.map((item, index) => `<p><b>${index + 1}</b><span title="${esc(item.name)}">${esc(item.name)}</span><i><em style="width:${Math.min(100, finite(item.share) * 100)}%"></em></i><strong>${(finite(item.share) * 100).toFixed(1)}%</strong></p>`).join('')}</div>` : '<p>暂无排名数据。</p>'}</section>`;
    if (detail.kind === 'target-gap') return `<section><h3>医院目标缺口</h3>${alertTargetRows(detail.dimensions?.hospital, '医院')}</section><section><h3>科室目标缺口</h3>${alertTargetRows(detail.dimensions?.department, '科室')}</section><section><h3>客户计划缺口</h3>${alertTargetRows(detail.dimensions?.customer, '客户')}</section>`;
    if (detail.kind === 'customer-count') return '<section><h3>客户口径</h3><p>仅统计两期均具备可靠 customerId 的实际销售记录，不使用4+3计划客户数替代。</p></section>';
    if (detail.kind === 'customer-downgrade') return `<section><h3>销量等级变化</h3><div class="v5-alert-table"><header><span>客户ID</span><span>前期</span><span>本期</span><span>等级</span></header>${(detail.customers || []).map(item => `<p><strong>${esc(item.customerId)}</strong><span>${alertMetric(item.previousBoxes, '盒')}</span><span>${alertMetric(item.currentBoxes, '盒')}</span><span>${esc(item.previousGrade)} → ${esc(item.currentGrade)}</span></p>`).join('')}</div><p>R1–R4认知等级未参与本次销量等级判断。</p></section>`;
    if (detail.kind === 'returns') return '<section><h3>退货核对</h3><p>基于真实销售明细中的负向净销售盒数，与上一周期使用相同口径比较。</p></section>';
    if (detail.kind === 'visit-no-output') return '<section><h3>观察说明</h3><p>仅表示真实拜访登记后的当前周期尚未观察到销售产出，不据此认定拜访无效或客户流失。</p></section>';
    if (detail.kind === 'data-quality') return `<section><h3>数据异常明细</h3><ul class="v5-alert-issues">${(detail.issues || []).map(item => `<li><span>${esc(item.label)}</span><strong>${alertMetric(item.value, item.unit)}</strong></li>`).join('')}</ul></section>`;
    return '<section><h3>详情</h3><p>当前异常已保留证据字段，可按建议检查项继续人工复核。</p></section>';
  }
  function alertDetailMarkup(alert, model) {
    const periods = (alert.sourcePeriods || []).map(item => `${item.label} ${item.from}${item.to && item.to !== item.from ? ` 至 ${item.to}` : ''}`).join('；');
    return `<section class="v5-alert-detail" data-alert-type="${esc(alert.alertType)}"><header data-severity="${esc(alert.severity)}"><span>${esc(alert.severity)} · ${esc(alert.confidence)}置信度</span><h3>${esc(alert.title)}</h3><p>${esc(alert.subjectName)}</p></header>${alertEvidenceMarkup(alert)}${alertSpecificDetail(alert)}<section><h3>建议进一步核对</h3><ol>${(alert.recommendedChecks || []).map(item => `<li>${esc(item)}</li>`).join('')}</ol></section><footer><strong>数据依据</strong><p>来源：${esc((alert.sourceTypes || []).join(' / ') || '未标记')}<br>${esc(periods || model.range?.label || '')}</p><small>异常预警仅基于真实业务输入和可复核基准；不会使用任务进度、截止日期或完成状态生成经营异常。</small></footer></section>`;
  }
  function AlertCard(model) {
    const alerts = model.alerts || [];
    const customerNote = model.alertMeta?.customerSales === 'insufficient' ? `<small class="v5-alert-data-note">${esc(model.alertMeta.customerMessage)}</small>` : '';
    return `<article class="v2-card v2-alerts"><header><h2>${icon('alert')}异常预警</h2><button type="button" data-analysis-type="alert-analysis">查看全部 ${alerts.length}条 ›</button></header>${alerts.length ? alerts.slice(0, 6).map(item => `<div class="v5-alert-row" data-severity="${esc(item.severity)}"><span>${icon('alert')}</span><p><em>${esc(item.severity)} · ${esc(item.confidence)}</em><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small><small>来源：${esc((item.sourceTypes || []).join(' / '))}</small></p><button type="button" data-alert-id="${esc(item.alertId)}">查看详情 ›</button></div>`).join('') : `<div class="v2-alert-empty">当前筛选范围暂未发现明显经营异常。</div>`}${customerNote}</article>`;
  }
  function executionDimensionMarkup(label, rows = []) {
    return `<details class="v4-execution-dimension"><summary>${esc(label)}<span>${rows.length}项</span></summary>${rows.length ? `<div class="v4-execution-table"><header><span>对象</span><span>目标</span><span>实际</span><span>差距</span><span>达成率</span><span>状态</span></header>${rows.map(item => `<p><strong title="${esc(item.name)}">${esc(item.name)}</strong><span>${finite(item.targetBoxes).toFixed(1)}盒</span><span>${finite(item.actualBoxes).toFixed(1)}盒</span><span data-tone="${item.gapBoxes > 0 ? 'down' : 'up'}">${item.gapBoxes > 0 ? '-' : '+'}${Math.abs(finite(item.gapBoxes)).toFixed(1)}盒</span><span>${item.achievementRate === null ? '—' : `${(item.achievementRate * 100).toFixed(1)}%`}</span><em data-status="${esc(item.status)}">${esc(item.status)}</em></p>`).join('')}</div>` : '<p class="v4-execution-empty">当前筛选范围暂无数据</p>'}</details>`;
  }
  function executionDetailMarkup(model) {
    const execution = model.fourThreeExecution || {
      state: 'empty',
      totals: {},
      dimensions: {},
      resources: [],
      reasons: []
    };
    if (execution.state === 'empty') return '<section class="v4-execution-detail"><div class="v4-execution-empty-state"><strong>暂无可用 4+3 数据</strong><p>当前筛选范围没有员工计划记录，可在数据管理中导入 4+3 工作表。</p></div></section>';
    const totals = execution.totals;
    const stats = [['参与员工', totals.employees, '人'], ['计划客户', totals.plannedCustomers, '位'], ['目标盒数', totals.targetBoxes, '盒'], ['实际盒数', totals.actualBoxes, '盒'], ['达成率', totals.achievementRate === null ? null : totals.achievementRate * 100, '%'], ['已达成', totals.achieved, '项'], ['未达成', totals.notAchieved, '项'], ['数据缺失', totals.missing, '项']];
    const planRow = (item, kind) => `<li><span><strong>${esc(item.label || item.text)}</strong><small>记录${finite(item.records || item.count).toFixed(0)}项 · 员工${finite(item.employees).toFixed(0)}人 · 医院${finite(item.hospitals).toFixed(0)}家 · 科室${finite(item.departments).toFixed(0)}个 · 客户${finite(item.customers).toFixed(0)}位</small>${item.rawTexts?.length ? `<details><summary>查看原始填写</summary>${item.rawTexts.map(text => `<p>${esc(text)}</p>`).join('')}</details>` : ''}</span><b>${kind === 'reason' ? `缺口${finite(item.boxGap).toFixed(0)}盒` : `${finite(item.records || item.count).toFixed(0)}项`}</b></li>`;
    return `<section class="v4-execution-detail"><div class="v4-execution-stats">${stats.map(([label, value, unit]) => `<article><span>${esc(label)}</span><strong>${value === null || value === undefined ? '—' : `${finite(value).toFixed(unit === '%' ? 1 : 0)}${unit}`}</strong></article>`).join('')}</div>
      <section class="v4-execution-drilldown"><h3>目标执行明细</h3>${executionDimensionMarkup('按员工', execution.dimensions.employee)}${executionDimensionMarkup('按医院', execution.dimensions.hospital)}${executionDimensionMarkup('按科室', execution.dimensions.department)}${executionDimensionMarkup('按客户', execution.dimensions.customer)}</section>
      <section class="v4-execution-plan-section"><h3>资源计划 <small>员工提议，仅代表计划，不等同于实际活动效果</small></h3>${execution.resources.length ? `<ul>${execution.resources.map(item => planRow(item, 'resource')).join('')}</ul>` : '<p>当前筛选范围暂无资源计划。</p>'}</section>
      <section class="v4-execution-plan-section"><h3>未达标原因统计 <small>仅统计未达成记录，并保留原始文字</small></h3>${execution.reasons.length ? `<ul>${execution.reasons.map(item => planRow(item, 'reason')).join('')}</ul>` : '<p>当前筛选范围暂无未达标原因记录。</p>'}</section>
      <footer><strong>数据口径</strong><p>数据来自当前筛选范围内的真实 4+3 员工计划记录；目标、实际、差距和达成率统一按盒数统计。</p></footer></section>`;
  }
  function ExecutionProgressCard(model) {
    const execution = model.fourThreeExecution;
    return `<article class="v2-card v2-execution"><header><h2>四定表执行情况 <small>（真实 4+3 数据）</small></h2><button type="button" data-action="execution-detail" data-analysis-type="execution-analysis">查看详情 ›</button></header>${execution?.state === 'normal' ? `<div>${execution.summaryCards.map(item => `<section><span>${esc(item.label)}</span><strong>${finite(item.value).toFixed(0)}${esc(item.unit)}</strong><i><b style="width:${item.rate === null ? 0 : Math.min(100, item.rate * 100)}%"></b></i><small data-status="${esc(item.status)}">${esc(item.status)}</small></section>`).join('')}</div>` : '<div class="v4-execution-card-empty">当前筛选范围暂无 4+3 计划记录</div>'}</article>`;
  }
  function DataSourceStatus(model) {
    const pending = Number(model.unassignedHospitalRecords) || 0;
    return `<footer class="v2-data-notes"><span>数据说明：1. 主营销售额按净盒数 × 产品单价计算。 2. 财年周期：每年10月–次年9月。 3. 所有模块使用同一筛选 Context。${pending ? ` 医院归属待确认 ${pending} 条：保留总体销售额，不计入具体医院。` : ''}</span><span>数据来源：企业微信智能表格 / Excel 兜底　数据更新时间：${esc(model.fiscal.cutoffDate)} 12:00</span></footer>`;
  }
  function renderAlertDetail(alert, model) {
    return alertDetailMarkup(alert, model);
  }
  const DETAIL_TABLE_KEYS = {
    'fiscal-monthly-turning': ['period', 'previous', 'current', 'delta', 'officeOne', 'officeTwo'],
    'fiscal-turning-hospitals': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'fiscal-turning-departments': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'fiscal-turning-employees': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'yoy-hospital-growth': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'yoy-hospital-decline': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'yoy-employee-growth': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'yoy-employee-decline': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'mom-hospital-growth': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'mom-hospital-decline': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'mom-employee-growth': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'mom-employee-decline': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'target-employees': ['subject', 'target', 'actual', 'gap', 'achievementRate', 'status'],
    'target-hospitals': ['subject', 'target', 'actual', 'gap', 'achievementRate', 'status'],
    'target-customers': ['customer', 'target', 'actual', 'status', 'source'],
    'decline-hospitals': ['hospital', 'previous', 'current', 'delta', 'deltaRate', 'lossContributionRate', 'previousCustomers', 'currentCustomers', 'customerDelta', 'status', 'reasonCategory'],
    'decline-departments': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'decline-employees': ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    'hospital-summary': ['hospital', 'current', 'share', 'yoy', 'mom', 'departments', 'employees', 'customers', 'status'],
    'employee-summary': ['employee', 'current', 'share', 'yoy', 'mom', 'target', 'achievementRate', 'fitScore', 'alerts', 'status'],
    'department-summary': ['hospital', 'department', 'current', 'share', 'yoy', 'mom', 'employees', 'customers', 'status'],
    'customer-level-change': ['level', 'previous', 'current', 'delta', 'share'],
    'customer-upgraded': ['customer', 'previousGrade', 'currentGrade', 'previousBoxes', 'currentBoxes', 'delta'],
    'customer-downgraded': ['customer', 'previousGrade', 'currentGrade', 'previousBoxes', 'currentBoxes', 'delta'],
    'customer-near-upgrade': ['customer', 'currentBoxes', 'nextGrade', 'upgradeGap'],
    'customer-upgrade-opportunities': ['customer', 'currentGrade', 'currentBoxes', 'nextGrade', 'threshold', 'gap', 'trend', 'targetBoxes', 'targetSource', 'employee', 'hospital', 'department', 'planStatus', 'actualState'],
    'order-distribution': ['label', 'count', 'share', 'value'],
    'order-hospitals': ['hospital', 'orders', 'boxes', 'average'],
    'order-employees': ['employee', 'orders', 'boxes', 'average'],
    'execution-employees': ['subject', 'target', 'actual', 'gap', 'achievementRate', 'status'],
    'execution-hospitals': ['subject', 'target', 'actual', 'gap', 'achievementRate', 'status'],
    'execution-departments': ['subject', 'target', 'actual', 'gap', 'achievementRate', 'status'],
    'execution-customers': ['subject', 'target', 'actual', 'gap', 'achievementRate', 'status'],
    'execution-resources': ['label', 'records', 'employees', 'hospitals', 'departments', 'customers'],
    'execution-reasons': ['label', 'records', 'boxGap'],
    'alert-list': ['alertType', 'subject', 'title', 'severity', 'confidence', 'sources'],
    department: ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    employee: ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    customer: ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    departments: ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    employees: ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    customers: ['subject', 'baseline', 'current', 'delta', 'deltaRate'],
    hospitals: ['subject', 'baseline', 'current', 'delta', 'deltaRate']
  };
  function detailValue(value, key = '') {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? item.label || item.title || item.value : item).filter(Boolean).join('、') || '—';
    if (typeof value === 'number') {
      if (/percent|rate|share|yoy|mom/i.test(key)) return `${(value * 100).toFixed(1)}%`;
      if (/fitScore/i.test(key)) return `${value.toFixed(1)}分`;
      return new Intl.NumberFormat('zh-CN', {
        maximumFractionDigits: 1
      }).format(value);
    }
    return String(value);
  }
  function detailSummaryCards(analysis) {
    return `<div class="v6-detail-cards">${(analysis.summaryCards || []).map(item => `<article><span>${esc(item.label)}</span><strong>${esc(detailValue(item.value, item.format || ''))}${item.value === null || item.value === undefined ? '' : esc(item.format === 'percent' ? '' : item.unit || '')}</strong>${item.delta === null || item.delta === undefined ? '' : `<small data-tone="${item.delta < 0 ? 'down' : 'up'}">较上期 ${item.delta > 0 ? '+' : ''}${esc(detailValue(item.delta))}</small>`}</article>`).join('')}</div>`;
  }
  function detailFindings(analysis, title = '主要发现') {
    if (!analysis.findings?.length) return '<div class="v6-detail-empty">当前数据不足，暂未生成有依据的发现。</div>';
    return `<section class="v6-detail-findings"><h3>${esc(title)}</h3><ol>${analysis.findings.map(item => `<li data-severity="${esc(item.severity)}"><div><b>${esc(item.title)}</b><small>${Math.round(finite(item.confidence, 0) * 100)}% 置信度</small></div><p>${esc(item.conclusion)}</p>${item.evidence?.length ? `<ul>${item.evidence.map(evidence => `<li>${esc(typeof evidence === 'object' ? evidence.label ? `${evidence.label}：${detailValue(evidence.value)}${evidence.unit || ''}` : JSON.stringify(evidence) : evidence)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol></section>`;
  }
  function detailTableMarkup(table, keyOverride = null) {
    const rows = table?.rows || [];
    const keys = keyOverride || DETAIL_TABLE_KEYS[table?.tableId] || Object.keys(rows[0] || {}).filter(key => !/Id$/.test(key) && !['rows', 'monthly', 'tables', 'fit', 'alerts'].includes(key)).slice(0, table?.columns?.length || 8);
    return `<section class="v6-detail-table" data-table-id="${esc(table?.tableId || '')}"><h3>${esc(table?.title || '')}</h3>${rows.length ? `<div><table><thead><tr>${(table.columns || keys).map(column => `<th>${esc(typeof column === 'string' ? column : column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${keys.map(key => `<td data-key="${esc(key)}">${esc(detailValue(row[key], key))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="v6-detail-empty">当前层级暂无可靠数据。</p>'}</section>`;
  }
  function detailLimitations(analysis) {
    return `${analysis.limitations?.length ? `<section class="v6-detail-limitations"><h3>数据限制</h3><ul>${analysis.limitations.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>` : ''}<footer class="v6-detail-methodology"><strong>统计口径</strong><p>${esc(analysis.methodology)}</p></footer>`;
  }
  function detailSectionDrilldowns(analysis) {
    return (analysis.sections || []).filter(section => section.tables?.length).map(section => `<details class="v6-detail-drilldown"><summary><span>${esc(section.title)}</span><small>${esc(section.summary || '点击查看下钻')}</small></summary>${section.reasonCategory ? `<p class="v6-reason-label">数据分类：${esc(section.reasonCategory)}</p>` : ''}${section.monthly?.length ? `<div class="v6-monthly-strip">${section.monthly.map(item => `<span><small>${esc(item.period?.slice(5) || item.period)}</small><b>${esc(detailValue(item.value))}</b></span>`).join('')}</div>` : ''}${section.tables.map(table => detailTableMarkup(table)).join('')}</details>`).join('');
  }
  function detailFrame(analysis, body) {
    return `<article class="v6-analysis-detail" data-analysis-type="${esc(analysis.analysisType)}"><p class="v6-analysis-headline">${esc(analysis.headline)}</p>${body}${detailLimitations(analysis)}</article>`;
  }
  function renderFiscalTrendDetail(analysis) {
    const run = analysis.sections?.find(item => item.sectionId === 'runs')?.data || {};
    return detailFrame(analysis, `${detailSummaryCards(analysis)}<section class="v6-trend-diagnosis"><h3>趋势诊断</h3><div><span>连续增长 <b>${finite(run.continuousGrowth)}个月</b></span><span>连续下降 <b>${finite(run.continuousDecline)}个月</b></span><span>最大增长月 <b>${esc(run.largestGrowthPeriod || '—')}</b></span><span>最大掉量月 <b>${esc(run.largestDeclinePeriod || '—')}</b></span></div></section>${detailFindings(analysis, '财年趋势发现')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}`);
  }
  function renderComparisonDetail(analysis) {
    const blocks = (analysis.sections || []).map(section => `<section class="v6-comparison-block" data-comparison="${esc(section.sectionId)}"><h3>${esc(section.title)}</h3><div><span>本期<b>${esc(detailValue(section.data.current))}</b></span><span>基期<b>${esc(detailValue(section.data.baseline))}</b></span><span>变化<b>${esc(detailValue(section.data.delta))}</b></span><span>变化率<b>${esc(detailValue(section.data.deltaRate, 'rate'))}</b></span></div>${analysis.tables.filter(table => table.tableId.startsWith(section.sectionId)).map(table => detailTableMarkup(table)).join('')}</section>`).join('');
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '同比与环比判断')}${blocks}`);
  }
  function renderTargetDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '达标推演')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}`);
  }
  function renderDeclineDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '掉量优先级')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}<section class="v6-detail-sections"><h3>医院下钻</h3>${detailSectionDrilldowns(analysis)}</section>`);
  }
  function renderHospitalDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '医院状态判断')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}<section class="v6-detail-sections"><h3>医院 → 科室 → 员工 → 客户</h3>${detailSectionDrilldowns(analysis)}</section>`);
  }
  function renderEmployeeDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '员工经营判断')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}<section class="v6-detail-sections"><h3>员工 → 医院 → 客户</h3>${detailSectionDrilldowns(analysis)}</section>`);
  }
  function renderDepartmentDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '科室结构判断')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}<section class="v6-detail-sections"><h3>医院内科室下钻</h3>${detailSectionDrilldowns(analysis)}</section>`);
  }
  function renderCustomerStructureDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '等级结构变化')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}`);
  }
  function renderCustomerUpgradeDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '升级优先对象')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}`);
  }
  function renderOrderDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '订单分布判断')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}`);
  }
  function renderExecutionAnalysisDetail(analysis, model) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${executionDetailMarkup(model)}${detailFindings(analysis, '员工填写的未达标原因')}`);
  }
  function renderAlertAnalysisDetail(analysis) {
    return detailFrame(analysis, `${detailSummaryCards(analysis)}${detailFindings(analysis, '有证据的经营异常')}${analysis.tables.map(table => detailTableMarkup(table)).join('')}`);
  }
  function renderAnalysisByType(analysis, model) {
    const renderers = {
      'fiscal-trend': renderFiscalTrendDetail,
      'period-comparison': renderComparisonDetail,
      'target-achievement': renderTargetDetail,
      'decline-analysis': renderDeclineDetail,
      'hospital-analysis': renderHospitalDetail,
      'employee-analysis': renderEmployeeDetail,
      'department-analysis': renderDepartmentDetail,
      'customer-structure': renderCustomerStructureDetail,
      'customer-upgrade': renderCustomerUpgradeDetail,
      'order-size': renderOrderDetail,
      'execution-analysis': value => renderExecutionAnalysisDetail(value, model),
      'alert-analysis': renderAlertAnalysisDetail
    };
    return renderers[analysis?.analysisType]?.(analysis) || '<div class="v6-detail-empty">当前栏目尚无专属分析器。</div>';
  }
  function renderMarketSummaryDetail(model) {
    return `<article class="v6-market-summary-detail"><ol>${(model.marketSummary.detailedAnalysis || ['暂无可用详细分析。']).map((item, index) => `<li><b>${index + 1}</b><p>${esc(item)}</p></li>`).join('')}</ol><footer><strong>统计口径</strong><p>${esc(model.methodology)}</p></footer></article>`;
  }
  function AnalysisDrawer(model) {
    return `<dialog class="v3-analysis-drawer"><form method="dialog"><header><div><small>当前筛选：FY${model.fiscal.fiscalYear}${model.fiscal.fiscalQuarter ? ` · Q${model.fiscal.fiscalQuarter}` : ''}${model.fiscal.month ? ` · ${model.fiscal.month}月` : ''} · ${esc(model.filters.product)} · 截至${esc(model.fiscal.cutoffDate)}</small><h2 data-analysis-title>市场多维分析报告</h2></div><button value="cancel" aria-label="关闭">×</button></header><div data-analysis-body></div></form></dialog>`;
  }
  function KpiPicker() {
    const selected = new Set(layout());
    return `<dialog class="v2-kpi-picker"><form method="dialog"><header><h2>添加指标</h2><button value="cancel" aria-label="关闭">×</button></header><div>${Object.entries(KPI_LIBRARY).map(([id, item]) => `<button type="button" data-add-kpi-id="${id}"${selected.has(id) ? ' disabled' : ''}>${icon(item.icon)}<span>${item.label}</span></button>`).join('')}</div></form></dialog>`;
  }
  function DashboardRail() {
    const items = [['总览', 'top'], ['销售分析', 'trend'], ['客户分析', 'customers'], ['员工分析', 'employees'], ['活动分析', 'execution'], ['汇报模式', 'report'], ['数据管理', 'data']];
    return `<aside class="v2-rail">${items.map(([label, target], index) => `<button type="button" data-nav="${target}" class="${index === 0 ? 'active' : ''}">${icon(index === 0 ? 'dashboard' : index === 6 ? 'database' : index === 5 ? 'export' : index === 3 ? 'users' : 'sales')}<span>${label}</span></button>`).join('')}<button type="button" data-action="back" class="v2-rail-back">${icon('back')}<span>返回日程</span></button></aside>`;
  }
  function render(rootElement, model) {
    if (model.performanceScope === 'AUXILIARY_NON_PERSONAL') {
      rootElement.innerHTML = `<div class="v2-shell"><div class="v2-content" id="v2-top"><header class="v2-header"><button type="button" data-action="back">返回活动</button><h1>${esc(model.filters.product)} · 辅助产品</h1><button type="button" data-action="data">来源明细</button></header><section class="v2-card"><h2>辅助产品 · 不计个人业绩</h2><p>数据不足：辅助产品来源明细用于医院、客户、活动和费用关联，不进入个人销量、销售额、目标达成、同比或预测。协助口径费效比需要可靠的外部或团队销售分母。</p></section></div></div>`;
      return;
    }
    rootElement.innerHTML = `<div class="v2-shell">${DashboardRail()}<div class="v2-content" id="v2-top">${DashboardHeader(model)}${DashboardFilterBar(model)}${EditableKpiGrid(model)}${InsightPanel(model)}<section class="v3-core-grid" id="v2-trend">${SalesTrendCard(model)}${ComparisonTrendCard(model)}</section><section class="v3-compact-grid" id="v2-customers">${TargetProgressCard(model)}${ProductAchievementCard(model)}${RankingCard(model, 'hospital')}<div id="v2-employees">${RankingCard(model, 'employee')}</div>${DepartmentDistributionCard(model)}${CustomerLevelCard(model)}${CustomerUpgradeCard(model)}${OrderSizeCard(model)}${WaterfallCard(model)}</section><section class="v2-bottom-grid" id="v2-execution">${AlertCard(model)}${ExecutionProgressCard(model)}</section>${DataSourceStatus(model)}</div>${KpiPicker()}${AnalysisDrawer(model)}</div>`;
  }
  function bind(rootElement, model, callbacks) {
    rootElement.onchange = event => {
      const key = event.target.dataset.filter;
      if (!key) return;
      const raw = event.target.value;
      const value = ['fiscalYear', 'fiscalQuarter', 'month'].includes(key) ? raw ? Number(raw) : null : raw;
      const filters = {
        ...model.filters,
        [key]: value
      };
      if (key === 'month' && value) {
        const calendarYear = value >= 10 ? Number(filters.fiscalYear) - 1 : Number(filters.fiscalYear);
        filters.fiscalQuarter = root.QuarterlyReporting?.resolveFiscalPeriod?.(`${calendarYear}-${String(value).padStart(2, '0')}-01`)?.fiscalQuarter;
      }
      if (key === 'fiscalQuarter') filters.month = null;
      callbacks.onFilters?.(filters);
    };
    rootElement.onclick = event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'data') callbacks.onData?.();
      if (action === 'report') callbacks.onReport?.();
      if (action === 'refresh') callbacks.onRefresh?.();
      if (action === 'upgrade-manage') callbacks.onUpgradeManage?.();
      if (action === 'back') callbacks.onBack?.();
      if (action === 'more-filters') {
        state.moreFilters = !state.moreFilters;
        renderAndBind(rootElement, model, callbacks);
      }
      if (action === 'clear-filters') callbacks.onFilters?.({
        comparison: 'yoy',
        product: 'all',
        office: 'all',
        hospital: 'all',
        department: 'all',
        employee: 'all'
      });
      if (action === 'reset-kpis') {
        saveLayout(DEFAULT_KPIS);
        state.editKpis = false;
        renderAndBind(rootElement, model, callbacks);
      }
      if (action === 'add-kpi') rootElement.querySelector('.v2-kpi-picker')?.showModal();
      if (action === 'remove-kpi') {
        const id = event.target.closest('[data-kpi-id]')?.dataset.kpiId;
        saveLayout(layout().filter(item => item !== id));
        renderAndBind(rootElement, model, callbacks);
      }
      const clearFilter = event.target.closest('[data-clear-filter]')?.dataset.clearFilter;
      if (clearFilter) callbacks.onFilters?.({
        ...model.filters,
        [clearFilter]: null,
        ...(clearFilter === 'fiscalQuarter' ? {
          month: null
        } : {})
      });
      const selectedProduct = event.target.closest('[data-product-switch]')?.dataset.productSwitch;
      if (selectedProduct) callbacks.onFilters?.({
        ...model.filters,
        product: selectedProduct
      });
      const customerGrade = event.target.closest('[data-customer-grade]')?.dataset.customerGrade;
      if (customerGrade) {
        state.customerGradeFilter = state.customerGradeFilter === customerGrade ? '' : customerGrade;
        renderAndBind(rootElement, model, callbacks);
      }
      const add = event.target.closest('[data-add-kpi-id]')?.dataset.addKpiId;
      if (add) {
        saveLayout([...layout(), add]);
        renderAndBind(rootElement, model, callbacks);
      }
      const rankingButton = event.target.closest('[data-ranking-mode]');
      if (rankingButton) {
        const dimension = rankingButton.closest('[data-ranking]').dataset.ranking;
        state.ranking[dimension] = rankingButton.dataset.rankingMode;
        renderAndBind(rootElement, model, callbacks);
      }
      const fitOrder = event.target.closest('[data-fit-order]')?.dataset.fitOrder;
      if (fitOrder) {
        state.employeeFitOrder = fitOrder;
        renderAndBind(rootElement, model, callbacks);
      }
      const grain = event.target.closest('[data-trend-grain]')?.dataset.trendGrain;
      if (grain) {
        state.trendGrain = grain;
        renderAndBind(rootElement, model, callbacks);
      }
      const type = event.target.closest('[data-trend-type]')?.dataset.trendType;
      if (type) {
        state.trendType = type;
        renderAndBind(rootElement, model, callbacks);
      }
      const product = event.target.closest('[data-trend-product]')?.dataset.trendProduct;
      if (product) callbacks.onFilters?.({
        ...model.filters,
        product
      });
      const office = event.target.closest('[data-trend-office]')?.dataset.trendOffice;
      if (office) callbacks.onFilters?.({
        ...model.filters,
        office
      });
      const nav = event.target.closest('[data-nav]')?.dataset.nav;
      if (nav === 'report') callbacks.onReport?.();else if (nav === 'data') callbacks.onData?.();else if (nav) rootElement.querySelector(`#v2-${nav}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      const analysisButton = event.target.closest('[data-analysis-type],[data-analysis-id]');
      const analysisId = analysisButton?.dataset.analysisId;
      const analysisType = analysisButton?.dataset.analysisType || chartById(model, analysisId)?.analysisType;
      if (analysisButton) {
        const drawer = rootElement.querySelector('.v3-analysis-drawer');
        if (!drawer) return;
        delete drawer.dataset.alertType;
        if (analysisId === 'market-summary') {
          drawer.dataset.detailKind = 'market-summary';
          drawer.querySelector('[data-analysis-title]').textContent = '市场多维分析报告';
          drawer.querySelector('[data-analysis-body]').innerHTML = renderMarketSummaryDetail(model);
        } else {
          const analysis = model.analyses?.[analysisType];
          drawer.dataset.detailKind = analysisType || 'unavailable';
          drawer.querySelector('[data-analysis-title]').textContent = analysis?.title || '详细分析';
          drawer.querySelector('[data-analysis-body]').innerHTML = renderAnalysisByType(analysis, model);
        }
        drawer.showModal();
      }
      const alertId = event.target.closest('[data-alert-id]')?.dataset.alertId;
      if (alertId) {
        const alert = model.alerts?.find(item => item.alertId === alertId);
        const drawer = rootElement.querySelector('.v3-analysis-drawer');
        if (!alert || !drawer) return;
        drawer.dataset.detailKind = 'alert';
        drawer.dataset.alertType = alert.alertType;
        drawer.querySelector('[data-analysis-title]').textContent = '经营异常详情';
        drawer.querySelector('[data-analysis-body]').innerHTML = renderAlertDetail(alert, model);
        drawer.showModal();
      }
      if (action === 'execution-detail' && !event.target.closest('[data-analysis-type]')) {
        const drawer = rootElement.querySelector('.v3-analysis-drawer');
        if (!drawer) return;
        drawer.dataset.detailKind = 'execution';
        delete drawer.dataset.alertType;
        drawer.querySelector('[data-analysis-title]').textContent = '四定表执行详情';
        drawer.querySelector('[data-analysis-body]').innerHTML = executionDetailMarkup(model);
        drawer.showModal();
      }
      const employeeFitId = event.target.closest('[data-employee-fit]')?.dataset.employeeFit;
      if (employeeFitId) {
        const item = model.employeePlanFit?.ranking.find(entry => entry.employeeId === employeeFitId);
        const drawer = rootElement.querySelector('.v3-analysis-drawer');
        if (!item || !drawer) return;
        delete drawer.dataset.detailKind;
        delete drawer.dataset.alertType;
        drawer.querySelector('[data-analysis-title]').textContent = '员工计划 vs 实际';
        drawer.querySelector('[data-analysis-body]').innerHTML = employeeFitDetailMarkup(item, model);
        drawer.showModal();
      }
    };
    let longPress;
    rootElement.querySelectorAll('[data-kpi-id]').forEach(card => {
      card.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        longPress = setTimeout(() => {
          state.editKpis = true;
          navigator.vibrate?.(12);
          renderAndBind(rootElement, model, callbacks);
        }, 520);
      });
      ['pointerup', 'pointercancel', 'pointermove'].forEach(name => card.addEventListener(name, () => clearTimeout(longPress)));
    });
    let dragged = null;
    rootElement.querySelectorAll('.v2-kpi-drag').forEach(handle => handle.addEventListener('pointerdown', event => {
      if (!state.editKpis) return;
      event.preventDefault();
      dragged = handle.closest('[data-kpi-id]');
      dragged.classList.add('dragging');
      handle.setPointerCapture?.(event.pointerId);
    }));
    rootElement.onpointermove = event => {
      if (!dragged) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-kpi-id]');
      if (target && target !== dragged) target.parentElement.insertBefore(dragged, target.getBoundingClientRect().left < event.clientX ? target.nextSibling : target);
    };
    rootElement.onpointerup = () => {
      if (!dragged) return;
      dragged.classList.remove('dragging');
      dragged = null;
      saveLayout([...rootElement.querySelectorAll('[data-kpi-id]')].map(card => card.dataset.kpiId));
    };
  }
  function renderAndBind(rootElement, model, callbacks) {
    render(rootElement, model);
    bind(rootElement, model, callbacks);
  }
  function mount(rootElement, model, callbacks = {}) {
    renderAndBind(rootElement, model, callbacks);
  }
  function closeTopLayer(rootElement) {
    const drawer = rootElement?.querySelector?.('.v3-analysis-drawer[open]');
    if (!drawer) return false;
    drawer.close();
    return true;
  }
  root.SalesDashboardV2 = {
    mount,
    closeTopLayer,
    components: {
      DashboardHeader,
      DashboardFilterBar,
      EditableKpiGrid,
      KpiCard,
      AddKpiCard,
      InsightPanel,
      TargetProgressCard,
      SalesTrendCard,
      ComparisonTrendCard,
      ProductAchievementCard,
      CustomerLevelCard,
      CustomerUpgradeCard,
      RankingCard,
      OrderSizeCard,
      WaterfallCard,
      DepartmentDistributionCard,
      AlertCard,
      ExecutionProgressCard,
      DataSourceStatus,
      ChartEmptyState,
      ChartLegend
    }
  };
  root.SalesDashboardV3 = root.SalesDashboardV2;
})(typeof globalThis !== 'undefined' ? globalThis : window);
