'use strict';
// A scoped smoke/focused PASS cannot replace the private full-product Gate.
const fs=require('node:fs'),path=require('node:path'),file=path.resolve(__dirname,'../full-equivalence-status.json');
const status=JSON.parse(fs.readFileSync(file,'utf8'));
if(!['PASS','PASS_WITH_DECLARED_PUBLIC_VARIANTS'].includes(status.completeProductEquivalence)){console.error('FULL_PRODUCT_EQUIVALENCE_NOT_ESTABLISHED; retain all unported gates and local reality checks.');process.exitCode=1;}
