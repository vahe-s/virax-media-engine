import { readdir,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve('.'),skip=new Set(['node_modules','.git','.data','private','test-results']);
async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(skip.has(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(path));else out.push(path);}return out;}
const files=await walk(root);let errors=[];
for(const file of files){
  if(/\.(mjs|js)$/.test(file)){const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)errors.push(`${file}: ${check.stderr}`);}
  if(/\.(json)$/.test(file)){try{JSON.parse(await readFile(file,'utf8'));}catch{errors.push(`Invalid JSON: ${file}`);}}
  if(/\.(md|mjs|js|json|txt|html|css|yml)$/.test(file) && !file.endsWith('package-lock.json')){
    const text=await readFile(file,'utf8');
    if(/gh[opusr]_[A-Za-z0-9]{25,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|EAA[A-Za-z0-9]{60,}/.test(text))errors.push(`Possible credential: ${file}`);
    if(/[A-Z]:\\Users\\|[A-Z]:\\AI Projects/.test(text))errors.push(`Private absolute path: ${file}`);
  }
}
for(const needed of ['README.md','START-HERE.md','PROJECT-INSTRUCTIONS.md','AGENTS.md','LICENSE','docs/chat-workflow.md','docs/references.md','docs/agent-workflow.md','docs/platforms.md','docs/deployment.md','docs/verification.md','examples/ASSET-LICENSE.md']){if(!files.includes(join(root,needed)))errors.push(`Missing ${needed}`);}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Checked ${files.length} public files. Syntax, JSON, required guides, and secret patterns passed.`);
