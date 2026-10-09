import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { Store } from '../src/store.mjs';
import { Engine, contentHash, digest } from '../src/engine.mjs';
import { addAsset, renderPost, exportPack } from '../src/media.mjs';
import { Worker } from '../src/worker.mjs';
import { MetaProvider } from '../src/providers.mjs';
import { DriveSync } from '../src/drive.mjs';
import { resolveTime } from '../src/time.mjs';
import { recommendations, stages, styles } from '../src/interview.mjs';
import { projectInstructions, saveProfileFiles } from '../src/profile.mjs';
import { taskPack } from '../src/media.mjs';

async function fixture(t) {
  const parent=resolve('.data/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'case-'));
  const store=new Store(join(root,'state.sqlite')),engine=new Engine(store);
  t.after(async()=>{try{store.close();}catch{}const rel=relative(parent,resolve(root));assert.ok(rel.startsWith('case-')&&!rel.includes('..'));await rm(root,{recursive:true,force:true});});
  let brand=engine.createBrand('Cedar Ceramic Studio');brand=engine.updateBrand(brand.id,{version:1,answers:{name:'Cedar Ceramic Studio',business:'Handmade ceramic vessels for quiet homes.',audience:'People who want practical handmade objects.',timezone:'America/New_York'},stage:3});brand=engine.chooseStyle(brand.id,'minimal');
  const asset=await addAsset(engine,root,brand.id,{name:'original.png',role:'image',rightsConfirmed:true,provenance:'Test fixture created in this test.'},await sharp({create:{width:1080,height:1920,channels:3,background:'#b7a489'}}).png().toBuffer());
  let post=engine.createPost(brand.id,{title:'A simple vessel',format:'single',mode:'image-only'});
  post=engine.editPost(post.id,{version:post.version,title:post.title,caption:'A study in shape and texture.',mode:'image-only',slides:[{assetId:asset.id,message:'Show the vessel.',evidence:'One complete object.',composition:'A centered still life.',alt:'A neutral test image used to test the media pipeline.'}],claims:[]});
  post=await renderPost(engine,root,post.id);
  return {root,store,engine,brand,asset,post};
}
function approve(f) {f.engine.review(f.post.id,{version:f.post.version,reviewer:'Automated test fixture only',accuracy:true,sourcesShown:true,slides:[{number:1,visual:true,phone:true}]});f.post=f.engine.decide(f.post.id,{version:f.post.version,action:'approve'});return f.post;}
function schedule(f,provider='demo',extra={}) {
  const grant=f.engine.authorize({brandId:f.brand.id,scope:'post',postIds:[f.post.id],provider,platform:'instagram',placement:'feed',account:'test_account',accountId:provider==='meta'?'101':undefined,...extra});
  const local=new Date(Date.now()+3600000).toISOString().slice(0,16);
  f.post=f.engine.schedule(f.post.id,{version:f.post.version,grantId:grant.id,local,timezone:'UTC'});return grant;
}
test('fresh business survives a new database session without private-brand defaults',async t=>{
  const f=await fixture(t);f.store.close();const reopened=new Store(join(f.root,'state.sqlite'));const saved=reopened.get(f.brand.id);
  assert.equal(saved.answers.business,'Handmade ceramic vessels for quiet homes.');assert.equal(saved.stage,3);assert.equal(saved.style,'minimal');assert.equal(reopened.list('grant').length,0);reopened.close();
});

test('setup works without references and exports the selected tip preference',async t=>{
  const f=await fixture(t);
  let b=f.engine.updateBrand(f.brand.id,{version:f.brand.version,answers:{creativeStart:'I do not have references. Give me ideas.',tips:'No tips'}});
  assert.equal(styles.length,7);
  for(const style of styles)b=f.engine.chooseStyle(b.id,style.id);
  assert.equal(f.engine.plan(b.id).entries.length>0,true);
  assert.equal(f.store.list('reference').length,0);
  assert.equal(stages.flatMap(stage=>stage.fields).some(field=>field.key==='music'),false);
  await saveProfileFiles(f.root,b);
  const instructions=await readFile(join(f.root,'brands',b.id,'PROJECT-INSTRUCTIONS.md'),'utf8');
  assert.match(instructions,/Do not give optional capability tips/);
  assert.match(instructions,/seven distinct visual previews/);
  assert.match(instructions,/one finished sample before a full batch/);
  const task=taskPack(f.engine,f.post.id);
  assert.ok(task.instructions.some(rule=>rule.includes('Do not give optional capability tips')));
  assert.match(projectInstructions({...b,answers:{tips:'Fewer tips'}}),/at a major milestone/);
  assert.match(projectInstructions({...b,answers:{}}),/every two or three substantive replies/);
});

test('hidden legacy music preference remains effective after setup edits',async t=>{
  const f=await fixture(t);
  let b=f.engine.updateBrand(f.brand.id,{version:f.brand.version,answers:{music:'Always required; hold if unavailable'}});
  b=f.engine.updateBrand(b.id,{version:b.version,answers:{creativeStart:'I do not have references. Give me ideas.',tips:'Regular useful tips'}});
  assert.equal(b.answers.music,'Always required; hold if unavailable');
  assert.equal(f.engine.createPost(b.id,{format:'single'}).music,'required');
});
test('approval requires actual exports and per-slide review',async t=>{
  const f=await fixture(t);assert.throws(()=>f.engine.decide(f.post.id,{version:f.post.version,action:'approve'}),/visual and phone-size/);
  approve(f);assert.equal(f.post.status,'approved');assert.equal(f.post.approval.hash,contentHash(f.post));
  const zip=unzipSync(await exportPack(f.engine,f.root,f.post.id));assert.ok(zip['media/slide-01.jpg']);assert.ok(zip['claims-and-sources.json']);assert.ok(zip['index.html']);
  const info=await sharp(zip['media/slide-01.jpg']).metadata();assert.equal(info.width,1080);assert.equal(info.height,1350);
});
test('an edit invalidates approval, permission, schedule, and visual checks',async t=>{
  const f=await fixture(t);approve(f);schedule(f);const updated=f.engine.editPost(f.post.id,{version:f.post.version,caption:'A revised caption.'});
  assert.equal(updated.status,'draft');assert.equal(updated.approval,null);assert.equal(updated.schedule,null);assert.equal(updated.grant,null);assert.equal(updated.slides[0].qa.visual,false);
  assert.throws(()=>f.engine.schedule(updated.id,{version:updated.version}),/Approve/);
});
test('brand changes invalidate queued content and stale writes are rejected',async t=>{
  const f=await fixture(t);approve(f);schedule(f);f.engine.updateBrand(f.brand.id,{version:f.brand.version,answers:{special:'Use warm images.'}});
  assert.equal(f.engine.get(f.post.id).status,'draft');assert.throws(()=>f.engine.updateBrand(f.brand.id,{version:f.brand.version,answers:{tone:'Other'}}),/changed/);
});
test('rights, distinct images, source metadata, and brand ownership block unsafe approval',async t=>{
  const f=await fixture(t);let p=f.engine.createPost(f.brand.id,{format:'carousel',mode:'educational'});
  p=f.engine.editPost(p.id,{version:1,caption:'A guide',slides:[1,2].map(()=>({assetId:f.asset.id,message:'Compare.',evidence:'Different shapes.',composition:'Side by side.',alt:'Test image.'})),claims:[{slide:1,claim:'Unsupported statement.',kind:'verified_fact'}]});
  const errors=f.engine.quality(p.id).errors.join(' ');assert.match(errors,/distinct/);assert.match(errors,/primary source/);assert.match(errors,/Slide 2: add its claim/);
  const other=f.engine.createBrand('Another fictional business');p=f.engine.createPost(other.id,{format:'single',mode:'image-only'});p=f.engine.editPost(p.id,{version:1,slides:[{assetId:f.asset.id}],caption:'Test'});
  assert.match(f.engine.quality(p.id).errors.join(' '),/from this brand/);
});
test('image-only content cannot pass with text overlays',async t=>{const f=await fixture(t);f.post=f.engine.editPost(f.post.id,{version:f.post.version,slides:[{...f.post.slides[0],headline:'Unrequested text'}]});assert.match(f.engine.quality(f.post.id).errors.join(' '),/remove text overlays/);});

test('finished artwork retains its layout while text and fact checks remain required',async t=>{
  const f=await fixture(t);
  let p=f.engine.createPost(f.brand.id,{format:'single',mode:'educational',artworkMode:'finished'});
  p=f.engine.editPost(p.id,{version:p.version,caption:'An editorial test.',slides:[{...f.post.slides[0],headline:'Text already in the artwork',body:'Do not place this text over the image again.'}],claims:[{slide:1,claim:'A visual concept.',kind:'illustration'}]});
  p=await renderPost(f.engine,f.root,p.id);
  const source=await readFile(join(f.root,f.asset.file));
  const expected=await sharp(source).resize(1080,1350,{fit:'cover'}).jpeg({quality:93,mozjpeg:true}).toBuffer();
  assert.equal(digest(await readFile(join(f.root,p.render.files[0].file))),digest(expected));
  const pack=unzipSync(await exportPack(f.engine,f.root,p.id));
  assert.ok(pack['media/slide-01.jpg']);
  assert.equal(pack['editable/slide-01.svg'],undefined);
  assert.match(f.engine.quality(p.id).errors.join(' '),/factual claim/);
  const priorHash=contentHash(p);
  p=f.engine.editPost(p.id,{version:p.version,artworkMode:'overlay'});
  assert.notEqual(contentHash(p),priorHash);
  const backup=await new DriveSync(f.engine,f.root,{env:{}}).collect(f.brand.id);
  assert.ok(backup.some(file=>file.path===`posts/${p.id}/v${p.render.version}/slide-01.jpg`));
  assert.ok(!backup.some(file=>file.path.endsWith('.svg')));
  assert.throws(()=>f.engine.editPost(p.id,{version:p.version,artworkMode:'unknown'}),/artwork/);
});
test('DST rejects missing times and requires a choice for repeated times',()=>{
  assert.throws(()=>resolveTime('2026-03-08T02:30','America/New_York'),/does not exist/);
  assert.throws(()=>resolveTime('2026-11-01T01:30','America/New_York'),/occurs twice/);
  assert.equal(resolveTime('2026-11-01T01:30','America/New_York','earlier'),'2026-11-01T05:30:00.000Z');
  assert.equal(resolveTime('2026-11-01T01:30','America/New_York','later'),'2026-11-01T06:30:00.000Z');
  assert.equal(resolveTime('2026-06-15T12:00','Asia/Kathmandu'),'2026-06-15T06:15:00.000Z');
  assert.throws(()=>resolveTime('2026-02-30T12:00','UTC'),/Invalid calendar/);
});
test('full demo queue runs once and never creates a live receipt',async t=>{
  const f=await fixture(t);approve(f);schedule(f);let calls=0;
  const worker=new Worker(f.engine,{mediaRoot:f.root,demo:{async publish(){calls++;return {simulated:true,verified:false,url:null};}}});
  const due=Date.parse(f.post.schedule.utc)+1000;await Promise.all([worker.tick(due),worker.tick(due)]);await worker.tick(due);
  assert.equal(calls,1);assert.equal(f.engine.get(f.post.id).status,'simulated_published');assert.equal(f.engine.get(f.post.id).receipt.verified,false);
});
test('revoked permission prevents dispatch at the due time',async t=>{
  const f=await fixture(t);approve(f);const grant=schedule(f);f.engine.revoke(grant.id);let calls=0;const worker=new Worker(f.engine,{mediaRoot:f.root,demo:{async publish(){calls++;}}});await worker.tick(Date.parse(f.post.schedule.utc)+1000);assert.equal(calls,0);assert.equal(f.engine.get(f.post.id).status,'failed');
});
test('uncertain commit and interrupted worker cannot automatically publish again',async t=>{
  const f=await fixture(t);approve(f);schedule(f,'meta');let calls=0;
  const worker=new Worker(f.engine,{mediaRoot:f.root,meta:{async publish(p,g,checkpoint){calls++;checkpoint({phase:'publish_dispatched'});throw new Error('Connection lost.');}}});
  const due=Date.parse(f.post.schedule.utc)+1000;await worker.tick(due);assert.equal(f.engine.get(f.post.id).status,'verification_required');assert.throws(()=>worker.retry(f.post.id),/confirmed failure/);await worker.tick(due);assert.equal(calls,1);
  const p=f.engine.get(f.post.id);p.status='publishing';f.store.put('post',p);worker.recover();assert.equal(f.engine.get(p.id).status,'verification_required');
});
test('a confirmed failure before commit can be retried without duplicate success',async t=>{
  const f=await fixture(t);approve(f);schedule(f);let calls=0;const worker=new Worker(f.engine,{mediaRoot:f.root,demo:{async publish(){calls++;if(calls===1)throw new Error('No dispatch.');return {simulated:true,verified:false};}}});const due=Date.parse(f.post.schedule.utc)+1000;await worker.tick(due);assert.equal(f.engine.get(f.post.id).status,'failed');worker.retry(f.post.id);await worker.tick(due);await worker.tick(due);assert.equal(calls,2);assert.equal(f.engine.get(f.post.id).status,'simulated_published');
});
test('manual result is reported, not independently verified',async t=>{
  const f=await fixture(t);approve(f);schedule(f,'manual');const worker=new Worker(f.engine,{mediaRoot:f.root});await worker.tick(Date.parse(f.post.schedule.utc)+1000);const p=worker.reportManual(f.post.id,{version:f.post.version,account:'test_account',url:'https://www.instagram.com/p/test_fixture/'});assert.equal(p.status,'published_reported');assert.equal(p.receipt.verified,false);
});
test('required music blocks automatic adapters',async t=>{const f=await fixture(t);f.post=f.engine.editPost(f.post.id,{version:f.post.version,music:'required'});f.post=await renderPost(f.engine,f.root,f.post.id);approve(f);assert.throws(()=>schedule(f),/music needs a native/);});
test('Meta adapter checks account, commits once, and reads back the result (mock network)',async t=>{
  const f=await fixture(t);approve(f);const requests=[];
  const fetcher=async(url,opts)=>{requests.push({url,opts});let data;
    if(url.endsWith('101?fields=id,username'))data={id:'101',username:'test_account'};
    else if(url.endsWith('/101/media'))data={id:'container'};
    else if(url.includes('container?fields=status_code'))data={status_code:'FINISHED'};
    else if(url.endsWith('/101/media_publish'))data={id:'published'};
    else data={id:'published',caption:f.post.caption,permalink:'https://www.instagram.com/p/test_fixture/',media_type:'IMAGE'};
    return {ok:true,status:200,json:async()=>data};
  };
  const env={META_GRAPH_VERSION:'v99.0',META_ACCESS_TOKEN:'fake-test-token',META_INSTAGRAM_ID:'101',META_PUBLIC_MEDIA_BASE:'https://example.invalid/media',ENGINE_LIVE_PUBLISH:'true'};
  const provider=new MetaProvider(env,fetcher),receipt=await provider.publish(f.post,{account:'test_account',accountId:'101'},()=>{});
  assert.equal(receipt.verified,true);assert.equal(requests.filter(r=>r.url.endsWith('/media_publish')).length,1);assert.ok(requests.every(r=>r.url.startsWith('https://graph.facebook.com/v99.0/')));
  await assert.rejects(()=>provider.publish(f.post,{account:'wrong_account'},()=>{}),/does not match/);
  await assert.rejects(()=>provider.publish(f.post,{account:'test_account',accountId:'999'},()=>{}),/account ID does not match/);
});
test('Story export is a separate portrait asset and separate publication entry',async t=>{
  const f=await fixture(t);let p=f.engine.createPost(f.brand.id,{format:'story',mode:'image-only'});p=f.engine.editPost(p.id,{version:1,caption:'Story',slides:f.post.slides});p=await renderPost(f.engine,f.root,p.id);const info=await sharp(await readFile(join(f.root,p.render.files[0].file))).metadata();assert.equal(info.height,1920);assert.equal(p.placement,'story');assert.notEqual(p.id,f.post.id);
});

test('Instagram Login binds the token owner and keeps tokens on the Instagram API host',async t=>{
  const f=await fixture(t);approve(f);const requests=[];
  const env={META_GRAPH_VERSION:'v25.0',META_LOGIN_TYPE:'instagram',META_ACCESS_TOKEN:'fake-test-token',META_INSTAGRAM_ID:'101',META_PUBLIC_MEDIA_BASE:'https://example.invalid/media',ENGINE_LIVE_PUBLISH:'true'};
  const fetcher=async(url,opts)=>{requests.push({url,opts});let data;
    if(url.endsWith('/me?fields=user_id,username'))data={user_id:'101',username:'test_account'};
    else if(url.endsWith('/101/media'))data={id:'container'};
    else if(url.includes('container?fields=status_code'))data={status_code:'FINISHED'};
    else if(url.endsWith('/101/media_publish'))data={id:'published'};
    else data={id:'published',caption:f.post.caption,permalink:'https://www.instagram.com/p/test_fixture/',media_type:'IMAGE'};
    return {ok:true,status:200,json:async()=>data};
  };
  const provider=new MetaProvider(env,fetcher);
  const receipt=await provider.publish(f.post,{account:'test_account',accountId:'101'},()=>{});
  assert.equal(receipt.verified,true);
  assert.ok(requests.every(r=>r.url.startsWith('https://graph.instagram.com/v25.0/')));
  assert.equal(requests.filter(r=>r.url.endsWith('/media_publish')).length,1);
  const requestCount=requests.length;
  await assert.rejects(()=>new MetaProvider({...env,META_LOGIN_TYPE:'https://untrusted.invalid'},fetcher).verify(),/META_LOGIN_TYPE/);
  await assert.rejects(()=>new MetaProvider({...env,META_FACEBOOK_PAGE_ID:'202'},fetcher).verify(),/cannot authorize a Facebook Page/);
  assert.equal(requests.length,requestCount);
  await assert.rejects(()=>new MetaProvider({...env,META_INSTAGRAM_ID:'999'},fetcher).verify(),/verification failed/);
});
test('saving unchanged answers preserves brand approval and its queue',async t=>{
  const f=await fixture(t);approve(f);schedule(f);
  const b=f.engine.updateBrand(f.brand.id,{version:f.brand.version,answers:f.brand.answers,stage:5});
  assert.equal(b.version,f.brand.version);assert.equal(b.styleApproved,true);assert.equal(b.stage,5);assert.equal(f.engine.get(f.post.id).status,'scheduled_local');
});
test('two-week plan respects frequency, preferred format, and image-only references',()=>{
  const plan=recommendations({business:'Ceramic vases',frequency:'7',formats:['Single image'],textMode:'Images only',storyPlan:'Yes, create a separate Story asset'});
  assert.equal(plan.entries.length,14);assert.equal(new Set(plan.entries.map(p=>p.title)).size,14);assert.equal(plan.entries[13].day,14);
  assert.ok(plan.entries.every(p=>p.format==='single' && p.mode==='image-only' && p.story));
});
test('modified export bytes cannot be dispatched or downloaded as approved media',async t=>{
  const f=await fixture(t);approve(f);schedule(f);await writeFile(join(f.root,f.post.render.files[0].file),'changed');let calls=0;
  const worker=new Worker(f.engine,{mediaRoot:f.root,demo:{async publish(){calls++;}}});await worker.tick(Date.parse(f.post.schedule.utc)+1000);
  assert.equal(calls,0);assert.match(f.engine.get(f.post.id).error,/changed after review/);await assert.rejects(()=>exportPack(f.engine,f.root,f.post.id),/changed after review/);
});
test('two workers cannot damage a completed later item from an old queue snapshot',async t=>{
  const f=await fixture(t);approve(f);schedule(f);const first=f.post;
  f.post=f.engine.duplicate(first.id);f.post=await renderPost(f.engine,f.root,f.post.id);approve(f);schedule(f);
  let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);const seen=[];
  const provider={async publish(p){seen.push(p.id);if(seen.length===1){enter();await gate;}return {simulated:true,verified:false};}};
  const a=new Worker(f.engine,{mediaRoot:f.root,demo:provider}),b=new Worker(f.engine,{mediaRoot:f.root,demo:provider});
  const due=Date.parse(f.post.schedule.utc)+1000,runA=a.tick(due);
  await entered;await b.tick(due);release();await runA;
  assert.equal(seen.length,2);assert.equal(new Set(seen).size,2);assert.equal(f.engine.get(first.id).status,'simulated_published');assert.equal(f.engine.get(f.post.id).status,'simulated_published');
});
test('publication permissions enforce expiry and placement',async t=>{
  const f=await fixture(t);approve(f);const grant=schedule(f);assert.throws(()=>f.engine.validateGrant(f.post,{...grant,placement:'story'}),/destination/);assert.throws(()=>f.engine.validateGrant(f.post,grant,Date.parse(grant.expiresAt)),/expired/);
});
test('exact creative counts and custom CTA survive each week of the plan',()=>{
  const plan=recommendations({business:'Ceramic vases',frequency:'3',postTypes:['Funny','Facts'],mixCounts:'2 humor, 2 facts',cta:'Custom',ctaPrompt:'Send this to a friend who loves ceramics.'});
  assert.equal(plan.frequency,4);assert.equal(plan.entries.length,8);
  for(const week of [1,2]){assert.equal(plan.entries.filter(e=>e.week===week&&e.type==='Funny').length,2);assert.equal(plan.entries.filter(e=>e.week===week&&e.type==='Facts').length,2);}
  assert.ok(plan.entries.every(e=>e.cta==='Send this to a friend who loves ceramics.'));
});
test('every post needs a factual review even if its images contain no text',async t=>{
  const f=await fixture(t);f.engine.review(f.post.id,{version:f.post.version,reviewer:'Test',slides:[{number:1,visual:true,phone:true}]});assert.throws(()=>f.engine.decide(f.post.id,{version:f.post.version,action:'approve'}),/every factual claim/);
  approve(f);assert.equal(f.engine.quality(f.post.id).passed,true);const p=f.engine.editPost(f.post.id,{version:f.post.version,caption:'Changed caption.'});assert.equal(p.accuracy,null);
});

