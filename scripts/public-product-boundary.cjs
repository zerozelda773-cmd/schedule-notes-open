'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function assertPublicCatalogue(code,products){
 const match=code.match(/const PRODUCT_TOPICS\s*=\s*(\{[\s\S]*?\n\s*\});/);
 assert.ok(match,'Missing public topic contract');let topics;
 try{topics=JSON.parse(match[1]);}catch{throw Error('Public topic contract requires JSON-compatible quoted catalogue keys');}
 assert.ok(JSON.stringify(Object.keys(topics).sort())===JSON.stringify(products.map(row=>row.name).sort()),'Topic key set must equal declared public catalogue');
 assert.ok(Object.values(topics).every(v=>typeof v==='string'&&products.some(row=>v.startsWith(row.name))),'Topic values must use declared public product names');
 return {status:'PASS',publicProductTopicKeys:Object.keys(topics).length};
}
module.exports={assertPublicCatalogue};
if(require.main===module){const root=path.resolve(__dirname,'..');const result=assertPublicCatalogue(fs.readFileSync(path.join(root,'activity-center.js'),'utf8'),require('../product-registry.js').products);console.log(JSON.stringify(result));}
