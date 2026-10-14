(function initSalesImportAdapter(root, factory) {
  const api = factory(root?.QuarterlyReporting, root?.ProductRegistry || (typeof require === 'function' ? require('./product-registry.js') : null), root?.DepartmentIdentity || (typeof require === 'function' ? require('./department-identity.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SalesImportAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (Reporting, Products, Departments) => {
  if (!Products) throw new Error('Product Registry is required for sales calculation.');
  const TARGET_PRODUCTS = Object.freeze(Object.fromEntries(Products.products.map(product => [product.id, product.name])));
  const HEADERS = Object.freeze({
    saleId: ['订单编号', '销售单号', '单号', 'saleid'],
    orderTime: ['下单时间', '订单时间', '日期', '时间'],
    deliveryTime: ['开始配送时间', '配送开始时间'],
    orderStatus: ['订单状态', '状态'],
    productInfo: ['产品信息', '商品信息', '产品明细', '商品明细'],
    office: ['所属办事处', '办事处'],
    employeeId: ['员工ID', '信息员ID', '专员ID'],
    employee: ['专员姓名', '专员信息', '信息员', '员工', '负责人', '业务员姓名'],
    hospital: ['Synthetic Hospital Example', '医院', '终端', '购进单位名称'],
    purchaseUnitId: ['购进单位ID'],
    hospitalCode: ['医院编码', '终端编码'],
    sourceDepartmentId: ['科室ID', '科室编号', '科室编码'],
    department: ['科室/房号', '科室房号', '科室', '房号'],
    address: ['收货/自提地址', '收货自提地址', '收货地址'],
    customer: ['客户姓名', '客户', '医生'],
    quantity: ['订单数量', '数量', '下单盒数', '盒数'],
    returnQuantity: ['退货数量', '退款数量'],
    unitPrice: ['单价'],
    grossAmount: ['商品金额', '总价', '销售金额', '销售额', '总金额', '商品实付价'],
    refundAmount: ['退款金额'],
    batchNo: ['批次号'],
    expiryDate: ['有效期'],
    productName: ['产品名称', '产品', '品种'],
    specification: ['规格']
  });
  const text = value => String(value ?? '').trim();
  const compact = value => text(value).replace(/^\uFEFF/, '').replace(/[\s_()（）/\\\-·:：]/g, '').toLowerCase();
  const numberOrNull = value => {
    const raw = text(value).replace(/[¥￥,$，盒元]/g, '').replace(/\s/g, '');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const stableProductId = value => {
    return Products.getProduct(value)?.id || '';
  };
  function classifyProduct(value) {
    if (/^舒复派.*增稠型/.test(compact(value))) return "auxiliaryProductA_THICKENED";
    return {
      primaryProductA: "primaryProductA",
      primaryProductB: "primaryProductB",
      auxiliaryProductA_original: "auxiliaryProductA_ORIGINAL",
      auxiliaryProductA_thickened: "auxiliaryProductA_THICKENED"
    }[stableProductId(value)] || 'OTHER_UNSUPPORTED';
  }
  const stableId = value => {
    let hash = 2166136261;
    for (const char of value) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `sale-${(hash >>> 0).toString(36)}`;
  };
  const headerKey = value => Object.keys(HEADERS).find(key => HEADERS[key].some(alias => compact(alias) === compact(value))) || '';
  function isoDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number' && value > 20000 && value < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000)).toISOString().slice(0, 10);
    const raw = text(value);
    if (!raw) return '';
    const match = raw.match(/(20\d{2})[年/\-.](\d{1,2})[月/\-.](\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }
  function fiscalPeriod(date) {
    const resolved = Reporting?.resolveFiscalPeriod?.(date);
    if (resolved) return resolved;
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    return {
      fiscalYear: month >= 10 ? year + 1 : year,
      fiscalQuarter: month >= 10 ? 1 : month <= 3 ? 2 : month <= 6 ? 3 : 4,
      month
    };
  }
  function detectHeader(matrix) {
    let best = null;
    matrix.slice(0, 50).forEach((row, index) => {
      const keys = row.map(headerKey);
      const unique = new Set(keys.filter(Boolean));
      const score = unique.size + (unique.has('productInfo') || unique.has('productName') ? 4 : 0) + (unique.has('orderStatus') ? 2 : 0) + (unique.has('orderTime') || unique.has('deliveryTime') ? 3 : 0);
      if (!best || score > best.score) best = {
        index,
        keys,
        unique,
        score
      };
    });
    return best && best.score >= 7 && (best.unique.has('productInfo') || best.unique.has('productName')) ? best : null;
  }
  function parseProductInfo(value) {
    const source = text(value);
    if (!source) return [];
    const result = [];
    let current = null;
    source.split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
      const match = line.match(/^(.*)[(（]\s*数量\s*[:：]\s*([\d.]+)\s*\|\s*规格\s*[:：]\s*(.*?)\s*\|\s*单价\s*[:：]\s*([\d.]+)\s*\|\s*(?:总价|商品金额)\s*[:：]\s*([\d.]+)\s*\|\s*退货数量\s*[:：]\s*([\d.]+)\s*[)）]\s*$/);
      if (match) {
        current = {
          productName: text(match[1]),
          quantity: finite(match[2]),
          specification: text(match[3]),
          unitPrice: finite(match[4]),
          grossAmount: finite(match[5]),
          returnQuantity: finite(match[6]),
          batches: []
        };
        result.push(current);
        return;
      }
      const batch = line.match(/批次号\s*[:：]\s*([^|\r\n]+)(?:\s*\|\s*批次数量\s*[:：]\s*([\d.]+))?(?:\s*\|\s*有效期\s*[:：]\s*([^\r\n|]+))?/);
      if (batch && current) current.batches.push({
        batchNo: text(batch[1]),
        expiryDate: isoDate(batch[3])
      });
    });
    return result.map(item => ({
      ...item,
      batchNo: item.batches.map(row => row.batchNo).filter(Boolean).join('；'),
      expiryDate: item.batches.map(row => row.expiryDate).filter(Boolean).sort()[0] || '',
      batches: undefined
    }));
  }
  function defaultProduct(raw) {
    const quantity = finite(raw.quantity);
    const grossAmount = numberOrNull(raw.grossAmount);
    const unitPrice = numberOrNull(raw.unitPrice) ?? (quantity > 0 && grossAmount !== null ? grossAmount / quantity : 0);
    return [{
      productName: text(raw.productName || raw.productInfo),
      quantity,
      specification: text(raw.specification),
      unitPrice,
      grossAmount: grossAmount ?? unitPrice * quantity,
      returnQuantity: finite(raw.returnQuantity),
      refundAmount: numberOrNull(raw.refundAmount),
      batchNo: text(raw.batchNo),
      expiryDate: isoDate(raw.expiryDate)
    }];
  }
  function employeeIdentityId(name) {
    const customers = typeof module === 'object' && module.exports ? require('./customer-profile/customer-profile.js') : globalThis.CustomerProfileV1;
    return customers.employeeIdentityId(name);
  }
  function createMatcher(items = [], aliases = {}, type = 'hospital') {
    if (type === 'department') return Departments.createResolver(items.map(item => ({
      ...item,
      aliases: [...(item.aliases || []), ...Object.entries(aliases).filter(([, name]) => compact(name) === compact(item.canonicalName || item.department || item.name)).map(([alias]) => alias)]
    })));
    const nameField = type === 'hospital' ? 'hospital' : 'department';
    const idField = `${type}Id`;
    const directory = [...new Map(items.map((item, index) => ({
      id: text(item[idField] || item.id || `${type}-${index + 1}`),
      canonicalName: text(item.canonicalName || item[nameField] || item.name),
      aliases: [...new Set([...(item.aliases || []), ...Object.entries(aliases).filter(([, canonical]) => compact(canonical) === compact(item.canonicalName || item[nameField] || item.name)).map(([alias]) => alias)])].filter(Boolean)
    })).filter(item => item.canonicalName).map(item => [`${item.id}\u001f${compact(item.canonicalName)}`, item])).values()];
    function match(rawName) {
      const raw = text(rawName);
      const normalized = compact(raw);
      if (!normalized) return {
        status: 'UNMATCHED',
        rawName: raw,
        canonicalName: '',
        id: ''
      };
      const exact = directory.filter(item => compact(item.canonicalName) === normalized || item.aliases.some(alias => compact(alias) === normalized));
      if (exact.length === 1) return {
        status: 'EXACT',
        rawName: raw,
        canonicalName: exact[0].canonicalName,
        id: exact[0].id
      };
      if (exact.length > 1) return {
        status: 'AMBIGUOUS',
        rawName: raw,
        candidates: exact
      };
      const probable = directory.filter(item => compact(item.canonicalName).includes(normalized) || normalized.includes(compact(item.canonicalName)) || item.aliases.some(alias => compact(alias).includes(normalized) || normalized.includes(compact(alias))));
      if (probable.length === 1) return {
        status: 'PROBABLE',
        rawName: raw,
        canonicalName: probable[0].canonicalName,
        id: probable[0].id
      };
      if (probable.length > 1) return {
        status: 'AMBIGUOUS',
        rawName: raw,
        candidates: probable
      };
      const mapped = text(aliases[raw]);
      return mapped ? {
        status: 'PROBABLE',
        rawName: raw,
        canonicalName: mapped,
        id: stableId(`${type}|${compact(mapped)}`)
      } : {
        status: 'UNMATCHED',
        rawName: raw,
        canonicalName: raw,
        id: stableId(`${type}|${normalized}`)
      };
    }
    return {
      match
    };
  }
  function parseWorkbook(workbook, XLSX, options = {}) {
    if (!workbook?.SheetNames?.length || !XLSX?.utils) throw new Error('Excel 工作簿不可用。');
    let selected = null;
    workbook.SheetNames.forEach(sheetName => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd',
        defval: '',
        blankrows: false
      });
      const header = detectHeader(matrix);
      if (header && (!selected || header.score > selected.header.score)) selected = {
        sheetName,
        matrix,
        header
      };
    });
    if (!selected) throw new Error('未识别销售原始表头，需要产品信息、订单状态及日期字段。');
    const hospitalMatcher = createMatcher(options.hospitals || [], options.hospitalAliases || {}, 'hospital');
    const departmentMatcher = createMatcher(options.departments || [], options.departmentAliases || {}, 'department');
    const records = [];
    const rawProducts = [];
    const excludedProducts = [];
    const cancelled = [];
    const invalid = [];
    let originalRecords = 0;
    let targetProductRecords = 0;
    selected.matrix.slice(selected.header.index + 1).forEach((cells, rowIndex) => {
      const raw = {};
      selected.header.keys.forEach((key, index) => {
        if (key) raw[key] = cells[index];
      });
      if (!Object.values(raw).some(value => text(value))) return;
      originalRecords += 1;
      const products = parseProductInfo(raw.productInfo);
      const productRows = products.length ? products : defaultProduct(raw);
      const sourceProducts = productRows.filter(item => item.productName);
      sourceProducts.forEach((product, productIndex) => {
        const productId = stableProductId(product.productName);
        const productClass = classifyProduct(product.productName);
        rawProducts.push({
          rawProductName: product.productName,
          productClass,
          sourceName: options.sourceName || selected.sheetName,
          sourceSheet: selected.sheetName,
          sourceRow: selected.header.index + rowIndex + 2,
          rawRecord: {
            ...raw
          },
          product: {
            ...product
          }
        });
        if (!productId) {
          excludedProducts.push({
            sourceRow: selected.header.index + rowIndex + 2,
            productName: product.productName
          });
          return;
        }
        targetProductRecords += 1;
        if (/已取消/.test(text(raw.orderStatus))) {
          cancelled.push({
            sourceRow: selected.header.index + rowIndex + 2,
            productId
          });
          return;
        }
        const date = isoDate(raw.deliveryTime || raw.orderTime);
        if (!date) {
          invalid.push({
            sourceRow: selected.header.index + rowIndex + 2,
            reason: '日期缺失'
          });
          return;
        }
        const hospital = hospitalMatcher.match(raw.hospital);
        const department = departmentMatcher.match(raw.department, {
          hospitalId: hospital.id,
          sourceDepartmentId: raw.sourceDepartmentId,
          provenance: {
            source: options.sourceName || selected.sheetName,
            evidence: 'SOURCE_DEPARTMENT_ID_COLUMN',
            sourceRow: selected.header.index + rowIndex + 2
          }
        });
        const quantity = finite(product.quantity);
        const returnQuantity = finite(product.returnQuantity);
        const netBoxes = quantity - returnQuantity;
        const grossAmount = finite(product.grossAmount || product.unitPrice * quantity);
        const netAmount = Math.max(0, grossAmount - (product.refundAmount ?? finite(product.unitPrice) * returnQuantity));
        const period = fiscalPeriod(date);
        const sourceRow = selected.header.index + rowIndex + 2;
        const saleKey = [raw.saleId || options.sourceName || selected.sheetName, sourceRow, productIndex, productId, date].join('|');
        records.push(Products.normalizeSalesRecord({
          id: stableId(saleKey),
          saleId: text(raw.saleId) || stableId(saleKey),
          schemaVersion: 1,
          date,
          fiscalYear: period.fiscalYear,
          fiscalQuarter: period.fiscalQuarter,
          month: period.month,
          productId,
          productClass,
          rawProductName: product.productName,
          productName: TARGET_PRODUCTS[productId],
          product: TARGET_PRODUCTS[productId],
          office: text(raw.office),
          employee: text(raw.employee),
          employeeId: text(raw.employeeId) || employeeIdentityId(raw.employee),
          hospitalRaw: text(raw.hospital),
          hospitalCanonical: hospital.canonicalName || text(raw.hospital),
          hospitalId: hospital.id,
          hospitalMatchStatus: hospital.status,
          hospital: hospital.canonicalName || text(raw.hospital),
          purchaseUnitId: text(raw.purchaseUnitId),
          hospitalCode: text(raw.hospitalCode || raw.purchaseUnitId),
          sourceDepartmentId: text(raw.sourceDepartmentId),
          departmentRaw: text(raw.department),
          departmentCanonical: department.canonicalName || text(raw.department),
          departmentId: department.id,
          legacyDepartmentIds: department.legacyIds || [],
          departmentProvenance: department.provenance,
          departmentAliases: department.aliases || [],
          departmentMatchingQuality: department.matchingQuality,
          departmentMatchStatus: department.status,
          department: department.canonicalName || text(raw.department),
          departmentRoom: text(raw.department),
          address: text(raw.address),
          customer: text(raw.customer),
          orderStatus: text(raw.orderStatus),
          quantity,
          returnQuantity,
          netBoxes,
          orderBoxes: netBoxes,
          specification: product.specification,
          unitPrice: finite(product.unitPrice),
          grossAmount,
          netAmount,
          salesAmount: netAmount,
          batchNo: product.batchNo,
          expiryDate: product.expiryDate,
          importedAt: options.importedAt || new Date().toISOString(),
          source: `${options.sourceName || '销售Excel'} · ${selected.sheetName}`,
          sourceRow
        }));
      });
    });
    return {
      sheetName: selected.sheetName,
      records,
      rawProducts,
      details: records,
      quality: {
        originalRecords,
        targetProductRecords,
        excludedProductRecords: excludedProducts.length,
        cancelledRecords: cancelled.length,
        validRecords: records.length,
        returnRecords: records.filter(row => row.returnQuantity > 0).length,
        invalidRecords: invalid.length,
        netBoxes: records.reduce((sum, row) => sum + row.netBoxes, 0),
        excludedProducts,
        cancelled,
        invalid
      }
    };
  }
  const group = (rows, keys) => {
    const groups = new Map();
    rows.forEach(row => {
      const key = keys.map(field => text(row[field])).join('|');
      const current = groups.get(key) || Object.fromEntries(keys.map(field => [field, row[field]]));
      current.orders = (current.orders || 0) + 1;
      current.quantity = finite(current.quantity) + row.quantity;
      current.returnQuantity = finite(current.returnQuantity) + row.returnQuantity;
      current.netBoxes = finite(current.netBoxes) + row.netBoxes;
      current.salesAmount = finite(current.salesAmount) + row.netAmount;
      groups.set(key, current);
    });
    return [...groups.values()];
  };
  function aggregateStatistics(rows = []) {
    rows = Products.personalSalesRecords(rows);
    const monthProduct = group(rows, ['fiscalYear', 'month', 'productId', 'productName']).sort((a, b) => a.fiscalYear - b.fiscalYear || a.month - b.month || a.productId.localeCompare(b.productId));
    const officeMonthProduct = group(rows, ['office', 'fiscalYear', 'month', 'productId', 'productName']);
    const assignedRows = rows.filter(Products.isReliableHospitalRecord);
    const hospitalMonthProduct = group(assignedRows, ['hospitalId', 'hospitalCanonical', 'fiscalYear', 'month', 'productId', 'productName']);
    const byMonthProduct = new Map(monthProduct.map(item => [`${item.fiscalYear}|${item.month}|${item.productId}`, item.netBoxes]));
    hospitalMonthProduct.forEach(item => {
      const calendarYear = Number(item.fiscalYear) - (Number(item.month) >= 10 ? 1 : 0);
      const date = new Date(Date.UTC(calendarYear, Number(item.month) - 1, 1));
      date.setUTCMonth(date.getUTCMonth() - 1);
      const previousFY = date.getUTCMonth() + 1 >= 10 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
      const previousMonth = date.getUTCMonth() + 1;
      const previous = hospitalMonthProduct.find(row => row.hospitalId === item.hospitalId && row.productId === item.productId && row.fiscalYear === previousFY && row.month === previousMonth)?.netBoxes;
      item.momChange = previous > 0 ? (item.netBoxes - previous) / previous : null;
      const total = byMonthProduct.get(`${item.fiscalYear}|${item.month}|${item.productId}`) || 0;
      item.contributionRate = total ? item.netBoxes / total : 0;
    });
    const departmentMonthProduct = group(assignedRows, ['hospitalId', 'hospitalCanonical', 'departmentId', 'departmentCanonical', 'fiscalYear', 'month', 'productId', 'productName']);
    const hospitalDepartments = group(assignedRows, ['hospitalId', 'hospitalCanonical', 'departmentId', 'departmentCanonical', 'productId', 'productName']);
    return {
      monthProduct,
      officeMonthProduct,
      hospitalMonthProduct,
      departmentMonthProduct,
      hospitalDepartments,
      unassignedHospitalRecords: rows.length - assignedRows.length
    };
  }
  function buildPreview(parsed) {
    const products = group(parsed.records, ['productId', 'productName']).map(row => ({
      productId: row.productId,
      productName: row.productName,
      netBoxes: row.netBoxes
    }));
    const months = group(parsed.records, ['fiscalYear', 'month']).map(row => ({
      fiscalYear: row.fiscalYear,
      month: row.month,
      netBoxes: row.netBoxes
    }));
    return {
      ...parsed.quality,
      sheetName: parsed.sheetName,
      products,
      months,
      detailRows: parsed.details.slice(0, 200),
      statistics: aggregateStatistics(parsed.records)
    };
  }
  function activityFiscalWindow(value) {
    const to = isoDate(value);
    if (!to) throw new Error('申请日期无效。');
    const fiscalYear = fiscalPeriod(to).fiscalYear;
    const [year, month, day] = to.split('-').map(Number);
    const lastPriorDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
    const priorTo = `${year - 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastPriorDay)).padStart(2, '0')}`;
    return {
      fiscalYear,
      from: `${fiscalYear - 1}-10-01`,
      to,
      priorFrom: `${fiscalYear - 2}-10-01`,
      priorTo
    };
  }
  function hospitalIdentityMatches(entity, row) {
    const resolve = value => globalThis.HospitalIdentity?.resolve(value) || text(value);
    const left = resolve(entity.hospitalId),
      right = resolve(row.hospitalId);
    if (left && right) return left === right || (entity.salesHospitalIds || []).map(resolve).includes(right);
    const codes = new Set([entity.purchaseUnitId, entity.hospitalCode, ...(entity.purchaseUnitIds || [])].map(text).filter(Boolean));
    const code = text(row.purchaseUnitId || row.hospitalCode || row.sourceHospitalCode);
    return Boolean(code && codes.has(code));
  }
  function salesObservation(records, {
    asOfDate = new Date().toISOString().slice(0, 10),
    month = ''
  } = {}) {
    const currentMonth = asOfDate.slice(0, 7);
    const effectiveMonths = [...new Set(records.filter(row => row.netBoxes != null && Number.isFinite(Number(row.netBoxes)) && /^\d{4}-\d{2}-\d{2}/.test(text(row.date)) && text(row.date).slice(0, 7) < currentMonth).map(row => row.date.slice(0, 7)))].sort().reverse();
    const observationMonth = month || effectiveMonths[0] || '';
    const monthlyRows = records.filter(row => observationMonth && text(row.date).slice(0, 7) === observationMonth && row.netBoxes != null);
    const averageMonths = effectiveMonths.filter(key => !observationMonth || key <= observationMonth).slice(0, 3);
    const averageRows = records.filter(row => averageMonths.includes(text(row.date).slice(0, 7)) && row.netBoxes != null);
    const total = rows => rows.length ? rows.reduce((sum, row) => sum + Number(row.netBoxes), 0) : null;
    return {
      observationMonth: observationMonth || null,
      monthlyRows,
      averageRows,
      averageMonths,
      monthlySales: total(monthlyRows),
      recentMonthlyAverage: averageMonths.length ? total(averageRows) / averageMonths.length : null
    };
  }
  function hospitalSales(entity, records, period, {
    preparedPersonalRecords = false
  } = {}) {
    const product = Products.getProduct(entity.productId || entity.product);
    const rows = (preparedPersonalRecords ? records : Products.personalSalesRecords(records)).filter(row => (!entity.productId && !entity.product || product && row.productId === product.id) && hospitalIdentityMatches(entity, row) && isReliableHospitalRecord({
      ...row,
      hospitalId: row.hospitalId || entity.hospitalId
    }) && row.date >= period.from && row.date.slice(0, 10) <= period.to);
    const amounts = rows.filter(row => row.salesAmount != null && Number.isFinite(Number(row.salesAmount)));
    return {
      rows,
      quantity: rows.length ? rows.reduce((sum, row) => sum + (Number(row.netBoxes) || 0), 0) : null,
      amount: amounts.length ? amounts.reduce((sum, row) => sum + Number(row.salesAmount), 0) : null,
      provenance: {
        source: 'SalesRecord',
        hospitalId: text(entity.hospitalId),
        productId: product?.id || null,
        period,
        rowsIncluded: rows.map(row => ({
          id: row.id,
          sourceFile: row.sourceFile || row.sourceName,
          sourceSheet: row.sourceSheet,
          sourceRow: row.sourceRow
        })),
        matchingQuality: rows.length ? 'EXACT_HOSPITAL_ID_OR_CODE' : 'SOURCE_NOT_AVAILABLE',
        amountRule: 'NET_BOXES_X_PRODUCT_REGISTRY_PRICE'
      }
    };
  }
  function activityFiscalSales(activity, records = [], {
    preparedPersonalRecords = false,
    observationDate = ''
  } = {}) {
    const range = activityFiscalWindow(observationDate || activity.applicationDate || activity.activityDate);
    const productId = stableProductId(activity.productId || activity.product);
    const hospitalId = text(activity.hospitalId);
    const candidates = (preparedPersonalRecords ? records : Products.personalSalesRecords(records)).filter(row => row.productId === productId && hospitalIdentityMatches(activity, row));
    const pendingRows = candidates.filter(row => !isReliableHospitalRecord(row) && row.date >= range.priorFrom && row.date.slice(0, 10) <= range.to);
    const rows = candidates.filter(isReliableHospitalRecord);
    const currentRows = rows.filter(row => row.date >= range.from && row.date.slice(0, 10) <= range.to);
    const priorRows = rows.filter(row => row.date >= range.priorFrom && row.date.slice(0, 10) <= range.priorTo);
    const total = values => {
      const known = values.filter(row => row.salesAmount != null && Number.isFinite(row.salesAmount));
      return known.length ? known.reduce((sum, row) => sum + row.salesAmount, 0) : null;
    };
    return {
      range,
      currentRows,
      priorRows,
      pendingRows,
      currentAmount: total(currentRows),
      priorAmount: total(priorRows),
      currentNetBoxes: currentRows.length ? currentRows.reduce((sum, row) => sum + (row.netBoxes || 0), 0) : null,
      priorNetBoxes: priorRows.length ? priorRows.reduce((sum, row) => sum + (row.netBoxes || 0), 0) : null
    };
  }
  function isReliableHospitalRecord(row) {
    return Products.isReliableHospitalRecord(row);
  }
  return {
    TARGET_PRODUCTS,
    HEADERS,
    stableProductId,
    classifyProduct,
    parseProductInfo,
    parseWorkbook,
    buildPreview,
    aggregateStatistics,
    employeeIdentityId,
    createMatcher,
    fiscalPeriod,
    activityFiscalWindow,
    activityFiscalSales,
    hospitalIdentityMatches,
    hospitalSales,
    salesObservation,
    isReliableHospitalRecord,
    personalSalesRecords: Products.personalSalesRecords
  };
});