for(const type of ['carousel','story','facebook'])test(`Meta ${type} request and readback contract (mock network)`,async t=>{
  const f=await fixture(t),requests=[],platform=type==='facebook'?'facebook':'instagram',accountId=platform==='facebook'?'202':'101';
  const post={...f.post,platform,format:type==='story'?'story':type==='carousel'?'carousel':'single',placement:type==='story'?'story':'feed',render:{...f.post.render,files:type==='carousel'?[...f.post.render.files,{...f.post.render.files[0],name:'slide-02.jpg'}]:f.post.render.files}};
  post.render.hash=contentHash(post);
  let containers=0;
  const fetcher=async(url,opts)=>{
    const body=opts.body?JSON.parse(opts.body):null;requests.push({url,body});let data;
    if(url.endsWith('101?fields=id,username'))data={id:'101',username:'test_account'};
    else if(url.endsWith('202?fields=id,name'))data={id:'202',name:'Test Page'};
    else if(url.endsWith('/media'))data={id:`container${++containers}`};
    else if(url.includes('?fields=status_code'))data={status_code:'FINISHED'};
    else if(url.endsWith('/photos'))data={id:'photo1'};
    else if(url.endsWith('/media_publish')||url.endsWith('/feed'))data={id:'published'};
    else data=platform==='facebook'?{id:'published',message:post.caption,permalink_url:'https://www.facebook.com/test_fixture'}:{id:'published',caption:post.caption,media_type:type==='carousel'?'CAROUSEL_ALBUM':'IMAGE',children:{data:[{id:'child1'},{id:'child2'}]}};
    return {ok:true,status:200,json:async()=>data};
  };
  const provider=new MetaProvider({META_GRAPH_VERSION:'v99.0',META_ACCESS_TOKEN:'fake-test-token',[platform==='facebook'?'META_FACEBOOK_PAGE_ID':'META_INSTAGRAM_ID']:accountId,META_PUBLIC_MEDIA_BASE:'https://example.invalid/media',ENGINE_LIVE_PUBLISH:'true'},fetcher);
  const receipt=await provider.publish(post,{account:platform==='facebook'?'Test Page':'test_account',accountId},()=>{});
  assert.equal(receipt.verified,true);assert.equal(requests.filter(r=>r.url.endsWith('/media_publish')||r.url.endsWith('/feed')).length,1);
  if(type==='carousel')assert.equal(requests.find(r=>r.body?.media_type==='CAROUSEL').body.children.split(',').length,2);
  if(type==='story')assert.equal(requests.find(r=>r.url.endsWith('/media')).body.media_type,'STORIES');
  if(type==='facebook')assert.equal(requests.find(r=>r.url.endsWith('/feed')).body.attached_media[0].media_fbid,'photo1');
});
