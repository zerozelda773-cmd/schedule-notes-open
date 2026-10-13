(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DepartmentIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const text = value => String(value ?? '').trim();
  const key = value => text(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const unique = values => [...new Set(values.map(text).filter(Boolean))];
  const idsOf = entity => unique([...(Array.isArray(entity?.departmentIds) ? entity.departmentIds : []), entity?.departmentId]);
  function sharesDepartment(left, right) {
    if (text(left?.hospitalId) && text(right?.hospitalId) && text(left.hospitalId) !== text(right.hospitalId)) return false;
    const ids = idsOf(left),
      other = idsOf(right);
    return ids.some(id => other.includes(id));
  }
  function deterministicId(hospitalId, identity) {
    return text(hospitalId) && key(identity) ? `department:${encodeURIComponent(text(hospitalId))}:${encodeURIComponent(key(identity))}` : '';
  }
  function migrationId(hospitalId, legacyId) {
    let hash = 2166136261;
    for (const char of text(legacyId)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `department-migration:${encodeURIComponent(hospitalId)}:${(hash >>> 0).toString(36)}`;
  }
  function normalize(input) {
    const hospitalId = text(input.hospitalId);
    const canonicalName = text(input.canonicalName || input.departmentName || input.department || input.name);
    const supplied = text(input.departmentId || input.id);
    const sourceId = input.provenance?.source && input.provenance?.evidence ? text(input.sourceDepartmentId || input.externalDepartmentId) : '';
    const departmentId = sourceId && hospitalId ? `department-source:${encodeURIComponent(hospitalId)}:${encodeURIComponent(sourceId)}` : supplied.startsWith(`department:${encodeURIComponent(hospitalId)}:`) || supplied.startsWith(`department-source:${encodeURIComponent(hospitalId)}:`) || supplied.startsWith(`department-migration:${encodeURIComponent(hospitalId)}:`) ? supplied : deterministicId(hospitalId, input.canonicalIdentity || canonicalName);
    return {
      hospitalId,
      departmentId,
      sourceDepartmentId: sourceId || text(input.sourceDepartmentId),
      canonicalName,
      aliases: unique(input.aliases || input.departmentAliases || []),
      legacyIds: unique([...(input.legacyIds || []), supplied !== departmentId ? supplied : '']),
      aliasEvidence: (input.aliasEvidence || []).map(evidence => ({
        ...evidence
      })),
      sourceBindings: (input.sourceBindings || []).map(evidence => ({
        ...evidence,
        departmentIds: unique(evidence.departmentIds || [])
      })),
      provenance: input.provenance || {
        source: 'IDENTITY_CONTRACT',
        evidence: 'HOSPITAL_NAMESPACE_AND_CANONICAL_IDENTITY'
      },
      matchingQuality: supplied.startsWith('department-migration:') ? 'MATCHING_AMBIGUOUS' : departmentId ? 'EXACT' : 'NOT_LINKED'
    };
  }
  function createResolver(items = []) {
    const identities = new Map();
    const candidateIds = new Map();
    for (const item of items) {
      if (item.referenceOnly) continue;
      const nameKey = `${text(item.hospitalId)}\u001f${key(item.canonicalName || item.departmentName || item.department || item.name)}`;
      if (!candidateIds.has(nameKey)) candidateIds.set(nameKey, new Set());
      const supplied = text(item.departmentId || item.id || item.sourceDepartmentId);
      if (supplied) candidateIds.get(nameKey).add(supplied);
    }
    items.map(input => {
      const item = normalize(input);
      const existingIds = candidateIds.get(`${item.hospitalId}\u001f${key(item.canonicalName)}`);
      if (!input.referenceOnly && existingIds?.size > 1 && !item.departmentId.startsWith('department-source:')) {
        const legacyId = text(input.departmentId || input.id);
        if (legacyId && !legacyId.startsWith('department-migration:')) item.departmentId = migrationId(item.hospitalId, legacyId);
        item.matchingQuality = 'MATCHING_AMBIGUOUS';
      }
      return item;
    }).filter(item => item.departmentId).forEach(item => {
      const previous = identities.get(item.departmentId);
      if (!previous) identities.set(item.departmentId, item);else {
        if (item.departmentId.startsWith('department-source:') && key(item.canonicalName) !== key(previous.canonicalName) && !previous.aliases.some(alias => key(alias) === key(item.canonicalName)) && !item.aliases.some(alias => key(alias) === key(previous.canonicalName))) throw new Error('DEPARTMENT_IDENTITY_AUTHORITY_CONFLICT');
        previous.aliases = unique([...previous.aliases, ...item.aliases, item.canonicalName !== previous.canonicalName ? item.canonicalName : '']);
        previous.legacyIds = unique([...previous.legacyIds, ...item.legacyIds]);
        previous.aliasEvidence = [...new Map([...previous.aliasEvidence, ...item.aliasEvidence].map(evidence => [JSON.stringify(evidence), evidence])).values()];
        previous.sourceBindings = [...new Map([...previous.sourceBindings, ...item.sourceBindings].map(evidence => [JSON.stringify(evidence), evidence])).values()];
      }
    });
    for (const [id, item] of identities) {
      if (!id.startsWith('department:')) continue;
      const authorities = [...identities.values()].filter(candidate => candidate.hospitalId === item.hospitalId && candidate.departmentId.startsWith('department-source:') && [candidate.canonicalName, ...candidate.aliases].some(name => key(name) === key(item.canonicalName)));
      if (authorities.length !== 1) continue;
      authorities[0].legacyIds = unique([...authorities[0].legacyIds, id, ...item.legacyIds]);
      identities.delete(id);
    }
    const departments = [...identities.values()];
    function match(name, context = {}) {
      const hospitalId = text(context.hospitalId);
      if (!hospitalId) return {
        status: 'UNMATCHED',
        matchingQuality: 'NOT_LINKED',
        id: '',
        rawName: text(name),
        canonicalName: text(name)
      };
      const scoped = departments.filter(item => item.hospitalId === hospitalId);
      const unresolvedIds = candidateIds.get(`${hospitalId}\u001f${key(name)}`);
      if (unresolvedIds?.size > 1 && !scoped.some(item => item.departmentId.startsWith('department-source:') && key(item.canonicalName) === key(name))) return {
        status: 'AMBIGUOUS',
        matchingQuality: 'MATCHING_AMBIGUOUS',
        id: '',
        candidates: [...unresolvedIds].map(legacyId => ({
          hospitalId,
          legacyId,
          canonicalName: text(name)
        }))
      };
      if (text(context.sourceDepartmentId) && context.provenance?.source && context.provenance?.evidence) {
        const authority = normalize({
          hospitalId,
          department: name,
          sourceDepartmentId: context.sourceDepartmentId,
          provenance: context.provenance
        });
        const conflicts = scoped.filter(item => item.departmentId.startsWith('department-source:') && item.departmentId !== authority.departmentId && [item.canonicalName, ...item.aliases].some(alias => key(alias) === key(name)));
        if (conflicts.length) return {
          status: 'AMBIGUOUS',
          matchingQuality: 'MATCHING_AMBIGUOUS',
          id: '',
          candidates: [...conflicts, authority]
        };
        const previous = scoped.filter(item => key(item.canonicalName) === key(name));
        authority.legacyIds = unique(previous.flatMap(item => [item.departmentId, ...item.legacyIds]));
        return {
          ...authority,
          id: authority.departmentId,
          status: 'EXACT',
          rawName: text(name)
        };
      }
      const id = text(context.departmentId);
      if (!id) {
        const bindings = scoped.flatMap(item => item.sourceBindings || []).filter(binding => key(binding.sourceLabel) === key(name) && binding.hospitalId === hospitalId);
        const sets = [...new Map(bindings.map(binding => [unique(binding.departmentIds).sort().join('\u001f'), binding])).values()];
        if (sets.length > 1) return {
          status: 'AMBIGUOUS',
          matchingQuality: 'MATCHING_AMBIGUOUS',
          id: '',
          candidates: sets
        };
        if (sets.length === 1) {
          const binding = sets[0],
            entity = binding.departmentIds.length === 1 ? scoped.find(item => item.departmentId === binding.departmentIds[0]) : null;
          return {
            ...(entity || {}),
            status: 'EXACT',
            matchingQuality: 'EXACT',
            id: entity?.departmentId || '',
            departmentIds: binding.departmentIds,
            provenance: binding,
            rawName: text(name)
          };
        }
      }
      const candidates = scoped.filter(item => id ? item.departmentId === id || item.legacyIds.includes(id) : key(item.canonicalName) === key(name) || item.aliases.some(alias => key(alias) === key(name)));
      if (candidates.some(item => item.matchingQuality === 'MATCHING_AMBIGUOUS')) return {
        status: 'AMBIGUOUS',
        matchingQuality: 'MATCHING_AMBIGUOUS',
        id: '',
        candidates
      };
      if (candidates.length > 1) return {
        status: 'AMBIGUOUS',
        matchingQuality: 'MATCHING_AMBIGUOUS',
        id: '',
        candidates
      };
      if (candidates.length === 1) return {
        ...candidates[0],
        id: candidates[0].departmentId,
        status: 'EXACT',
        matchingQuality: 'EXACT',
        rawName: text(name)
      };
      if (id) return match(name, {
        hospitalId
      });
      const identity = normalize({
        hospitalId,
        department: name
      });
      return {
        ...identity,
        id: identity.departmentId,
        status: 'UNMATCHED',
        matchingQuality: 'UNMATCHED',
        rawName: text(name)
      };
    }
    function candidates(name, context = {}) {
      const scoped = departments.filter(item => item.hospitalId === text(context.hospitalId));
      const needle = key(name);
      const exact = match(name, context);
      const fuzzy = scoped.filter(item => [item.canonicalName, ...item.aliases].some(value => key(value).includes(needle) || needle && key(value).includes(needle.replace(/(?:外科|内科|病区|科室|科)$/u, '')) || needle && [...needle.replace(/(?:外科|内科|病区|科室|科)$/u, '')].some(char => /[\u4e00-\u9fff]/.test(char) && key(value).includes(char))));
      const exactIds = idsOf(exact).length ? idsOf(exact) : exact.id ? [exact.id] : [];
      const found = exact.status === 'EXACT' ? [...scoped.filter(item => exactIds.includes(item.departmentId)), ...fuzzy.filter(item => !exactIds.includes(item.departmentId))] : fuzzy;
      return {
        match: exact,
        fallbackAll: !found.length,
        candidates: (found.length ? found : scoped).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'zh-CN') || a.departmentId.localeCompare(b.departmentId))
      };
    }
    return {
      match,
      candidates,
      departments
    };
  }
  function confirmAliases(registry, {
    hospitalId,
    sourceLabel,
    departmentIds,
    source = 'ACTIVITY_DEPARTMENT_PICKER',
    confirmedAt = new Date().toISOString()
  }) {
    const resolver = createResolver(registry);
    const ids = unique(departmentIds || []);
    const selected = ids.map(id => resolver.departments.find(item => item.hospitalId === text(hospitalId) && item.departmentId === id));
    if (!text(sourceLabel) || !selected.length || selected.some(item => !item)) throw new Error('DEPARTMENT_ALIAS_CONFIRMATION_INVALID');
    const evidence = {
      type: 'USER_CONFIRMED_SOURCE_LABEL',
      source,
      sourceLabel: text(sourceLabel),
      hospitalId: text(hospitalId),
      departmentIds: ids,
      confirmedAt
    };
    return resolver.departments.map(item => {
      const sourceBindings = (item.sourceBindings || []).filter(binding => !(binding.hospitalId === text(hospitalId) && key(binding.sourceLabel) === key(sourceLabel)));
      if (!ids.includes(item.departmentId) || item.hospitalId !== text(hospitalId)) return {
        ...item,
        sourceBindings
      };
      return {
        ...item,
        aliases: ids.length === 1 ? unique([...item.aliases, text(sourceLabel)]) : item.aliases,
        aliasEvidence: ids.length === 1 ? [...(item.aliasEvidence || []), evidence] : item.aliasEvidence,
        sourceBindings: [...sourceBindings, evidence]
      };
    });
  }
  function migrate(state) {
    if (!state || typeof state !== 'object') return state;
    const references = [],
      seen = new Set();
    function visit(node, inheritedHospital = '') {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      const hospitalId = text(node.hospitalId || inheritedHospital);
      const name = text(node.departmentName || node.department || node.departmentRoom);
      if (hospitalId && name && idsOf(node).length < 2) references.push({
        node,
        hospitalId,
        name
      });
      Object.values(node).forEach(value => visit(value, hospitalId));
    }
    visit(state);
    const existing = state.settings?.departmentIdentityRegistry || [];
    const previousResolver = createResolver(existing);
    const resolver = createResolver([...existing, ...references.flatMap(({
      node,
      hospitalId,
      name
    }) => {
      const previous = previousResolver.match(name, {
        hospitalId,
        departmentId: node.departmentId
      });
      if (previous.status === 'AMBIGUOUS') return [];
      if (previous.status === 'EXACT' && idsOf(previous).length > 1) return [];
      if (previous.status === 'EXACT' && !node.sourceDepartmentId) return [{
        ...previous,
        aliases: unique([...previous.aliases, ...(node.departmentAliases || []), name !== previous.canonicalName ? name : ''])
      }];
      return [{
        referenceOnly: true,
        hospitalId,
        departmentName: name,
        departmentId: node.departmentId,
        departmentAliases: node.departmentAliases,
        legacyIds: node.legacyDepartmentIds,
        sourceDepartmentId: node.sourceDepartmentId,
        provenance: node.departmentProvenance
      }];
    })]);
    for (const {
      node,
      hospitalId,
      name
    } of references) {
      const identity = resolver.match(name, {
        hospitalId,
        departmentId: node.departmentId
      });
      node.departmentMatchingQuality = identity.matchingQuality;
      if (identity.status === 'EXACT' && idsOf(identity).length > 1) {
        if (text(node.departmentId)) node.legacyDepartmentIds = unique([...(node.legacyDepartmentIds || []), node.departmentId]);
        node.departmentId = '';
        node.departmentIds = idsOf(identity);
        node.departmentProvenance = identity.provenance;
        continue;
      }
      if (!identity.id) continue;
      if (text(node.departmentId) && node.departmentId !== identity.id) node.legacyDepartmentIds = unique([...(node.legacyDepartmentIds || []), node.departmentId]);
      node.departmentId = identity.id;
      node.departmentIds = [identity.id];
      node.departmentProvenance = identity.provenance;
    }
    state.settings ||= {};
    state.settings.departmentIdentityRegistry = resolver.departments;
    return state;
  }
  return Object.freeze({
    deterministicId,
    normalize,
    createResolver,
    confirmAliases,
    migrate,
    idsOf,
    sharesDepartment
  });
});
