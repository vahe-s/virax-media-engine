import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm,writeFile,readFile } from 'node:fs/promises';
import { join,resolve,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { Store } from '../src/store.mjs';
import { Engine } from '../src/engine.mjs';
import { DriveSync } from '../src/drive.mjs';

async function fixture(t){
  const parent=resolve('.data/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'drive-')),store=new Store(join(root,'engine.sqlite')),engine=new Engine(store),brand=engine.createBrand('Fictional Drive Test');
  t.after(async()=>{store.close();assert.ok(relative(parent,root).startsWith('drive-'));await rm(root,{recursive:true,force:true});});
  const files=new Map(),pending=new Map();let sequence=0,uploads=0,failAfterCommit=false,identityFails=false,account={emailAddress:'example@example.invalid',permissionId:'mock-owner'};
  const response=(data,status=200,headers={})=>({ok:status>=200&&status<300,status,json:async()=>data,headers:new Headers(headers)});
  const fetcher=async(url,options)=>{
    const u=new URL(url),body=Buffer.isBuffer(options.body)?options.body:options.body?JSON.parse(options.body):null;
    if(u.pathname.endsWith('/about'))return identityFails?response({},503):response({user:account});
    if(u.pathname.endsWith('/generateIds'))return response({ids:[`mock_${++sequence}`]});
    if(u.pathname.startsWith('/upload/drive/v3/files')){
      if(options.method==='PUT'){const saved=pending.get(u.searchParams.get('upload_id'));files.set(saved.id,{...saved,md5Checksum:createHash('md5').update(body).digest('hex')});uploads++;if(failAfterCommit){failAfterCommit=false;throw new Error('Simulated lost response after upload.');}return response(files.get(saved.id));}
      const id=body.id||u.pathname.split('/').at(-1),saved={...files.get(id),...body,id};pending.set(id,saved);return response({},200,{location:`https://www.googleapis.com/upload/drive/v3/files?upload_id=${id}`});
    }
    if(u.pathname.endsWith('/files')&&options.method==='POST'){files.set(body.id,{...body,webViewLink:`https://drive.google.com/drive/folders/${body.id}`});return response(files.get(body.id));}
    const id=u.pathname.split('/').at(-1);return files.has(id)?response(files.get(id)):response({},404);
  };
  const clientFactory=()=>({credentials:{},setCredentials(c){this.credentials=c;},async getAccessToken(){return {token:this.credentials.access_token||'mock-access'};},generateCodeVerifierAsync:async()=>({codeVerifier:'mock-verifier',codeChallenge:'mock-challenge'}),generateAuthUrl:o=>'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams(o),getToken:async()=>({tokens:{access_token:'mock-new-access',refresh_token:'mock-new-refresh'}}),getTokenInfo:async()=>({scopes:['https://www.googleapis.com/auth/drive.file']}),revokeCredentials:async()=>{}});
  const sync=new DriveSync(engine,root,{env:{GOOGLE_CLIENT_ID:'mock-client',GOOGLE_CLIENT_SECRET:'mock-secret'},fetcher,clientFactory});sync.client=clientFactory();sync.credentials={access_token:'mock-access',refresh_token:'mock-refresh'};sync.client.setCredentials(sync.credentials);store.put('connection',{id:'drive_connection',kind:'connection',account:account.emailAddress,accountId:account.permissionId});sync.configure(brand.id,{enabled:true,automatic:false});
  return {root,store,engine,brand,sync,files,get uploads(){return uploads;},loseNextUpload(){failAfterCommit=true;},failIdentity(){identityFails=true;},changeAccount(){account={emailAddress:'second@example.invalid',permissionId:'mock-second-owner'};}};
}
test('Drive sync checks uploaded bytes and reuses IDs for unchanged files (mock network)',async t=>{
  const f=await fixture(t);const first=await f.sync.sync(f.brand.id);assert.equal(first.state,'synced');assert.ok(first.folderUrl);const count=f.files.size,uploads=f.uploads;await f.sync.sync(f.brand.id);assert.equal(f.files.size,count);assert.equal(f.uploads,uploads);
});
test('Drive retries a lost upload response without a duplicate remote file (mock network)',async t=>{
  const f=await fixture(t);f.loseNextUpload();await assert.rejects(()=>f.sync.sync(f.brand.id),/safe retry/);const ids=Object.values(f.sync.config(f.brand.id).files).map(x=>x.id);await f.sync.sync(f.brand.id);assert.ok(ids.every(id=>f.files.has(id)));assert.equal(new Set([...f.files.values()].filter(x=>x.md5Checksum).map(x=>x.appProperties.viraxPath)).size,[...f.files.values()].filter(x=>x.md5Checksum).length);
});
test('Drive keeps remote edits and reports a conflict (mock network)',async t=>{
  const f=await fixture(t);await f.sync.sync(f.brand.id);const record=f.sync.config(f.brand.id).files['file:brand-profile.md'];f.files.get(record.id).md5Checksum='externally-edited';await assert.rejects(()=>f.sync.sync(f.brand.id),/Drive conflict/);assert.equal(f.files.get(record.id).md5Checksum,'externally-edited');assert.equal(f.sync.config(f.brand.id).state,'conflict');
});

test('A pause during an active upload survives its response and stops the next file',async t=>{
  const f=await fixture(t),send=f.sync.fetcher;let paused=false;
  f.sync.fetcher=async(url,options)=>{
    const response=await send(url,options);
    if(options.method==='PUT'&&!paused){paused=true;f.sync.configure(f.brand.id,{enabled:false,automatic:false});}
    return response;
  };
  await assert.rejects(()=>f.sync.sync(f.brand.id),/Sync paused/);
  const saved=f.sync.config(f.brand.id);
  assert.equal(saved.enabled,false);assert.equal(saved.automatic,false);assert.equal(saved.state,'paused');assert.equal(saved.error,null);assert.equal(f.uploads,1);
});
test('Drive file collection excludes connection secrets and other brands',async t=>{
  const f=await fixture(t);await mkdir(join(f.root,'connections'),{recursive:true});await writeFile(join(f.root,'connections','google-drive.json'),'PRIVATE_SECRET_SENTINEL');f.engine.createBrand('PRIVATE_OTHER_BRAND');const files=await f.sync.collect(f.brand.id);const content=files.map(x=>x.bytes.toString()).join('');assert.ok(!content.includes('PRIVATE_SECRET_SENTINEL'));assert.ok(!content.includes('PRIVATE_OTHER_BRAND'));assert.ok(files.some(f=>f.path==='brand-profile.md'));
});
test('Google callback needs its matching browser cookie and a fresh one-use state',async t=>{
  const f=await fixture(t);await f.sync.sync(f.brand.id);const folder=f.sync.config(f.brand.id).folderId,flow=await f.sync.begin('http://127.0.0.1:4318');assert.match(flow.url,/accounts.google.com/);await assert.rejects(()=>f.sync.finish(flow.state,'wrong','code'),/does not match/);await f.sync.finish(flow.state,flow.state,'code');assert.equal(f.sync.status().account,'example@example.invalid');assert.equal(f.sync.config(f.brand.id).folderId,folder);assert.equal(f.sync.config(f.brand.id).enabled,true);await assert.rejects(()=>f.sync.finish(flow.state,flow.state,'code'),/does not match/);
});

test('A failed Google identity check keeps the existing connection and private tokens',async t=>{
  const f=await fixture(t);await f.sync.saveTokens(f.sync.credentials);const oldClient=f.sync.client,oldTokens=await readFile(f.sync.tokenFile,'utf8'),flow=await f.sync.begin('http://127.0.0.1:4318');f.failIdentity();
  await assert.rejects(()=>f.sync.finish(flow.state,flow.state,'code'),/Google Drive request failed/);
  assert.equal(f.sync.client,oldClient);assert.equal(await readFile(f.sync.tokenFile,'utf8'),oldTokens);assert.equal(f.sync.status().account,'example@example.invalid');assert.equal(f.sync.busy,false);
});

test('Google reconnect cannot replace credentials during an active backup',async t=>{
  const f=await fixture(t),flow=await f.sync.begin('http://127.0.0.1:4318'),send=f.sync.fetcher,oldClient=f.sync.client;
  let releaseUpload,uploadStarted;const started=new Promise(resolve=>{uploadStarted=resolve;}),release=new Promise(resolve=>{releaseUpload=resolve;});
  f.sync.fetcher=async(url,options)=>{if(options.method==='PUT'){uploadStarted();await release;}return send(url,options);};
  const backup=f.sync.sync(f.brand.id);await started;
  try{await assert.rejects(()=>f.sync.finish(flow.state,flow.state,'code'),/active|already/i);assert.equal(f.sync.client,oldClient);}finally{releaseUpload();await backup;}
  await f.sync.finish(flow.state,flow.state,'code');assert.equal(f.sync.busy,false);
});

test('A different Google account needs a new explicit backup choice and keeps the old destination record',async t=>{
  const f=await fixture(t);f.sync.configure(f.brand.id,{enabled:true,automatic:true});await f.sync.sync(f.brand.id);const previous=f.sync.config(f.brand.id),oldRemoteIds=[...f.files.keys()],uploads=f.uploads,flow=await f.sync.begin('http://127.0.0.1:4318');f.changeAccount();
  await f.sync.finish(flow.state,flow.state,'code');const changed=f.sync.config(f.brand.id);
  assert.equal(f.sync.status().account,'second@example.invalid');assert.equal(changed.enabled,false);assert.equal(changed.automatic,false);assert.deepEqual(changed.files,{});assert.equal(f.uploads,uploads);
  const archives=f.store.list('drive_archive');assert.equal(archives.length,1);assert.equal(archives[0].folderId,previous.folderId);assert.ok(oldRemoteIds.every(id=>f.files.has(id)));
  f.sync.configure(f.brand.id,{enabled:true,automatic:false});await f.sync.sync(f.brand.id);assert.notEqual(f.sync.config(f.brand.id).folderId,previous.folderId);assert.ok(oldRemoteIds.every(id=>f.files.has(id)));
});
