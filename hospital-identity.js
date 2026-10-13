(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./assets/hospital-master.json') : root?.WORK_PROGRESS_HOSPITAL_MASTER);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HospitalIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (master) {
  'use strict';

  const text = v => String(v ?? '').trim();
  function createResolver(registry = {
    hospitals: []
  }) {
    const ids = new Map(),
      names = new Map();
    for (const hospital of registry.hospitals || []) {
      const keys = [hospital.hospitalId, hospital.purchaseUnitId, ...(hospital.purchaseUnitIds || []), ...(hospital.salesHospitalIds || []), ...(hospital.legacyIds || [])];
      for (const key of keys.filter(Boolean)) {
        if (ids.has(key) && ids.get(key).hospitalId !== hospital.hospitalId) throw new Error('HOSPITAL_IDENTITY_AUTHORITY_CONFLICT: ' + key);
        ids.set(key, hospital);
      }
      for (const name of [hospital.canonicalName, ...(hospital.aliases || [])].filter(Boolean)) {
        if (!names.has(name)) names.set(name, new Set());
        names.get(name).add(hospital);
      }
    }
    function resolve(id, name = '') {
      const key = text(id);
      if (key) return ids.get(key)?.hospitalId || key;
      const candidates = names.get(text(name));
      return candidates?.size === 1 ? [...candidates][0].hospitalId : '';
    }
    function migrate(value) {
      const visited = new Set();
      function walk(node) {
        if (!node || typeof node !== 'object' || visited.has(node)) return;
        visited.add(node);
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        for (const field of ['hospitalId', 'sourceRecommendationHospitalId']) {
          if (typeof node[field] !== 'string') continue;
          const previous = node[field];
          const canonical = resolve(previous, node.hospital || node.hospitalName);
          if (canonical && canonical !== previous) {
            if (field === 'hospitalId' && previous && !node.legacyHospitalId) node.legacyHospitalId = previous;
            node[field] = canonical;
          }
        }
        if (node.kind === 'hospital' && typeof node.id === 'string') node.id = resolve(node.id);
        if (Array.isArray(node.hospitalIds)) node.hospitalIds = node.hospitalIds.map(id => resolve(id));
        if (node.sourceType === 'hospital' && typeof node.sourceId === 'string') node.sourceId = resolve(node.sourceId);
        for (const field of ['sourceRecommendationKey', 'sourceRecommendationId', 'recommendationKey', 'key']) {
          if (typeof node[field] !== 'string') continue;
          node[field] = node[field].replace(/^(recommendation:)?hospital-maintenance:(.+)$/, (_, prefix, id) => (prefix || '') + 'hospital-maintenance:' + resolve(id));
        }
        const overrides = node.hospitalDirectoryOverrides?.hospitals;
        if (overrides && !Array.isArray(overrides)) {
          for (const oldId of Object.keys(overrides)) {
            const canonical = resolve(oldId);
            if (canonical !== oldId && !Object.prototype.hasOwnProperty.call(overrides, canonical)) {
              overrides[canonical] = overrides[oldId];
              delete overrides[oldId];
            }
          }
        }
        Object.values(node).forEach(walk);
      }
      walk(value);
      return value;
    }
    return Object.freeze({
      resolve,
      migrate,
      hospitals: registry.hospitals || []
    });
  }
  return Object.freeze({
    ...createResolver(master),
    createResolver
  });
});
