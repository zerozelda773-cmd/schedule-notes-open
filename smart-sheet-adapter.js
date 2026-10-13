(function initSmartSheetAdapter(root) {
  const REQUIRED_FIELDS = ['date', 'product', 'hospital'];

  function normalize(value) { return String(value ?? '').trim(); }
  function validateConfig(config = {}) {
    const missing = ['corpId', 'sheetId'].filter((key) => !normalize(config[key]));
    return { valid: missing.length === 0, missing, message: missing.length ? `缺少授权配置：${missing.join('、')}` : '配置完整' };
  }

  function mapRows(rows = [], mapping = {}) {
    return rows.map((row, index) => {
      const mapped = {};
      Object.entries(mapping).forEach(([target, source]) => { mapped[target] = row[source]; });
      const missing = REQUIRED_FIELDS.filter((field) => !normalize(mapped[field]));
      return { index, valid: missing.length === 0, missing, record: mapped };
    });
  }

  function create(config = {}) {
    const checked = validateConfig(config);
    let status = checked.valid ? 'configured' : 'not-configured';
    let lastError = checked.valid ? '' : checked.message;
    return {
      getStatus() { return { status, lastError, configured: checked.valid, mode: 'adapter-only' }; },
      validateRows(rows, mapping) { return mapRows(rows, mapping); },
      async sync() {
        if (!checked.valid) { status = 'error'; lastError = checked.message; return { ok: false, code: 'MISSING_CONFIG', message: checked.message, records: [] }; }
        status = 'ready';
        return { ok: false, code: 'AUTH_NOT_IMPLEMENTED', message: 'SmartSheet Adapter 已就绪，等待企业微信授权参数后接入正式 API。', records: [] };
      },
    };
  }

  root.SmartSheetAdapter = { create, validateConfig, mapRows, requiredFields: [...REQUIRED_FIELDS] };
  if (typeof module === 'object' && module.exports) module.exports = root.SmartSheetAdapter;
}(typeof globalThis !== 'undefined' ? globalThis : window));
