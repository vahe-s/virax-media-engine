import { mkdir,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { brandMarkdown } from './media.mjs';

export function projectInstructions(brand){
  return `# VIRAX project: ${brand.name}\n\nBrand ID: ${brand.id}\nProfile version: ${brand.version}\n\nUse this project chat as the main interface.\nRead the newest brand-profile.json and brand-profile.md before each task.\nUse the engine database as the authority when it is available.\nKeep all work for this brand in this project or its connected private folder.\nAsk at most three short questions at a time.\nHandle technical setup with your authorized tools.\nSave lasting owner corrections to the profile and export the new version.\nKeep one-post changes in that post.\nAccept reference links pasted directly into chat.\nInspect the actual reference and preserve its format and text treatment.\nCreate original media in this brand's style.\nCheck every factual claim before artwork creation.\nRespect the saved public source preference.\nUse the companion only for previews, approvals, assets, or settings.\nDo not set up an Instagram inbox listener or a DM trigger.\nDo not claim that a link starts a model inside the local server.\nCheck the saved publication scope before any external post.\nKeep tokens and credentials outside chat and exported profiles.\n\nEngine instructions: https://github.com/vahe-s/virax-engine-machine/blob/main/START-HERE.md\n`;
}
export async function saveProfileFiles(root,brand){
  if(!/^brand_[a-zA-Z0-9-]+$/.test(brand.id))throw new Error('Invalid brand identifier.');
  const directory=join(root,'brands',brand.id);await mkdir(directory,{recursive:true});
  const files={'brand-profile.json':JSON.stringify(brand,null,2),'brand-profile.md':brandMarkdown(brand),'PROJECT-INSTRUCTIONS.md':projectInstructions(brand)};
  for(const [name,content]of Object.entries(files)){const path=join(directory,name),temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,content);await rename(temp,path);}
  return {directory,version:brand.version};
}
