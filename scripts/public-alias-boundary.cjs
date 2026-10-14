'use strict';
const fs=require('fs'),p=require('path'),crypto=require('crypto');
const normalize=s=>String(s).replace(/\\s[+*?]?/g,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const allowed=new Set(['primaryproducta','primaryproductb','auxiliaryproducta','auxiliaryproductb','psynprimarya','psynprimaryb','psynauxiliarya','psynauxiliaryb']);
function scanText(code,path){
 const hits=[];
 const re=/\.replace\s*\(\s*\/((?:\\.|[^/\r\n])+)\/[dgimsuvy]*\s*,\s*['"]((?:Primary|Auxiliary)\s*Product\s*[AB])['"]\s*\)/g;
 for(const m of code.matchAll(re)){if(!allowed.has(normalize(m[1])))hits.push({path,rule:'UNDECLARED_PRODUCT_REGEX_ALIAS',fingerprint:crypto.createHash('sha256').update(m[1]).digest('hex')});}
 return hits;
}
function walk(dir,base=dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(['node_modules','.git','.gradle','build','dist','.generated'].includes(e.name))return [];const f=p.join(dir,e.name);return e.isDirectory()?walk(f,base):/\.(?:js|cjs|mjs|html|json)$/.test(e.name)?[{path:p.relative(base,f).split(p.sep).join('/'),file:f}]:[];});}
async function scanTree(root,apk){
 const source=walk(root),built=fs.existsSync(p.join(root,'dist'))?walk(p.join(root,'dist')):[],hits=[],classifiedFixtures=[];
 // Only the exact reviewed, immutable negative-test file is classified as a fixture.
 // No directory exclusion, no known-sensitive exception, no build/package exception.
 for(const r of source){const code=fs.readFileSync(r.file,'utf8'),found=scanText(code,r.path);
  const exactFixture=r.path==='tests/public-alias-boundary.test.cjs'&&crypto.createHash('sha256').update(code).digest('hex')==='5d0ba6316b65c081a838218c4cae97656c840c032849f7fbf494616f955e95f5';
  for(const f of found){if(exactFixture&&f.fingerprint==='a544d9efd0402a18f4f999b971e9c78a88cf178537167435182ef7b2133af2db')classifiedFixtures.push({...f,classification:'SYNTHETIC_NEGATIVE_TEST'});else hits.push(f);}
 }
 for(const r of built)hits.push(...scanText(fs.readFileSync(r.file,'utf8'),'dist/'+r.path));
 let packaged=0;if(apk){const zip=await require('jszip').loadAsync(fs.readFileSync(apk));for(const entry of Object.values(zip.files)){if(entry.dir||!entry.name.startsWith('assets/www/'))continue;packaged++;hits.push(...scanText(await entry.async('string'),'apk:'+entry.name));}}
 return{status:hits.length?'FAIL':'PASS',sourceFiles:source.length,builtFiles:built.length,packagedFiles:packaged,findings:hits,classifiedFixtures,policy:'Only declared generic catalogue aliases may normalize directly to a public product. Exactly reviewed negative-test bytes receive fixture classification; all tests remain scanned. This structural guard supplements local private corpus scans; it is not a universal sensitive-data detector.'};
}
module.exports={scanText,scanTree,normalize};
if(require.main===module)scanTree(p.resolve(__dirname,'..'),process.argv[2]).then(r=>{console.log(JSON.stringify(r));if(r.findings.length)process.exitCode=1;}).catch(()=>{console.error('Boundary resource scan failed');process.exitCode=1;});
