'use strict';
const test=require('node:test'),a=require('assert/strict'),sales=require('../sales-import-adapter.js');
const row=(fy,month,quantity,extra={})=>({fiscalYear:fy,month,quantity,returnQuantity:0,netBoxes:quantity,productId:'P_SYN_PRIMARY_A',productName:'Primary Product A',hospitalId:'H_SYN_MOM_A',hospitalCanonical:'Synthetic MoM A',hospitalMatchStatus:'EXACT',...extra});
const current=(rows,fy,month,h='H_SYN_MOM_A',product='P_SYN_PRIMARY_A')=>sales.aggregateStatistics(rows).hospitalMonthProduct.find(r=>r.fiscalYear===fy&&r.month===month&&r.hospitalId===h&&r.productId===product);
for(let month=1;month<=12;month++){const previousMonth=month===1?12:month-1,previousFY=month===10?2030:2031;test('FY calendar adjacency for synthetic month '+month,()=>a.equal(current([row(previousFY,previousMonth,4),row(2031,month,10)],2031,month).momChange,1.5));}
test('missing previous month remains null without invented rows',()=>{const r=sales.aggregateStatistics([row(2031,10,10)]);a.equal(r.hospitalMonthProduct.length,1);a.equal(r.hospitalMonthProduct[0].momChange,null);});
test('a gap cannot bridge the missing previous month',()=>a.equal(current([row(2030,8,4),row(2031,10,10)],2031,10).momChange,null));
test('known zero prior retains null ratio',()=>a.equal(current([row(2030,9,0),row(2031,10,10)],2031,10).momChange,null));
test('known current zero over positive prior is minus one',()=>a.equal(current([row(2030,9,4),row(2031,10,0)],2031,10).momChange,-1));
test('another hospital cannot provide prior period',()=>a.equal(current([row(2030,9,4,{hospitalId:'H_SYN_MOM_B'}),row(2031,10,10)],2031,10).momChange,null));
test('another product cannot provide prior period',()=>a.equal(current([row(2030,9,4,{productId:'P_SYN_PRIMARY_B'}),row(2031,10,10)],2031,10).momChange,null));
test('probable hospital prior cannot enter exact aggregation',()=>a.equal(current([row(2030,9,4,{hospitalMatchStatus:'PROBABLE'}),row(2031,10,10)],2031,10).momChange,null));
test('net returns drive both numerator and prior denominator',()=>a.equal(current([row(2030,9,8,{returnQuantity:4}),row(2031,10,12,{returnQuantity:2})],2031,10).momChange,1.5));
for(const month of [10,11,12])test('wrong fiscal year cannot supply prior for month '+month,()=>{
  const priorMonth=month-1;
  const wrongFY=month===10?2031:2032;
  const rows=[row(wrongFY,priorMonth,99),row(2031,month,10)];
  a.equal(current(rows,2031,month).momChange,null);
  a.equal(sales.aggregateStatistics(rows).hospitalMonthProduct.length,2);
});
test('negative prior denominator stays null',()=>a.equal(current([row(2030,9,-4),row(2031,10,10)],2031,10).momChange,null));
test('preview preserves observed amounts and uses fiscal adjacency',()=>{
  const records=[row(2030,9,4),row(2031,10,10)],preview=sales.buildPreview({records,details:records,quality:{validRecords:2},sheetName:'Synthetic source'});
  a.equal(preview.statistics.hospitalMonthProduct.find(r=>r.month===10).momChange,1.5);
  a.deepEqual(preview.months.map(r=>r.netBoxes),[4,10]);a.equal(preview.validRecords,2);
});
test('aggregation never mutates synthetic source facts',()=>{
  const rows=[row(2030,9,4),row(2031,10,10)],before=structuredClone(rows);sales.aggregateStatistics(rows);a.deepEqual(rows,before);
});
test('non-MoM totals contribution and department facts stay observed',()=>{
  const rows=[row(2030,9,4,{office:'Synthetic Office',departmentId:'D_SYN_A',departmentCanonical:'Synthetic Department'}),row(2031,10,10,{office:'Synthetic Office',departmentId:'D_SYN_A',departmentCanonical:'Synthetic Department'}),row(2031,10,30,{hospitalId:'H_SYN_MOM_B'})];
  const stats=sales.aggregateStatistics(rows),oct=stats.hospitalMonthProduct.find(r=>r.hospitalId==='H_SYN_MOM_A'&&r.month===10);
  a.equal(oct.netBoxes,10);a.equal(oct.orders,1);a.equal(oct.quantity,10);a.equal(oct.returnQuantity,0);a.equal(oct.contributionRate,0.25);
  a.equal(stats.monthProduct.find(r=>r.month===10).netBoxes,40);a.equal(stats.departmentMonthProduct.find(r=>r.month===10&&r.departmentId==='D_SYN_A').netBoxes,10);
  a.equal(stats.unassignedHospitalRecords,0);a.equal(stats.monthProduct.length,2);
});
