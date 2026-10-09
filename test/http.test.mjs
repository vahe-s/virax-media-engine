import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { join,resolve,relative } from 'node:path';
import { createApp } from '../src/server.mjs';

test('private HTTP workflow rejects cross-origin and unauthenticated access',async()=>{
  const parent=resolve('.data/tests');await mkdir(parent,{recursive:true});const dataDir=await mkdtemp(join(parent,'http-'));
  const app=await createApp({dataDir,workerEnabled:false,env:{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
  try {
    assert.equal((await fetch(base+'/api/state')).status,401);
    assert.equal((await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://bad.example'}})).status,403);
    const session=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),cookie=session.headers.get('set-cookie').split(';')[0],{csrf}=await session.json();
    assert.match(session.headers.get('set-cookie'),/HttpOnly/);
    assert.equal((await fetch(base+'/api/brands',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'})).status,403);
    const headers={Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf};
    const response=await fetch(base+'/api/brands',{method:'POST',headers,body:JSON.stringify({name:'Fresh test business'})});assert.equal(response.status,201);const brand=await response.json();
    const state=await fetch(base+'/api/state',{headers});const data=await state.json();assert.equal(data.brands.length,1);assert.equal(data.brands[0].id,brand.id);assert.equal(data.liveEnabled,false);
    assert.equal((await fetch(base+'/api/files/../../package.json',{headers})).status,404);
    assert.equal((await fetch(base+'/examples/../.env.local')).status,404);
    const reference=await fetch(base+'/api/references',{method:'POST',headers,body:JSON.stringify({brandId:brand.id,url:'https://example.com/public-reference',notes:'Keep the format.'})});assert.equal(reference.status,201);
    const refs=await (await fetch(base+`/api/references?brandId=${brand.id}`,{headers})).json();assert.equal(refs.length,1);assert.equal(refs[0].status,'needs_inspection');
    assert.equal((await fetch(base+'/api/webhooks/instagram',{method:'POST',headers,body:'{}'})).status,404);
    assert.equal((await fetch(base+'/api/dm/pair',{method:'POST',headers,body:'{}'})).status,404);
  } finally {await app.close();assert.ok(relative(parent,dataDir).startsWith('http-'));await rm(dataDir,{recursive:true,force:true});}
});
