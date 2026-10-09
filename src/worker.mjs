import { contentHash, expect, now } from './engine.mjs';
import { MetaProvider, demoProvider } from './providers.mjs';
import { verifyExportBytes } from './media.mjs';

export class Worker {
  constructor(engine,{meta=new MetaProvider(),demo=demoProvider,mediaRoot}={}) {this.engine=engine;this.store=engine.store;this.providers={meta,demo};this.mediaRoot=mediaRoot;this.busy=false;}
  recover() {
    // A process exit during publication has an unknown external result. Never auto-repeat it.
    for(const post of this.store.list('post').filter(p=>p.status==='publishing')) {post.status='verification_required';post.error='The previous process stopped during publication. Reconcile the external result.';this.engine.save('post',post,'interrupted_publication_held');}
  }
  async tick(at=Date.now()) {
    if(this.busy)return [];this.busy=true;const results=[];
    try {
      for(const item of this.store.list('post').filter(p=>p.status==='scheduled_local' && Date.parse(p.schedule?.utc)<=at)) {
        let post,grant,key,eligible=false,claimed=false;
        try {
          this.store.tx(()=>{
            post=this.engine.get(item.id,'post');if(post.status!=='scheduled_local')return;
            key=`${post.id}:${post.version}:${post.platform}:${post.placement}`;
            const operation=this.store.operation(key);
            // Another worker can finish a later item from this loop's earlier snapshot.
            if(operation && operation.state!=='safe_to_retry')return;
            eligible=true;
            grant=this.engine.get(post.grant,'grant');this.engine.validateGrant(post,grant,at);
            expect(this.engine.get(post.brandId,'brand').version===post.brandVersion,'The brand changed. Review the post again.');
            expect(post.render?.hash===contentHash(post),'Approved exports are unavailable.');
            post.status=grant.provider==='manual'?'manual_due':'publishing';
            this.store.setOperation(key,post.id,grant.provider==='manual'?'manual_due':'started',{hash:contentHash(post)});
            this.engine.save('post',post,grant.provider==='manual'?'manual_action_due':'publication_started');
            claimed=true;
          });
          if(!claimed)continue;
          await verifyExportBytes(this.mediaRoot,post);
          if(grant.provider==='manual'){results.push({id:post.id,status:'manual_due'});continue;}
          const provider=this.providers[grant.provider];expect(provider,'Publication provider is unavailable.');
          // Permission may be revoked while the files are checked.
          this.engine.validateGrant(post,this.engine.get(post.grant,'grant'),at);
          const receipt=await provider.publish(post,grant,detail=>this.store.setOperation(key,post.id,'started',detail));
          this.store.tx(()=>{post=this.engine.get(post.id,'post');post.receipt=receipt;post.status=receipt.simulated?'simulated_published':'published';this.store.setOperation(key,post.id,'complete',receipt);this.engine.save('post',post,'publication_completed',receipt.simulated?'Simulation only. Nothing was sent.':'External result independently read back.');});
          results.push({id:post.id,status:post.status});
        } catch(error) {
          if(!post || !eligible)continue;
          const recorded=key?this.store.operation(key):null;
          const uncertain=error.uncertain || ['publish_dispatched','published_id_received'].includes(recorded?.data?.phase);
          post=this.engine.get(post.id,'post');post.status=uncertain?'verification_required':'failed';post.error=error.message;
          if(key)this.store.setOperation(key,post.id,uncertain?'uncertain':'failed_before_commit',{error:error.message,previous:recorded?.data});
          this.engine.save('post',post,'publication_failed',error.message);results.push({id:post.id,status:post.status,error:post.error});
        }
      }
      return results;
    } finally {this.busy=false;}
  }
  retry(id) {
    const post=this.engine.get(id,'post'),key=`${post.id}:${post.version}:${post.platform}:${post.placement}`,operation=this.store.operation(key);
    expect(post.status==='failed' && operation?.state==='failed_before_commit','Only a confirmed failure before publication can be retried.');
    this.engine.validateGrant(post,this.engine.get(post.grant,'grant'));
    this.store.setOperation(key,id,'safe_to_retry',{reason:'No publish request was dispatched.'});post.status='scheduled_local';post.error=null;return this.engine.save('post',post,'safe_retry_requested');
  }
  reportManual(id,input) {
    const post=this.engine.get(id,'post');expect(['manual_due','verification_required'].includes(post.status),'This post does not need a manual receipt.');
    expect(input.version===post.version,'Report the current version.');
    let url;try{url=new URL(input.url);}catch{throw new Error('Add the real platform post link.');}
    const expected=post.platform==='instagram'?/(^|\.)instagram\.com$/:/(^|\.)facebook\.com$/;
    expect(url.protocol==='https:' && expected.test(url.hostname),'Use a link from the correct platform.');
    expect(input.account===post.schedule?.account,'Confirm the exact scheduled account.');
    if(post.music==='required')expect(input.musicVerified===true,'Verify required music in the live post.');
    post.receipt={provider:'manual',verified:false,reported:true,url:url.href,account:input.account,musicVerified:input.musicVerified===true,at:now()};post.status='published_reported';
    return this.engine.save('post',post,'manual_publication_reported','Owner or agent report. No independent API readback.');
  }
}
