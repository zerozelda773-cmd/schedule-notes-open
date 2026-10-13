'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'dist');
const allowed=new Set(JSON.parse(fs.readFileSync(path.join(__dirname,'build-files.json'),'utf8'))),port=Number(process.env.PORT||4173);
const server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'index.html':pathname.slice(1);if(!allowed.has(relative))throw Error('not_public');const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('invalid');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log('Offline public development server ready on loopback'));
