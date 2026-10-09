import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { expect, digest, now } from './engine.mjs';
import { confined, brandMarkdown } from './media.mjs';
import { projectInstructions } from './profile.mjs';

const scope='https://www.googleapis.com/auth/drive.file';
const mimeFor=path=>({png:'image/png',jpg:'image/jpeg',json:'application/json',md:'text/markdown',svg:'image/svg+xml',pdf:'application/pdf',ttf:'font/ttf',otf:'font/otf',txt:'text/plain'}[path.split('.').at(-1)]||'application/octet-stream');
export class DriveSync {
  constructor(engine,root,{env=process.env,fetcher=fetch,clientFactory=(id,secret,redirect)=>new OAuth2Client(id,secret,redirect)}={}) {
    this.engine=engine;this.store=engine.store;this.root=root;this.env=env;this.fetcher=fetcher;this.clientFactory=clientFactory;this.pending=new Map();this.busy=false;this.client=null;this.credentials={};this.tokenFile=join(root,'connections','google-drive.json');
  }
  configured(){return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);}
  async init(){if(!this.configured())return;try{this.credentials=JSON.parse(await readFile(this.tokenFile,'utf8'));if(this.credentials.refresh_token)this.loadClient();}catch(e){if(e.code!=='ENOENT')throw new Error('The private Google connection file cannot be read.');}}
  loadClient(redirect=this.env.GOOGLE_REDIRECT_URI){this.client=this.clientFactory(this.env.GOOGLE_CLIENT_ID,this.env.GOOGLE_CLIENT_SECRET,redirect);this.client.setCredentials(this.credentials);return this.client;}
  async saveTokens(tokens){this.credentials={...this.credentials,...tokens};await mkdir(dirname(this.tokenFile),{recursive:true});const temp=this.tokenFile+'.tmp';await writeFile(temp,JSON.stringify(this.credentials),{mode:0o600});await rename(temp,this.tokenFile);}
  status(){const c=this.store.get('drive_connection');return {configured:this.configured(),connected:Boolean(this.client && this.credentials.refresh_token),account:c?.account||null,verifiedAt:c?.verifiedAt||null,busy:this.busy,brands:this.store.list('drive_sync').map(({files,...s})=>({...s,fileCount:Object.values(files||{}).filter(f=>f.complete).length}))};}
  async begin(origin){
    expect(this.configured(),'Set your Google OAuth client ID and secret first. Read the Google Drive guide.');
    const redirect=this.env.GOOGLE_REDIRECT_URI||`${origin}/api/drive/callback`;expect(redirect===`${origin}/api/drive/callback`,'The Google redirect URI must match this studio address.');
    const client=this.clientFactory(this.env.GOOGLE_CLIENT_ID,this.env.GOOGLE_CLIENT_SECRET,redirect),verifier=await client.generateCodeVerifierAsync(),state=randomBytes(32).toString('hex');
    this.pending.set(state,{client,verifier,expires:Date.now()+600000});for(const [key,value]of this.pending)if(value.expires<Date.now())this.pending.delete(key);
    return {state,url:client.generateAuthUrl({scope:[scope],access_type:'offline',prompt:'consent',state,code_challenge_method:'S256',code_challenge:verifier.codeChallenge})};
  }
  async finish(state,cookie,code){
    const pending=this.pending.get(state);expect(pending && pending.expires>Date.now() && cookie===state,'The Google connection request expired or does not match this browser.');this.pending.delete(state);
    expect(code,'Google did not return permission.');let tokens;
    try {({tokens}=await pending.client.getToken({code,codeVerifier:pending.verifier.codeVerifier}));const info=await pending.client.getTokenInfo(tokens.access_token);expect(info.scopes?.includes(scope),'Google Drive file permission is missing.');}catch {throw new Error('Google authorization failed. Reconnect through Settings.');}
    expect(tokens.refresh_token,'Google did not provide offline access. Reconnect and grant access.');this.credentials={};await this.saveTokens(tokens);this.client=pending.client;this.client.setCredentials(this.credentials);
    const info=await this.request('/drive/v3/about?fields=user(displayName,emailAddress)');
    this.store.put('connection',{id:'drive_connection',kind:'connection',account:info.user?.emailAddress||info.user?.displayName||'Google account',verifiedAt:now()});
    return this.status();
  }
  async request(path,{method='GET',body,headers={},raw=false,missing=false}={}){
    expect(this.client,'Connect Google Drive first.');let token;
    try{token=(await this.client.getAccessToken()).token;if(this.client.credentials?.refresh_token)await this.saveTokens(this.client.credentials);}catch{throw new Error('Google access expired. Reconnect through Settings.');}
    expect(token,'Google access is unavailable.');
    const url=path.startsWith('https://')?new URL(path):new URL(path,'https://www.googleapis.com');
    expect(url.protocol==='https:' && url.hostname==='www.googleapis.com','Invalid Google API upload address.');
    let response;try{response=await this.fetcher(url.href,{method,headers:{Authorization:`Bearer ${token}`,...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body),signal:AbortSignal.timeout(60000),redirect:'error'});}catch{throw new Error('Google Drive did not respond. Saved file IDs allow a safe retry.');}
    if(response.status===404 && missing)return null;
    expect(response.ok,`Google Drive request failed (${response.status}). Check account access and available storage.`);
    return raw?response:response.status===204?{}:response.json();
  }
  config(brandId){return this.store.get(`drive_sync_${brandId}`)||{id:`drive_sync_${brandId}`,kind:'drive_sync',brandId,enabled:false,automatic:false,files:{},state:'not_enabled'};}
  save(config){
    const current=this.store.get(config.id);
    if(current){config.enabled=current.enabled;config.automatic=current.automatic;if(!current.enabled){config.state=current.state==='disconnected'?'disconnected':'paused';config.error=null;}}
    this.store.put('drive_sync',config);return config;
  }
  configure(brandId,input){this.engine.get(brandId,'brand');const config=this.config(brandId);if(input.enabled)expect(this.client && this.credentials.refresh_token,'Connect Google Drive before you enable sync.');config.enabled=input.enabled===true;config.automatic=config.enabled&&input.automatic===true;config.state=config.enabled?'pending':'paused';config.error=null;return this.store.put('drive_sync',config);}
  async disconnect(){
    expect(!this.busy,'Wait for the active sync before disconnecting.');this.busy=true;
    try{
      if(this.client)try{await this.client.revokeCredentials();}catch{throw new Error('Google did not confirm revocation. Retry or remove access in your Google account.');}
      this.credentials={};await this.saveTokens({});this.client=null;
      for(const s of this.store.list('drive_sync')){s.enabled=false;s.automatic=false;s.state='disconnected';this.store.put('drive_sync',s);}
      this.store.put('connection',{id:'drive_connection',kind:'connection',account:null});
    }finally{this.busy=false;}
    return this.status();
  }
  async allocate(config,key){let record=config.files[key];if(record)return record;const ids=await this.request('/drive/v3/files/generateIds?count=1&space=drive&type=files');expect(ids.ids?.[0],'Google did not return a file identifier.');record={id:ids.ids[0],complete:false};config.files[key]=record;this.save(config);return record;}
  async metadata(id){expect(/^[\w-]+$/.test(id),'Invalid Google file identifier.');return this.request(`/drive/v3/files/${id}?fields=id,name,mimeType,md5Checksum,webViewLink,trashed,parents`,{missing:true});}
  async folder(config,key,name,parent){
    const record=await this.allocate(config,key);let metadata=await this.metadata(record.id);
    if(!metadata)metadata=await this.request('/drive/v3/files?fields=id,webViewLink,mimeType',{method:'POST',headers:{'Content-Type':'application/json'},body:{id:record.id,name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})}});
    expect(metadata.mimeType==='application/vnd.google-apps.folder' && !metadata.trashed,'The Drive destination is no longer an active folder.');
    if(parent)expect(!metadata.parents || metadata.parents.includes(parent),'A Drive folder moved. Restore its original location before sync.');
    record.complete=true;record.url=metadata.webViewLink||record.url;this.save(config);return record.id;
  }
  async collect(brandId){
    const brand=this.engine.get(brandId,'brand'),posts=this.store.list('post').filter(p=>p.brandId===brandId),assets=this.store.list('asset').filter(a=>a.brandId===brandId),files=[];
    const add=(path,value)=>files.push({path,bytes:Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2))});
    add('brand-profile.json',brand);add('brand-profile.md',brandMarkdown(brand));
    add('PROJECT-INSTRUCTIONS.md',projectInstructions(brand));
    add('state/references.json',this.store.list('reference').filter(r=>r.brandId===brandId));
    add('READ-ME-FIRST.md',`# ${brand.name}\n\nProfile version: ${brand.version}\n\nRead brand-profile.md and brand-profile.json before any content task.\nInspect approved examples and current post versions.\nFollow https://github.com/vahe-s/virax-engine-machine/blob/main/START-HERE.md.\nCheck every factual claim before image creation.\nNever publish from a backup or an old approval.\nDrive edits require an explicit import into the engine.\nThis folder contains private business content. Keep its access private.\n`);
    add('state/brand-history.json',this.store.history(brandId));add('state/posts.json',posts);add('state/permissions.json',this.store.list('grant').filter(g=>g.brandId===brandId));
    const trail=this.store.backupTrail(brandId,posts.map(p=>p.id));
    add('state/publication-operations.json',trail.operations);
    add('state/activity.json',trail.audit.filter(e=>e.action!=='drive_sync_completed'));
    for(const p of posts){add(`posts/${p.id}/current.json`,p);add(`posts/${p.id}/history.json`,this.store.history(p.id));add(`posts/${p.id}/caption.txt`,p.caption);add(`posts/${p.id}/claims-and-sources.json`,p.claims);add(`posts/${p.id}/alt-text.json`,p.slides.map(s=>({slide:s.number,alt:s.alt})));for(const v of [...this.store.history(p.id),p])if(v.render)for(const f of v.render.files){const bytes=await readFile(await confined(this.root,f.file));expect(digest(bytes)===f.sha256,'An export changed outside the app. Resolve it before sync.');add(`posts/${p.id}/v${v.render.version}/${f.name}`,bytes);if(v.mode==='educational')add(`posts/${p.id}/v${v.render.version}/${f.name.replace('.jpg','.svg')}`,await readFile(await confined(this.root,f.file.replace('.jpg','.svg'))));}}
    for(const a of assets){add(`assets/${a.id}/metadata.json`,a);add(`assets/${a.id}/${a.id}.${a.file.split('.').at(-1)}`,await readFile(await confined(this.root,a.file)));}
    for(const p of posts)for(const v of [...this.store.history(p.id),p])if(v.render){
      const dir=`posts/${p.id}/v${v.render.version}`;
      for(const f of v.render.files)add(`${dir}/phone/${f.name}`,await readFile(await confined(this.root,f.file.replace('.jpg','-phone.jpg'))));
      add(`${dir}/PREVIEW.md`,['# Export preview',`Post version: ${v.render.version}`,`Open each image at full size before approval.`,...v.render.files.map(f=>`![Slide ${f.name}](${f.name})`)].join('\n\n'));
    }
    return [...new Map(files.map(f=>[f.path,f])).values()];
  }
  async upload(config,file,parent){
    const key=`file:${file.path}`,record=await this.allocate(config,key),md5=createHash('md5').update(file.bytes).digest('hex'),remote=await this.metadata(record.id);
    expect(!remote?.trashed,'A synchronized file is in Drive trash. Restore it before sync.');
    expect(!remote?.parents || remote.parents.includes(parent),'A synchronized file moved. Restore its original location before sync.');
    expect(this.config(config.brandId).enabled,'Sync paused.');
    if(record.complete && remote?.md5Checksum && remote.md5Checksum!==record.md5)throw new Error(`Drive conflict: ${file.path} changed online. Import or preserve that change before sync.`);
    if(remote?.md5Checksum===md5){record.complete=true;record.md5=md5;this.save(config);return false;}
    const metadata={name:file.path.split('/').at(-1),mimeType:mimeFor(file.path),appProperties:{viraxPath:digest(file.path),sha256:digest(file.bytes)}};
    if(!remote){metadata.id=record.id;metadata.parents=[parent];}
    const response=await this.request(`/upload/drive/v3/files${remote?'/'+record.id:''}?uploadType=resumable&fields=id,md5Checksum,webViewLink`,{method:remote?'PATCH':'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':mimeFor(file.path),'X-Upload-Content-Length':String(file.bytes.length)},body:metadata,raw:true});
    const location=response.headers.get('location');expect(location,'Google did not start the file upload.');
    await this.request(location,{method:'PUT',headers:{'Content-Type':mimeFor(file.path),'Content-Length':String(file.bytes.length)},body:file.bytes});
    const proof=await this.metadata(record.id);expect(proof?.md5Checksum===md5,'Google did not confirm the uploaded file bytes.');record.complete=true;record.md5=md5;record.url=proof.webViewLink;record.at=now();this.save(config);return true;
  }
  async sync(brandId,{onlyIfChanged=false}={}){
    expect(!this.busy,'A Drive sync is already active.');const config=this.config(brandId);expect(config.enabled,'Enable sync for this brand first.');this.busy=true;config.state='syncing';config.error=null;this.save(config);
    try{
      const brand=this.engine.get(brandId,'brand'),files=await this.collect(brandId),fingerprint=digest(files.map(f=>[f.path,digest(f.bytes)]));
      if(onlyIfChanged && config.fingerprint===fingerprint){config.state='synced';this.save(config);return {...config,files:undefined};}
      const root=await this.folder(config,'folder:','VIRAX - '+brand.name),folders=new Map([['',root]]);let uploaded=0;
      for(const file of files){expect(this.config(brandId).enabled,'Sync paused.');const parts=file.path.split('/');parts.pop();let dir='',parent=root;for(const part of parts){dir=dir?dir+'/'+part:part;if(!folders.has(dir))folders.set(dir,await this.folder(config,'folder:'+dir,part,parent));parent=folders.get(dir);}if(await this.upload(config,file,parent))uploaded++;}
      config.state='synced';config.lastSyncedAt=now();config.brandVersion=brand.version;config.folderId=root;config.folderUrl=config.files['folder:'].url||null;config.uploaded=uploaded;config.error=null;config.fingerprint=fingerprint;this.save(config);this.store.audit(brandId,'drive_sync_completed',`${files.length} files checked; ${uploaded} changed files uploaded.`);return {...config,files:undefined};
    }catch(error){config.state=/conflict/i.test(error.message)?'conflict':'failed';config.error=error.message;this.save(config);throw error;}finally{this.busy=false;}
  }
  async tick(){if(this.busy)return;for(const config of this.store.list('drive_sync').filter(c=>c.enabled&&c.automatic)){if(Date.now()-Date.parse(config.lastAttempt||0)<60000)continue;config.lastAttempt=now();this.save(config);try{await this.sync(config.brandId,{onlyIfChanged:config.state!=='failed'&&config.state!=='conflict'});}catch{/* The error is visible in Settings. The next attempt keeps the saved file IDs. */}}}
}
