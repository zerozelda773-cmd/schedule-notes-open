'use strict';const test=require('node:test'),a=require('assert/strict'),{scanText,normalize}=require('../scripts/public-alias-boundary.cjs');
test('declared generic alias remains public-safe',()=>a.equal(scanText('x.replace(/primary\\s*product\\s*a/gi, "Primary Product A")','source.js').length,0));
test('synthetic undeclared regex alias is rejected in source',()=>a.equal(scanText('x.replace(/fictional\\s*brand\\s*q/gi, "Primary Product A")','source.js').length,1));
test('synthetic undeclared alias is rejected in generated output',()=>a.equal(scanText('x.replace(/fictional\\s*brand\\s*q/gi,"Primary Product B")','dist/app.js').length,1));
test('synthetic undeclared alias is rejected in packaged resources',()=>a.equal(scanText('x.replace(/fictional\\s*brand\\s*q/gi,"Primary Product B")','apk:assets/www/app.js').length,1));
test('whitespace-normalized alias cannot bypass catalogue',()=>a.equal(normalize('fictional\\s*brand\\s*q'),'fictionalbrandq'));
test('generic auxiliary alias is retained',()=>a.equal(scanText('x.replace(/auxiliary\\s*product\\s*b/gi,"Auxiliary Product B")','source.js').length,0));
