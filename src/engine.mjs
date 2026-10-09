import { createHash } from 'node:crypto';
import { newId } from './store.mjs';
import { answerKeys, recommendations, stages, styles } from './interview.mjs';
import { parseMix } from './creative.mjs';
import { resolveTime } from './time.mjs';

export const now = () => new Date().toISOString();
const text = (value, limit = 6000) => String(value ?? '').trim().slice(0,limit);
const clone = value => structuredClone(value);
export function expect(value, message) { if (!value) throw new Error(message); }
export function digest(value) { return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex'); }
export function contentHash(post) {
  return digest({brandId:post.brandId,brandVersion:post.brandVersion,title:post.title,caption:post.caption,mode:post.mode,format:post.format,platform:post.platform,placement:post.placement,slides:post.slides.map(({qa,...s})=>s),claims:post.claims,music:post.music,...(post.artworkMode?{artworkMode:post.artworkMode}:{}),...(post.referenceBrief?{referenceBrief:post.referenceBrief}:{})});
}
export class Engine {
  constructor(store) { this.store = store; }
  get(id, kind) { const value=this.store.get(id); expect(value && (!kind || value.kind===kind), 'Item not found.'); return value; }
  save(kind, value, action, detail='') { value.updatedAt=now(); this.store.put(kind,value); this.store.audit(value.id,action,detail); return value; }
  createBrand(name='Your business') {
    return this.save('brand',{id:newId('brand'),kind:'brand',name:text(name,100),version:1,answers:{name:text(name,100)},stage:0,style:null,styleApproved:false,assets:[],research:[],createdAt:now()},'brand_created');
  }
  updateBrand(id, input) {
    return this.store.tx(()=>{
      const brand=this.get(id,'brand');
      expect(input.version===brand.version,'This brand changed. Reload before you save.');
      const answers={...brand.answers};
      let rules=brand.rules||[];
      if(input.rules!==undefined){
        expect(Array.isArray(input.rules)&&input.rules.length<=100,'Use up to 100 saved brand rules.');
        rules=input.rules.map(rule=>{expect(/^[a-z][a-z0-9_-]{0,63}$/.test(rule.key)&&text(rule.text),'Each rule needs a key and clear instructions.');return {key:rule.key,text:text(rule.text,3000)};});
        expect(new Set(rules.map(r=>r.key)).size===rules.length,'Each saved rule needs a unique key.');
      }
      for (const [key,value] of Object.entries(input.answers||{})) if(answerKeys.has(key)) answers[key]=Array.isArray(value)?value.map(v=>text(v,100)).slice(0,25):text(value);
      if(answers.website) expect(/^https?:\/\/[^\s]+$/i.test(answers.website),'Use a complete website URL.');
      if(answers.timezone) { try { new Intl.DateTimeFormat('en',{timeZone:answers.timezone}).format(); } catch {throw new Error('Use a valid timezone, such as America/New_York.');} }
      if(answers.mixCounts)parseMix(answers.mixCounts);
      const stage=Math.max(0,Math.min(stages.length-1,Number(input.stage??brand.stage)));
      if(JSON.stringify(answers)===JSON.stringify(brand.answers)&&JSON.stringify(rules)===JSON.stringify(brand.rules||[])) {
        brand.stage=Number.isFinite(stage)?stage:brand.stage;
        return this.save('brand',brand,'interview_progress_saved');
      }
      this.store.snapshot(brand);
      brand.answers=answers;brand.rules=rules;brand.name=answers.name||brand.name;brand.stage=Number.isFinite(stage)?stage:brand.stage;brand.version++;
      // Changed brand instructions need a fresh visual approval and invalidate queued content.
      brand.styleApproved=false;
      for(const post of this.store.list('post').filter(p=>p.brandId===id && ['approved','scheduled_local'].includes(p.status))) {
        post.status='draft';post.approval=null;post.schedule=null;post.grant=null;
        this.save('post',post,'brand_change_invalidated_approval');
      }
      return this.save('brand',brand,'brand_updated',`Version ${brand.version}`);
    });
  }
  chooseStyle(id, style) {
    expect(style==='custom'||styles.some(item=>item.id===style),'Choose a known style.');
    const brand=this.get(id,'brand');
    return this.updateStyle(brand,style);
  }
  setRule(id,input){
    const brand=this.get(id,'brand'),rules=[...(brand.rules||[])];
    expect(input.version===brand.version,'This brand changed. Reload before you save.');
    expect(/^[a-z][a-z0-9_-]{0,63}$/.test(input.key||''),'Use a short rule key with lowercase letters, numbers, or hyphens.');
    const index=rules.findIndex(r=>r.key===input.key);
    if(input.remove===true){expect(index>=0,'This rule does not exist.');rules.splice(index,1);}
    else{expect(text(input.text),'Add the owner instruction to save.');const rule={key:input.key,text:text(input.text,3000)};if(index>=0)rules[index]=rule;else rules.push(rule);}
    return this.updateBrand(id,{version:input.version,rules});
  }
  updateStyle(brand,style) {
    return this.store.tx(()=>{
      if(brand.style===style && brand.styleApproved)return brand;
      this.store.snapshot(brand);brand.style=style;brand.styleApproved=true;brand.version++;
      for(const post of this.store.list('post').filter(p=>p.brandId===brand.id && ['approved','scheduled_local'].includes(p.status))) {
        post.status='draft';post.approval=null;post.schedule=null;post.grant=null;this.save('post',post,'style_change_invalidated_approval');
      }
      return this.save('brand',brand,'style_approved',style);
    });
  }
  createPost(brandId,input={}) {
    const brand=this.get(brandId,'brand');
    const format=['carousel','single','story','video'].includes(input.format)?input.format:'carousel';
    const count=format==='carousel'?Number(input.slideCount||9):1;
    expect(Number.isInteger(count)&&count>=1&&count<=10&&(format!=='carousel'||count>=2),'Use two to ten carousel slides or one image for other formats.');
    const mode=input.mode==='image-only'?'image-only':'educational';
    const artworkMode=input.artworkMode||'overlay';
    expect(['overlay','finished'].includes(artworkMode),'Choose overlay text or finished artwork.');
    const slides=Array.from({length:count},(_,i)=>({number:i+1,headline:'',body:'',message:'',evidence:'',composition:'',callouts:'',assetId:null,alt:'',qa:{visual:false,phone:false}}));
    const post={id:newId('post'),kind:'post',brandId,brandVersion:brand.version,version:1,title:text(input.title||'Untitled post',160),caption:'',mode,format,platform:input.platform==='facebook'?'facebook':'instagram',placement:format==='story'?'story':'feed',status:'draft',slides,claims:[],creativeIntent:input.creativeIntent?{type:text(input.creativeIntent.type,100),cta:text(input.creativeIntent.cta,1000),customPrompt:text(input.creativeIntent.customPrompt)}:null,music:brand.answers.music?.startsWith('Always')?'required':'none',accuracy:null,approval:null,grant:null,schedule:null,receipt:null,createdAt:now()};
    post.artworkMode=artworkMode;
    return this.save('post',post,'post_created');
  }
  editPost(id, input) {
    return this.store.tx(()=>{
      const post=this.get(id,'post');
      expect(input.version===post.version,'This post changed. Reload before you save.');
      expect(!['publishing','published','published_reported','simulated_published','verification_required','manual_due'].includes(post.status),'Create a new version as a separate post after publication starts.');
      this.store.snapshot(post);
      for(const key of ['title','caption','mode','music']) if(input[key]!==undefined) post[key]=text(input[key],key==='caption'?2200:160);
      if(input.artworkMode!==undefined){expect(['overlay','finished'].includes(input.artworkMode),'Choose overlay text or finished artwork.');post.artworkMode=input.artworkMode;}
      expect(['educational','image-only'].includes(post.mode),'Choose educational or image-only content.');
      expect(['none','optional','required'].includes(post.music),'Choose a valid music requirement.');
      if(input.slides) {
        expect(Array.isArray(input.slides) && input.slides.length>=1 && input.slides.length<=10,'Use one to ten slides.');
        expect(post.format==='carousel' || input.slides.length===1,'This format uses one image.');
        post.slides=input.slides.map((s,i)=>({number:i+1,headline:text(s.headline,160),body:text(s.body,500),message:text(s.message,600),evidence:text(s.evidence,600),composition:text(s.composition,600),callouts:text(s.callouts,300),assetId:s.assetId?text(s.assetId,100):null,alt:text(s.alt,1000),qa:{visual:false,phone:false}}));
      } else post.slides=post.slides.map(s=>({...s,qa:{visual:false,phone:false}}));
      if(input.claims) {
        expect(Array.isArray(input.claims) && input.claims.length<=100,'Too many claims.');
        post.claims=input.claims.map(c=>({slide:Number(c.slide),claim:text(c.claim,1200),kind:['verified_fact','business_fact','editorial_advice','illustration'].includes(c.kind)?c.kind:'unverified',source:text(c.source,2000),checkedOn:text(c.checkedOn,30),caveat:text(c.caveat,1000),reviewer:text(c.reviewer,150)}));
      }
      post.version++;post.brandVersion=this.get(post.brandId,'brand').version;post.status='draft';post.accuracy=null;post.approval=null;post.grant=null;post.schedule=null;post.receipt=null;
      return this.save('post',post,'post_revised',`Version ${post.version}; previous approval removed`);
    });
  }
  quality(id) {
    const post=this.get(id,'post'),brand=this.get(post.brandId,'brand'),errors=[],warnings=[],seen=new Set();
    if(!brand.styleApproved) errors.push('Choose and approve a brand style.');
    if(post.brandVersion!==brand.version) errors.push('Refresh this post against the current brand version.');
    if(!post.caption) errors.push('Add a caption.');
    if(post.accuracy?.hash!==contentHash(post) || !post.accuracy?.checked)errors.push('Review every factual claim, including the caption. Confirm that no unsupported fact remains.');
    if(brand.answers.sourceDisplay && !/^Private/.test(brand.answers.sourceDisplay) && post.claims.some(c=>c.kind==='verified_fact') && !post.accuracy?.sourcesShown)errors.push('Check that public sources follow the saved display preference.');
    if(post.format==='video') errors.push('Video requires an external video tool and a separate manual publication workflow in v0.1.');
    if(post.format==='carousel' && post.slides.length<2) errors.push('A carousel needs at least two images.');
    if(post.mode==='educational' && !post.claims.length) errors.push('Record sources or mark the content as editorial advice.');
    for(const slide of post.slides) {
      const prefix=`Slide ${slide.number}: `,asset=slide.assetId?this.store.get(slide.assetId):null;
      if(!asset || asset.brandId!==brand.id || asset.role!=='image') errors.push(prefix+'add an image from this brand.');
      else {
        if(!asset.rightsConfirmed) errors.push(prefix+'confirm image rights.');
        if(seen.has(asset.sha256)) errors.push(prefix+'use a distinct meaningful image.');
        seen.add(asset.sha256);
        const [w,h]=post.placement==='story'?[1080,1920]:[1080,1350];
        if(asset.width<w || asset.height<h) warnings.push(prefix+`source is smaller than ${w} × ${h}. Inspect the export.`);
      }
      if(!slide.alt) errors.push(prefix+'add alt text.');
      if(!slide.message || !slide.evidence || !slide.composition) errors.push(prefix+'complete the visual brief.');
      if(post.mode==='image-only' && (slide.headline || slide.body || slide.callouts)) errors.push(prefix+'remove text overlays from this image-only post.');
      if(post.mode==='educational' && !post.claims.some(c=>c.slide===slide.number)) errors.push(prefix+'add its claim or editorial record.');
      if(!slide.qa?.visual || !slide.qa?.phone) errors.push(prefix+'complete visual and phone-size checks.');
      if(slide.headline.length>85 || slide.body.length>200) warnings.push(prefix+'shorten text before export.');
    }
    for(const c of post.claims) {
      if(!Number.isInteger(c.slide) || c.slide<1 || c.slide>post.slides.length || !c.claim) errors.push('Each claim needs a valid slide and statement.');
      if(c.kind==='verified_fact' && (!/^https:\/\//.test(c.source) || !/^\d{4}-\d{2}-\d{2}$/.test(c.checkedOn) || !c.reviewer)) errors.push(`Slide ${c.slide}: add a primary source, check date, and reviewer.`);
      if(c.kind==='business_fact' && !c.reviewer) errors.push(`Slide ${c.slide}: record who confirmed the business fact.`);
      if(!['verified_fact','business_fact','editorial_advice','illustration'].includes(c.kind)) errors.push(`Slide ${c.slide}: verify or remove the unsupported claim.`);
    }
    return {passed:!errors.length,errors,warnings,checkedAt:now(),version:post.version};
  }
  review(id,input) {
    const post=this.get(id,'post');expect(input.version===post.version,'Review the current version.');
    expect(!['publishing','published','published_reported','simulated_published','verification_required','manual_due','scheduled_local'].includes(post.status),'This version is locked.');
    expect(input.reviewer && Array.isArray(input.slides),'Provide a reviewer and per-slide checks.');
    expect(post.render?.hash===contentHash(post),'Export the current version before its visual review.');
    if(input.accuracy!==undefined)post.accuracy={checked:input.accuracy===true,sourcesShown:input.sourcesShown===true,hash:contentHash(post),reviewer:text(input.reviewer,150),at:now()};
    for(const check of input.slides) {const slide=post.slides[Number(check.number)-1];if(slide) slide.qa={visual:check.visual===true,phone:check.phone===true,reviewer:text(input.reviewer,150),at:now()};}
    this.save('post',post,'quality_review_recorded');
    const qa=this.quality(id);post.status=qa.passed?'ready_for_review':'draft';this.store.put('post',post);return {post,quality:qa};
  }
  decide(id,input) {
    return this.store.tx(()=>{
      const post=this.get(id,'post');expect(input.version===post.version,'Approve the current version.');
      expect(['draft','ready_for_review','approved','rejected'].includes(post.status),'This post cannot be approved in its current state.');
      if(input.action==='reject') {post.status='rejected';post.approval=null;return this.save('post',post,'content_rejected');}
      expect(input.action==='approve','Choose approve or reject.');
      const qa=this.quality(id);expect(qa.passed,qa.errors.join(' '));
      expect(post.render?.hash===contentHash(post),'Export and inspect the current version.');
      post.status='approved';post.approval={version:post.version,hash:contentHash(post),at:now(),reviewer:text(input.reviewer||'Owner',150)};
      return this.save('post',post,'content_approved','No publication permission granted.');
    });
  }
  authorize(input) {
    expect(['post','batch','ongoing'].includes(input.scope),'Choose post, batch, or ongoing permission.');
    expect(['demo','manual','meta'].includes(input.provider),'Choose a publication method.');
    const brand=this.get(input.brandId,'brand');
    const ids=Array.isArray(input.postIds)?[...new Set(input.postIds)]:[];
    expect(input.scope==='ongoing' || ids.length>0,'Select the approved posts.');
    expect(input.scope!=='post' || ids.length===1,'Post permission covers one item.');
    for(const id of ids) {const p=this.get(id,'post');expect(p.brandId===brand.id && p.status==='approved','Only approved posts from this brand can be authorized.');}
    const expiresAt=input.expiresAt || new Date(Date.now()+14*86400000).toISOString();
    expect(Date.parse(expiresAt)>Date.now(),'Choose a future expiry.');
    const account=text(input.account,200);expect(account,'Name the destination account.');
    const accountId=text(input.accountId,100);if(input.provider==='meta')expect(/^\d+$/.test(accountId),'Verify and record the numeric Meta destination ID.');
    const platform=input.platform;expect(['instagram','facebook'].includes(platform),'Choose Instagram or Facebook.');
    const placement=input.placement;expect(['feed','story'].includes(placement),'Choose Feed or Story.');
    const grant={id:newId('grant'),kind:'grant',brandId:brand.id,scope:input.scope,provider:input.provider,platform,placement,account,accountId:accountId||null,versions:Object.fromEntries(ids.map(id=>[id,this.get(id).version])),expiresAt,revoked:false,createdAt:now(),recordedBy:text(input.recordedBy||'Owner',100)};
    return this.save('grant',grant,'publication_authorized',`${grant.scope}; ${platform}; ${placement}; ${input.provider}`);
  }
  validateGrant(post,grant,at=Date.now()) {
    expect(grant && !grant.revoked && Date.parse(grant.expiresAt)>at,'Publication permission is absent or expired.');
    expect(grant.brandId===post.brandId && grant.platform===post.platform && grant.placement===post.placement,'Permission does not match this brand and destination.');
    expect(grant.scope==='ongoing' || grant.versions[post.id]===post.version,'Permission does not cover this version.');
    expect(post.approval?.hash===contentHash(post),'This version is not approved.');
    if(post.music==='required') expect(grant.provider==='manual','Required music needs a native manual step.');
    return true;
  }
  schedule(id,input) {
    return this.store.tx(()=>{
      const post=this.get(id,'post');expect(['approved','scheduled_local'].includes(post.status),'Approve this post before you schedule it.');
      expect(input.version===post.version,'Schedule the current version.');
      const grant=this.get(input.grantId,'grant');this.validateGrant(post,grant);
      const utc=resolveTime(input.local,input.timezone,input.occurrence);
      expect(Date.parse(utc)>Date.now(),'Choose a future time.');
      expect(Date.parse(utc)<Date.parse(grant.expiresAt),'Permission expires before this publication time.');
      post.schedule={local:input.local,timezone:input.timezone,utc,occurrence:input.occurrence||'reject',method:grant.provider,account:grant.account,platformConfirmed:false};
      post.grant=grant.id;post.status='scheduled_local';
      return this.save('post',post,'schedule_saved','Local queue only. No platform confirmation yet.');
    });
  }
  cancel(id) {
    const post=this.get(id,'post');expect(!['publishing','published','published_reported','simulated_published','verification_required'].includes(post.status),'Completed or uncertain publication records cannot be cancelled.');
    post.status='cancelled';post.schedule=null;post.grant=null;return this.save('post',post,'post_cancelled');
  }
  revoke(id) {const grant=this.get(id,'grant');grant.revoked=true;return this.save('grant',grant,'permission_revoked');}
  duplicate(id) {
    const original=this.get(id,'post'),copy=clone(original);copy.id=newId('post');copy.version=1;copy.title=`${original.title} · revision`;copy.status='draft';copy.accuracy=null;copy.approval=null;copy.grant=null;copy.schedule=null;copy.receipt=null;copy.render=null;copy.brandVersion=this.get(copy.brandId,'brand').version;copy.slides.forEach(s=>s.qa={visual:false,phone:false});copy.createdAt=now();
    return this.save('post',copy,'post_copied');
  }
  plan(brandId) { return recommendations(this.get(brandId,'brand').answers); }
}
