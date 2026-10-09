import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addAsset, renderPost } from './media.mjs';

export async function seedDemo(engine,root,projectRoot) {
  const previous=engine.store.get('demo_marker');if(previous)return previous;
  const data=JSON.parse(await readFile(join(projectRoot,'examples','fieldwork','example.json'),'utf8'));
  let brand=engine.createBrand(data.brand.name);
  brand=engine.updateBrand(brand.id,{version:brand.version,answers:data.brand.answers,stage:6});
  brand=engine.chooseStyle(brand.id,'editorial');
  const assets=[];
  for(const [i,file] of data.images.entries()) assets.push(await addAsset(engine,root,brand.id,{name:file,role:'image',rightsConfirmed:true,provenance:'Original generated public example. Fictional brand. See examples/ASSET-LICENSE.md.'},await readFile(join(projectRoot,'examples','fieldwork','photos',file))));
  const make=async(format,indices,title)=>{
    let post=engine.createPost(brand.id,{title,format,mode:'image-only'});
    post=engine.editPost(post.id,{version:post.version,title,caption:data.caption,mode:'image-only',slides:indices.map((index,i)=>({number:i+1,assetId:assets[index].id,headline:'',body:'',message:data.scenes[index].message,evidence:data.scenes[index].evidence,composition:data.scenes[index].composition,alt:data.scenes[index].alt})),claims:[]});
    post=await renderPost(engine,root,post.id);
    // The shipped example was inspected. A fresh export remains pending review.
    return post;
  };
  const carousel=await make('carousel',Array.from({length:9},(_,i)=>i),'The morning ritual');
  const single=await make('single',[1],'Small details, full character');
  const story=await make('story',[0],'The morning ritual · Story');
  const marker={id:'demo_marker',kind:'setting',brandId:brand.id,postIds:[carousel.id,single.id,story.id],simulated:true};engine.store.put('setting',marker);return marker;
}
