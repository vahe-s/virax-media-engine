import { newId } from './store.mjs';
import { expect, digest, now } from './engine.mjs';
import { verifyExportBytes } from './media.mjs';

const short=(value,max=4000)=>String(value??'').trim().slice(0,max);
export function referenceUrl(value){
  let url;try{url=new URL(short(value));}catch{throw new Error('Paste a complete HTTPS link to the reference.');}
  expect(url.protocol==='https:'&&!url.username&&!url.password,'Use a public HTTPS reference link without a password.');
  expect(!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname),'Use a public reference link.');
  expect(!/(^|\/)direct(\/|$)/i.test(url.pathname),'Paste the public post or Reel link, not an inbox or conversation link.');
  for(const key of [...url.searchParams.keys()])if(/^utm_|^(stkn|igsh|fbclid|igshid)$/i.test(key))url.searchParams.delete(key);
  url.hash='';return url.href;
}

export class References {
  constructor(engine){this.engine=engine;this.store=engine.store;}
  add(brandId,input){
    this.engine.get(brandId,'brand');
    const url=referenceUrl(input.url),notes=short(input.notes),key=digest({brandId,url,notes});
    const existing=this.store.list('reference').find(r=>r.key===key&&r.status!=='cancelled');
    if(existing)return {...existing,reused:true};
    return this.engine.save('reference',{id:newId('reference'),kind:'reference',brandId,key,url,notes,status:'needs_inspection',inspection:null,postId:null,createdAt:now()},'reference_link_saved');
  }
  inspect(id,input){
    const reference=this.engine.get(id,'reference');
    expect(!reference.postId,'This reference already has a draft. Resume that draft.');
    expect(input.viewed===true,'Inspect the actual reference images or video before you record its format.');
    expect(['carousel','single','story','video'].includes(input.format),'Record the observed reference format.');
    expect(['image-only','educational'].includes(input.mode),'Record whether the reference contains text.');
    expect(short(input.summary)&&short(input.style)&&short(input.reviewer),'Record the observed content, visual style, and reviewer.');
    const slideCount=Number(input.slideCount||1);
    expect(Number.isInteger(slideCount)&&slideCount>=1&&slideCount<=100,'Record the actual slide count.');
    expect(input.format==='carousel'?slideCount>=2:slideCount===1,'Use the image count for a carousel, or one for other formats.');
    reference.inspection={format:input.format,mode:input.mode,slideCount,summary:short(input.summary),style:short(input.style),reviewer:short(input.reviewer,150),evidence:short(input.evidence),viewedAt:now()};
    reference.status='inspected';return this.engine.save('reference',reference,'reference_inspected');
  }
  draft(id,input={}){
    return this.store.tx(()=>{
      const reference=this.engine.get(id,'reference');
      if(reference.postId)return this.engine.get(reference.postId,'post');
      expect(reference.status==='inspected'&&reference.inspection,'Inspect this reference before you create its draft.');
      const observed=reference.inspection,override=input.ownerOverride;
      if(override)expect(short(override.reason),'Record the direct owner instruction for a format or text change.');
      const format=override?.format||observed.format,mode=override?.mode||observed.mode;
      expect(['carousel','single','story','video'].includes(format)&&['image-only','educational'].includes(mode),'Choose a supported format and text treatment.');
      const count=format==='carousel'?Number(override?.slideCount||observed.slideCount):1;
      expect(format!=='carousel'||(Number.isInteger(count)&&count>=2&&count<=10),'This exporter supports two to ten slides. Ask the owner how to adapt a longer reference.');
      const post=this.engine.createPost(reference.brandId,{title:short(input.title||'Reference adaptation',160),format,mode,slideCount:count,platform:input.platform});
      post.referenceId=reference.id;
      post.referenceBrief={url:reference.url,notes:reference.notes,...observed,ownerOverride:override?{format,mode,slideCount:count,reason:short(override.reason)}:null};
      this.engine.save('post',post,'reference_draft_started');
      reference.postId=post.id;reference.status='draft_started';this.engine.save('reference',reference,'reference_linked_to_draft');
      return post;
    });
  }
  async complete(id,root){
    const reference=this.engine.get(id,'reference');expect(reference.postId,'This reference has no draft.');
    const quality=this.engine.quality(reference.postId);expect(quality.passed,'Finish the real media and all review checks before you complete this reference.');
    const post=this.engine.get(reference.postId,'post');await verifyExportBytes(root,post);
    expect(this.engine.get(post.id,'post').version===post.version&&this.engine.quality(post.id).passed,'This draft changed during the check. Review it again.');
    reference.status='ready_for_review';reference.completedVersion=this.engine.get(reference.postId,'post').version;
    return this.engine.save('reference',reference,'reference_draft_completed');
  }
  context(brandId){
    const brand=this.engine.get(brandId,'brand');
    return {brand,references:this.store.list('reference').filter(r=>r.brandId===brandId),posts:this.store.list('post').filter(p=>p.brandId===brandId),plan:this.engine.plan(brandId),instructions:[
      'Work in the existing project chat. Ask at most three useful questions at once.',
      'Save lasting user preferences to the brand profile. Keep one-post requests in the task.',
      'Accept a pasted reference link. Inspect its actual media before choosing format or text treatment.',
      'Create finished original work with your available tools. This server does not call a hidden model.',
      'Open the optional companion only for a preview, approval, asset library, or settings.',
      'The public engine has no Instagram inbox listener, sender pairing, or DM trigger.'
    ]};
  }
}
