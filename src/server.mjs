import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { Store } from './store.mjs';
import { Engine, expect } from './engine.mjs';
import { Worker } from './worker.mjs';
import { capabilities, MetaProvider } from './providers.mjs';
import { stages, styles } from './interview.mjs';
import { addAsset, confined, renderPost, exportPack, taskPack, brandMarkdown } from './media.mjs';
import { seedDemo } from './demo.mjs';
import { DriveSync } from './drive.mjs';
import { References } from './references.mjs';
import { saveProfileFiles,projectInstructions } from './profile.mjs';

export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function createApp({dataDir=resolve(process.env.ENGINE_DATA_DIR||'.data'),env=process.env,workerEnabled=true}={}) {
  await mkdir(dataDir,{recursive:true});const store=new Store(join(dataDir,'engine.sqlite')),engine=new Engine(store),meta=new MetaProvider(env),worker=new Worker(engine,{meta,mediaRoot:dataDir});
  const drive=new DriveSync(engine,dataDir,{env});await drive.init();
  const references=new References(engine);
  const saveBrand=async brand=>{await saveProfileFiles(dataDir,brand);return brand;};
  const sessions=new Map(),host=env.ENGINE_HOST||'127.0.0.1',remote=!['127.0.0.1','localhost','::1'].includes(host);
  if(remote) expect(/^https:\/\//.test(env.ENGINE_ORIGIN||'') && (env.ENGINE_ACCESS_TOKEN||'').length>=32,'Remote mode needs an exact HTTPS origin and an access token of at least 32 characters.');
  worker.recover();
  const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
  function send(res,status,body,type='application/json',headers={}) {res.writeHead(status,{...security,'Content-Type':type,'Cache-Control':'no-store',...headers});res.end(type==='application/json'?JSON.stringify(body):body);}
  async function body(req) {let chunks=[],size=0;for await(const c of req){size+=c.length;expect(size<=30*1024*1024,'Request is too large.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
  const server=http.createServer(async(req,res)=>{
    try {
      const reqHost=req.headers.host||'',port=server.address()?.port;
      const allowedHosts=remote?[new URL(env.ENGINE_ORIGIN).host]:[`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`];
      if(!allowedHosts.includes(reqHost)){send(res,403,{error:'Host is not allowed.'});return;}
      const origin=remote?env.ENGINE_ORIGIN:`http://${reqHost}`;
      const url=new URL(req.url,origin),path=url.pathname;
      if(req.method==='GET' && path==='/api/drive/callback') {
        const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)virax_oauth=([a-f0-9]+)/)?.[1];
        try {await drive.finish(url.searchParams.get('state'),cookie,url.searchParams.get('code'));send(res,200,'<!doctype html><meta name="referrer" content="no-referrer"><title>Google Drive connected</title><p>Google Drive is connected. Return to Settings to choose a brand and enable sync.</p><a href="/">Return to the studio</a>','text/html',{'Set-Cookie':'virax_oauth=; HttpOnly; SameSite=Lax; Path=/api/drive/callback; Max-Age=0'});}catch{send(res,400,'Google connection failed or expired. Return to Settings and try again.','text/plain');}return;
      }
      if(req.headers.origin && req.headers.origin!==origin){send(res,403,{error:'Cross-origin access is not allowed.'});return;}
      if(['cross-site','same-site'].includes(req.headers['sec-fetch-site'])){send(res,403,{error:'Open the app directly.'});return;}
      if(req.method==='POST' && path==='/api/session') {
        const input=await body(req);
        if(remote) {const a=Buffer.from(String(input.token||'')),b=Buffer.from(env.ENGINE_ACCESS_TOKEN);if(a.length!==b.length || !timingSafeEqual(a,b)){send(res,401,{error:'Enter the private access token.'});return;}}
        const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');sessions.set(id,{csrf,at:Date.now()});
        send(res,200,{csrf,mode:remote?'remote':'local'},'application/json',{'Set-Cookie':`virax_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${remote?'; Secure':''}`});return;
      }
      if(path.startsWith('/api/')) {
        const sid=(req.headers.cookie||'').match(/(?:^|;\s*)virax_session=([a-f0-9]+)/)?.[1],session=sessions.get(sid);
        if(!session || Date.now()-session.at>43200000){send(res,401,{error:'Start a new private session.'});return;}
        if(req.method!=='GET' && req.headers['x-csrf-token']!==session.csrf){send(res,403,{error:'Invalid request token.'});return;}
        const parts=path.split('/').filter(Boolean),id=parts[2],action=parts[3];
        if(req.method==='GET' && path==='/api/state') {send(res,200,{brands:store.list('brand'),posts:store.list('post'),grants:store.list('grant'),references:store.list('reference'),assets:store.list('asset').map(({file,...a})=>a),events:store.events(),capabilities:capabilities(env),connection:store.get('meta_connection'),drive:drive.status(),stages,styles,liveEnabled:env.ENGINE_LIVE_PUBLISH==='true',workerEnabled,remote});return;}
        if(req.method==='POST' && path==='/api/drive/connect'){const auth=await drive.begin(origin);send(res,200,{url:auth.url},'application/json',{'Set-Cookie':`virax_oauth=${auth.state}; HttpOnly; SameSite=Lax; Path=/api/drive/callback; Max-Age=600${remote?'; Secure':''}`});return;}
        if(req.method==='POST' && path==='/api/drive/disconnect'){send(res,200,await drive.disconnect());return;}
        if(req.method==='POST' && path==='/api/drive/configure'){const input=await body(req);send(res,200,drive.configure(input.brandId,input));return;}
        if(req.method==='POST' && path==='/api/drive/sync'){send(res,200,await drive.sync((await body(req)).brandId));return;}
        if(req.method==='POST' && path==='/api/demo'){send(res,200,await seedDemo(engine,dataDir,projectRoot));return;}
        if(req.method==='POST' && path==='/api/brands'){send(res,201,await saveBrand(engine.createBrand((await body(req)).name)));return;}
        if(req.method==='PUT' && parts[1]==='brands' && id){send(res,200,await saveBrand(engine.updateBrand(id,await body(req))));return;}
        if(parts[1]==='brands' && action==='style' && req.method==='POST'){send(res,200,await saveBrand(engine.chooseStyle(id,(await body(req)).style)));return;}
        if(parts[1]==='brands' && action==='rule' && req.method==='POST'){send(res,200,await saveBrand(engine.setRule(id,await body(req))));return;}
        if(parts[1]==='brands' && action==='context' && req.method==='GET'){send(res,200,references.context(id));return;}
        if(req.method==='POST' && path==='/api/references'){const input=await body(req);send(res,201,references.add(input.brandId,input));return;}
        if(req.method==='GET' && path==='/api/references'){send(res,200,store.list('reference').filter(r=>r.brandId===url.searchParams.get('brandId')));return;}
        if(parts[1]==='references' && id && req.method==='POST'){
          const input=await body(req);
          if(action==='inspect')send(res,200,references.inspect(id,input));
          else if(action==='draft')send(res,200,references.draft(id,input));
          else if(action==='complete')send(res,200,await references.complete(id,dataDir));
          else send(res,404,{error:'Reference action not found.'});
          return;
        }
        if(parts[1]==='brands' && action==='plan' && req.method==='GET'){send(res,200,engine.plan(id));return;}
        if(parts[1]==='brands' && action==='portable' && req.method==='GET') {
          const brand=engine.get(id,'brand');const files={'brand-profile.json':strToU8(JSON.stringify(brand,null,2)),'brand-profile.md':strToU8(brandMarkdown(brand)),'START-HERE.md':new Uint8Array(await readFile(join(projectRoot,'START-HERE.md'))),'agent-workflow.md':new Uint8Array(await readFile(join(projectRoot,'docs/agent-workflow.md')))};
          files['PROJECT-INSTRUCTIONS.md']=strToU8(projectInstructions(brand));
          send(res,200,Buffer.from(zipSync(files)),'application/zip',{'Content-Disposition':'attachment; filename="virax-brand-instructions.zip"'});return;
        }
        if(req.method==='POST' && path==='/api/assets'){const input=await body(req);send(res,201,await addAsset(engine,dataDir,input.brandId,input,Buffer.from(input.base64||'','base64')));return;}
        if(req.method==='GET' && parts[1]==='assets' && id){const asset=engine.get(id,'asset');send(res,200,await readFile(await confined(dataDir,asset.file)),asset.mime,['image','logo'].includes(asset.role)?{}:{'Content-Disposition':'attachment; filename="brand-file"'});return;}
        if(req.method==='POST' && path==='/api/posts'){const input=await body(req);send(res,201,engine.createPost(input.brandId,input));return;}
        if(req.method==='GET' && parts[1]==='posts' && id) {
          if(action==='quality')send(res,200,engine.quality(id));
          else if(action==='task')send(res,200,taskPack(engine,id));
          else if(action==='history')send(res,200,store.history(id));
          else if(action==='download')send(res,200,await exportPack(engine,dataDir,id),'application/zip',{'Content-Disposition':`attachment; filename="${id}-v${engine.get(id).version}.zip"`});
          else send(res,200,engine.get(id,'post'));
          return;
        }
        if(req.method==='PUT' && parts[1]==='posts' && id){send(res,200,engine.editPost(id,await body(req)));return;}
        if(req.method==='POST' && parts[1]==='posts' && id) {
          const input=await body(req);let result;
          if(action==='render')result=await renderPost(engine,dataDir,id);
          else if(action==='review')result=engine.review(id,input);
          else if(action==='decision')result=engine.decide(id,input);
          else if(action==='schedule')result=engine.schedule(id,input);
          else if(action==='cancel')result=engine.cancel(id);
          else if(action==='duplicate')result=engine.duplicate(id);
          else if(action==='retry')result=worker.retry(id);
          else if(action==='receipt')result=worker.reportManual(id,input);
          else if(action==='story') {
            const original=engine.get(id,'post');let story=engine.createPost(original.brandId,{title:`${original.title} · Story`,format:'story',mode:original.mode,platform:original.platform});
            story=engine.editPost(story.id,{version:story.version,title:story.title,caption:original.caption,mode:original.mode,slides:[original.slides[0]],claims:original.claims.filter(c=>c.slide===1)});result=story;
          } else {send(res,404,{error:'Action not found.'});return;}
          send(res,200,result);return;
        }
        if(req.method==='POST' && path==='/api/grants'){send(res,201,engine.authorize(await body(req)));return;}
        if(req.method==='POST' && parts[1]==='grants' && action==='revoke'){send(res,200,engine.revoke(id));return;}
        if(req.method==='POST' && path==='/api/worker/tick'){send(res,200,await worker.tick());return;}
        if(req.method==='POST' && path==='/api/connections/meta/verify'){const connection=await meta.verify();store.put('connection',connection);send(res,200,connection);return;}
        if(req.method==='GET' && parts[1]==='files') {
          const post=engine.get(id,'post');expect(/^slide-\d{2}(-phone)?\.jpg$/.test(action||''),'Invalid export file.');expect(post.render,'No exported media yet.');
          const file=`exports/${post.id}/v${post.render.version}/${action}`;send(res,200,await readFile(await confined(dataDir,file)),'image/jpeg');return;
        }
        send(res,404,{error:'Route not found.'});return;
      }
      if(req.method!=='GET'){send(res,405,{error:'Method not allowed.'});return;}
      const staticFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
      if(staticFiles[path]) {const file=staticFiles[path],type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';send(res,200,await readFile(join(projectRoot,'public',file)),type);return;}
      if(/^\/(fonts|brand)\/[A-Za-z0-9.-]+$/.test(path)){const file=await confined(join(projectRoot,'public'),path.slice(1)),type=file.endsWith('.ttf')?'font/ttf':file.endsWith('.svg')?'image/svg+xml':'text/plain';send(res,200,await readFile(file),type);return;}
      if(path.startsWith('/examples/') && /^[a-zA-Z0-9_./-]+$/.test(path)) {
        const file=await confined(join(projectRoot,'examples'),path.slice('/examples/'.length));
        const ext=file.split('.').at(-1),type={jpg:'image/jpeg',png:'image/png',json:'application/json',md:'text/plain',zip:'application/zip'}[ext];expect(type,'Unsupported public file.');send(res,200,await readFile(file),type==='application/json'?'text/plain':type);return;
      }
      if(/^\/docs\/[a-z-]+\.md$/.test(path)) {send(res,200,await readFile(await confined(join(projectRoot,'docs'),path.slice(6))),'text/plain; charset=utf-8');return;}
      send(res,404,'Not found.','text/plain');
    } catch(error) {if(!res.headersSent)send(res,error.message==='Item not found.'?404:400,{error:error.message});else res.end();}
  });
  const timer=workerEnabled?setInterval(()=>worker.tick().catch(e=>store.audit('worker','error',e.message)),30000):null;timer?.unref();
  const syncTimer=setInterval(()=>drive.tick().catch(()=>{}),60000);syncTimer.unref();
  return {server,store,engine,worker,drive,dataDir,host,close:async()=>{if(timer)clearInterval(timer);clearInterval(syncTimer);await new Promise(r=>server.close(r));while(worker.busy||drive.busy)await new Promise(r=>setTimeout(r,50));store.close();}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=await createApp({workerEnabled:process.env.ENGINE_WORKER!=='false'});
  if(process.argv.includes('--demo'))await seedDemo(app.engine,app.dataDir,projectRoot);
  const port=Number(process.env.PORT||4318);
  app.server.listen(port,app.host,()=>console.log(`VIRAX Engine Machine: http://${app.host}:${port}\nPrivate files: ${app.dataDir}\nLive publication: ${process.env.ENGINE_LIVE_PUBLISH==='true'?'enabled; scoped permission still required':'disabled'}`));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
