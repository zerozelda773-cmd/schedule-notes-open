(function (root, factory) {
  const api = factory(root?.ProductRegistry || (typeof require === 'function' ? require('./product-registry.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HospitalMaintenanceAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Products) {
  'use strict';

  const HOSPITAL_TASK_TYPE = 'hospital_profile_maintenance';
  const LEGACY_HOSPITAL_TASK_TYPE = 'hospital_maintenance';
  const HOSPITAL_REQUIRED_FIELDS = Object.freeze([{
    key: 'hospitalId',
    label: '稳定医院标识',
    severity: 'critical'
  }, {
    key: 'hospitalName',
    label: 'Synthetic Hospital Example',
    severity: 'critical'
  }, {
    key: 'hospitalCode',
    label: '医院编码',
    severity: 'important'
  }, {
    key: 'hospitalLevel',
    label: '医院等级',
    severity: 'important'
  }, {
    key: 'office',
    label: '办事处归属',
    severity: 'important'
  }, {
    key: 'owner',
    label: '资料负责人',
    severity: 'important'
  }, {
    key: 'address',
    label: '地址',
    severity: 'optional'
  }]);
  const DEPARTMENT_REQUIRED_FIELDS = Object.freeze([{
    key: 'departmentId',
    label: '稳定科室标识',
    severity: 'critical'
  }, {
    key: 'departmentName',
    label: '科室名称',
    severity: 'critical'
  }, {
    key: 'hospitalId',
    label: '归属医院',
    severity: 'critical'
  }, {
    key: 'director',
    label: '科室负责人',
    severity: 'important'
  }]);
  const EMPTY_PLACEHOLDERS = new Set(['', 'n/a', 'na', 'none', 'null', 'unknown', '未知', '不详', '待定', '待补充', '-', '--', '—']);
  function text(value) {
    return String(value ?? '').trim();
  }
  function compact(value) {
    return text(value).replace(/[\s_()（）/\\·,，.。;；:\-]+/g, '').toLowerCase();
  }
  function isMeaningfulValue(value) {
    if (value === 0 || value === false) return true;
    if (value == null) return false;
    return !EMPTY_PLACEHOLDERS.has(text(value).toLowerCase());
  }
  function dateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function shiftDate(value, days) {
    const [year, month, day] = dateKey(value).split('-').map(Number);
    if (!year) return '';
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }
  function timestamp(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function firstMeaningful(values) {
    return values.find(isMeaningfulValue) ?? '';
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }
  function parseMappingWorkbook(workbook, XLSX, sourceName = '') {
    const rows = [];
    for (const sheetName of workbook.SheetNames || []) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: '',
        raw: false
      });
      const headerAt = matrix.findIndex(row => row.some(v => text(v) === '购进单位ID') && row.some(v => text(v) === '购进单位名称'));
      if (headerAt < 0) continue;
      const header = matrix[headerAt].map(text);
      const purchaseIdColumn = header.indexOf('购进单位ID');
      const sheetRange = XLSX.utils.decode_range(workbook.Sheets[sheetName]['!ref']);
      const get = (row, names) => {
        const at = header.findIndex(v => names.includes(v));
        return at < 0 ? '' : text(row[at]);
      };
      matrix.slice(headerAt + 1).forEach((row, index) => {
        const purchaseIdCell = workbook.Sheets[sheetName][XLSX.utils.encode_cell({
          r: sheetRange.s.r + headerAt + index + 1,
          c: sheetRange.s.c + purchaseIdColumn
        })];
        const purchaseUnitId = text(purchaseIdCell?.v);
        const hospital = get(row, ['购进单位名称']);
        if (!purchaseUnitId || !hospital) return;
        rows.push({
          purchaseUnitId,
          hospitalCode: purchaseUnitId,
          hospital,
          hospitalName: hospital,
          office: get(row, ['办事处', '所属办事处']),
          city: get(row, ['城市']),
          district: get(row, ['区县']),
          hospitalLevel: get(row, ['医院级别', '医院等级']),
          source: 'HOSPITAL_ID_MAPPING',
          sourceName,
          sourceSheet: sheetName,
          sourceRow: sheetRange.s.r + headerAt + index + 2
        });
      });
    }
    return {
      rows,
      sourceName
    };
  }
  function canonicalSourceRows(rows) {
    const byCode = new Map();
    const byName = new Map();
    rows.forEach(row => {
      const code = text(row.purchaseUnitId || row.hospitalCode || row.code);
      const name = text(row.hospitalName || row.hospital);
      if (code) {
        if (!byCode.has(code)) byCode.set(code, []);
        byCode.get(code).push(row);
      }
      if (name) {
        if (!byName.has(compact(name))) byName.set(compact(name), new Set());
        if (code) byName.get(compact(name)).add(code);
      }
    });
    const inferredCode = row => {
      const name = text(row.hospitalName || row.hospital);
      const codes = byName.get(compact(name));
      if (codes?.size === 1) return [...codes][0];
      if (byCode.has(name)) return name;
      const mixed = name.match(/^(\d{3,})[\s·\-:：]+(.+)$/);
      return mixed && byCode.has(mixed[1]) && byCode.get(mixed[1]).some(item => compact(item.hospitalName || item.hospital) === compact(mixed[2])) ? mixed[1] : '';
    };
    rows.forEach(row => {
      if (text(row.purchaseUnitId || row.hospitalCode || row.code)) return;
      const code = inferredCode(row);
      if (code) byCode.get(code).push(row);
    });
    const resolved = new Map();
    byCode.forEach((group, code) => {
      const masters = group.filter(row => row.source === 'CUSTOMER_MASTER' && text(row.hospitalId));
      const explicit = group.filter(row => text(row.hospitalId) && !/^sale-/.test(text(row.hospitalId)));
      const owners = masters.length ? masters : explicit;
      const ownerIds = new Set(owners.map(row => text(row.hospitalId)));
      if (ownerIds.size > 1) return;
      const mappedIdentity = group.some(row => row.source === 'HOSPITAL_ID_MAPPING') ? 'hospital-purchase:' + code : '';
      const primaryIds = [...new Set(group.filter(row => Products?.getProduct(row.productId || row.product || row.rawProductName)?.role === 'PRIMARY').map(row => text(row.hospitalId)).filter(Boolean))].sort();
      const id = [...ownerIds][0] || primaryIds[0] || mappedIdentity || [...new Set(group.map(row => text(row.hospitalId)).filter(Boolean))].sort()[0] || 'hospital-purchase:' + code;
      const preferred = masters[0] || group.find(row => row.source === 'HOSPITAL_ID_MAPPING') || group.find(row => text(row.hospitalName || row.hospital) && !/^\d+$/.test(text(row.hospitalName || row.hospital)));
      const registryIdentity = globalThis.HospitalIdentity?.hospitals?.find(hospital => hospital.hospitalId === id);
      const name = text(registryIdentity?.canonicalName || preferred?.hospitalName || preferred?.hospital);
      if (!name) return;
      resolved.set(code, {
        hospitalId: id,
        canonicalName: name,
        aliases: [...new Set(group.flatMap(row => [text(row.hospitalName || row.hospital), ...(row.aliases || [])]).filter(Boolean))],
        salesHospitalIds: [...new Set(group.flatMap(row => [text(row.hospitalId), ...(row.salesHospitalIds || [])]).filter(Boolean))]
      });
    });
    return rows.map(row => {
      const name = compact(row.hospitalName || row.hospital);
      const nameCodes = byName.get(name);
      const code = text(row.purchaseUnitId || row.hospitalCode || row.code) || inferredCode(row);
      const entity = resolved.get(code);
      if (text(row.purchaseUnitId) && text(row.hospitalCode) && text(row.purchaseUnitId) !== text(row.hospitalCode)) return row;
      return entity ? {
        ...row,
        ...entity,
        purchaseUnitId: code,
        hospitalCode: code,
        hospitalName: entity.canonicalName,
        hospital: entity.canonicalName
      } : row;
    });
  }
  function mapPurchaseUnitCodes(rows = []) {
    const codesByHospital = new Map();
    const idsByCode = new Map();
    rows.forEach(row => {
      const id = text(row.hospitalId);
      const code = text(row.purchaseUnitId ?? row['购进单位ID'] ?? row.hospitalCode ?? row.code);
      if (!id || !code) return;
      if (!codesByHospital.has(id)) codesByHospital.set(id, new Set());
      if (!idsByCode.has(code)) idsByCode.set(code, new Set());
      codesByHospital.get(id).add(code);
      idsByCode.get(code).add(id);
    });
    return rows.map(row => {
      const explicitId = text(row.hospitalId);
      const code = text(row.purchaseUnitId ?? row['购进单位ID'] ?? row.hospitalCode ?? row.code);
      const candidates = idsByCode.get(code);
      const id = explicitId || (candidates?.size === 1 ? [...candidates][0] : '');
      const knownCodes = codesByHospital.get(id);
      const resolvedCode = code || (knownCodes?.size === 1 ? [...knownCodes][0] : '');
      const conflict = knownCodes?.size > 1 || idsByCode.get(resolvedCode)?.size > 1 || text(row.hospitalCode) && code && text(row.hospitalCode) !== code;
      const verified = Boolean(id && resolvedCode && !conflict);
      return {
        ...row,
        hospitalId: id,
        hospitalCode: verified ? resolvedCode : text(row.hospitalCode),
        hospitalCodeEvidence: {
          source: code ? 'PURCHASE_UNIT_ID_OR_EXISTING_CODE' : 'EXISTING_HOSPITAL_ENTITY',
          sourceId: resolvedCode,
          hospitalId: id,
          verificationState: conflict ? 'NEEDS_REVIEW' : verified ? 'VERIFIED' : 'UNRESOLVED'
        }
      };
    });
  }
  function normalizeDepartmentForMaintenance(input = {}) {
    return {
      departmentId: text(input.departmentId ?? input.id),
      departmentName: text(input.departmentName ?? input.department ?? input.departmentRoom ?? input.name),
      aliases: [...new Set(input.departmentAliases || input.aliases || [])],
      hospitalId: text(input.hospitalId),
      director: text(input.director ?? input.departmentDirector ?? input.departmentHead),
      active: input.active !== false,
      deletedAt: text(input.deletedAt)
    };
  }
  function hospitalPotentialEvidence(hospitalId, entries = []) {
    const fields = ['bedCount', 'overallStrength', 'departmentReputation', 'regionalInfluence', 'academicCapability', 'conferenceActivity', 'teachingHospital', 'trainingCapability'];
    return {
      hospitalId: text(hospitalId),
      fields: fields.map(field => {
        const evidence = entries.filter(item => text(item.hospitalId) === text(hospitalId) && item.field === field).map(item => ({
          value: item.value ?? null,
          source: text(item.source),
          retrievedAt: text(item.retrievedAt),
          evidence: text(item.evidence),
          verificationState: item.verificationState === 'VERIFIED' && text(item.source) && text(item.retrievedAt) && text(item.evidence) ? 'VERIFIED' : 'UNVERIFIED'
        }));
        const confirmed = evidence.filter(item => item.verificationState === 'VERIFIED');
        const values = new Set(confirmed.map(item => JSON.stringify(item.value)));
        return {
          field,
          value: values.size === 1 ? confirmed[0].value : null,
          verificationState: values.size > 1 ? 'NEEDS_REVIEW' : confirmed.length ? 'VERIFIED' : 'UNVERIFIED',
          evidence
        };
      })
    };
  }
  function normalizeHospitalForMaintenance(input = {}) {
    return {
      hospitalId: text(input.hospitalId ?? input.id),
      hospitalName: text(input.hospitalName ?? input.hospital ?? input.name),
      canonicalName: text(input.canonicalName ?? input.hospitalName ?? input.hospital ?? input.name),
      aliases: [...new Set(input.aliases || [])],
      salesHospitalIds: [...new Set(input.salesHospitalIds || [])],
      purchaseUnitId: text(input.purchaseUnitId ?? input.hospitalCode ?? input.code),
      grade: text(input.grade ?? input.hospitalLevel ?? input.level),
      region: text(input.region ?? input.district),
      hospitalCode: text(input.hospitalCode ?? input.code),
      hospitalLevel: text(input.hospitalLevel ?? input.level),
      hospitalLevelEvidence: input.hospitalLevelEvidence || null,
      source: input.source ?? null,
      evidence: input.evidence ?? null,
      verifiedAt: input.verifiedAt ?? null,
      city: text(input.city),
      district: text(input.district),
      office: text(input.office),
      owner: text(input.owner ?? input.hospitalOwner ?? input.employee),
      address: text(input.address),
      active: input.active !== false,
      deletedAt: text(input.deletedAt),
      departments: (input.departments || []).map(item => normalizeDepartmentForMaintenance({
        ...item,
        hospitalId: item.hospitalId || input.hospitalId || input.id
      }))
    };
  }
  function applyPatch(target, patch, fields) {
    fields.forEach(field => {
      if (hasOwn(patch, field)) target[field] = text(patch[field]);
    });
    return target;
  }
  function buildHospitalDirectory(rows = [], overrides = {}, options = {}) {
    const normalizedRows = typeof globalThis.HospitalIdentity?.migrate === 'function' ? globalThis.HospitalIdentity.migrate((rows || []).filter(Boolean).map(row => ({
      ...row
    }))) : (rows || []).filter(Boolean);
    const sourceRows = mapPurchaseUnitCodes(canonicalSourceRows(normalizedRows));
    const hospitalIdsByName = new Map();
    const departmentIdsByName = new Map();
    sourceRows.forEach(row => {
      const hospitalName = text(row.hospitalName || row.hospital);
      const hospitalId = text(row.hospitalId);
      if (hospitalName && hospitalId) hospitalIdsByName.set(compact(hospitalName), hospitalId);
    });
    sourceRows.forEach(row => {
      const hospitalName = text(row.hospitalName || row.hospital);
      const hospitalId = text(row.hospitalId) || hospitalIdsByName.get(compact(hospitalName)) || '';
      const departmentName = text(row.departmentName || row.department || row.departmentRoom);
      const departmentId = text(row.departmentId);
      if (hospitalId && departmentName && departmentId) departmentIdsByName.set(`${hospitalId}\u001f${compact(departmentName)}`, departmentId);
    });
    const groups = new Map();
    const invalidRecords = [];
    sourceRows.forEach(row => {
      const hospitalName = text(row.hospitalName || row.hospital);
      const hospitalId = text(row.hospitalId) || hospitalIdsByName.get(compact(hospitalName)) || '';
      if (!hospitalId || !hospitalName || /^\d+$/.test(hospitalName)) {
        if (hospitalName || hospitalId) invalidRecords.push({
          hospitalId,
          hospitalName,
          reason: !hospitalId ? 'missing_hospital_id' : 'missing_hospital_name'
        });
        return;
      }
      if (!groups.has(hospitalId)) groups.set(hospitalId, {
        hospitalId,
        rows: [],
        departments: new Map()
      });
      const group = groups.get(hospitalId);
      group.rows.push(row);
      const departmentName = text(row.departmentName || row.department || row.departmentRoom);
      const departmentId = text(row.departmentId) || departmentIdsByName.get(`${hospitalId}\u001f${compact(departmentName)}`) || '';
      if (!departmentName && !departmentId) return;
      if (!departmentId || !departmentName) {
        invalidRecords.push({
          hospitalId,
          hospitalName,
          departmentId,
          departmentName,
          reason: !departmentId ? 'missing_department_id' : 'missing_department_name'
        });
        return;
      }
      if (!group.departments.has(departmentId)) group.departments.set(departmentId, []);
      group.departments.get(departmentId).push(row);
    });
    const hospitalOverrides = overrides.hospitals || {};
    const departmentOverrides = overrides.departments || {};
    const tombstoneByHospital = new Map((options.tombstones || []).filter(item => item?.kind === 'hospital' && item.id).map(item => [text(item.id), text(item.deletedAt)]));
    const hospitals = [...groups.values()].map(group => {
      const rowsForHospital = group.rows;
      const hospital = normalizeHospitalForMaintenance({
        hospitalId: group.hospitalId,
        hospitalName: firstMeaningful(rowsForHospital.map(row => row.hospitalName || row.hospital)),
        aliases: [...new Set(rowsForHospital.flatMap(row => row.aliases || []))],
        salesHospitalIds: [...new Set(rowsForHospital.flatMap(row => [row.hospitalId, ...(row.salesHospitalIds || [])]).filter(Boolean))],
        hospitalCode: firstMeaningful(rowsForHospital.map(row => row.hospitalCode ?? row.code)),
        hospitalLevel: firstMeaningful(rowsForHospital.map(row => row.hospitalLevel ?? row.level)),
        hospitalLevelEvidence: rowsForHospital.find(row => row.hospitalLevel && row.hospitalLevelEvidence)?.hospitalLevelEvidence || null,
        source: [...new Set(rowsForHospital.flatMap(row => Array.isArray(row.source) ? row.source : row.source ? [row.source] : []))],
        evidence: rowsForHospital.flatMap(row => Array.isArray(row.evidence) ? row.evidence : row.evidence ? [row.evidence] : []),
        verifiedAt: rowsForHospital.find(row => row.verifiedAt)?.verifiedAt ?? null,
        city: firstMeaningful(rowsForHospital.map(row => row.city)),
        district: firstMeaningful(rowsForHospital.map(row => row.district)),
        office: firstMeaningful(rowsForHospital.map(row => row.office)),
        owner: firstMeaningful(rowsForHospital.map(row => row.owner ?? row.hospitalOwner ?? row.employee)),
        address: firstMeaningful(rowsForHospital.map(row => row.address)),
        active: rowsForHospital.some(row => row.active !== false && !row.deletedAt),
        deletedAt: tombstoneByHospital.get(group.hospitalId) || firstMeaningful(rowsForHospital.map(row => row.deletedAt))
      });
      applyPatch(hospital, hospitalOverrides[group.hospitalId], ['hospitalCode', 'hospitalLevel', 'office', 'owner', 'address']);
      hospital.canonicalName = hospital.hospitalName;
      hospital.purchaseUnitId = hospital.hospitalCode;
      hospital.grade = hospital.hospitalLevel;
      hospital.region = hospital.district;
      hospital.departments = [...group.departments.entries()].map(([departmentId, departmentRows]) => {
        const department = normalizeDepartmentForMaintenance({
          departmentId,
          hospitalId: group.hospitalId,
          departmentName: firstMeaningful(departmentRows.map(row => row.departmentName || row.department || row.departmentRoom)),
          departmentAliases: [...new Set(departmentRows.flatMap(row => row.departmentAliases || []))],
          director: firstMeaningful(departmentRows.map(row => row.director ?? row.departmentDirector ?? row.departmentHead)),
          active: departmentRows.some(row => row.active !== false && !row.deletedAt),
          deletedAt: firstMeaningful(departmentRows.map(row => row.departmentDeletedAt || row.deletedAt))
        });
        applyPatch(department, departmentOverrides[departmentId], ['director']);
        return department;
      }).sort((a, b) => a.departmentName.localeCompare(b.departmentName, 'zh-CN') || a.departmentId.localeCompare(b.departmentId));
      return hospital;
    });
    tombstoneByHospital.forEach((deletedAt, hospitalId) => {
      if (!groups.has(hospitalId)) hospitals.push(normalizeHospitalForMaintenance({
        hospitalId,
        active: false,
        deletedAt
      }));
    });
    hospitals.sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, 'zh-CN') || a.hospitalId.localeCompare(b.hospitalId));
    return {
      hospitals,
      invalidRecords
    };
  }
  function missingFor(entity, fields, scope, extra = {}) {
    return fields.filter(field => field.severity !== 'optional' && !isMeaningfulValue(entity[field.key])).map(field => ({
      scope,
      field: field.key,
      label: field.label,
      severity: field.severity,
      ...extra
    }));
  }
  function getHospitalMissingFields(hospital) {
    return missingFor(normalizeHospitalForMaintenance(hospital), HOSPITAL_REQUIRED_FIELDS, 'hospital');
  }
  function getDepartmentMissingFields(department) {
    const normalized = normalizeDepartmentForMaintenance(department);
    return missingFor(normalized, DEPARTMENT_REQUIRED_FIELDS, 'department', {
      departmentId: normalized.departmentId,
      departmentName: normalized.departmentName
    });
  }
  function evaluateDepartmentCompleteness(department) {
    const normalized = normalizeDepartmentForMaintenance(department);
    const fields = DEPARTMENT_REQUIRED_FIELDS.filter(field => field.severity !== 'optional');
    const missingFields = getDepartmentMissingFields(normalized);
    const completed = fields.length - missingFields.length;
    return {
      department: normalized,
      missingFields,
      completenessPercent: Math.round(completed / fields.length * 100),
      valid: Boolean(normalized.departmentId && normalized.departmentName && normalized.hospitalId)
    };
  }
  function evaluateHospitalCompleteness(hospitalInput) {
    const hospital = normalizeHospitalForMaintenance(hospitalInput);
    const hospitalFields = HOSPITAL_REQUIRED_FIELDS.filter(field => field.severity !== 'optional');
    const hospitalMissing = getHospitalMissingFields(hospital);
    const departments = hospital.departments.filter(department => department.active !== false && !department.deletedAt).map(evaluateDepartmentCompleteness);
    const countedDepartments = departments.filter(item => item.valid);
    const missingFields = [...hospitalMissing, ...countedDepartments.flatMap(item => item.missingFields)];
    const denominator = hospitalFields.length + countedDepartments.length * DEPARTMENT_REQUIRED_FIELDS.filter(field => field.severity !== 'optional').length;
    const completenessPercent = denominator ? Math.round((denominator - missingFields.length) / denominator * 100) : 100;
    return {
      hospital,
      hospitalMissing,
      departments,
      missingFields,
      completenessPercent,
      criticalMissingCount: missingFields.filter(item => item.severity === 'critical').length,
      importantMissingCount: missingFields.filter(item => item.severity === 'important').length,
      valid: Boolean(hospital.hospitalId && hospital.hospitalName)
    };
  }
  function issueFromEvaluation(evaluation, options = {}) {
    if (!evaluation.valid || evaluation.hospital.active === false || evaluation.hospital.deletedAt) return null;
    if (!evaluation.criticalMissingCount && !evaluation.importantMissingCount) return null;
    const hospitalMissing = evaluation.hospitalMissing.map(item => ({
      ...item
    }));
    const departmentMissing = evaluation.departments.filter(item => item.valid && item.missingFields.length).map(item => ({
      departmentId: item.department.departmentId,
      departmentName: item.department.departmentName,
      missingFields: item.missingFields.map(field => ({
        ...field
      }))
    }));
    const displayFields = [...hospitalMissing.map(item => item.label), ...departmentMissing.flatMap(group => group.missingFields.map(item => `${group.departmentName} · ${item.label}`))];
    const priority = evaluation.criticalMissingCount ? 'high' : 'normal';
    return {
      id: `hospital-maintenance:${evaluation.hospital.hospitalId}`,
      hospitalId: evaluation.hospital.hospitalId,
      hospitalName: evaluation.hospital.hospitalName,
      completeness: evaluation.completenessPercent,
      completenessPercent: evaluation.completenessPercent,
      informationStatus: '待完善',
      missingFields: displayFields,
      missingGroups: {
        hospital: hospitalMissing,
        departments: departmentMissing
      },
      criticalMissingCount: evaluation.criticalMissingCount,
      importantMissingCount: evaluation.importantMissingCount,
      priority,
      dueDate: shiftDate(options.now || new Date(), priority === 'high' ? 3 : 7)
    };
  }
  function buildHospitalMaintenanceIssues(hospitals = [], options = {}) {
    return (hospitals || []).map(hospital => issueFromEvaluation(evaluateHospitalCompleteness(hospital), options)).filter(Boolean).sort((a, b) => Number(b.criticalMissingCount > 0) - Number(a.criticalMissingCount > 0) || b.missingFields.length - a.missingFields.length || a.completeness - b.completeness || a.hospitalId.localeCompare(b.hospitalId));
  }
  function isHospitalMaintenanceTask(task = {}) {
    return text(task.sourceType) === 'hospital' && [HOSPITAL_TASK_TYPE, LEGACY_HOSPITAL_TASK_TYPE].includes(text(task.taskType));
  }
  function syncHospitalMaintenanceTasks(hospitals = [], existingTasks = [], options = {}) {
    return {
      tasks: existingTasks.map(clone),
      issues: buildHospitalMaintenanceIssues(hospitals, options),
      changed: false,
      created: [],
      updated: [],
      completed: [],
      cancelled: []
    };
  }
  function syncAllHospitalMaintenanceTasks(hospitals, tasks, options = {}) {
    return syncHospitalMaintenanceTasks(hospitals, tasks, options);
  }
  function completeResolvedHospitalTasks(hospitals, tasks, options = {}) {
    return syncHospitalMaintenanceTasks(hospitals, tasks, options);
  }
  function mergeDirectoryOverrides(local = {}, remote = {}) {
    const mergeBucket = (left = {}, right = {}) => {
      const ids = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
      const merged = {};
      ids.forEach(id => {
        const localItem = left[id];
        const remoteItem = right[id];
        if (!localItem) merged[id] = clone(remoteItem);else if (!remoteItem) merged[id] = clone(localItem);else merged[id] = clone(timestamp(localItem.updatedAt) >= timestamp(remoteItem.updatedAt) ? localItem : remoteItem);
      });
      return merged;
    };
    return {
      hospitals: mergeBucket(local.hospitals, remote.hospitals),
      departments: mergeBucket(local.departments, remote.departments),
      updatedAt: timestamp(local.updatedAt) >= timestamp(remote.updatedAt) ? text(local.updatedAt) : text(remote.updatedAt)
    };
  }
  function bindHospitalRecords(records, hospitals, tracingKind) {
    const ids = new Map(),
      codes = new Map(),
      names = new Map();
    const add = (index, key, hospital) => {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(hospital);
    };
    for (const hospital of hospitals || []) {
      if (hospital.active === false || hospital.deletedAt) continue;
      add(ids, hospital.hospitalId, hospital);
      add(codes, text(hospital.hospitalCode || hospital.purchaseUnitId), hospital);
      for (const name of new Set([hospital.canonicalName, hospital.hospitalName, ...(hospital.aliases || [])].map(text))) add(names, name, hospital);
    }
    return records.map(row => {
      const id = text(row.hospitalId),
        code = text(row.hospitalCode || row.purchaseUnitId),
        name = text(row.hospital);
      const candidates = (id ? ids.get(id) : code ? codes.get(code) : name ? names.get(name) : null) || [];
      const explicitStatuses = [row.hospitalMatchStatus, row.hospitalBindingStatus].map(text).filter(Boolean);
      const existingUncertain = id && explicitStatuses.find(status => !Products.isReliableHospitalRecord({
        hospitalId: id,
        hospitalMatchStatus: status
      }));
      const status = existingUncertain || (candidates.length === 1 ? 'EXACT' : candidates.length ? 'AMBIGUOUS' : 'UNMATCHED');
      return {
        ...row,
        hospitalId: id || (status === 'EXACT' ? candidates[0].hospitalId : ''),
        hospitalMatchStatus: status,
        hospitalBindingEvidence: status === 'EXACT' ? {
          method: id ? 'STABLE_ID' : code ? 'CODE_EXACT' : 'NAME_EXACT',
          hospitalId: candidates[0].hospitalId
        } : null,
        productId: Products.getProduct(row.productId || row.product)?.id || text(row.productId)
      };
    });
  }
  return {
    HOSPITAL_TASK_TYPE,
    LEGACY_HOSPITAL_TASK_TYPE,
    HOSPITAL_REQUIRED_FIELDS,
    DEPARTMENT_REQUIRED_FIELDS,
    isMeaningfulValue,
    normalizeHospitalForMaintenance,
    normalizeDepartmentForMaintenance,
    evaluateHospitalCompleteness,
    evaluateDepartmentCompleteness,
    getHospitalMissingFields,
    getDepartmentMissingFields,
    parseMappingWorkbook,
    canonicalSourceRows,
    mapPurchaseUnitCodes,
    hospitalPotentialEvidence,
    buildHospitalDirectory,
    bindHospitalRecords,
    buildHospitalMaintenanceIssues,
    syncHospitalMaintenanceTasks,
    syncAllHospitalMaintenanceTasks,
    completeResolvedHospitalTasks,
    isHospitalMaintenanceTask,
    mergeDirectoryOverrides,
    dateKey,
    shiftDate
  };
});
