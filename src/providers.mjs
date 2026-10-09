import { contentHash, digest, expect, now } from './engine.mjs';

export function capabilities(env=process.env) {
  return [
    {id:'agent',name:'Your AI agent',state:'assisted',detail:'Export a task with brand rules. Your connected agent creates and imports finished artwork.'},
    {id:'upload',name:'Your files',state:'available',detail:'Upload original or licensed photographs, logos, and brand files.'},
    {id:'demo',name:'Demo publisher',state:'simulation',detail:'Tests the full local queue. Sends nothing to a social account.'},
    {id:'manual',name:'Native platform handoff',state:'available',detail:'Prepare a pack and native steps. You or an authorized browser agent completes the final action.'},
    {id:'meta',name:'Meta API',state:env.META_ACCESS_TOKEN && env.META_GRAPH_VERSION?'needs_verification':'not_connected',detail:'Instagram images, carousels, and Stories; Facebook Page photo posts. Requires your own Meta app and a public media host.'},
    {id:'drive',name:'Google Drive',state:env.GOOGLE_CLIENT_ID?'needs_connection':'needs_setup',detail:'Native backup sync for profiles, assets, post versions, captions, sources, and permissions. Connect your own Google app in Settings.'},
    {id:'video',name:'Video tools',state:'assisted',detail:'Use a connected video tool. Import and publish video through the documented manual path.'}
  ];
}
export class MetaProvider {
  constructor(env=process.env, fetcher=fetch) {this.env=env;this.fetcher=fetcher;}
  config() {
    expect(/^v\d+\.\d+$/.test(this.env.META_GRAPH_VERSION||'') && this.env.META_ACCESS_TOKEN,'Configure the Meta token and supported Graph API version.');
    const loginType=this.env.META_LOGIN_TYPE||'facebook';
    expect(['facebook','instagram'].includes(loginType),'Choose facebook or instagram for META_LOGIN_TYPE.');
    expect(loginType!=='instagram' || !this.env.META_FACEBOOK_PAGE_ID,'Instagram Login cannot authorize a Facebook Page. Use a separate Facebook Login connection.');
    return {version:this.env.META_GRAPH_VERSION,token:this.env.META_ACCESS_TOKEN,loginType,host:loginType==='instagram'?'graph.instagram.com':'graph.facebook.com'};
  }
  async graph(path,{method='GET',body}={}) {
    const cfg=this.config();
    expect(!path.startsWith('/') && !path.includes('://'),'Invalid Graph API path.');
    let response;
    try {response=await this.fetcher(`https://${cfg.host}/${cfg.version}/${path}`,{method,headers:{Authorization:`Bearer ${cfg.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});} catch {throw new Error('Meta did not return a response. Check the operation before any retry.');}
    const data=await response.json();
    expect(response.ok && !data.error,`Meta request failed (${response.status}). Check token permissions and account access.`);
    return data;
  }
  fingerprint() {return digest([this.env.META_ACCESS_TOKEN,this.env.META_GRAPH_VERSION,this.env.META_INSTAGRAM_ID,this.env.META_FACEBOOK_PAGE_ID,this.env.META_LOGIN_TYPE||'facebook'].join('|'));}
  async verify() {
    const config=this.config();
    const result={id:'meta_connection',kind:'connection',loginType:config.loginType,fingerprint:this.fingerprint(),verifiedAt:now(),instagram:null,facebook:null};
    if(this.env.META_INSTAGRAM_ID) {
      expect(/^\d+$/.test(this.env.META_INSTAGRAM_ID),'Use the numeric Instagram professional account ID.');
      const account=await this.graph(config.loginType==='instagram'?'me?fields=user_id,username':`${this.env.META_INSTAGRAM_ID}?fields=id,username`);
      const id=config.loginType==='instagram'?account.user_id:account.id;
      expect(String(id)===this.env.META_INSTAGRAM_ID && account.username,'Instagram account verification failed.');
      result.instagram={id,account:account.username};
    }
    if(this.env.META_FACEBOOK_PAGE_ID) {
      expect(/^\d+$/.test(this.env.META_FACEBOOK_PAGE_ID),'Use the numeric Facebook Page ID.');
      const account=await this.graph(`${this.env.META_FACEBOOK_PAGE_ID}?fields=id,name`);
      expect(String(account.id)===this.env.META_FACEBOOK_PAGE_ID && account.name,'Facebook Page verification failed.');
      result.facebook={id:account.id,account:account.name};
    }
    expect(result.instagram || result.facebook,'Configure a destination account.');return result;
  }
  mediaUrls(post) {
    let base;try{base=new URL(this.env.META_PUBLIC_MEDIA_BASE);}catch{throw new Error('Set the HTTPS public media base URL.');}
    expect(base.protocol==='https:' && !base.username && !base.password && !base.search && !base.hash,'Use a plain HTTPS public media base URL.');
    expect(!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(base.hostname),'Meta needs publicly accessible image URLs.');
    expect(post.render?.hash===contentHash(post),'Export the approved media first.');
    return post.render.files.map(file=>`${base.href.replace(/\/$/,'')}/${post.id}/v${post.version}/${file.name}`);
  }
  async publish(post,grant,checkpoint) {
    expect(this.env.ENGINE_LIVE_PUBLISH==='true','Live publication is disabled. Enable it only after account verification and a test.');
    const connection=await this.verify(),account=connection[post.platform];
    expect(account && account.account.replace(/^@/,'').toLowerCase()===grant.account.replace(/^@/,'').toLowerCase(),'The connected account does not match the saved permission.');
    expect(grant.accountId && String(account.id)===String(grant.accountId),'The connected account ID does not match the saved permission.');
    const urls=this.mediaUrls(post);
    let dispatched=false;
    const commit=async(path,body)=>{checkpoint({phase:'publish_dispatched',destination:account.id});dispatched=true;return this.graph(path,{method:'POST',body});};
    try {
      let published;
      if(post.platform==='instagram') {
        let body;
        if(post.placement==='story') body={media_type:'STORIES',image_url:urls[0]};
        else if(post.format==='carousel') {
          expect(urls.length>=2 && urls.length<=10,'The Instagram adapter accepts two to ten carousel images.');
          const children=[];
          for(const url of urls) {const child=await this.graph(`${account.id}/media`,{method:'POST',body:{image_url:url,is_carousel_item:true}});expect(child.id,'Meta did not create a child container.');children.push(child.id);checkpoint({phase:'containers',children});}
          body={media_type:'CAROUSEL',children:children.join(','),caption:post.caption};
        } else body={image_url:urls[0],caption:post.caption,alt_text:post.slides[0].alt};
        const container=await this.graph(`${account.id}/media`,{method:'POST',body});expect(container.id,'Meta did not create a media container.');checkpoint({phase:'container_ready',containerId:container.id});
        let ready=false;
        for(let i=0;i<5;i++) {
          const status=await this.graph(`${container.id}?fields=status_code`);
          if(status.status_code==='FINISHED'){ready=true;break;}
          expect(!['ERROR','EXPIRED'].includes(status.status_code),'Meta could not prepare the media.');
          if(i<4) await new Promise(r=>setTimeout(r,1000));
        }
        expect(ready,'Media is not ready. No publication was sent. Try again after checking the container.');
        published=await commit(`${account.id}/media_publish`,{creation_id:container.id});
        expect(published.id,'Meta did not return a post ID.');checkpoint({phase:'published_id_received',externalId:published.id});
        const fields=post.placement==='story'?'id,media_type':'id,caption,permalink,media_type,children{id}';
        const proof=await this.graph(`${published.id}?fields=${fields}`);
        expect(String(proof.id)===String(published.id),'Post readback did not match.');
        if(post.placement!=='story') {
          expect((proof.caption||'')===post.caption,'Published caption did not match.');
          if(post.format==='carousel') expect(proof.children?.data?.length===urls.length,'Published carousel count did not match.');
        }
        return {provider:'meta',verified:true,simulated:false,externalId:published.id,url:proof.permalink||null,account:account.account,placement:post.placement,verifiedAt:now(),readback:proof};
      }
      expect(post.placement==='feed','Facebook Stories use the manual path in v0.1.');
      const attached=[];
      for(const url of urls) {const photo=await this.graph(`${account.id}/photos`,{method:'POST',body:{url,published:false}});expect(photo.id,'Meta did not return an unpublished photo ID.');attached.push({media_fbid:photo.id});checkpoint({phase:'unpublished_photos',attached});}
      published=await commit(`${account.id}/feed`,{message:post.caption,attached_media:attached});expect(published.id,'Meta did not return a post ID.');checkpoint({phase:'published_id_received',externalId:published.id});
      const proof=await this.graph(`${published.id}?fields=id,message,permalink_url`);
      expect(String(proof.id)===String(published.id) && (proof.message||'')===post.caption,'Facebook readback did not match.');
      return {provider:'meta',verified:true,simulated:false,externalId:published.id,url:proof.permalink_url||null,account:account.account,verifiedAt:now(),readback:proof};
    } catch(error) {error.uncertain=dispatched;throw error;}
  }
}
export const demoProvider={async publish(post,grant,checkpoint){checkpoint({phase:'simulation'});return {provider:'demo',simulated:true,verified:false,externalId:`demo-${post.id}-v${post.version}`,url:null,account:grant.account,at:now()};}};
