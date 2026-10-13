'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),root=path.resolve(__dirname,'..'),registry=require('../product-registry.js');
const code=fs.readFileSync(path.join(root,'activity-center.js'),'utf8'),text=code.match(/const PRODUCT_TOPICS\s*=\s*(\{[\s\S]*?\n\s*\});/);
assert.ok(text,'Missing product topic contract');const topics=JSON.parse(text[1]);
assert.deepEqual(Object.keys(topics).sort(),registry.products.map(row=>row.name).sort(),'Topics must use only the declared public product catalogue');
assert.ok(Object.values(topics).every(value=>typeof value==='string'&&registry.products.some(row=>value.startsWith(row.name))),'Topic labels must use public product names');
console.log(JSON.stringify({status:'PASS',publicProductTopicKeys:Object.keys(topics).length,privateBusinessIdentifierPolicy:'Only declared public catalogue keys; no unquoted or unknown business identifiers'}));
