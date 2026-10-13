(function attachProductRegistry(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProductRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function productRegistryFactory() {
  'use strict';

  const products = Object.freeze([{
    "id": "P_SYN_PRIMARY_A",
    "name": "Primary Product A",
    "unitPrice": 17,
    "role": "PRIMARY"
  }, {
    "id": "P_SYN_PRIMARY_B",
    "name": "Primary Product B",
    "unitPrice": 29,
    "role": "PRIMARY"
  }, {
    "id": "P_SYN_AUX_A",
    "name": "Auxiliary Product A",
    "unitPrice": 7,
    "role": "AUXILIARY"
  }, {
    "id": "P_SYN_AUX_B",
    "name": "Auxiliary Product B",
    "unitPrice": 11,
    "role": "AUXILIARY"
  }].map(Object.freeze));
  const compact = value => String(value ?? '').trim().replace(/[\s_()（）/\\\-·:：]/g, '').toLowerCase();
  function getProduct(value) {
    const query = compact(value);
    return products.find(product => compact(product.id) === query || compact(product.name) === query) || null;
  }
  const numeric = value => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  function normalizeSalesRecord(record) {
    const product = getProduct(record.productId || record.product || record.rawProductName);
    const facts = record.sourceMonetaryFacts || {
      unitPrice: numeric(record.unitPrice),
      grossAmount: numeric(record.grossAmount),
      netAmount: numeric(record.netAmount),
      salesAmount: numeric(record.salesAmount)
    };
    const quantity = numeric(record.quantity),
      returns = numeric(record.returnQuantity) ?? 0;
    const netBoxes = quantity !== null && returns !== null ? quantity - returns : numeric(record.netBoxes ?? record.orderBoxes);
    const personalSalesEligible = Boolean(product?.role === 'PRIMARY' && !/已取消/.test(String(record.orderStatus || '')));
    const amount = personalSalesEligible && netBoxes !== null ? netBoxes * product.unitPrice : null;
    return {
      ...record,
      sourceMonetaryFacts: {
        ...facts
      },
      productId: product?.id || String(record.productId || ''),
      product: product?.name || record.product,
      productName: product?.name || record.productName,
      productRole: product?.role || 'UNKNOWN',
      unitPrice: product?.unitPrice ?? null,
      netBoxes,
      orderBoxes: personalSalesEligible ? netBoxes : null,
      salesAmount: amount,
      netAmount: amount,
      personalSalesEligible,
      salesAmountMethod: 'NET_BOXES_X_PRODUCT_REGISTRY_PRICE'
    };
  }
  function personalSalesRecords(records = []) {
    return records.map(normalizeSalesRecord).filter(record => record.personalSalesEligible);
  }
  function isReliableHospitalRecord(row) {
    const statuses = [row.hospitalMatchStatus, row.hospitalBindingStatus].map(value => String(value || '').trim().toUpperCase()).filter(Boolean);
    return Boolean(String(row.hospitalId || '').trim()) && statuses.every(status => ['EXACT', 'CONFIRMED', 'MANUAL_MAPPING', 'STABLE_ID'].includes(status));
  }
  function reportingSalesRecords(records) {
    return personalSalesRecords(records).map(row => !isReliableHospitalRecord(row) ? {
      ...row,
      sourceHospitalId: row.sourceHospitalId ?? row.hospitalId,
      sourceHospitalName: row.sourceHospitalName ?? row.hospital,
      hospitalId: '',
      hospital: '待确认医院',
      hospitalAssignmentPending: true
    } : row);
  }
  function assistanceDenominator(proof, context) {
    if (!proof || !String(context.hospitalId || '').trim() || getProduct(context.productId)?.role !== 'AUXILIARY' || !/^\d{4}-10-01$/.test(context.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(context.to || '') || context.to <= context.from || context.to > `${Number(context.from.slice(0, 4)) + 1}-09-30`) return null;
    const amount = numeric(proof.amount);
    return ['TEAM', 'EXTERNAL'].includes(proof.sourceType) && ['EXACT', 'CONFIRMED'].includes(proof.reliability) && String(proof.sourceId || '').trim() && proof.hospitalId === context.hospitalId && proof.productId === context.productId && proof.from === context.from && proof.to === context.to && amount > 0 ? {
      amount,
      sourceId: proof.sourceId,
      sourceType: proof.sourceType
    } : null;
  }
  return Object.freeze({
    products,
    getProduct,
    normalizeSalesRecord,
    personalSalesRecords,
    assistanceDenominator,
    isReliableHospitalRecord,
    reportingSalesRecords
  });
});
