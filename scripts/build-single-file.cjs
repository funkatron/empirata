const fs = require('node:fs');
const path = require('node:path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent => ent.isDirectory()?walk(path.join(dir,ent.name)):[path.join(dir,ent.name)]);
let registry = '';
for (const filename of walk(path.join(root,'src')).filter(f=>f.endsWith('.ts')).sort()) {
  const id=path.relative(path.join(root,'src'),filename).replace(/\\/g,'/').replace(/\.ts$/,'.js');
  const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  registry+=`__modules[${JSON.stringify(id)}] = function(module, exports, require) {\n${js}\n};\n`;
}
const loader=`\n(()=>{\n'use strict';\nconst __modules=Object.create(null);\nconst __cache=Object.create(null);\n${registry}\nfunction __load(id){\n if(Object.hasOwn(__cache,id))return __cache[id].exports;\n const factory=__modules[id];if(!factory)throw new Error('Missing Empirata module: '+id);\n const module={exports:{}};__cache[id]=module;\n factory(module,module.exports,(request)=>{\n   if(!request.startsWith('.'))throw new Error('Unexpected external module: '+request);\n   const parts=id.split('/');parts.pop();\n   for(const part of request.split('/')){if(part==='.'||part==='')continue;if(part==='..')parts.pop();else parts.push(part)}\n   return __load(parts.join('/'));\n });\n return module.exports;\n}\n__load('ui/main.js');\n})();\n`;
let html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'dist/styles.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="./styles.css"/>',`<style>\n${css}\n</style>`);
html=html.replace('<script type="module" src="./ui/main.js"></script>',`<script>\n${loader.replaceAll('</script','<\\/script')}\n</script>`);
if (html.includes('src="./ui/main.js"') || html.includes('href="./styles.css"'))throw new Error('Some imports were not embedded');
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Wrote single-file HTML: ',Buffer.byteLength(html),'bytes');
