(function initQuarterlyPpt(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuarterlyPpt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function quarterlyPptFactory() {
  'use strict';

  const COLORS = {
    green: '087F63',
    green2: '10A37F',
    mint: 'DDF3EB',
    pale: 'F3F7F5',
    ink: '15211E',
    gray: '65736F',
    line: 'DCE6E2',
    blue: '357AE8',
    orange: 'E77728',
    red: 'D94B4B',
    white: 'FFFFFF'
  };
  const PRODUCT_NAMES = {
    primaryProductA: "Primary Product A",
    primaryProductB: "Primary Product B"
  };
  const SLIDE_IDS = ['cover', 'executive-summary', 'sales-kpis', 'fiscal-sales-trend', 'yoy-mom-analysis', 'target-gap', 'growth-drivers', 'loss-drivers', 'hospital-ranking', 'hospital-change', 'hospital-small-multiples', 'employee-ranking', 'employee-trend', 'employee-small-multiples', 'employee-segmentation', 'employee-plan-fit', 'performance-fit-matrix', 'department-distribution', 'customer-levels', 'customer-upgrades', 'average-order', 'order-depth-trend', 'core-problems', 'execution-review', 'activity-review', 'risks', 'next-actions', 'data-completeness', 'employee-fit-detail', 'hospital-loss-detail'];
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const trace = (event, details = {}) => {
    try {
      globalThis.recordSafeDiagnostic?.(event, details);
    } catch {}
  };
  const percent = value => value === null || value === undefined ? '暂无基期' : `${value >= 0 ? '+' : ''}${(finite(value) * 100).toFixed(1)}%`;
  const productName = id => PRODUCT_NAMES[id] || String(id || '当前产品');
  const productId = value => value === "Primary Product A" ? "Primary Product A" : value === "Primary Product B" ? "Primary Product B" : String(value || '');
  const formatValue = (value, unit) => {
    const n = finite(value);
    if (unit === '元' && Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万元`;
    return `${n.toLocaleString('zh-CN', {
      maximumFractionDigits: 1
    })}${unit || ''}`;
  };
  const findChart = (model, id) => model.charts.find(chart => chart.chartId === id) || null;
  const conclusions = (chart, fallback = []) => {
    const list = [chart?.summary, ...(chart?.detailedAnalysis || []), ...fallback].filter(Boolean);
    return [...new Set(list)].slice(0, 4);
  };
  const periodLabel = model => `FY${model.fiscal.fiscalYear} Q${model.fiscal.fiscalQuarter} · ${model.range.from}—${model.range.to}`;
  const findingLines = (items = [], limit = 4) => items.slice(0, limit).map(item => item.conclusion || String(item));
  function makeSlide(model, id, title, chart, options = {}) {
    return {
      id,
      title,
      period: periodLabel(model),
      product: productName(model.filters.product),
      metric: model.metric,
      summary: chart?.summary || options.summary || '当前筛选范围暂无可用结论。',
      conclusions: conclusions(chart, options.conclusions),
      chart,
      kind: options.kind || chart?.chartType || 'text',
      coreNumbers: options.coreNumbers || [],
      payload: options.payload || null
    };
  }
  function buildDeckModel(model) {
    if (!model || model.schemaVersion !== 3 || !Array.isArray(model.charts)) throw new Error('PPT 生成需要 reporting.js schemaVersion 3 数据契约');
    if (!model.deepAnalysis || model.deepAnalysis.schemaVersion !== 1) throw new Error('PPT 深度分析 V2 需要 reporting.js deepAnalysis 契约');
    const selectedProductId = productId(model.filters.product);
    if (!["Primary Product A", "Primary Product B"].includes(selectedProductId)) throw new Error("\u5B63\u5EA6 PPT \u5FC5\u987B\u9009\u62E9Primary Product A\u6216Primary Product B\u5355\u4E00\u4EA7\u54C1");
    const unit = model.metric.unit;
    const chart = id => findChart(model, id);
    const deep = model.deepAnalysis;
    const slides = [makeSlide(model, 'cover', `${productName(model.filters.product)}季度销售汇报`, null, {
      kind: 'cover',
      summary: `${periodLabel(model)}｜经营复盘、问题诊断、计划验证与行动部署`,
      coreNumbers: [{
        label: model.metric.label,
        value: formatValue(model.summary.value, unit)
      }]
    }), makeSlide(model, 'executive-summary', '本季度经营摘要', null, {
      kind: 'findings',
      summary: deep.executiveSummary[0]?.conclusion || '当前范围暂无经营结论。',
      conclusions: findingLines(deep.executiveSummary, 8),
      payload: deep.executiveSummary
    }), makeSlide(model, 'sales-kpis', '销售指标及达成情况', chart('product-target'), {
      kind: 'kpis',
      coreNumbers: [{
        label: model.metric.label,
        value: formatValue(model.summary.value, unit)
      }, {
        label: '目标达成率',
        value: model.summary.targetRate === null ? '未设置' : `${(model.summary.targetRate * 100).toFixed(1)}%`
      }, {
        label: '同比',
        value: percent(model.summary.yoy)
      }, {
        label: '环比',
        value: percent(model.summary.mom)
      }, {
        label: '活跃医院',
        value: `${finite(model.summary.activeHospitals)}家`
      }, {
        label: '平均单笔',
        value: `${finite(model.summary.avgOrder).toFixed(1)}盒`
      }]
    }), makeSlide(model, 'fiscal-sales-trend', '财年销售趋势', chart('fiscal-sales-trend')), makeSlide(model, 'yoy-mom-analysis', '同比 / 环比分析', chart('yoy-mom-analysis')), makeSlide(model, 'target-gap', '目标缺口与达标预测', chart('quarter-target'), {
      kind: 'target-gap',
      summary: deep.targetGap.conclusion,
      conclusions: deep.targetDiagnosis.map(item => item.conclusion),
      payload: deep.targetGap
    }), makeSlide(model, 'growth-drivers', '增长来源拆解', chart('waterfall'), {
      kind: 'waterfall',
      summary: deep.growthDrivers[0] ? `${deep.growthDrivers[0].name}贡献${formatValue(deep.growthDrivers[0].value, unit)}。` : '当前没有可确认的增长来源。',
      payload: model.waterfall.series,
      conclusions: findingLines(deep.executiveSummary.filter(item => item.topic === 'growth'))
    }), makeSlide(model, 'loss-drivers', '掉量来源拆解', chart('waterfall'), {
      kind: 'waterfall',
      summary: deep.lossDrivers[0] ? `${deep.lossDrivers[0].name}影响${formatValue(Math.abs(deep.lossDrivers[0].value), unit)}。` : '当前没有可确认的掉量来源。',
      payload: model.waterfall.series,
      conclusions: findingLines(deep.coreProblems.filter(item => item.topic === 'loss'))
    }), makeSlide(model, 'hospital-ranking', '医院贡献与集中度', null, {
      kind: 'pareto',
      summary: `Top3医院贡献${(deep.hospitalDiagnosis.top3Share * 100).toFixed(1)}%。`,
      payload: deep.hospitalDiagnosis.pareto,
      conclusions: [deep.hospitalDiagnosis.concentrationRisk ? '医院集中度较高，需建立掉量预警并培育第二梯队。' : '医院贡献集中度处于可控范围。']
    }), makeSlide(model, 'hospital-change', '医院月度变化热力图', null, {
      kind: 'heatmap',
      summary: deep.hospitalDiagnosis.decline[0] ? `${deep.hospitalDiagnosis.decline[0].name}为最大医院掉量。` : '当前没有医院掉量。',
      payload: deep.hospitalDiagnosis.monthlyTrend,
      conclusions: deep.hospitalDiagnosis.decline.slice(0, 3).map(item => `${item.name}减少${formatValue(Math.abs(item.change), unit)}${item.responsibleEmployees[0] ? `，主要关联${item.responsibleEmployees[0].name}` : ''}。`)
    }), makeSlide(model, 'hospital-small-multiples', '重点医院月度趋势', null, {
      kind: 'small-multiples',
      summary: '分别观察重点医院的连续变化，避免总量排名掩盖月末拐点。',
      payload: deep.hospitalDiagnosis.monthlyTrend,
      conclusions: deep.hospitalDiagnosis.monthlyTrend.slice(0, 3).map(item => `${item.name}：${item.direction === 'continuous-decline' ? '连续下降' : item.direction === 'continuous-growth' ? '连续增长' : item.direction === 'volatile' ? '波动明显' : '相对稳定'}。`)
    }), makeSlide(model, 'employee-ranking', '员工贡献分析', chart('employee-ranking')), makeSlide(model, 'employee-trend', '员工月度变化热力图', null, {
      kind: 'heatmap',
      summary: deep.employeeMonthlyTrend.length ? '按当前产品和财季展示员工月度变化。' : '当前缺少员工月度趋势数据。',
      payload: deep.employeeMonthlyTrend,
      conclusions: deep.employeeMonthlyTrend.slice(0, 4).map(item => `${item.name}：${item.direction === 'continuous-decline' ? '连续下降' : item.direction === 'continuous-growth' ? '连续增长' : item.direction === 'volatile' ? '波动明显' : '相对稳定'}。`)
    }), makeSlide(model, 'employee-small-multiples', '重点员工月度趋势', null, {
      kind: 'small-multiples',
      summary: '重点员工各自成图，观察拐点、连续增长与连续掉量。',
      payload: deep.employeeMonthlyTrend,
      conclusions: deep.employeeMonthlyTrend.slice(0, 3).map(item => `${item.name}最近变化${item.latestChange >= 0 ? '+' : ''}${item.latestChange.toFixed(1)}${unit}。`)
    }), makeSlide(model, 'employee-segmentation', '员工头腰尾分层', null, {
      kind: 'segmentation',
      summary: '按周期下单盒数分为头部≥30盒、腰部10–30盒、尾部<10盒。',
      payload: deep.employeeSegmentation,
      conclusions: deep.employeeSegmentation.map(item => `${item.label}${item.count}人，贡献${item.value.toFixed(1)}盒，占${(item.share * 100).toFixed(1)}%。`)
    }), makeSlide(model, 'employee-plan-fit', '员工计划执行与拟合分析', null, {
      kind: 'plan-fit',
      summary: model.employeePlanFit.summary,
      payload: model.employeePlanFit,
      conclusions: model.employeePlanFit.detailedAnalysis
    }), makeSlide(model, 'performance-fit-matrix', '业绩 × 计划拟合四象限', null, {
      kind: 'fit-scatter',
      summary: '横轴为计划拟合度，纵轴为实际贡献；低拟合仅表示计划与实际一致性较低，需人工复核。',
      payload: deep.performanceFitMatrix,
      conclusions: ['A：高业绩+高拟合，重点参考对象。', 'B：高业绩+低拟合，业务能力较强但计划参考价值有限。', 'C：低业绩+高拟合，重点解决执行能力。', 'D：低业绩+低拟合，重点复核对象。']
    }), makeSlide(model, 'department-distribution', '科室月度结构', null, {
      kind: 'stacked-monthly',
      summary: deep.departmentDiagnosis.monthly?.length ? '按月份观察科室结构迁移。' : '当前缺少科室月度数据。',
      payload: deep.departmentDiagnosis.monthly,
      conclusions: chart('department-distribution')?.detailedAnalysis
    }), makeSlide(model, 'customer-levels', 'ABCD客户结构', chart('customer-levels'), {
      kind: 'customer-stairs',
      summary: chart('customer-levels')?.summary || '当前缺少客户分级数据。',
      payload: model.customers,
      coreNumbers: [{
        label: '客户总数',
        value: `${finite(model.customers.total)}位`
      }, {
        label: '等级待复核',
        value: `${finite(model.customers.mismatchCount)}位`
      }]
    }), makeSlide(model, 'customer-upgrades', '客户升级机会 TOP10', chart('customer-upgrades'), {
      kind: 'upgrade-opportunities',
      payload: model.upgrades.topOpportunities || [],
      coreNumbers: [{
        label: '可升级客户',
        value: `${finite(model.upgrades.summary?.upgradeable)}位`
      }, {
        label: '距离≤3盒',
        value: `${finite(model.upgrades.summary?.gapWithin3)}位`
      }]
    }), makeSlide(model, 'average-order', '单笔订单分布', chart('average-order'), {
      kind: 'histogram',
      coreNumbers: [{
        label: '平均单笔',
        value: `${finite(model.summary.avgOrder).toFixed(1)}盒`
      }]
    }), makeSlide(model, 'order-depth-trend', '月度订单深度', null, {
      kind: 'order-trend',
      summary: '销售量 = 订单数量 × 平均单笔；按月区分订单变少与订单变浅。',
      payload: deep.orderDepthDiagnosis.monthly,
      conclusions: deep.orderDepthDiagnosis.conclusions || []
    }), makeSlide(model, 'core-problems', '本季度核心问题诊断', null, {
      kind: 'findings',
      summary: deep.coreProblems[0]?.conclusion || '当前未识别高优先级问题。',
      payload: deep.coreProblems,
      conclusions: findingLines(deep.coreProblems)
    }), makeSlide(model, 'execution-review', '四定表执行复盘', null, {
      kind: 'execution',
      summary: deep.executionReview.some(item => item.rate !== null) ? '按计划—实际—差距—动作复盘四定执行。' : '四定表数据尚未设置。',
      payload: deep.executionReview,
      conclusions: deep.executionReview.map(item => `${item.label}：${item.diagnosis}`)
    }), makeSlide(model, 'activity-review', '活动 / 病例复盘', null, {
      kind: 'activity',
      summary: deep.activityReview.conclusion,
      payload: deep.activityReview,
      conclusions: [deep.activityReview.conclusion, '活动后观察到的销售变化不直接等同于活动造成的增长。']
    }), makeSlide(model, 'risks', '风险清单', null, {
      kind: 'findings',
      summary: deep.risks[0]?.conclusion || '当前未发现明显风险。',
      payload: deep.risks,
      conclusions: findingLines(deep.risks)
    }), makeSlide(model, 'next-actions', '下一季度重点行动建议', null, {
      kind: 'actions',
      summary: deep.nextQuarterActions.length ? `已按优先级生成${deep.nextQuarterActions.length}项可复盘动作。` : '当前缺少生成行动方案的数据依据。',
      payload: deep.nextQuarterActions,
      conclusions: deep.nextQuarterActions.slice(0, 4).map(item => `${item.priority} ${item.action}`)
    }), makeSlide(model, 'data-completeness', '数据完整度与分析限制', null, {
      kind: 'completeness',
      summary: deep.dataCompleteness.limitations.length ? `当前有${deep.dataCompleteness.limitations.length}项分析限制。` : '当前关键字段覆盖完整。',
      payload: deep.dataCompleteness,
      conclusions: deep.dataCompleteness.limitations
    }), makeSlide(model, 'employee-fit-detail', '附录：员工计划拟合明细', null, {
      kind: 'fit-detail',
      summary: '低拟合优先展示；低拟合不等同于虚假填写。',
      payload: model.employeePlanFit.ranking,
      conclusions: model.employeePlanFit.majorIssues.map(item => `${item.text}（${item.count}人）`)
    }), makeSlide(model, 'hospital-loss-detail', '附录：医院掉量责任链', null, {
      kind: 'hospital-loss-detail',
      summary: '按医院→科室→员工→计划拟合形成复核线索。',
      payload: deep.hospitalDiagnosis.decline,
      conclusions: deep.hospitalDiagnosis.decline.slice(0, 4).map(item => `${item.name}减少${formatValue(Math.abs(item.change), unit)}。`)
    })];
    if (slides.length !== SLIDE_IDS.length || slides.some((slide, index) => slide.id !== SLIDE_IDS[index])) throw new Error('季度 PPT 固定页面结构不完整');
    return {
      schemaVersion: 1,
      title: `${productName(selectedProductId)} FY${model.fiscal.fiscalYear} Q${model.fiscal.fiscalQuarter}季度汇报`,
      product: selectedProductId,
      productName: productName(selectedProductId),
      fiscalYear: model.fiscal.fiscalYear,
      fiscalQuarter: model.fiscal.fiscalQuarter,
      cutoffDate: model.fiscal.cutoffDate,
      period: periodLabel(model),
      metric: model.metric,
      sourceSchemaVersion: model.schemaVersion,
      sourceGeneratedAt: model.generatedAt,
      deepAnalysisSchemaVersion: deep.schemaVersion,
      slides,
      consistency: {
        value: model.summary.value,
        targetRate: model.summary.targetRate,
        yoy: model.summary.yoy,
        mom: model.summary.mom,
        activeHospitals: model.summary.activeHospitals,
        avgOrder: model.summary.avgOrder
      }
    };
  }
  function addText(slide, text, x, y, w, h, options = {}) {
    slide.addText(String(text ?? ''), {
      x,
      y,
      w,
      h,
      fontFace: 'Microsoft YaHei',
      fontSize: 14,
      color: COLORS.ink,
      margin: 0,
      breakLine: false,
      fit: 'shrink',
      valign: 'mid',
      ...options
    });
  }
  function addCard(slide, x, y, w, h, fill = COLORS.white) {
    slide.addShape('roundRect', {
      x,
      y,
      w,
      h,
      rectRadius: 0.08,
      fill: {
        color: fill
      },
      line: {
        color: COLORS.line,
        width: 0.8
      },
      shadow: {
        type: 'outer',
        color: 'CAD7D2',
        opacity: 0.12,
        blur: 1.5,
        angle: 45,
        distance: 1
      }
    });
  }
  function addLineSegment(slide, x1, y1, x2, y2, line) {
    slide.addShape('line', {
      x: x1,
      y: Math.min(y1, y2),
      w: Math.max(0.001, x2 - x1),
      h: Math.abs(y2 - y1),
      flipV: y2 < y1,
      line
    });
  }
  function addHeader(slide, spec, index) {
    addText(slide, spec.title, 0.55, 0.2, 9.8, 0.6, {
      fontSize: 35,
      bold: true,
      color: COLORS.ink
    });
    addText(slide, `${spec.product}｜${spec.period}`, 0.58, 0.78, 8.8, 0.25, {
      fontSize: 10,
      color: COLORS.gray
    });
    slide.addShape('line', {
      x: 0.55,
      y: 1.12,
      w: 12.2,
      h: 0,
      line: {
        color: COLORS.green,
        width: 1.4
      }
    });
    addText(slide, String(index).padStart(2, '0'), 12.15, 0.34, 0.55, 0.3, {
      fontSize: 11,
      bold: true,
      color: COLORS.green,
      align: 'right'
    });
  }
  function addFooter(slide) {
    addText(slide, '数据来源：日程速记2统一销售统计契约｜财年：10月1日至次年9月30日', 0.58, 7.15, 10.8, 0.2, {
      fontSize: 8,
      color: '87938F'
    });
  }
  function addConclusions(slide, spec) {
    addCard(slide, 8.85, 1.42, 3.85, 5.42, COLORS.pale);
    addText(slide, '核心结论', 9.12, 1.68, 2.8, 0.36, {
      fontSize: 18,
      bold: true,
      color: COLORS.green
    });
    const lines = (spec.conclusions.length ? spec.conclusions : [spec.summary]).slice(0, 4);
    const rowHeight = 4.35 / Math.max(lines.length, 1);
    lines.forEach((line, i) => {
      const y = 2.16 + i * rowHeight;
      slide.addShape('ellipse', {
        x: 9.12,
        y: y + 0.05,
        w: 0.28,
        h: 0.28,
        fill: {
          color: i === 0 ? COLORS.green : COLORS.mint
        },
        line: {
          color: COLORS.white,
          transparency: 100
        }
      });
      addText(slide, i + 1, 9.12, y + 0.05, 0.28, 0.28, {
        fontSize: 10,
        bold: true,
        align: 'center',
        color: i === 0 ? COLORS.white : COLORS.green
      });
      addText(slide, line, 9.52, y, 2.88, rowHeight - 0.13, {
        fontSize: 12,
        color: COLORS.ink,
        valign: 'top',
        breakLine: true,
        fit: 'shrink'
      });
    });
  }
  function chartBase() {
    return {
      showTitle: false,
      showLegend: true,
      legendPos: 'b',
      showValue: false,
      fontFace: 'Microsoft YaHei',
      chartColors: [COLORS.green, '67C9AA', COLORS.blue, COLORS.orange, COLORS.red],
      showCatName: false,
      showPercent: false,
      showSerName: false,
      showValAxisTitle: false,
      showCatAxisTitle: false,
      valGridLine: {
        color: 'E7EEEB',
        width: 1
      },
      catAxisLineColor: 'CAD7D2',
      valAxisLineColor: 'CAD7D2',
      catAxisLabelFontFace: 'Microsoft YaHei',
      valAxisLabelFontFace: 'Microsoft YaHei',
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 9,
      showValue: false
    };
  }
  function addTrendChart(pptx, slide, chart, x, y, w, h) {
    const rows = chart?.series || [];
    const labels = rows.map(r => String(r.period || '').slice(5) + '月');
    if (!rows.length || !rows.some(r => r.hasData || r.priorAvailable)) return addEmpty(slide, x, y, w, h);
    slide.addChart([{
      type: pptx.ChartType.bar,
      data: [{
        name: 'Synthetic Office A',
        labels,
        values: rows.map(r => r.future ? null : finite(r.officeOne))
      }, {
        name: 'Synthetic Office B',
        labels,
        values: rows.map(r => r.future ? null : finite(r.officeTwo))
      }],
      options: {
        grouping: 'clustered'
      }
    }, {
      type: pptx.ChartType.line,
      data: [{
        name: `FY${chart.fiscalYear}合计`,
        labels,
        values: rows.map(r => r.future ? null : finite(r.total))
      }],
      options: {
        lineSize: 2.2,
        showValue: true,
        dataLabelPosition: 't'
      }
    }, {
      type: pptx.ChartType.line,
      data: [{
        name: `FY${chart.fiscalYear - 1}同期`,
        labels,
        values: rows.map(r => r.priorAvailable ? finite(r.priorTotal) : null)
      }],
      options: {
        lineSize: 1.4,
        lineDash: 'dash'
      }
    }], {
      x,
      y: y + .18,
      w,
      h: h - .18,
      ...chartBase(),
      showLegend: true,
      legendPos: 'b'
    });
    addText(slide, `单位：${chart.unit}`, x, y - .02, 1.2, .2, {
      fontSize: 8,
      color: COLORS.gray
    });
    const actual = rows.filter(r => !r.future && r.hasData);
    const peak = actual.reduce((best, item) => !best || item.total > best.total ? item : best, null);
    const low = actual.reduce((best, item) => !best || item.total < best.total ? item : best, null);
    if (peak) addText(slide, `峰值：${Number(peak.period.slice(5))}月 ${formatValue(peak.total, chart.unit)}`, x + w - 2.75, y - .02, 1.35, .2, {
      fontSize: 8,
      bold: true,
      color: COLORS.green,
      align: 'right'
    });
    if (low) addText(slide, `低点：${Number(low.period.slice(5))}月 ${formatValue(low.total, chart.unit)}`, x + w - 1.35, y - .02, 1.35, .2, {
      fontSize: 8,
      color: COLORS.orange,
      align: 'right'
    });
  }
  function addComparisonChart(pptx, slide, chart, x, y, w, h) {
    const rows = chart?.series || [];
    if (!rows.length) return addEmpty(slide, x, y, w, h);
    const plot = {
      x: x + 0.62,
      y: y + 0.42,
      w: w - 1.15,
      h: h - 1.05
    };
    const active = rows.filter(r => !r.future);
    const salesMax = Math.max(...active.flatMap(r => [finite(r.prior), finite(r.current)]), 1) * 1.18;
    const percentageValues = active.flatMap(r => [r.yoy, r.mom]).filter(v => v !== null && v !== undefined).map(v => finite(v) * 100);
    const percentageMax = Math.max(50, ...percentageValues.map(Math.abs)) * 1.15;
    for (let step = 0; step <= 4; step += 1) {
      const gy = plot.y + plot.h * step / 4;
      slide.addShape('line', {
        x: plot.x,
        y: gy,
        w: plot.w,
        h: 0,
        line: {
          color: 'E4ECE8',
          width: 0.7
        }
      });
      addText(slide, Math.round(salesMax * (4 - step) / 4).toLocaleString('zh-CN'), x, gy - 0.1, 0.55, 0.2, {
        fontSize: 8,
        align: 'right',
        color: COLORS.gray
      });
      addText(slide, `${Math.round(percentageMax * (2 - step) / 2)}%`, x + w - 0.46, gy - 0.1, 0.46, 0.2, {
        fontSize: 8,
        align: 'left',
        color: COLORS.gray
      });
    }
    const points = {
      yoy: [],
      mom: []
    };
    const col = plot.w / rows.length;
    rows.forEach((r, index) => {
      const cx = plot.x + col * (index + 0.5);
      const base = plot.y + plot.h;
      if (!r.future) {
        const priorH = finite(r.prior) / salesMax * plot.h;
        const currentH = finite(r.current) / salesMax * plot.h;
        if (r.prior !== null && r.prior !== undefined) slide.addShape('rect', {
          x: cx - col * 0.28,
          y: base - priorH,
          w: col * 0.22,
          h: priorH,
          fill: {
            color: 'A8DCCC'
          },
          line: {
            color: COLORS.white,
            transparency: 100
          }
        });
        if (r.current !== null && r.current !== undefined) slide.addShape('rect', {
          x: cx + col * 0.02,
          y: base - currentH,
          w: col * 0.22,
          h: currentH,
          fill: {
            color: COLORS.green
          },
          line: {
            color: COLORS.white,
            transparency: 100
          }
        });
        if (r.prior !== null && r.prior !== undefined) addText(slide, finite(r.prior).toFixed(0), cx - col * .43, base - priorH - .2, col * .52, .16, {
          fontSize: 6,
          align: 'center',
          color: COLORS.gray
        });
        if (r.current !== null && r.current !== undefined) addText(slide, finite(r.current).toFixed(0), cx - col * .08, base - currentH - .2, col * .52, .16, {
          fontSize: 6,
          align: 'center',
          color: COLORS.green,
          bold: true
        });
        for (const key of ['yoy', 'mom']) if (r[key] !== null && r[key] !== undefined) points[key].push({
          x: cx,
          y: plot.y + plot.h / 2 - finite(r[key]) * 100 / percentageMax * plot.h / 2
        });
      }
      addText(slide, `${String(r.period || '').slice(5)}月`, cx - col * 0.38, base + 0.08, col * 0.76, 0.22, {
        fontSize: 8,
        align: 'center',
        color: COLORS.gray
      });
    });
    for (const [key, color] of [['yoy', COLORS.blue], ['mom', COLORS.orange]]) {
      points[key].forEach((point, index) => {
        if (index) addLineSegment(slide, points[key][index - 1].x, points[key][index - 1].y, point.x, point.y, {
          color,
          width: 1.8
        });
        slide.addShape('ellipse', {
          x: point.x - 0.045,
          y: point.y - 0.045,
          w: 0.09,
          h: 0.09,
          fill: {
            color
          },
          line: {
            color: COLORS.white,
            transparency: 100
          }
        });
      });
      const point = points[key].at(-1);
      const source = active.filter(row => row[key] !== null && row[key] !== undefined).at(-1);
      if (point && source) addText(slide, `${key === 'yoy' ? '同比' : '环比'} ${percent(source[key])}`, point.x - .42, point.y - .3, .84, .2, {
        fontSize: 7,
        bold: true,
        align: 'center',
        color
      });
    }
    addText(slide, `左轴：${chart.unit}`, x, y - .03, .9, .2, {
      fontSize: 8,
      color: COLORS.gray
    });
    addText(slide, '右轴：同比/环比', x + w - 1.1, y - .03, 1.1, .2, {
      fontSize: 8,
      color: COLORS.gray,
      align: 'right'
    });
    [['上财年同期', 'A8DCCC'], ['当前财年同期', COLORS.green], ['同比', COLORS.blue], ['环比', COLORS.orange]].forEach(([label, color], index) => {
      const lx = x + 1.25 + index * 1.3;
      slide.addShape(index < 2 ? 'rect' : 'line', {
        x: lx,
        y: y + 0.03,
        w: 0.18,
        h: index < 2 ? 0.13 : 0,
        fill: {
          color
        },
        line: {
          color,
          width: 1.8
        }
      });
      addText(slide, label, lx + 0.24, y - 0.03, 0.95, 0.2, {
        fontSize: 8,
        color: COLORS.gray
      });
    });
  }
  function rankingRows(chart) {
    return Array.isArray(chart?.series?.contribution) ? chart.series.contribution : Array.isArray(chart?.series) ? chart.series : [];
  }
  function addStandardChart(pptx, slide, spec, x, y, w, h) {
    const chart = spec.chart;
    const rows = Array.isArray(chart?.series) ? chart.series : [];
    if (spec.id === 'fiscal-sales-trend') return addTrendChart(pptx, slide, chart, x, y, w, h);
    if (spec.id === 'yoy-mom-analysis') return addComparisonChart(pptx, slide, chart, x, y, w, h);
    if (['hospital-ranking', 'employee-ranking'].includes(spec.id)) {
      const ranks = rankingRows(chart).slice(0, 8);
      const labels = ranks.map(r => r.name).reverse();
      const values = ranks.map(r => finite(r.value)).reverse();
      if (!labels.length) return addEmpty(slide, x, y, w, h);
      return slide.addChart(pptx.ChartType.bar, [{
        name: spec.metric.label,
        labels,
        values
      }], {
        x,
        y,
        w,
        h,
        ...chartBase(),
        catAxisLabelFontSize: 10,
        showLegend: false,
        showValue: true,
        showCatName: false,
        barDir: 'bar',
        catAxisLabelPos: 'low',
        valAxisLabelPos: 'none',
        chartColors: [COLORS.green]
      });
    }
    if (['department-distribution', 'customer-levels'].includes(spec.id)) {
      const labels = rows.map(r => r.name || r.level);
      const values = rows.map(r => finite(r.value ?? r.count));
      if (!labels.length || !values.some(Boolean)) return addEmpty(slide, x, y, w, h);
      return slide.addChart(pptx.ChartType.doughnut, [{
        name: spec.metric.label,
        labels,
        values
      }], {
        x,
        y,
        w,
        h,
        ...chartBase(),
        holeSize: 55,
        showLegend: true,
        legendPos: 'r',
        showPercent: true,
        showValue: false,
        showTitle: false
      });
    }
    if (spec.id === 'average-order') {
      const labels = rows.map(r => r.label);
      const values = rows.map(r => finite(r.count));
      return slide.addChart(pptx.ChartType.bar, [{
        name: '订单数',
        labels,
        values
      }], {
        x,
        y,
        w,
        h,
        ...chartBase(),
        showLegend: false,
        showValue: true,
        chartColors: [COLORS.green]
      });
    }
    if (spec.id === 'quarter-target') {
      const labels = rows.map(r => r.quarter);
      const actual = rows.map(r => finite(r.actual));
      const target = rows.map(r => r.target === null ? 0 : finite(r.target));
      return slide.addChart(pptx.ChartType.bar, [{
        name: '实际',
        labels,
        values: actual
      }, {
        name: '目标',
        labels,
        values: target
      }], {
        x,
        y,
        w,
        h,
        ...chartBase(),
        grouping: 'clustered',
        chartColors: [COLORS.green, 'B9DACE']
      });
    }
    if (spec.id === 'customer-upgrades') {
      const transitions = chart?.series && !Array.isArray(chart.series) ? Object.entries(chart.series).map(([label, count]) => ({
        label,
        count
      })) : rows;
      return addFunnel(slide, transitions, x, y, w, h);
    }
    if (spec.id === 'waterfall') return addWaterfall(slide, rows, x, y, w, h);
    return addEmpty(slide, x, y, w, h);
  }
  function addEmpty(slide, x, y, w, h) {
    addCard(slide, x, y, w, h, 'F8FAF9');
    addText(slide, '暂无可用于绘图的数据', x, y + h / 2 - 0.2, w, 0.4, {
      align: 'center',
      color: COLORS.gray
    });
  }
  function addFunnel(slide, rows, x, y, w, h) {
    if (!rows.length) return addEmpty(slide, x, y, w, h);
    const max = Math.max(...rows.map(r => finite(r.count ?? r.value)), 1);
    rows.slice(0, 5).forEach((r, i) => {
      const width = Math.max(2, w * (0.45 + 0.5 * finite(r.count ?? r.value) / max));
      const left = x + (w - width) / 2;
      slide.addShape('chevron', {
        x: left,
        y: y + i * (h / 5),
        w: width,
        h: h / 5 - 0.06,
        fill: {
          color: ['087F63', '2D9D81', '67BFA8', 'A8DCCC', 'DDF3EB'][i]
        },
        line: {
          color: COLORS.white,
          width: 1
        }
      });
      addText(slide, `${r.label || r.name || ''}  ${finite(r.count ?? r.value)}`, left, y + i * (h / 5), width, h / 5 - 0.06, {
        align: 'center',
        bold: true,
        color: i < 3 ? COLORS.white : COLORS.ink,
        fontSize: 13
      });
    });
  }
  function addCustomerStairs(slide, spec) {
    const rows = [...(spec.payload?.levels || [])].sort((a, b) => 'DCBA'.indexOf(a.level) - 'DCBA'.indexOf(b.level));
    addCard(slide, .7, 1.42, 7.75, 5.35);
    if (!rows.some(item => finite(item.count))) return addEmpty(slide, .95, 1.75, 7.2, 4.7);
    const max = Math.max(...rows.map(item => finite(item.count)), 1);
    const colors = ['D8E2DF', '77C7AE', '3BAA89', COLORS.green];
    rows.forEach((item, index) => {
      const x = 1.25 + index * 1.65;
      const height = Math.max(.25, finite(item.count) / max * 3.35);
      const y = 5.65 - height;
      slide.addShape('roundRect', {
        x,
        y,
        w: 1.0,
        h: height,
        rectRadius: .06,
        fill: {
          color: colors[index]
        },
        line: {
          color: colors[index]
        }
      });
      addText(slide, `${finite(item.count)}人`, x, y - .32, 1, .25, {
        fontSize: 13,
        bold: true,
        align: 'center'
      });
      addText(slide, `${item.level}\n${spec.payload.total ? (finite(item.count) / spec.payload.total * 100).toFixed(1) : 0}%`, x, 5.78, 1, .52, {
        fontSize: 12,
        bold: true,
        align: 'center',
        breakLine: true
      });
    });
  }
  function addUpgradeOpportunities(slide, spec) {
    const rows = (spec.payload || []).slice(0, 10);
    addCard(slide, .55, 1.35, 12.2, 5.55);
    if (!rows.length) return addEmpty(slide, .85, 1.7, 11.6, 4.8);
    const max = Math.max(...rows.map(item => finite(item.nextGradeThreshold || item.currentBoxes)), 1);
    rows.forEach((item, index) => {
      const y = 1.72 + index * .48;
      addText(slide, item.customer || `客户${index + 1}`, .82, y, 2.15, .24, {
        fontSize: 10,
        bold: true,
        fit: 'shrink'
      });
      const width = 6.1;
      const currentWidth = width * finite(item.currentBoxes) / max;
      const gapWidth = width * finite(item.upgradeGap) / max;
      slide.addShape('roundRect', {
        x: 3.05,
        y: y + .03,
        w: width,
        h: .16,
        rectRadius: .04,
        fill: {
          color: 'EDF2F0'
        },
        line: {
          color: 'EDF2F0'
        }
      });
      if (currentWidth > 0) slide.addShape('roundRect', {
        x: 3.05,
        y: y + .03,
        w: Math.max(.04, currentWidth),
        h: .16,
        rectRadius: .04,
        fill: {
          color: COLORS.green
        },
        line: {
          color: COLORS.green
        }
      });
      if (gapWidth > 0) slide.addShape('rect', {
        x: 3.05 + currentWidth,
        y: y + .03,
        w: Math.max(.04, gapWidth),
        h: .16,
        fill: {
          color: 'F2C16B'
        },
        line: {
          color: 'F2C16B'
        }
      });
      addText(slide, `${finite(item.currentBoxes)}盒 + ${finite(item.upgradeGap)}盒`, 9.38, y, 1.15, .24, {
        fontSize: 9,
        bold: true,
        align: 'right'
      });
      addText(slide, `${item.currentGrade}→${item.nextGrade} · ${item.status}`, 10.68, y, 1.55, .24, {
        fontSize: 8,
        color: COLORS.gray,
        fit: 'shrink'
      });
    });
  }
  function addWaterfall(slide, rows, x, y, w, h) {
    if (!rows.length) return addEmpty(slide, x, y, w, h);
    const values = rows.map(r => finite(r.value ?? r.change));
    const max = Math.max(...values.map(Math.abs), 1);
    const col = w / rows.length;
    rows.forEach((r, i) => {
      const value = values[i];
      const bh = Math.max(0.18, Math.abs(value) / max * (h * 0.68));
      const base = y + h * 0.76;
      slide.addShape('rect', {
        x: x + i * col + col * 0.18,
        y: value >= 0 ? base - bh : base,
        w: col * 0.64,
        h: bh,
        fill: {
          color: value > 0 ? COLORS.green2 : value < 0 ? COLORS.red : 'AAB5B1'
        },
        line: {
          color: COLORS.white,
          transparency: 100
        }
      });
      addText(slide, r.name || r.label || '', x + i * col, base + h * 0.05, col, h * 0.16, {
        fontSize: 8,
        align: 'center',
        valign: 'top'
      });
      addText(slide, value.toFixed(1), x + i * col, value >= 0 ? base - bh - 0.28 : base + bh + 0.02, col, 0.2, {
        fontSize: 8,
        align: 'center',
        color: value < 0 ? COLORS.red : COLORS.green
      });
    });
  }
  function addKpis(slide, spec) {
    spec.coreNumbers.forEach((item, i) => {
      const x = 0.7 + i % 3 * 2.62;
      const y = 1.55 + Math.floor(i / 3) * 1.65;
      addCard(slide, x, y, 2.35, 1.35, i === 0 ? COLORS.mint : COLORS.white);
      addText(slide, item.label, x + 0.18, y + 0.16, 1.9, 0.25, {
        fontSize: 11,
        color: COLORS.gray
      });
      addText(slide, item.value, x + 0.18, y + 0.5, 1.95, 0.55, {
        fontSize: 24,
        bold: true,
        color: i === 0 ? COLORS.green : COLORS.ink
      });
    });
  }
  function addListSlide(slide, spec, rows) {
    addCard(slide, 0.7, 1.45, 7.75, 5.42);
    const safeRows = rows.length ? rows.slice(0, 6) : [{
      title: '暂无数据',
      detail: '当前筛选范围没有可显示的记录。'
    }];
    safeRows.forEach((row, i) => {
      const y = 1.78 + i * 0.78;
      slide.addShape('ellipse', {
        x: 1.0,
        y,
        w: 0.32,
        h: 0.32,
        fill: {
          color: row.level === 'risk' ? COLORS.red : row.level === 'warning' ? COLORS.orange : COLORS.green
        },
        line: {
          color: COLORS.white,
          transparency: 100
        }
      });
      addText(slide, i + 1, 1.0, y, 0.32, 0.32, {
        align: 'center',
        color: COLORS.white,
        bold: true,
        fontSize: 9
      });
      addText(slide, row.title || row.name || row.label, 1.48, y - 0.03, 5.85, 0.28, {
        bold: true,
        fontSize: 13
      });
      addText(slide, row.detail || row.diagnosis || (row.rate === null ? '未设置' : `完成率 ${finite(row.rate).toFixed(1)}%`), 1.48, y + 0.27, 6.2, 0.28, {
        color: COLORS.gray,
        fontSize: 10
      });
    });
  }
  function addFindingSlide(slide, spec) {
    const rows = (spec.payload || []).slice(0, 6);
    if (!rows.length) return addEmpty(slide, 0.7, 1.42, 11.95, 5.35);
    rows.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 0.7 + column * 6.02;
      const y = 1.42 + row * 1.72;
      addCard(slide, x, y, 5.72, 1.48, index === 0 ? 'EEF8F4' : COLORS.white);
      addText(slide, `${index + 1}`, x + 0.18, y + 0.16, 0.35, 0.35, {
        fontSize: 14,
        bold: true,
        color: COLORS.white,
        align: 'center',
        fill: {
          color: item.severity === 'critical' ? COLORS.red : item.severity === 'high' ? COLORS.orange : COLORS.green
        }
      });
      addText(slide, item.conclusion, x + 0.68, y + 0.1, 4.76, 0.54, {
        fontSize: 11,
        bold: true,
        valign: 'top',
        breakLine: true,
        fit: 'shrink'
      });
      addText(slide, `证据：${(item.evidence || []).slice(0, 2).join('；') || '当前缺少进一步证据。'}`, x + 0.68, y + 0.68, 4.76, 0.3, {
        fontSize: 8.5,
        color: COLORS.gray,
        valign: 'top',
        breakLine: true,
        fit: 'shrink'
      });
      addText(slide, `动作：${item.recommendedAction || '继续观察并按同口径复盘。'}`, x + 0.68, y + 1.0, 4.76, 0.34, {
        fontSize: 9,
        color: COLORS.green,
        valign: 'top',
        breakLine: true,
        fit: 'shrink'
      });
    });
  }
  function addDriverBars(slide, spec) {
    const rows = (spec.payload || []).slice(0, 8);
    const max = Math.max(...rows.map(item => Math.abs(finite(item.change))), 1);
    addCard(slide, 0.7, 1.42, 7.75, 5.35);
    if (!rows.length) return addEmpty(slide, 0.95, 1.75, 7.2, 4.7);
    rows.forEach((item, index) => {
      const y = 1.75 + index * 0.58;
      const width = 4.15 * Math.abs(finite(item.change)) / max;
      addText(slide, item.name, 0.95, y, 1.65, 0.3, {
        fontSize: 12,
        bold: index === 0
      });
      slide.addShape('roundRect', {
        x: 2.72,
        y: y + 0.04,
        w: Math.max(.12, width),
        h: .22,
        rectRadius: .03,
        fill: {
          color: finite(item.change) >= 0 ? COLORS.green2 : COLORS.red
        },
        line: {
          color: COLORS.white,
          transparency: 100
        }
      });
      addText(slide, `${finite(item.change) >= 0 ? '+' : ''}${finite(item.change).toFixed(1)}${spec.metric.unit}`, 6.98, y, 1.0, .3, {
        fontSize: 11,
        bold: true,
        color: finite(item.change) >= 0 ? COLORS.green : COLORS.red,
        align: 'right'
      });
    });
  }
  function addTargetGap(slide, spec) {
    const data = spec.payload || {};
    addCard(slide, 0.7, 1.42, 7.75, 5.35);
    const values = data.state === 'missing' ? [{
      label: '财年目标',
      value: '未设置'
    }] : [{
      label: '财年目标',
      value: formatValue(data.target, spec.metric.unit)
    }, {
      label: '已完成',
      value: formatValue(data.actual, spec.metric.unit)
    }, {
      label: '完成率',
      value: `${(finite(data.completionRate) * 100).toFixed(1)}%`
    }, {
      label: '剩余缺口',
      value: formatValue(data.gap, spec.metric.unit)
    }, {
      label: '后续月均需要',
      value: data.requiredMonthly === null ? '财年已结束' : formatValue(data.requiredMonthly, spec.metric.unit)
    }, {
      label: '当前月均速度',
      value: formatValue(data.currentMonthlyPace, spec.metric.unit)
    }];
    values.slice(0, 4).forEach((item, index) => {
      const x = 1.0 + index % 4 * 1.78;
      const y = 1.72;
      addText(slide, item.label, x, y, 2.0, .25, {
        fontSize: 11,
        color: COLORS.gray
      });
      addText(slide, item.value, x, y + .32, 1.55, .5, {
        fontSize: 18,
        bold: true,
        color: index === 2 ? COLORS.green : COLORS.ink
      });
    });
    const rows = (data.cumulativePlan || []).filter(item => item.actual !== null || item.target !== null);
    if (rows.length && rows.some(item => item.target !== null)) {
      const px = 1.05;
      const py = 3.05;
      const pw = 6.85;
      const ph = 2.1;
      const max = Math.max(...rows.flatMap(item => [finite(item.actual), finite(item.target)]), 1);
      slide.addShape('line', {
        x: px,
        y: py + ph,
        w: pw,
        h: 0,
        line: {
          color: COLORS.line,
          width: 1
        }
      });
      for (const [key, color] of [['actual', COLORS.green], ['target', COLORS.orange]]) {
        const points = rows.map((item, index) => ({
          x: px + (rows.length > 1 ? pw * index / (rows.length - 1) : 0),
          y: py + ph - finite(item[key]) / max * ph,
          value: item[key]
        })).filter(item => item.value !== null);
        points.forEach((point, index) => {
          if (index) addLineSegment(slide, points[index - 1].x, points[index - 1].y, point.x, point.y, {
            color,
            width: 2.2,
            dash: key === 'target' ? 'dash' : 'solid'
          });
          slide.addShape('ellipse', {
            x: point.x - .035,
            y: point.y - .035,
            w: .07,
            h: .07,
            fill: {
              color
            },
            line: {
              color,
              transparency: 100
            }
          });
        });
      }
      rows.forEach((item, index) => addText(slide, `${Number(item.period.slice(5))}月`, px + pw * index / Math.max(1, rows.length - 1) - .2, py + ph + .08, .4, .18, {
        fontSize: 7,
        color: COLORS.gray,
        align: 'center'
      }));
      addText(slide, '累计实际', px, py - .28, .8, .2, {
        fontSize: 8,
        bold: true,
        color: COLORS.green
      });
      addText(slide, '累计目标', px + .9, py - .28, .8, .2, {
        fontSize: 8,
        bold: true,
        color: COLORS.orange
      });
    } else addText(slide, '录入月度目标后，将显示“累计实际 vs 累计目标”轨迹。', 1.05, 3.5, 6.8, .5, {
      fontSize: 15,
      color: COLORS.gray,
      align: 'center'
    });
    addText(slide, data.conclusion || spec.summary, 1.0, 5.65, 6.95, .65, {
      fontSize: 12,
      bold: true,
      color: data.projectedGap > 0 ? COLORS.red : COLORS.green,
      breakLine: true,
      valign: 'top'
    });
  }
  function addMiniTrend(slide, spec) {
    const rows = (spec.payload || []).slice(0, 6);
    addCard(slide, 0.7, 1.42, 7.75, 5.35);
    if (!rows.length) return addEmpty(slide, .95, 1.75, 7.2, 4.7);
    const all = rows.flatMap(item => item.values || []).map(item => finite(item.value));
    const max = Math.max(...all, 1);
    rows.forEach((item, index) => {
      const y = 1.68 + index * .78;
      addText(slide, item.name, .95, y, 1.45, .28, {
        fontSize: 12,
        bold: true
      });
      const values = item.values || [];
      const startX = 2.52;
      const width = 5.15;
      const step = values.length > 1 ? width / (values.length - 1) : 0;
      values.forEach((point, pointIndex) => {
        const px = startX + step * pointIndex;
        const py = y + .48 - finite(point.value) / max * .42;
        if (pointIndex) {
          const prior = values[pointIndex - 1];
          const priorY = y + .48 - finite(prior.value) / max * .42;
          addLineSegment(slide, px - step, priorY, px, py, {
            color: index === 0 ? COLORS.green : COLORS.blue,
            width: 1.6
          });
        }
        slide.addShape('ellipse', {
          x: px - .035,
          y: py - .035,
          w: .07,
          h: .07,
          fill: {
            color: index === 0 ? COLORS.green : COLORS.blue
          },
          line: {
            color: COLORS.white,
            transparency: 100
          }
        });
      });
      addText(slide, values.map(point => point.period.slice(5)).join('  '), startX, y + .5, width, .2, {
        fontSize: 8,
        color: COLORS.gray,
        align: 'center'
      });
    });
  }
  function addHeatmap(slide, spec) {
    const rows = (spec.payload || []).slice(0, 10);
    addCard(slide, .7, 1.42, 7.75, 5.35);
    if (!rows.length) return addEmpty(slide, .95, 1.72, 7.2, 4.65);
    const periods = rows[0].values || [];
    const max = Math.max(...rows.flatMap(item => (item.values || []).map(point => finite(point.value))), 1);
    const labelW = 1.55;
    const gridX = 2.45;
    const gridW = 5.45;
    const cellW = gridW / Math.max(periods.length, 1);
    const cellH = Math.min(.42, 4.2 / rows.length);
    periods.forEach((item, index) => addText(slide, `${Number(item.period.slice(5))}月`, gridX + index * cellW, 1.62, cellW, .22, {
      fontSize: 8,
      color: COLORS.gray,
      align: 'center'
    }));
    rows.forEach((item, rowIndex) => {
      const y = 1.93 + rowIndex * (cellH + .05);
      addText(slide, item.name, .92, y, labelW, cellH, {
        fontSize: 9,
        bold: rowIndex < 3,
        fit: 'shrink'
      });
      (item.values || []).forEach((point, index) => {
        const ratio = finite(point.value) / max;
        const color = ratio > .75 ? '087F63' : ratio > .5 ? '39A98A' : ratio > .25 ? '8FD3BD' : ratio > 0 ? 'D8EFE7' : 'F0F3F2';
        slide.addShape('roundRect', {
          x: gridX + index * cellW + .02,
          y,
          w: cellW - .04,
          h: cellH,
          rectRadius: .02,
          fill: {
            color
          },
          line: {
            color: COLORS.white,
            transparency: 100
          }
        });
        addText(slide, finite(point.value).toFixed(0), gridX + index * cellW + .02, y, cellW - .04, cellH, {
          fontSize: 7,
          color: ratio > .5 ? COLORS.white : COLORS.ink,
          align: 'center'
        });
      });
    });
  }
  function addPareto(slide, spec) {
    const rows = (spec.payload || []).slice(0, 10);
    addCard(slide, .7, 1.42, 7.75, 5.35);
    if (!rows.length) return addEmpty(slide, .95, 1.75, 7.2, 4.7);
    const max = Math.max(...rows.map(item => finite(item.value)), 1);
    const baseY = 5.85;
    const chartH = 3.45;
    const x0 = 1.02;
    const col = 6.95 / rows.length;
    const points = [];
    rows.forEach((item, index) => {
      const h = finite(item.value) / max * chartH;
      const x = x0 + index * col;
      slide.addShape('rect', {
        x: x + .08,
        y: baseY - h,
        w: col * .58,
        h,
        fill: {
          color: COLORS.green
        },
        line: {
          color: COLORS.white,
          transparency: 100
        }
      });
      addText(slide, item.name, x, baseY + .08, col * .82, .45, {
        fontSize: 7,
        color: COLORS.gray,
        rotate: 315,
        fit: 'shrink'
      });
      points.push({
        x: x + col * .38,
        y: baseY - finite(item.cumulativeShare) * chartH
      });
    });
    points.forEach((point, index) => {
      if (index) addLineSegment(slide, points[index - 1].x, points[index - 1].y, point.x, point.y, {
        color: COLORS.orange,
        width: 2
      });
      slide.addShape('ellipse', {
        x: point.x - .04,
        y: point.y - .04,
        w: .08,
        h: .08,
        fill: {
          color: COLORS.orange
        },
        line: {
          color: COLORS.orange
        }
      });
    });
    addText(slide, '柱：医院贡献｜线：累计贡献率', 1.02, 1.72, 2.3, .22, {
      fontSize: 9,
      color: COLORS.gray
    });
  }
  function addFitScatter(slide, spec) {
    const data = spec.payload || {};
    const points = ['A', 'B', 'C', 'D'].flatMap(key => (data[key] || []).map(item => ({
      ...item,
      quadrant: key
    })));
    addCard(slide, .7, 1.42, 7.75, 5.35);
    const x = 1.2;
    const y = 1.9;
    const w = 6.65;
    const h = 4.1;
    slide.addShape('line', {
      x: x + w / 2,
      y,
      w: 0,
      h,
      line: {
        color: COLORS.line,
        dash: 'dash'
      }
    });
    slide.addShape('line', {
      x,
      y: y + h / 2,
      w,
      h: 0,
      line: {
        color: COLORS.line,
        dash: 'dash'
      }
    });
    addText(slide, '高业绩', x, y - .28, .8, .2, {
      fontSize: 8,
      color: COLORS.gray
    });
    addText(slide, '计划拟合度 →', x + w - 1.15, y + h + .12, 1.15, .2, {
      fontSize: 8,
      color: COLORS.gray,
      align: 'right'
    });
    const maxContribution = Math.max(...points.map(item => finite(item.contribution)), 1);
    points.forEach(item => {
      const px = x + Math.max(0, Math.min(100, finite(item.fitScore))) / 100 * w;
      const py = y + h - finite(item.contribution) / maxContribution * h;
      const color = {
        A: COLORS.green,
        B: COLORS.orange,
        C: COLORS.blue,
        D: COLORS.red
      }[item.quadrant];
      slide.addShape('ellipse', {
        x: px - .08,
        y: py - .08,
        w: .16,
        h: .16,
        fill: {
          color,
          transparency: 15
        },
        line: {
          color
        }
      });
      addText(slide, item.employeeName, px + .08, py - .08, .85, .18, {
        fontSize: 6,
        color
      });
    });
    if (!points.length) addText(slide, '员工计划数据不足，暂不绘制散点。', x, y + 1.8, w, .4, {
      align: 'center',
      color: COLORS.gray
    });
  }
  function addStackedMonthly(slide, spec, customer = false) {
    const rows = spec.payload || [];
    addCard(slide, .7, 1.42, 7.75, 5.35);
    if (!rows.length) return addEmpty(slide, .95, 1.75, 7.2, 4.7);
    const names = customer ? ['A', 'B', 'C', 'D'] : [...new Set(rows.flatMap(row => (row.values || []).map(item => item.name)))].slice(0, 6);
    const colors = [COLORS.green, '3BAA89', '77C7AE', COLORS.blue, COLORS.orange, 'B8C4C0'];
    const x0 = 1.05;
    const baseY = 5.75;
    const chartH = 3.7;
    const col = 6.85 / rows.length;
    rows.forEach((row, index) => {
      const values = customer ? names.map(name => finite((row.levels || []).find(item => item.level === name)?.count)) : names.map(name => finite((row.values || []).find(item => item.name === name)?.value));
      const total = values.reduce((a, b) => a + b, 0);
      let yCursor = baseY;
      values.forEach((value, valueIndex) => {
        const h = total ? value / total * chartH : 0;
        yCursor -= h;
        if (h > 0) slide.addShape('rect', {
          x: x0 + index * col + .12,
          y: yCursor,
          w: col * .55,
          h,
          fill: {
            color: colors[valueIndex]
          },
          line: {
            color: COLORS.white,
            width: .5
          }
        });
      });
      addText(slide, `${Number(row.period.slice(5))}月`, x0 + index * col, baseY + .08, col * .8, .2, {
        fontSize: 8,
        align: 'center',
        color: COLORS.gray
      });
    });
    names.forEach((name, index) => {
      const lx = 1.05 + index * 1.05;
      slide.addShape('rect', {
        x: lx,
        y: 1.65,
        w: .13,
        h: .13,
        fill: {
          color: colors[index]
        },
        line: {
          color: colors[index]
        }
      });
      addText(slide, name, lx + .19, 1.6, .8, .22, {
        fontSize: 8,
        color: COLORS.gray
      });
    });
  }
  function addSegmentation(slide, spec) {
    const rows = spec.payload || [];
    rows.forEach((item, index) => {
      const x = .7 + index * 4.03;
      addCard(slide, x, 1.55, 3.72, 4.75, index === 0 ? 'EEF8F4' : COLORS.white);
      addText(slide, item.label, x + .25, 1.85, 1.8, .35, {
        fontSize: 20,
        bold: true,
        color: index === 0 ? COLORS.green : COLORS.ink
      });
      addText(slide, `${item.count}人`, x + .25, 2.38, 1.6, .55, {
        fontSize: 30,
        bold: true
      });
      addText(slide, `贡献 ${item.value.toFixed(1)}盒`, x + .25, 3.13, 2.7, .35, {
        fontSize: 15,
        bold: true,
        color: COLORS.green
      });
      addText(slide, `占团队 ${(item.share * 100).toFixed(1)}%`, x + .25, 3.58, 2.7, .3, {
        fontSize: 13,
        color: COLORS.gray
      });
      addText(slide, item.averageFit === null ? '计划拟合：数据不足' : `计划拟合：${item.averageFit.toFixed(1)}分`, x + .25, 4.02, 2.8, .3, {
        fontSize: 13,
        color: item.averageFit !== null && item.averageFit < 60 ? COLORS.red : COLORS.ink
      });
      addText(slide, (item.employees || []).slice(0, 4).map(employee => `${employee.name} ${employee.value.toFixed(0)}盒`).join('\n') || '暂无员工', x + .25, 4.55, 3.05, 1.2, {
        fontSize: 12,
        color: COLORS.gray,
        breakLine: true,
        valign: 'top'
      });
    });
  }
  function addPlanFit(slide, spec) {
    const data = spec.payload || {};
    const counts = data.statusCounts || {};
    const statuses = [['团队平均', data.teamAverage === null ? '数据不足' : `${finite(data.teamAverage).toFixed(1)}分`, COLORS.green], ['较可信', `${finite(counts.trusted)}人`, COLORS.green2], ['部分符合', `${finite(counts.partial)}人`, COLORS.blue], ['需复核', `${finite(counts.review)}人`, COLORS.orange], ['低拟合', `${finite(counts.low)}人`, COLORS.red], ['未填写/不足', `${finite(counts.unfilled) + finite(counts.insufficient)}人`, COLORS.gray]];
    statuses.forEach((item, index) => {
      const x = .7 + index * 1.35;
      addCard(slide, x, 1.45, 1.16, 1.05);
      addText(slide, item[0], x + .1, 1.62, .96, .24, {
        fontSize: 8,
        color: COLORS.gray
      });
      addText(slide, item[1], x + .1, 1.92, .96, .35, {
        fontSize: 15,
        bold: true,
        color: item[2]
      });
    });
    if (finite(data.coverageRate) < .5 && finite(data.employeeCount) > 0) addText(slide, `员工计划覆盖率 ${(finite(data.coverageRate) * 100).toFixed(1)}%，本项仅供参考。`, .82, 2.58, 7.0, .24, {
      fontSize: 11,
      bold: true,
      color: COLORS.orange
    });
    const rows = (data.ranking || []).slice(0, 6);
    rows.forEach((item, index) => {
      const y = 2.9 + index * .58;
      addText(slide, item.employeeName, .85, y, 1.35, .28, {
        fontSize: 12,
        bold: true
      });
      addText(slide, item.fitScore === null ? item.status.label : `${item.fitScore.toFixed(0)}分`, 2.25, y, .68, .28, {
        fontSize: 12,
        bold: true,
        color: item.fitScore !== null && item.fitScore < 60 ? COLORS.red : COLORS.green
      });
      addText(slide, item.issues?.[0]?.text || item.positives?.[0] || '当前缺少可评分计划数据。', 3.08, y, 4.95, .35, {
        fontSize: 11,
        color: COLORS.gray
      });
    });
  }
  function addFitMatrix(slide, spec) {
    const data = spec.payload || {};
    const cells = [['A', '高业绩 + 高拟合', COLORS.green, 1.0, 1.55], ['B', '高业绩 + 低拟合', COLORS.orange, 6.85, 1.55], ['C', '低业绩 + 高拟合', COLORS.blue, 1.0, 4.05], ['D', '低业绩 + 低拟合', COLORS.red, 6.85, 4.05]];
    cells.forEach(([key, label, color, x, y]) => {
      addCard(slide, x, y, 5.25, 2.05, 'FFFFFF');
      addText(slide, key, x + .25, y + .2, .45, .42, {
        fontSize: 22,
        bold: true,
        color
      });
      addText(slide, label, x + .82, y + .2, 2.6, .32, {
        fontSize: 15,
        bold: true
      });
      const people = (data[key] || []).slice(0, 5);
      addText(slide, people.length ? people.map(item => `${item.employeeName}｜${item.contribution.toFixed(1)}${spec.metric.unit}｜${item.fitScore.toFixed(0)}分`).join('\n') : '暂无员工', x + .28, y + .75, 4.68, 1.02, {
        fontSize: 12,
        color: COLORS.gray,
        breakLine: true,
        valign: 'top'
      });
    });
  }
  function addActionTable(slide, spec) {
    const rows = (spec.payload || []).slice(0, 5);
    addCard(slide, .55, 1.35, 12.2, 5.55);
    const columns = [{
      name: '优先级',
      x: .78,
      w: .68
    }, {
      name: '对象 / 问题',
      x: 1.55,
      w: 3.15
    }, {
      name: '动作',
      x: 4.82,
      w: 3.42
    }, {
      name: '负责人',
      x: 8.38,
      w: 1.45
    }, {
      name: '衡量 / 复盘',
      x: 9.98,
      w: 2.42
    }];
    columns.forEach(column => addText(slide, column.name, column.x, 1.62, column.w, .28, {
      fontSize: 12,
      bold: true,
      color: COLORS.green
    }));
    rows.forEach((item, index) => {
      const y = 2.08 + index * .94;
      slide.addShape('line', {
        x: .78,
        y: y - .12,
        w: 11.62,
        h: 0,
        line: {
          color: COLORS.line,
          width: .7
        }
      });
      addText(slide, item.priority, .78, y, .68, .32, {
        fontSize: 13,
        bold: true,
        color: COLORS.red
      });
      addText(slide, `${item.object}\n${item.problem}`, 1.55, y - .04, 3.15, .78, {
        fontSize: 9,
        breakLine: true,
        valign: 'top',
        fit: 'shrink'
      });
      addText(slide, item.action, 4.82, y - .04, 3.42, .72, {
        fontSize: 9,
        breakLine: true,
        valign: 'top',
        fit: 'shrink'
      });
      addText(slide, item.owner, 8.38, y, 1.45, .4, {
        fontSize: 9,
        fit: 'shrink'
      });
      addText(slide, `${item.metric}\n${item.reviewDate}`, 9.98, y - .04, 2.42, .72, {
        fontSize: 9,
        breakLine: true,
        valign: 'top',
        fit: 'shrink'
      });
    });
  }
  function addCompleteness(slide, spec) {
    const data = spec.payload || {};
    const cards = [['销售明细', `${finite(data.salesRecords)}条`], ['员工字段覆盖', `${(finite(data.employeeCoverage) * 100).toFixed(0)}%`], ['客户字段覆盖', `${(finite(data.customerCoverage) * 100).toFixed(0)}%`], ['员工计划覆盖', `${(finite(data.employeePlanCoverage) * 100).toFixed(0)}%`], ['历史长度', `${finite(data.historyMonths)}个月`], ['目标设置', data.targetConfigured ? '已设置' : '未设置']];
    cards.forEach((item, index) => {
      const x = .7 + index % 3 * 2.62;
      const y = 1.5 + Math.floor(index / 3) * 1.25;
      addCard(slide, x, y, 2.35, .98);
      addText(slide, item[0], x + .16, y + .12, 1.9, .22, {
        fontSize: 10,
        color: COLORS.gray
      });
      addText(slide, item[1], x + .16, y + .4, 1.9, .35, {
        fontSize: 19,
        bold: true,
        color: COLORS.green
      });
    });
    addText(slide, '分析限制', .75, 4.15, 2.0, .32, {
      fontSize: 18,
      bold: true
    });
    addText(slide, (data.limitations || ['当前未识别明显数据限制。']).map((item, index) => `${index + 1}. ${item}`).join('\n'), .85, 4.58, 7.2, 1.65, {
      fontSize: 13,
      color: COLORS.gray,
      breakLine: true,
      valign: 'top'
    });
  }
  function addFitDetail(slide, spec) {
    const rows = (spec.payload || []).slice(0, 8);
    addCard(slide, .55, 1.35, 12.2, 5.55);
    rows.forEach((item, index) => {
      const y = 1.65 + index * .62;
      addText(slide, item.employeeName, .82, y, 1.35, .28, {
        fontSize: 11,
        bold: true
      });
      addText(slide, item.fitScore === null ? item.status.label : `${item.fitScore.toFixed(0)}分`, 2.25, y, .7, .28, {
        fontSize: 11,
        bold: true,
        color: item.fitScore !== null && item.fitScore < 60 ? COLORS.red : COLORS.green
      });
      addText(slide, `实际${finite(item.evidence?.actualSales).toFixed(1)}｜目标${item.evidence?.planTarget ?? '未填'}｜总量${item.scores.volumeFit?.toFixed?.(0) ?? '-'}｜医院科室${item.scores.hospitalDepartmentFit?.toFixed?.(0) ?? '-'}｜客户${item.scores.customerLevelFit?.toFixed?.(0) ?? '-'}｜质量${item.scores.planQuality?.toFixed?.(0) ?? '-'}`, 3.05, y, 4.75, .28, {
        fontSize: 10
      });
      addText(slide, item.issues?.[0]?.text || item.positives?.[0] || '数据不足，暂不评分。', 7.92, y, 4.35, .32, {
        fontSize: 10,
        color: COLORS.gray
      });
    });
  }
  function addHospitalLossDetail(slide, spec) {
    const rows = (spec.payload || []).slice(0, 6);
    addCard(slide, .55, 1.35, 12.2, 5.55);
    rows.forEach((item, index) => {
      const y = 1.65 + index * .82;
      addText(slide, `${index + 1}. ${item.name}`, .82, y, 2.2, .32, {
        fontSize: 13,
        bold: true
      });
      addText(slide, `掉量 ${Math.abs(finite(item.change)).toFixed(1)}${spec.metric.unit}`, 3.1, y, 1.45, .3, {
        fontSize: 12,
        bold: true,
        color: COLORS.red
      });
      addText(slide, `科室：${(item.departments || []).slice(0, 2).map(entry => entry.name).join('、') || '暂无'}`, 4.65, y, 2.25, .3, {
        fontSize: 11
      });
      addText(slide, `员工/计划：${(item.responsibleEmployees || []).slice(0, 2).map(entry => `${entry.name}${entry.planFit?.fitScore === null || entry.planFit?.fitScore === undefined ? '' : ` ${entry.planFit.fitScore.toFixed(0)}分`}`).join('、') || '暂无责任链数据'}`, 7.0, y, 4.95, .42, {
        fontSize: 11,
        color: COLORS.gray
      });
    });
  }
  function addHospitalChange(slide, spec) {
    const data = spec.payload || {};
    const groups = [['增长医院', data.growth || [], COLORS.green], ['掉量医院', data.decline || [], COLORS.red]];
    groups.forEach(([title, rows, color], column) => {
      const x = .7 + column * 4.0;
      addCard(slide, x, 1.48, 3.72, 4.95);
      addText(slide, title, x + .24, 1.76, 2.2, .34, {
        fontSize: 18,
        bold: true,
        color
      });
      (rows.length ? rows.slice(0, 5) : [{
        name: '暂无数据',
        change: 0
      }]).forEach((item, index) => {
        const y = 2.35 + index * .72;
        addText(slide, item.name, x + .25, y, 1.95, .3, {
          fontSize: 12,
          bold: index === 0
        });
        addText(slide, `${finite(item.change) >= 0 ? '+' : ''}${finite(item.change).toFixed(1)}${spec.metric.unit}`, x + 2.2, y, 1.15, .3, {
          fontSize: 11,
          bold: true,
          color,
          align: 'right'
        });
        if (column === 1 && item.responsibleEmployees?.[0]) addText(slide, `关联${item.responsibleEmployees[0].name}${item.responsibleEmployees[0].planFit?.fitScore === null || item.responsibleEmployees[0].planFit?.fitScore === undefined ? '' : `｜拟合${item.responsibleEmployees[0].planFit.fitScore.toFixed(0)}分`}`, x + .25, y + .3, 3.05, .22, {
          fontSize: 9,
          color: COLORS.gray
        });
      });
    });
  }
  function addActivity(slide, spec) {
    const data = spec.payload || {};
    const cards = [['活动/拜访明细', `${finite(data.count)}条`], ['费用', `${finite(data.cost).toFixed(1)}元`], ['拜访次数', `${finite(data.visits)}次`], ['覆盖医院', `${finite(data.hospitals)}家`]];
    cards.forEach((item, index) => {
      const x = .75 + index * 1.95;
      addCard(slide, x, 1.58, 1.72, 1.15);
      addText(slide, item[0], x + .14, 1.76, 1.45, .22, {
        fontSize: 10,
        color: COLORS.gray
      });
      addText(slide, item[1], x + .14, 2.08, 1.45, .35, {
        fontSize: 18,
        bold: true,
        color: COLORS.green
      });
    });
    addText(slide, data.conclusion || spec.summary, .88, 3.35, 7.1, 1.15, {
      fontSize: 17,
      bold: true,
      breakLine: true,
      valign: 'top'
    });
    addText(slide, '归因边界：活动后观察到的变化仅用于后续跟踪，不能直接解释为活动造成。', .88, 4.82, 7.15, .75, {
      fontSize: 14,
      color: COLORS.orange,
      breakLine: true
    });
  }
  function createPresentation(deck, PptxGenJS) {
    if (typeof PptxGenJS !== 'function') throw new Error('PptxGenJS 组件未加载');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = '日程速记2';
    pptx.company = '日程速记2';
    pptx.subject = deck.period;
    pptx.title = deck.title;
    pptx.lang = 'zh-CN';
    pptx.theme = {
      headFontFace: 'Microsoft YaHei',
      bodyFontFace: 'Microsoft YaHei',
      lang: 'zh-CN'
    };
    deck.slides.forEach((spec, index) => {
      const slide = pptx.addSlide();
      slide.background = {
        color: index === 0 ? 'F2F7F5' : 'F7F9F8'
      };
      if (spec.kind === 'cover') {
        slide.addShape('rect', {
          x: 0,
          y: 0,
          w: 4.35,
          h: 7.5,
          fill: {
            color: COLORS.green
          },
          line: {
            color: COLORS.green
          }
        });
        addText(slide, 'QUARTERLY\nBUSINESS REVIEW', 0.72, 0.72, 3.0, 1.25, {
          fontSize: 15,
          bold: true,
          color: 'A6E3D1',
          breakLine: true,
          valign: 'top'
        });
        addText(slide, spec.title, 4.95, 1.75, 7.15, 1.25, {
          fontSize: 50,
          bold: true,
          color: COLORS.ink,
          breakLine: true,
          valign: 'top'
        });
        addText(slide, spec.summary, 5.0, 3.15, 6.5, 0.5, {
          fontSize: 17,
          color: COLORS.green
        });
        addText(slide, '基于统一统计口径自动生成｜可编辑图表', 5.0, 4.0, 6.4, 0.35, {
          fontSize: 13,
          color: COLORS.gray
        });
        addText(slide, '日程速记2', 5.0, 6.72, 2.0, 0.28, {
          fontSize: 11,
          bold: true,
          color: COLORS.green
        });
        return;
      }
      addHeader(slide, spec, index + 1);
      addFooter(slide);
      const fullWidthKinds = new Set(['findings', 'fit-matrix', 'actions', 'fit-detail', 'hospital-loss-detail']);
      if (spec.kind === 'kpis') addKpis(slide, spec);else if (spec.kind === 'findings') addFindingSlide(slide, spec);else if (spec.kind === 'target-gap') addTargetGap(slide, spec);else if (spec.kind === 'drivers') addDriverBars(slide, spec);else if (spec.kind === 'waterfall') {
        addCard(slide, .7, 1.42, 7.75, 5.35);
        addWaterfall(slide, spec.payload || [], .98, 1.82, 7.18, 4.55);
      } else if (spec.kind === 'heatmap') addHeatmap(slide, spec);else if (spec.kind === 'small-multiples') addMiniTrend(slide, spec);else if (spec.kind === 'pareto') addPareto(slide, spec);else if (spec.kind === 'hospital-change') addHospitalChange(slide, spec);else if (spec.kind === 'trend-lines') addMiniTrend(slide, spec);else if (spec.kind === 'segmentation') addSegmentation(slide, spec);else if (spec.kind === 'plan-fit') addPlanFit(slide, spec);else if (spec.kind === 'fit-matrix') addFitMatrix(slide, spec);else if (spec.kind === 'fit-scatter') addFitScatter(slide, spec);else if (spec.kind === 'stacked-monthly') addStackedMonthly(slide, spec, false);else if (spec.kind === 'customer-monthly') addStackedMonthly(slide, spec, true);else if (spec.kind === 'customer-stairs') addCustomerStairs(slide, spec);else if (spec.kind === 'upgrade-opportunities') addUpgradeOpportunities(slide, spec);else if (spec.kind === 'histogram') {
        addCard(slide, .58, 1.35, 7.95, 5.55);
        addStandardChart(pptx, slide, spec, .9, 1.72, 7.35, 4.55);
      } else if (spec.kind === 'order-trend') addMiniTrend(slide, {
        ...spec,
        payload: [{
          name: '平均单笔',
          values: (spec.payload || []).map(item => ({
            period: item.period,
            value: item.average
          }))
        }]
      });else if (spec.kind === 'execution') addListSlide(slide, spec, spec.payload || []);else if (spec.kind === 'activity') addActivity(slide, spec);else if (spec.kind === 'actions') addActionTable(slide, spec);else if (spec.kind === 'completeness') addCompleteness(slide, spec);else if (spec.kind === 'fit-detail') addFitDetail(slide, spec);else if (spec.kind === 'hospital-loss-detail') addHospitalLossDetail(slide, spec);else {
        addCard(slide, 0.58, 1.35, 7.95, 5.55);
        addStandardChart(pptx, slide, spec, 0.9, 1.72, 7.35, 4.55);
      }
      if (!fullWidthKinds.has(spec.kind)) addConclusions(slide, spec);
      const qualityNotice = spec.chart?.dataQuality?.missing?.length ? `数据提示：缺少${spec.chart.dataQuality.missing.join('、')}。` : '';
      const summaryText = [spec.summary, qualityNotice].filter(Boolean).join(' ');
      addText(slide, summaryText, 0.82, fullWidthKinds.has(spec.kind) ? 6.82 : 6.36, fullWidthKinds.has(spec.kind) ? 11.55 : 7.45, fullWidthKinds.has(spec.kind) ? 0.25 : 0.62, {
        fontSize: fullWidthKinds.has(spec.kind) ? 9 : 10.5,
        color: qualityNotice ? COLORS.orange : COLORS.gray,
        italic: true,
        valign: 'top',
        breakLine: true,
        fit: 'shrink'
      });
    });
    return pptx;
  }
  function fileName(deck) {
    return `季度汇报-FY${deck.fiscalYear}-Q${deck.fiscalQuarter}-${deck.productName}-${deck.cutoffDate}.pptx`;
  }
  function androidFileName(deck) {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'), '-', String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'), String(now.getSeconds()).padStart(2, '0')].join('');
    return fileName(deck).replace(/\.pptx$/, `-${stamp}-${String(now.getMilliseconds()).padStart(3, '0')}-${Math.random().toString(36).slice(2, 6)}.pptx`);
  }
  const pendingSaves = new Map();
  function onAndroidSaveResult(id, result) {
    const pending = pendingSaves.get(id);
    if (!pending) return;
    pendingSaves.delete(id);
    if (result?.ok) pending.resolve(`${result.filename}\n保存位置：${result.location}`);else pending.reject(new Error(result?.error || 'PPT 保存失败，请重新选择本地目录。'));
  }
  const nextFrame = () => new Promise(resolve => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => resolve()) : setTimeout(resolve, 0));
  async function download(deck, PptxGenJS, onProgress = () => {}) {
    const pptx = createPresentation(deck, PptxGenJS);
    if (typeof globalThis.AndroidBridge !== 'undefined') {
      const bridge = globalThis.AndroidBridge;
      if (typeof bridge.beginPptxTransfer !== 'function' || typeof bridge.appendPptxChunk !== 'function' || typeof bridge.finishPptxTransfer !== 'function') throw new Error('当前 Android 版本不支持可靠的 PPT 保存，请更新应用。');
      if (pendingSaves.size) throw new Error('已有 PPT 正在保存，请先完成或取消。');
      onProgress({
        state: 'generating',
        message: '正在生成 PPT…'
      });
      await nextFrame();
      const data = await pptx.write({
        outputType: 'base64',
        compression: true
      });
      trace('PPT_BINARY_READY', {
        size: data.length
      });
      const id = `ppt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return new Promise((resolve, reject) => {
        pendingSaves.set(id, {
          resolve,
          reject
        });
        (async () => {
          try {
            trace('ANDROID_BRIDGE_CALL', {
              requestId: id,
              stage: 'beginPptxTransfer'
            });
            let error = await bridge.beginPptxTransfer(id, androidFileName(deck), data.length);
            if (error) throw new Error(error);
            const chunkSize = 64 * 1024;
            for (let offset = 0, index = 0; offset < data.length; offset += chunkSize, index += 1) {
              error = await bridge.appendPptxChunk(id, index, data.slice(offset, offset + chunkSize));
              if (error) throw new Error(error);
              onProgress({
                state: 'transferring',
                percent: Math.min(100, Math.round((offset + chunkSize) / data.length * 100)),
                message: '正在传输到系统保存器…'
              });
              await nextFrame();
            }
            error = await bridge.finishPptxTransfer(id);
            if (error) throw new Error(error);
            trace('CREATE_DOCUMENT_INTENT', {
              requestId: id
            });
            onProgress({
              state: 'picker',
              message: 'PPT 已生成，请选择保存位置。'
            });
          } catch (error) {
            try {
              bridge.cancelPptxTransfer?.(id);
            } catch {}
            pendingSaves.delete(id);
            reject(new Error(error?.message || '无法启动系统保存器，请重试。'));
          }
        })();
      });
    }
    await pptx.writeFile({
      fileName: fileName(deck),
      compression: true
    });
    return fileName(deck);
  }
  return {
    COLORS,
    SLIDE_IDS,
    buildDeckModel,
    createPresentation,
    download,
    onAndroidSaveResult,
    fileName,
    formatValue
  };
});
