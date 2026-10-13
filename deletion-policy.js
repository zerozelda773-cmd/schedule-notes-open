(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DeletionPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const text = value => String(value ?? '').trim();
  const fields = { activity: ['activityId','relatedActivityId','sourceActivityId'], task: ['taskId','sourceTaskId','linkedTaskId'],
    customer: ['customerId','directorCustomerId','speakerCustomerId','sourceCustomerId','targetCustomerId'] };
  function references(kind, entity, context = {}) {
    const id = text(entity.customerId || entity.id), found = [], seen = new Set();
    function visit(value) {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (!Array.isArray(value) && value !== entity) {
        const byId = (fields[kind] || []).some(field => text(value[field]) === id)
          || (value.sourceType === kind && text(value.sourceId) === id)
          || (Array.isArray(value.relatedTaskIds) && kind === 'task' && value.relatedTaskIds.includes(id));
        const byContext = kind === 'customer' && text(value.customer || value.customerName) === text(entity.customerName)
          && (value.hospitalId ? value.hospitalId === entity.hospitalId : text(value.hospital || value.hospitalName) === text(entity.hospital))
          && (value.departmentId ? value.departmentId === entity.departmentId : text(value.department || value.departmentName) === text(entity.department));
        if (byId || byContext) found.push(value);
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
    }
    visit(context); return found;
  }
  function decide(kind, entity = {}, context = {}) {
    const referenced = references(kind, entity, context).length > 0;
    const completed = Boolean(entity.completedAt) || Number(entity.progress) >= 100 || ['completed','已完成','已复盘'].includes(entity.status);
    if (kind === 'task' && entity.sourceRecommendationKey && !completed)
      return { action: 'WITHDRAW', reason: 'RECOMMENDATION_EXECUTION', referenced };
    if (kind === 'activity') {
      const status = text(entity.approvalStatus || entity.status);
      const terminal = ['已取消', '已作废', 'cancelled', 'voided', 'archived'].includes(text(entity.status))
        || ['已取消', '已作废', 'cancelled', 'voided', 'archived'].includes(text(entity.approvalStatus))
        || Boolean(entity.archivedAt || entity.voidedAt || entity.cancelledAt);
      const draft = !terminal && entity.isDraft !== false && ['', '草稿', '未申请', '未提交'].includes(status)
        && !entity.formalizedAt && !entity.generatedAt && !entity.exportedAt;
      return { action: draft && !referenced ? 'DELETE' : 'ARCHIVE', reason: referenced ? 'REFERENCED_FACT' : draft ? 'DRAFT' : 'FORMAL_BUSINESS_FACT', referenced };
    }
    if (kind === 'customer') return { action: referenced ? 'ARCHIVE' : 'DELETE', reason: referenced ? 'SHARED_ENTITY_REFERENCED' : 'UNREFERENCED_ENTITY', referenced };
    const sourceFact = Boolean(entity.activityId || entity.relatedActivityId || (entity.sourceType && entity.sourceType !== 'manual') || entity.sourceId);
    return { action: referenced || completed || sourceFact ? 'ARCHIVE' : 'DELETE', reason: referenced ? 'REFERENCED_FACT' : completed || sourceFact ? 'FORMAL_BUSINESS_FACT' : 'USER_CREATED', referenced };
  }
  return { decide, references };
});
