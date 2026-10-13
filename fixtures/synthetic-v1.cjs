'use strict';
// Independently generated values and topology. No production fixture input.
const version='synthetic-product-v1';
function createDataset(){
 const hospitals=Array.from({length:12},(_,i)=>({id:'H_SYN_'+String(i+1).padStart(3,'0'),hospitalId:'H_SYN_'+String(i+1).padStart(3,'0'),canonicalName:i<2?'Synthetic Hospital Shared':'Synthetic Hospital '+(i+1),name:i<2?'Synthetic Hospital Shared':'Synthetic Hospital '+(i+1),hospitalCode:'CODE_SYN_'+(i+1),purchaseUnitId:'PU_SYN_'+(i+1),purchaseUnitIds:['PU_SYN_'+(i+1)],aliases:['Synthetic Hospital Alias '+(i+1)],salesHospitalIds:[],hospitalLevel:i%2?'SECONDARY':'TERTIARY',city:'Synthetic City '+(i%3+1),source:'synthetic-product-v1',sourceIds:['SRC_SYN_'+(i+1)],sourceFiles:[],legacyIds:[],evidence:[],verifiedAt:'2030-03-15',authorityKey:'synthetic:'+i,synthetic:true}));
 const departments=hospitals.flatMap((h,i)=>[0,1].map(j=>({id:'D_SYN_'+i+'_'+j,hospitalId:h.id,name:j?'Synthetic Department B':'Synthetic Department Shared',synthetic:true})));
 const employees=Array.from({length:4},(_,i)=>({id:'E_SYN_'+i,name:'Synthetic Employee '+(i+1),synthetic:true}));
 const products=[{id:'P_SYN_PRIMARY_A',name:'Primary Product A',role:'primary',unitPrice:17},{id:'P_SYN_PRIMARY_B',name:'Primary Product B',role:'primary',unitPrice:29},{id:'P_SYN_AUX_A',name:'Auxiliary Product A',role:'auxiliary',unitPrice:7},{id:'P_SYN_AUX_B',name:'Auxiliary Product B',role:'auxiliary',unitPrice:11}].map(p=>({...p,synthetic:true}));
 const customers=Array.from({length:8},(_,i)=>({id:'C_SYN_'+i,name:i<2?'Synthetic Customer Shared':'Synthetic Customer '+(i+1),hospitalId:hospitals[(i*5+3)%12].id,departmentId:departments[((i*5+3)%12)*2+(i%2)].id,employeeId:employees[(i*3+1)%4].id,abcd:['A','B','C','D'][i%4],observation:['R1','R2','R3','R4'][i%4],synthetic:true}));
 const sales=Array.from({length:10},(_,i)=>({id:'S_SYN_'+i,hospitalId:hospitals[(i*7+2)%12].id,employeeId:employees[i%4].id,productId:products[i%4].id,date:'2030-'+String(i%3+1).padStart(2,'0')+'-15',amount:i===0?null:i===1?0:((i*13)%47)+3,boxes:i===0?null:i%5,sourceId:'SRC_SYN_SALES',synthetic:true}));
 const plans=employees.map((e,i)=>({id:'PLAN_SYN_'+i,employeeId:e.id,period:'2030-03',productId:products[(i+1)%4].id,target:19+i*7,synthetic:true}));
 const activities=[null,0,43.5].map((actualExpense,i)=>({id:'A_SYN_'+i,hospitalId:hospitals[(i*3+1)%12].id,departmentId:departments[((i*3+1)%12)*2].id,productId:products[i%4].id,date:'2030-03-'+String(i+10),status:['草稿','待执行','已完成'][i],approvalStatus:['未提交','已通过','已通过'][i],actualExpense,budget:71+i*3,synthetic:true}));
 const visits=customers.slice(0,4).map((c,i)=>({id:'V_SYN_'+i,customerId:c.id,hospitalId:c.hospitalId,date:'2030-03-'+(i+11),status:'planned',synthetic:true}));
 const tasks=customers.slice(0,4).map((c,i)=>({id:'T_SYN_'+i,customerId:c.id,sourceTaskId:i?'T_SYN_'+(i-1):null,status:['pending','done','cancelled','pending'][i],date:'2030-03-15',synthetic:true}));
 const boundaries={sameNameHospitals:[hospitals[0].id,hospitals[1].id],sameNameCustomers:[customers[0].id,customers[1].id],missingIdentity:{hospitalId:null,quality:'UNRESOLVED'},duplicateTasks:[{id:'T_SYN_DUP',sourceTaskId:'T_SYN_0'},{id:'T_SYN_DUP',sourceTaskId:'T_SYN_0'}],months:[{month:'2030-01',value:null},{month:'2030-02',value:0},{month:'2030-03',value:23}],fiscal:{start:'2029-10-01',endExclusive:'2030-10-01',boundaryBefore:'2029-09-30',boundaryAfter:'2029-10-01'},restore:{revision:'SYN_REV_1',staleRevision:'SYN_REV_0',retainNull:true},navigation:{from:'Task',to:'Customer',back:'Task',sourceTaskId:'T_SYN_0'}};
 return {synthetic:true,version,hospitals,departments,employees,products,customers,sales,plans,activities,visits,tasks,boundaries};
}
module.exports={version,createDataset};

