(function (root, factory) {
  const api = factory(root?.TaskProgressAdapter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TaskProgressV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Adapter) {
  'use strict';

  function mount(config = {}) {
    if (!Adapter) throw new Error('TaskProgressAdapter 未加载');
    const root = config.root;
    if (!root) throw new Error('任务进度 V2 缺少挂载节点');
    const state = {
      period: 'today',
      sourceType: 'all',
      status: 'all',
      listSource: 'all',
      selectedRecommendationIds: new Set(),
      selectedTaskId: '',
      sourceDetails: false,
      recommendations: [],
      hospitalMaintenance: [],
      providersLoading: false,
      providerToken: 0,
      suggestionsCollapsed: false,
      addingRecommendations: false,
      showAllRecommendations: false
    };
    let rawTasks = [];
    const esc = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;'
    })[char]);
    const sourceIcon = source => ({
      activity: '日',
      customer: '客',
      hospital: '院',
      manual: '自'
    })[source] || '任';
    const developmentLabel = status => ({
      UNDEVELOPED: '未开发',
      CONTACTED: '初步接触',
      CULTIVATING: '培养中',
      PRIORITY: '重点推进',
      STABLE: '稳定使用',
      AT_RISK: '风险',
      PAUSED: '暂停',
      LOST: '流失',
      RECOVERABLE: '可恢复'
    })[status] || status || '待补充';
    const readTasks = () => (typeof config.getTasks === 'function' ? config.getTasks() : rawTasks) || [];
    const notify = message => config.onNotify?.(message);
    const selectedTask = () => readTasks().map(task => Adapter.normalizeTask(task)).find(task => task.id === state.selectedTaskId);
    const provider = () => config.providers || {};
    function formatDate(value) {
      if (!value) return '未设截止时间';
      const date = Adapter.localDate(value);
      if (Number.isNaN(date.getTime())) return esc(value);
      const hasTime = String(value).includes('T');
      return date.toLocaleString('zh-CN', hasTime ? {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      } : {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
      });
    }
    function relatedObject(task) {
      if (task.sourceType === 'customer') return [task.customer, task.hospital, task.department].filter(Boolean).join(' · ') || '未关联客户';
      if (task.sourceType === 'hospital') return [task.hospital, task.department].filter(Boolean).join(' · ') || '未关联医院';
      if (task.sourceType === 'activity') return [task.activity, task.hospital, task.department].filter(Boolean).join(' · ') || '未关联活动';
      return [task.hospital, task.department, task.customer, task.location].filter(Boolean).join(' · ') || '—';
    }
    function checklist(task) {
      const items = Array.isArray(task.checklist) ? task.checklist : [];
      const completed = items.filter(item => typeof item === 'object' ? item.completed : false).length;
      return items.length ? {
        completed,
        total: items.length,
        items
      } : null;
    }
    function sourceBadge(task) {
      return `<span class="tpv2-source source-${task.sourceType}"><i>${sourceIcon(task.sourceType)}</i>${esc(task.sourceLabel)}</span>`;
    }
    function statusBadge(task) {
      return `<span class="tpv2-status status-${task.status}">${esc(task.statusLabel)}</span>`;
    }
    function priorityBadge(task) {
      return `<span class="tpv2-priority priority-${task.priority}">${task.priority === 'high' ? '!' : ''}${esc(task.priorityLabel)}优先级</span>`;
    }
    function emptyState(message, action = '') {
      return `<div class="tpv2-empty"><span aria-hidden="true">✓</span><p>${esc(message)}</p>${action}</div>`;
    }
    function taskCard(task, compact = false) {
      const list = checklist(task);
      return `<button class="tpv2-task-card ${task.status === 'overdue' ? 'is-overdue' : ''} ${compact ? 'is-compact' : ''}" type="button" data-tpv2-task="${esc(task.id)}">
        <span class="tpv2-card-top">${sourceBadge(task)}${statusBadge(task)}</span>
        <strong>${esc(task.title)}</strong>
        <span class="tpv2-related">${esc(relatedObject(task))}</span>
        <span class="tpv2-card-foot"><span class="tpv2-due">${task.status === 'overdue' ? '已逾期 · ' : ''}${esc(formatDate(task.dueDate))}</span>${priorityBadge(task)}</span>
        ${list ? `<span class="tpv2-checklist-progress"><i style="--check-progress:${Math.round(list.completed / list.total * 100)}%"></i><b>${list.completed}/${list.total}</b></span>` : ''}
      </button>`;
    }
    function renderKpis(tasks) {
      const values = Adapter.kpis(tasks);
      return `<section class="tpv2-kpis" aria-label="任务概览">
        <article><span>今日待办</span><strong>${values.todayPending}</strong><small>今天到期</small></article>
        <article><span>本周待办</span><strong>${values.weekPending}</strong><small>本周内处理</small></article>
        <article class="is-alert"><span>已逾期</span><strong>${values.overdue}</strong><small>需要优先处理</small></article>
        <article class="tpv2-rate"><span>本周完成率</span><strong>${values.weekCompletionRate}%</strong><small>已完成 ${values.weekCompleted} / ${values.weekTotal}</small></article>
      </section>`;
    }
    function renderToday(tasks) {
      const mustDo = Adapter.todayMustDo(tasks);
      return `<section class="tpv2-section tpv2-today" aria-labelledby="tpv2TodayTitle">
        <header><div><p>优先处理</p><h2 id="tpv2TodayTitle">今日必须完成</h2></div><span>${mustDo.length} 项</span></header>
        ${mustDo.length ? `<div class="tpv2-task-grid">${mustDo.map(task => taskCard(task)).join('')}</div>` : emptyState('今天暂无必须处理的任务')}
      </section>`;
    }
    function recommendationId(item) {
      return String(item.id || item.recommendationId || item.customerId || item.customerName || '');
    }
    function renderRecommendations(tasks) {
      const allRecommendations = state.recommendations.map(Adapter.normalizeRecommendation);
      const recommendations = state.showAllRecommendations ? allRecommendations : allRecommendations.slice(0, 10);
      return `<section class="tpv2-section tpv2-recommendations" aria-labelledby="tpv2RecommendationsTitle">
        <header><div><p>业务建议</p><h2 id="tpv2RecommendationsTitle">推荐事项</h2></div><button type="button" data-tpv2-more-recommendations aria-expanded="${state.showAllRecommendations}" ${allRecommendations.length > 10 ? '' : 'disabled'}>${state.showAllRecommendations ? '收起' : '查看更多'}</button></header>
        <div class="tpv2-recommendation-period" role="group" aria-label="推荐事项日期范围"><button type="button" class="${state.period === 'today' ? 'active' : ''}" data-tpv2-period="today" aria-pressed="${state.period === 'today'}">今日</button><button type="button" class="${state.period === 'week' ? 'active' : ''}" data-tpv2-period="week" aria-pressed="${state.period === 'week'}">本周</button><button type="button" class="${state.period === 'month' ? 'active' : ''}" data-tpv2-period="month" aria-pressed="${state.period === 'month'}">自定义日期</button></div>
        ${state.providersLoading && !recommendations.length ? '<div class="tpv2-loading">正在读取推荐…</div>' : recommendations.length ? `<div class="tpv2-recommendation-list">${recommendations.map(item => {
        const id = recommendationId(item);
        const duplicate = Adapter.hasOpenCustomerVisit(tasks, item);
        const checked = state.selectedRecommendationIds.has(id);
        const reasons = Adapter.recommendationReasonLabels(item.recommendationReason);
        return `<article class="tpv2-recommendation-card ${duplicate ? 'is-added' : ''}">
            <div class="tpv2-recommendation-header"><label class="tpv2-select-customer"><input type="checkbox" data-tpv2-recommendation="${esc(id)}" ${checked ? 'checked' : ''} ${duplicate ? 'disabled' : ''}><span class="tpv2-fake-check" aria-hidden="true"></span><span class="tpv2-customer-copy"><strong>${esc(item.customerName || '未命名客户')}</strong><small>${esc([item.hospitalName, item.departmentName].filter(Boolean).join(' · ') || '医院/科室待补充')}</small></span><b class="tpv2-grade">${esc(item.customerGrade || '—')}</b></label><button class="task-surface-action is-primary" type="button" data-tpv2-add-one="${esc(id)}" ${duplicate || state.addingRecommendations ? 'disabled' : ''}>${duplicate ? '已加入任务池' : '加入任务池'}</button></div>
            <details><summary>建议与依据</summary><div class="tpv2-reasons">${reasons.length ? reasons.map(reason => `<span>${esc(reason)}</span>`).join('') : '<span>原因待上游补充</span>'}</div>
            <p>${esc(item.recommendationExplanation || '信息不足 / 待完善分析依据')}</p>
            <dl class="tpv2-recommendation-analysis">${[['客户阶段', item.customerStage], ['潜力', item.potential], ['开发难度', item.developmentDifficulty], ['策略类型', item.strategyType], ['建议拜访时间窗', item.recommendedTimeWindow]].map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
            <p>${esc(item.reason)}</p></details><label>拜访周期（天，可编辑）<input type="number" min="1" max="365" data-tpv2-interval="${esc(id)}" value="${item.recommendedVisitInterval || ''}" placeholder="待判断"></label>
            <details><summary>分析依据</summary>${item.analysisEvidence.length ? item.analysisEvidence.map(entry => `<p>${esc(entry.sourceType || entry.source || '来源待完善')} · ${esc(entry.sourceId || entry.evidenceId || '')}：${esc(entry.value || entry.summary || '内容待完善')}</p>`).join('') : '<p>信息不足 / 待完善</p>'}</details>
            <footer><button type="button" data-tpv2-dismiss="${esc(id)}">删除建议</button></footer>
            <footer><button type="button" data-tpv2-customer="${esc(item.customerId || item.customerName)}">查看档案</button><span>${duplicate ? '已有未完成拜访任务' : '可加入本次任务池'}</span></footer>
          </article>`;
      }).join('')}</div><div class="tpv2-selection-bar"><span>前 ${recommendations.length} 条 · 已选择 <strong>${state.selectedRecommendationIds.size}</strong> 人</span><button type="button" data-tpv2-add-selected ${state.selectedRecommendationIds.size && !state.addingRecommendations ? '' : 'disabled'}>确认加入任务</button></div>` : emptyState('当前暂无需要优先拜访的客户')}
      </section>`;
    }
    function maintenanceItems(tasks) {
      const provided = state.hospitalMaintenance.map(Adapter.normalizeHospitalMaintenance);
      const seen = new Set();
      return provided.filter(item => {
        const key = item.hospitalId || item.hospitalName || item.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    function missingSummary(fields = []) {
      const visible = fields.slice(0, 3);
      const remaining = fields.length - visible.length;
      return `${visible.map(field => `<span>${esc(field)}</span>`).join('')}${remaining > 0 ? `<span>还有 ${remaining} 项</span>` : ''}`;
    }
    function renderMaintenance(tasks) {
      const allItems = maintenanceItems(tasks);
      const items = allItems.slice(0, 4);
      return `<section class="tpv2-section tpv2-maintenance" aria-labelledby="tpv2MaintenanceTitle">
        <header><div><p>资料质量</p><h2 id="tpv2MaintenanceTitle">医院信息维护</h2></div><span>${allItems.length ? `${allItems.length} 家待完善` : '状态驱动'}</span></header>
        ${state.providersLoading && !items.length ? '<div class="tpv2-loading">正在检查资料状态…</div>' : items.length ? `<div class="tpv2-maintenance-list">${items.map(item => `<article class="tpv2-maintenance-card" data-maintenance-recommendation="${esc(item.id)}">
          <div><strong>${esc(item.hospitalName || '未命名医院')}</strong><span>${item.completeness == null ? esc(item.informationStatus || '完整度待上游提供') : `资料完整度 ${item.completeness}%`}</span></div>
          ${item.completeness == null ? '' : `<div class="tpv2-completeness" aria-label="资料完整度 ${item.completeness}%"><i style="--completeness:${item.completeness}%"></i></div>`}
          <p><b>缺失：</b>${item.missingFields?.length ? missingSummary(item.missingFields) : '<span>缺失项待上游提供</span>'}</p>
          <footer>${item.taskId ? `<button type="button" data-tpv2-task="${esc(item.taskId)}">查看任务</button>` : `<button class="is-primary" type="button" data-tpv2-add-hospital="${esc(item.id)}"${item.hospitalId ? '' : ' disabled'}>${item.hospitalId ? '加入任务' : '匹配待确认'}</button>`}<button type="button" data-tpv2-dismiss-hospital="${esc(item.id)}">不再推荐</button><button type="button" data-tpv2-hospital="${esc(item.hospitalId)}">查看医院资料</button></footer>
        </article>`).join('')}</div>` : emptyState('医院资料当前无需维护')}
      </section>`;
    }
    function renderFuture(tasks) {
      const future = Adapter.futureTasks(tasks).slice(0, 4);
      return `<section class="tpv2-section tpv2-future" aria-labelledby="tpv2FutureTitle"><header><div><p>稍后处理</p><h2 id="tpv2FutureTitle">后续任务</h2></div><button type="button" data-tpv2-scroll-all>查看全部</button></header>${future.length ? `<div class="tpv2-future-list">${future.map(task => taskCard(task, true)).join('')}</div>` : emptyState('当前暂无后续任务')}</section>`;
    }
    function renderAllTasks(tasks) {
      const filtered = Adapter.sortTasks(Adapter.filterTasks(tasks, {
        period: state.period,
        sourceType: state.listSource,
        status: state.status
      }));
      const tabs = [['all', '全部'], ...Object.entries(Adapter.SOURCE_LABELS)];
      return `<section class="tpv2-section tpv2-all" id="tpv2AllTasks" aria-labelledby="tpv2AllTitle"><header><div><p>完整任务列表</p><h2 id="tpv2AllTitle">全部任务</h2></div><span>${filtered.length} 项</span></header>
        <div class="tpv2-tabs" role="tablist">${tabs.map(([key, label]) => `<button role="tab" type="button" data-tpv2-list-source="${key}" aria-selected="${state.listSource === key}" class="${state.listSource === key ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>
        ${filtered.length ? `<div class="tpv2-table-wrap"><table><thead><tr><th>任务</th><th>来源</th><th>关联对象</th><th>截止时间</th><th>优先级</th><th>状态</th></tr></thead><tbody>${filtered.map(task => `<tr tabindex="0" data-tpv2-task="${esc(task.id)}"><td><strong>${esc(task.title)}</strong></td><td>${sourceBadge(task)}</td><td>${esc(relatedObject(task))}</td><td>${esc(formatDate(task.dueDate))}</td><td>${priorityBadge(task)}</td><td>${statusBadge(task)}</td></tr>`).join('')}</tbody></table></div><div class="tpv2-mobile-task-list">${filtered.map(task => taskCard(task, true)).join('')}</div>` : emptyState('暂无任务，可新建其他任务', '<button type="button" data-tpv2-new-manual>＋ 新建其他任务</button>')}
      </section>`;
    }
    function detailRows(task) {
      const rows = [['来源', task.sourceLabel], ['状态', task.statusLabel], ['优先级', `${task.priorityLabel}优先级`], ['截止时间', formatDate(task.dueDate)], ['创建时间', task.createdAt ? formatDate(task.createdAt) : ''], ['关联医院', task.hospital], ['科室', task.department], ['客户', task.customer], ['活动', task.activity || (task.activityId ? '已关联活动' : '')]].filter(([, value]) => value);
      return rows.map(([label, value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('');
    }
    function renderSourceDetail(task) {
      if (task.sourceType === 'activity') return `<section><h3>关联活动</h3><p>${esc(task.activity || '已关联活动')}</p><button type="button" data-tpv2-activity="${esc(task.activityId || task.sourceId)}">查看原活动</button></section>`;
      if (task.sourceType === 'customer') return `<section><h3>本次拜访</h3><div class="tpv2-detail-grid"><div><span>客户等级</span><strong>${esc(task.customerGrade || '待补充')}</strong></div><div><span>上次跟进</span><strong>${esc(task.lastFollowUpAt ? formatDate(task.lastFollowUpAt) : '暂无数据')}</strong></div><div><span>开发状态</span><strong>${esc(developmentLabel(task.currentDevelopmentStatus))}</strong></div><div><span>下一步动作</span><strong>${esc(task.nextAction || '待补充')}</strong></div></div><p><b>推荐原因：</b>${esc(Adapter.recommendationReasonLabels(task.recommendationReason).join('、') || '待补充')}</p><p><b>推荐依据：</b>${esc(task.recommendationExplanation || '待补充')}</p><p><b>本次目标：</b>${esc(task.visitGoal || '待补充')}</p><div class="tpv2-source-actions"><button type="button" data-tpv2-customer="${esc(task.customerId || task.sourceId)}">查看客户档案</button>${task.status === 'completed' ? '' : `<button class="is-primary" type="button" data-tpv2-complete-visit="${esc(task.id)}">完成拜访并记录</button>`}</div></section>`;
      if (task.sourceType === 'hospital') {
        const groups = task.missingGroups || {};
        const hospitalFields = Array.isArray(groups.hospital) ? groups.hospital : [];
        const departments = Array.isArray(groups.departments) ? groups.departments : [];
        return `<section class="tpv2-hospital-detail"><h3>待完善资料</h3><div class="tpv2-detail-grid"><div><span>资料完整度</span><strong>${task.completeness == null ? '待计算' : `${task.completeness}%`}</strong></div><div><span>最近检测</span><strong>${task.lastCheckedAt ? esc(formatDate(task.lastCheckedAt)) : '待检测'}</strong></div><div><span>维护周期</span><strong>第 ${Number(task.maintenanceCycle) || 1} 轮</strong></div><div><span>完成方式</span><strong>补齐数据后自动完成</strong></div></div>${hospitalFields.length ? `<div class="tpv2-missing-group"><strong>医院资料</strong><p>${hospitalFields.map(field => `<span class="tpv2-missing">${esc(field.label || field.field)}</span>`).join('')}</p></div>` : ''}${departments.map(department => `<div class="tpv2-missing-group"><strong>${esc(department.departmentName || '未命名科室')}</strong><p>${(department.missingFields || []).map(field => `<span class="tpv2-missing">${esc(field.label || field.field)}</span>`).join('')}</p></div>`).join('')}${!hospitalFields.length && !departments.length ? `<p>${task.missingFields.length ? task.missingFields.map(field => `<span class="tpv2-missing">${esc(field)}</span>`).join('') : '当前缺失项已清除'}</p>` : ''}<button class="is-primary" type="button" data-tpv2-hospital="${esc(task.hospitalId)}">去完善资料</button></section>`;
      }
      return '';
    }
    function renderDrawer(task) {
      if (!task) return '';
      const list = checklist(task);
      const managedHospital = task.sourceType === 'hospital' && task.taskType === 'hospital_profile_maintenance';
      const salesAction = task.hospital || task.hospitalId || task.product ? `<button type="button" data-tpv2-sales="${esc(task.id)}">查看医院 / 产品销售</button>` : '';
      return `<dialog class="tpv2-drawer" id="tpv2Drawer" aria-labelledby="tpv2DrawerTitle"><article>
        <header><div>${sourceBadge(task)}<h2 id="tpv2DrawerTitle">${esc(task.title)}</h2></div><div class="task-header-actions">${task.sourceRecommendationKey && !['completed', 'cancelled'].includes(task.status) ? `<button class="task-withdraw-arrow" type="button" data-tpv2-withdraw="${esc(task.id)}" aria-label="撤回建议" title="撤回建议">↶</button>` : ''}<button class="icon-button" type="button" data-tpv2-close aria-label="关闭任务详情">×</button></div></header>
        <div class="tpv2-drawer-body"><div class="tpv2-detail-grid">${detailRows(task)}</div>
          ${task.description ? `<section><h3>描述 / 备注</h3><p>${esc(task.description)}</p></section>` : ''}
          ${list ? `<section><h3>Checklist · ${list.completed}/${list.total}</h3><ul>${list.items.map(item => `<li class="${typeof item === 'object' && item.completed ? 'done' : ''}">${typeof item === 'object' && item.completed ? '✓ ' : '○ '}${esc(typeof item === 'object' ? item.label || item.title : item)}</li>`).join('')}</ul></section>` : ''}
          ${renderSourceDetail(task)}
          ${task.taskType === 'customer_visit' ? `<section><h3>拜访计划</h3><p>计划时间：${esc(task.due || task.dueDate || '待安排')} · 周期：${task.visitIntervalDays ? `${esc(task.visitIntervalDays)} 天` : '待判断'} · 进度：${task.progress}% · ${esc(task.statusLabel)}</p><button type="button" data-tpv2-edit-visit="${esc(task.id)}">编辑客户拜访</button>${task.sourceRecommendationKey ? `<details><summary>建议维护</summary><button type="button" data-tpv2-dismiss-task="${esc(task.id)}">删除建议</button></details>` : ''}</section>` : ''}
        </div>
        <footer><div class="tpv2-status-actions">${managedHospital ? `<span class="tpv2-managed-hint">系统维护任务不能手动完成、取消或重开</span>${!['completed', 'cancelled'].includes(task.status) ? `<button type="button" data-tpv2-status="in_progress" data-task-id="${esc(task.id)}">开始处理</button>` : ''}` : !['completed', 'cancelled'].includes(task.status) ? `<button type="button" data-tpv2-status="in_progress" data-task-id="${esc(task.id)}">开始处理</button>${task.sourceType === 'customer' && task.taskType === 'customer_visit' ? '' : `<button type="button" data-tpv2-status="completed" data-task-id="${esc(task.id)}">标记完成</button>`}<button type="button" data-tpv2-status="cancelled" data-task-id="${esc(task.id)}">取消任务</button>` : `<button type="button" data-tpv2-status="pending" data-task-id="${esc(task.id)}">重新打开</button>`}${salesAction}</div>${task.sourceType === 'manual' || task.taskType === 'customer_profile_maintenance' ? `<button class="is-primary" type="button" data-tpv2-edit-manual="${esc(task.id)}">编辑任务</button>` : ''}</footer>
      </article></dialog>`;
    }
    function render() {
      const tasks = readTasks();
      const nativeVisit = tasks.find(task => String(task.id) === state.selectedTaskId && ['customer_visit', 'hospital_profile_maintenance', 'hospital_maintenance'].includes(task.taskType));
      const nativeEditor = nativeVisit?.taskType === 'customer_visit' ? config.onEditCustomerVisit : config.onEditHospitalMaintenance;
      if (nativeVisit && nativeEditor && !state.sourceDetails) {
        state.selectedTaskId = '';
        queueMicrotask(() => nativeEditor(nativeVisit));
      }
      root.innerHTML = `<div class="tpv2-shell tpv2-embedded-shell ${state.suggestionsCollapsed ? 'is-collapsed' : ''}">
        <header class="tpv2-embedded-header"><button class="tpv2-collapse-toggle" type="button" data-tpv2-toggle-suggestions aria-expanded="${!state.suggestionsCollapsed}" aria-controls="tpv2SuggestionBody">业务任务建议</button></header>
        <div id="tpv2SuggestionBody" ${state.suggestionsCollapsed ? 'hidden' : ''}>${renderRecommendations(tasks)}${renderMaintenance(tasks)}</div>
      </div>${renderDrawer(selectedTask())}`;
      if (state.selectedTaskId) queueMicrotask(() => {
        const drawer = root.querySelector('#tpv2Drawer');
        if (drawer && !drawer.open) drawer.showModal();
      });
    }
    function loadProviders() {
      const token = ++state.providerToken;
      const tasks = readTasks();
      const sources = [['recommendations', provider().getCustomerRecommendations], ['hospitalMaintenance', provider().getHospitalMaintenance]];
      state.providersLoading = false;
      sources.forEach(([key, reader]) => {
        if (typeof reader !== 'function') {
          state[key] = [];
          return;
        }
        try {
          const result = reader({
            tasks: tasks.map(task => Adapter.normalizeTask(task))
          });
          if (result && typeof result.then === 'function') {
            state.providersLoading = true;
            Promise.resolve(result).then(items => {
              if (token !== state.providerToken) return;
              state[key] = Array.isArray(items) ? items : [];
              state.providersLoading = false;
              render();
            }).catch(error => {
              if (token !== state.providerToken) return;
              state[key] = [];
              state.providersLoading = false;
              config.onProviderError?.(key, error);
              render();
            });
          } else state[key] = Array.isArray(result) ? result : [];
        } catch (error) {
          state[key] = [];
          config.onProviderError?.(key, error);
        }
      });
    }
    async function addRecommendations(ids) {
      if (!ids.length || state.addingRecommendations) return;
      state.addingRecommendations = true;
      render();
      try {
        const result = await config.onAddCustomerTasks?.(state.recommendations, ids);
        ids.forEach(id => state.selectedRecommendationIds.delete(id));
        notify(result?.added ? `已加入 ${result.added} 项客户拜访任务${result.skipped ? `，跳过重复 ${result.skipped} 项` : ''}` : result?.skipped ? '所选客户已有未完成拜访任务' : '已加入任务');
      } catch (error) {
        notify(error.message || '加入任务失败');
      } finally {
        state.addingRecommendations = false;
        update({
          tasks: readTasks()
        });
      }
    }
    root.addEventListener('change', event => {
      if (event.target.matches('[data-tpv2-interval]')) {
        const item = state.recommendations.find(entry => recommendationId(entry) === event.target.dataset.tpv2Interval);
        if (item) {
          item.visitIntervalDays = event.target.value ? Math.max(1, Math.min(365, Number(event.target.value))) : null;
          config.onRecommendationPlan?.(item, item.visitIntervalDays);
        }
        return;
      }
      const recommendation = event.target.closest('[data-tpv2-recommendation]');
      if (recommendation) {
        if (recommendation.checked) state.selectedRecommendationIds.add(recommendation.dataset.tpv2Recommendation);else state.selectedRecommendationIds.delete(recommendation.dataset.tpv2Recommendation);
        render();
        return;
      }
      if (event.target.matches('[data-tpv2-source]')) {
        state.sourceType = event.target.value;
        state.listSource = event.target.value;
        render();
        return;
      }
      if (event.target.matches('[data-tpv2-status-filter]')) {
        state.status = event.target.value;
        render();
      }
    });
    root.addEventListener('keydown', event => {
      const row = event.target.closest('tr[data-tpv2-task]');
      if (row && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        state.selectedTaskId = row.dataset.tpv2Task;
        render();
      }
    });
    root.addEventListener('click', event => {
      const addHospital = event.target.closest('[data-tpv2-add-hospital]');
      if (addHospital) {
        const item = state.hospitalMaintenance.find(item => String(item.id) === addHospital.dataset.tpv2AddHospital);
        if (item) config.onAddHospitalTask?.(item);
        update({
          tasks: readTasks()
        });
        return;
      }
      const dismissHospital = event.target.closest('[data-tpv2-dismiss-hospital]');
      if (dismissHospital) {
        const item = state.hospitalMaintenance.find(item => String(item.id) === dismissHospital.dataset.tpv2DismissHospital);
        if (item) config.onRecommendationAction?.('dismiss', {
          ...item,
          sourceType: 'hospital',
          sourceRecommendationType: 'hospital-maintenance'
        });
        update({
          tasks: readTasks()
        });
        return;
      }
      if (event.target.closest('[data-tpv2-toggle-suggestions]')) {
        state.suggestionsCollapsed = !state.suggestionsCollapsed;
        render();
        return;
      }
      if (event.target.closest('[data-tpv2-more-recommendations]')) {
        state.showAllRecommendations = !state.showAllRecommendations;
        render();
        return;
      }
      const period = event.target.closest('[data-tpv2-period]');
      if (period) {
        state.period = period.dataset.tpv2Period;
        render();
        return;
      }
      const tab = event.target.closest('[data-tpv2-list-source]');
      if (tab) {
        state.listSource = tab.dataset.tpv2ListSource;
        render();
        return;
      }
      if (event.target.closest('[data-tpv2-new-manual]')) {
        config.onCreateManual?.();
        return;
      }
      const addOne = event.target.closest('[data-tpv2-add-one]');
      if (addOne) {
        if (!addOne.disabled) addRecommendations([addOne.dataset.tpv2AddOne]);
        return;
      }
      if (event.target.closest('[data-tpv2-add-selected]')) {
        addRecommendations([...state.selectedRecommendationIds]);
        return;
      }
      const editVisit = event.target.closest('[data-tpv2-edit-visit]');
      if (editVisit) {
        const task = readTasks().find(entry => entry.id === editVisit.dataset.tpv2EditVisit);
        closeDrawer();
        config.onEditCustomerVisit?.(task);
        return;
      }
      const withdraw = event.target.closest('[data-tpv2-withdraw]');
      const dismissTask = event.target.closest('[data-tpv2-dismiss-task]');
      if (withdraw || dismissTask) {
        const task = readTasks().find(entry => entry.id === (withdraw?.dataset.tpv2Withdraw || dismissTask?.dataset.tpv2DismissTask));
        closeDrawer();
        config.onRecommendationAction?.(withdraw ? 'withdraw' : 'dismiss', task);
        return;
      }
      const dismiss = event.target.closest('[data-tpv2-dismiss]');
      if (dismiss) {
        const item = state.recommendations.find(entry => recommendationId(entry) === dismiss.dataset.tpv2Dismiss);
        if (item) config.onRecommendationAction?.('dismiss', item);
        return;
      }
      const taskButton = event.target.closest('[data-tpv2-task]');
      if (taskButton) {
        openTask(taskButton.dataset.tpv2Task);
        return;
      }
      if (event.target.closest('[data-tpv2-close]')) {
        closeDrawer();
        return;
      }
      const edit = event.target.closest('[data-tpv2-edit-manual]');
      if (edit) {
        const task = readTasks().find(item => String(item.id) === edit.dataset.tpv2EditManual);
        root.querySelector('#tpv2Drawer')?.close();
        state.selectedTaskId = '';
        config.onEditManual?.(task);
        return;
      }
      const status = event.target.closest('[data-tpv2-status]');
      if (status && status.dataset.taskId) {
        config.onUpdateTaskStatus?.(status.dataset.taskId, status.dataset.tpv2Status);
        return;
      }
      const customer = event.target.closest('[data-tpv2-customer]');
      if (customer) {
        const sourceTask = state.selectedTaskId ? readTasks().find(item => String(item.id) === String(state.selectedTaskId)) : null;
        config.onViewCustomer?.(customer.dataset.tpv2Customer, sourceTask ? Adapter.normalizeTask(sourceTask) : null);
        return;
      }
      const visit = event.target.closest('[data-tpv2-complete-visit]');
      if (visit) {
        config.onCompleteCustomerVisit?.(visit.dataset.tpv2CompleteVisit);
        return;
      }
      const hospital = event.target.closest('[data-tpv2-hospital]');
      if (hospital) {
        config.onViewHospital?.(hospital.dataset.tpv2Hospital, {taskId:state.selectedTaskId || ''});
        return;
      }
      const activity = event.target.closest('[data-tpv2-activity]');
      if (activity) {
        config.onViewActivity?.(activity.dataset.tpv2Activity);
        return;
      }
      const sales = event.target.closest('[data-tpv2-sales]');
      if (sales) {
        const task = readTasks().find(item => String(item.id) === sales.dataset.tpv2Sales);
        if (task) config.onViewSales?.(Adapter.normalizeTask(task));
        return;
      }
      if (event.target.closest('[data-tpv2-scroll-all]')) root.querySelector('#tpv2AllTasks')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
    function update(data = {}) {
      if (Array.isArray(data.tasks)) rawTasks = data.tasks;
      loadProviders();
      render();
    }
    function closeDrawer() {
      state.selectedTaskId = '';
      state.sourceDetails = false;
      root.querySelector('#tpv2Drawer')?.close();
    }
    function openTask(taskId) {
      state.sourceDetails = false;
      const task = readTasks().find(item => String(item.id) === String(taskId));
      if (!task) return false;
      if (task.taskType === 'customer_visit' && config.onEditCustomerVisit) {
        closeDrawer();
        config.onEditCustomerVisit(task);
        return true;
      }
      if (['hospital_profile_maintenance', 'hospital_maintenance'].includes(task.taskType) && config.onEditHospitalMaintenance) {
        closeDrawer();
        config.onEditHospitalMaintenance(task);
        return true;
      }
      state.selectedTaskId = String(taskId);
      render();
      return true;
    }
    function openTaskDetails(taskId) {
      if (!readTasks().some(item => String(item.id) === String(taskId))) return false;
      state.sourceDetails = true;
      state.selectedTaskId = String(taskId);
      render();
      return true;
    }
    function getNavigationState() {
      return {
        period: state.period,
        sourceType: state.sourceType,
        status: state.status,
        listSource: state.listSource,
        selectedTaskId: state.selectedTaskId,
        sourceDetails: state.sourceDetails,
        selectedRecommendationIds: [...state.selectedRecommendationIds],
        suggestionsCollapsed: state.suggestionsCollapsed
      };
    }
    function restoreNavigationState(snapshot = {}) {
      if (['today', 'week', 'month'].includes(snapshot.period)) state.period = snapshot.period;
      if (snapshot.sourceType === 'all' || Adapter.SOURCE_LABELS[snapshot.sourceType]) state.sourceType = snapshot.sourceType;
      if (snapshot.status === 'all' || Adapter.STATUS_LABELS[snapshot.status]) state.status = snapshot.status;
      if (snapshot.listSource === 'all' || Adapter.SOURCE_LABELS[snapshot.listSource]) state.listSource = snapshot.listSource;
      state.selectedRecommendationIds = new Set(Array.isArray(snapshot.selectedRecommendationIds) ? snapshot.selectedRecommendationIds.map(String) : []);
      if (typeof snapshot.suggestionsCollapsed === 'boolean') state.suggestionsCollapsed = snapshot.suggestionsCollapsed;
      state.selectedTaskId = readTasks().some(task => String(task.id) === String(snapshot.selectedTaskId || '')) ? String(snapshot.selectedTaskId) : '';
      state.sourceDetails = Boolean(state.selectedTaskId && snapshot.sourceDetails);
      render();
    }
    update({
      tasks: config.tasks || []
    });
    return {
      update,
      render,
      openTask,
      openTaskDetails,
      closeDrawer,
      getState: () => ({
        ...state,
        selectedRecommendationIds: [...state.selectedRecommendationIds]
      }),
      getNavigationState,
      restoreNavigationState,
      hasOpenLayer: () => Boolean(state.selectedTaskId),
      destroy: () => {
        root.innerHTML = '';
      }
    };
  }
  return {
    mount
  };
});

