import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm,readFile } from 'node:fs/promises';
import { resolve,join,relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Store } from '../src/store.mjs';
import { Engine } from '../src/engine.mjs';
import { References,referenceUrl } from '../src/references.mjs';
import { saveProfileFiles } from '../src/profile.mjs';

const exec=promisify(execFile);
async function fixture(t){
  const parent=resolve('.data/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'references-'));
  const store=new Store(join(root,'engine.sqlite')),engine=new Engine(store),brand=engine.createBrand('Fictional Reference Studio'),references=new References(engine);
  t.after(async()=>{store.close();assert.ok(relative(parent,root).startsWith('references-'));await rm(root,{recursive:true,force:true});});
  return {root,store,engine,brand,references};
}
const inspection={viewed:true,format:'carousel',mode:'image-only',slideCount:3,summary:'Three test compositions.',style:'Blue surfaces and distinct complete objects.',reviewer:'Automated test fixture; no live reference was opened.'};

test('Reference links exclude DMs, credentials, local hosts, and unsafe schemes',()=>{
  assert.equal(referenceUrl('https://www.instagram.com/p/fixture/?img_index=2&stkn=tracking&utm_source=test'),'https://www.instagram.com/p/fixture/?img_index=2');
  for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://127.0.0.1/x','https://www.instagram.com/direct/t/123/'])assert.throws(()=>referenceUrl(url));
});
test('Pasted references need an inspection and retain the observed format and text treatment',async t=>{
  const f=await fixture(t),r=f.references.add(f.brand.id,{url:'https://example.com/reference',notes:'Use blue.'});
  assert.equal(r.status,'needs_inspection');assert.equal(f.references.add(f.brand.id,{url:r.url,notes:r.notes}).id,r.id);
  assert.throws(()=>f.references.draft(r.id),/Inspect/);
  assert.throws(()=>f.references.inspect(r.id,{...inspection,viewed:false}),/Inspect the actual/);
  f.references.inspect(r.id,inspection);const p=f.references.draft(r.id);
  assert.equal(p.format,'carousel');assert.equal(p.mode,'image-only');assert.equal(p.slides.length,3);assert.equal(p.referenceBrief.notes,'Use blue.');
  assert.equal(f.references.draft(r.id).id,p.id);assert.equal(f.store.list('post').length,1);
  await assert.rejects(()=>f.references.complete(r.id,f.root),/real media/);
});
test('Long references require an owner instruction before a shorter adaptation',async t=>{
  const f=await fixture(t),r=f.references.add(f.brand.id,{url:'https://example.com/long'});f.references.inspect(r.id,{...inspection,slideCount:20});
  assert.throws(()=>f.references.draft(r.id),/Ask the owner/);
  const p=f.references.draft(r.id,{ownerOverride:{slideCount:9,reason:'The owner explicitly requests nine slides in this test.'}});assert.equal(p.slides.length,9);
});
test('Lasting chat rules keep one current value, a history, and portable project instructions',async t=>{
  const f=await fixture(t);let b=f.engine.setRule(f.brand.id,{version:f.brand.version,key:'palette',text:'Use blue for this brand.'});
  b=f.engine.setRule(b.id,{version:b.version,key:'palette',text:'Use deep blue and white.'});
  assert.equal(b.rules.length,1);assert.equal(b.rules[0].text,'Use deep blue and white.');assert.ok(f.store.history(b.id).some(v=>v.rules?.[0]?.text==='Use blue for this brand.'));
  assert.throws(()=>f.engine.setRule(b.id,{version:1,key:'palette',text:'Stale'}),/changed/);
  const exported=await saveProfileFiles(f.root,b);assert.match(await readFile(join(exported.directory,'brand-profile.md'),'utf8'),/Use deep blue and white/);assert.match(await readFile(join(exported.directory,'PROJECT-INSTRUCTIONS.md'),'utf8'),/project chat as the main interface/);
  const result=await exec(process.execPath,['src/cli.mjs','chat-context',b.id],{cwd:resolve('.'),env:{...process.env,ENGINE_DATA_DIR:f.root},maxBuffer:1024*1024});
  const context=JSON.parse(result.stdout);assert.equal(context.brand.rules[0].text,'Use deep blue and white.');assert.equal(context.profileFiles.version,b.version);
  b=f.engine.setRule(b.id,{version:b.version,key:'palette',remove:true});assert.equal(b.rules.length,0);
});
