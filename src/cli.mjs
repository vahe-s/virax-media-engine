import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { Engine, expect } from './engine.mjs';
import { capabilities, MetaProvider } from './providers.mjs';
import { Worker } from './worker.mjs';
import { addAsset, renderPost, exportPack, taskPack, brandMarkdown } from './media.mjs';
import { seedDemo } from './demo.mjs';
import { References } from './references.mjs';
import { saveProfileFiles,projectInstructions } from './profile.mjs';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(process.env.ENGINE_DATA_DIR||'.data');
const [command,id,file]=process.argv.slice(2);
await mkdir(root,{recursive:true});const store=new Store(join(root,'engine.sqlite')),engine=new Engine(store),worker=new Worker(engine,{mediaRoot:root});
const references=new References(engine);
const jsonFile=async path=>JSON.parse(await readFile(resolve(path),'utf8'));
try {
  let result;
  switch(command) {
    case 'doctor': result={node:process.version,storage:root,providers:capabilities(),liveEnabled:process.env.ENGINE_LIVE_PUBLISH==='true',note:'A connected chat tool is not automatically available inside this server.'};break;
    case 'status': result={brands:store.list('brand'),posts:store.list('post'),grants:store.list('grant'),references:store.list('reference')};break;
    case 'demo': result=await seedDemo(engine,root,projectRoot);break;
    case 'brand-create': result=engine.createBrand(id);break;
    case 'brand-show': result=engine.get(id,'brand');break;
    case 'brand-save': result=engine.updateBrand(id,await jsonFile(file));break;
    case 'brand-rule': result=engine.setRule(id,await jsonFile(file));break;
    case 'chat-context': result=references.context(id);break;
    case 'reference-add': result=references.add(id,await jsonFile(file));break;
    case 'reference-show': result=engine.get(id,'reference');break;
    case 'reference-inspect': result=references.inspect(id,await jsonFile(file));break;
    case 'reference-draft': result=references.draft(id,file?await jsonFile(file):{});break;
    case 'reference-complete': result=await references.complete(id,root);break;
    case 'brand-style': result=engine.chooseStyle(id,file);break;
    case 'brand-export': {const brand=engine.get(id,'brand');const out=resolve(file||join(root,'handoff',id));await mkdir(out,{recursive:true});await writeFile(join(out,'brand-profile.json'),JSON.stringify(brand,null,2));await writeFile(join(out,'brand-profile.md'),brandMarkdown(brand));await writeFile(join(out,'PROJECT-INSTRUCTIONS.md'),projectInstructions(brand));result={directory:out};break;}
    case 'plan': result=engine.plan(id);break;
    case 'post-create': result=engine.createPost(id,file?await jsonFile(file):{});break;
    case 'post-show': result=engine.get(id,'post');break;
    case 'post-save': result=engine.editPost(id,await jsonFile(file));break;
    case 'task': result=taskPack(engine,id);break;
    case 'asset-add': {const extra=process.argv[5]?await jsonFile(process.argv[5]):{};result=await addAsset(engine,root,id,{...extra,name:basename(file)},await readFile(resolve(file)));break;}
    case 'import': {
      const input=await jsonFile(file),base=dirname(resolve(file));
      expect(Array.isArray(input.slides),'The manifest needs a slides array.');
      let post=input.postId?engine.get(input.postId,'post'):engine.createPost(id,input);
      expect(post.brandId===id,'The manifest targets another brand.');
      const slides=[];
      for(const slide of input.slides) {
        const asset=slide.image?await addAsset(engine,root,id,{name:basename(slide.image),role:'image',rightsConfirmed:slide.rightsConfirmed===true,provenance:slide.provenance||'Unconfirmed imported asset'},await readFile(resolve(base,slide.image))):null;
        slides.push({...slide,assetId:asset?.id||slide.assetId});
      }
      result=engine.editPost(post.id,{...input,version:input.version??post.version,slides});break;
    }
    case 'render': result=await renderPost(engine,root,id);break;
    case 'quality': result=engine.quality(id);break;
    case 'review': result=engine.review(id,await jsonFile(file));break;
    case 'approve': result=engine.decide(id,{version:Number(file),action:'approve',reviewer:'Owner via CLI'});break;
    case 'authorize': result=engine.authorize(await jsonFile(id));break;
    case 'schedule': result=engine.schedule(id,await jsonFile(file));break;
    case 'cancel': result=engine.cancel(id);break;
    case 'revoke': result=engine.revoke(id);break;
    case 'retry': result=worker.retry(id);break;
    case 'receipt': result=worker.reportManual(id,await jsonFile(file));break;
    case 'tick': result=await worker.tick();break;
    case 'meta-verify': result=await new MetaProvider().verify();store.put('connection',result);break;
    case 'export': {const out=resolve(file||join(root,`${id}.zip`));await writeFile(out,await exportPack(engine,root,id));result={file:out};break;}
    default: result={commands:['doctor','status','demo','brand-create <name>','brand-show <id>','brand-save <id> <json>','brand-rule <id> <rule.json>','chat-context <brand>','reference-add <brand> <reference.json>','reference-show <id>','reference-inspect <id> <inspection.json>','reference-draft <id> [brief.json]','reference-complete <id>','brand-style <id> <style>','brand-export <id> <folder>','plan <brand>','post-create <brand> [json]','post-show <id>','post-save <id> <json>','task <post>','asset-add <brand> <file> [metadata.json]','import <brand> <manifest.json>','render <post>','quality <post>','review <post> <checks.json>','approve <post> <version>','authorize <grant.json>','schedule <post> <schedule.json>','cancel <post>','revoke <grant>','retry <post>','receipt <post> <receipt.json>','tick','meta-verify','export <post> [file.zip]']};
  }
  if(result?.kind==='brand')await saveProfileFiles(root,result);
  if(result?.kind==='asset'||command==='import')await saveProfileFiles(root,engine.get(id,'brand'));
  if(result?.brand && command==='chat-context')result.profileFiles=await saveProfileFiles(root,result.brand);
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.error(JSON.stringify({error:error.message}));process.exitCode=1;} finally {store.close();}
