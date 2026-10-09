import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';
import { Resvg } from '@resvg/resvg-js';

const root=resolve('examples/fieldwork');await mkdir(join(root,'photos'),{recursive:true});
if(process.argv[2]) {
  const inputs=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
  for(const input of inputs) await sharp(input.path).resize(1080,1350,{fit:'cover'}).jpeg({quality:94,mozjpeg:true}).toFile(join(root,'photos',input.id+'.jpg'));
}
const data=JSON.parse(await readFile(join(root,'example.json'),'utf8'));
const tiles=[];
for(const [i,file] of data.images.entries())tiles.push({input:await sharp(join(root,'photos',file)).resize(360,450).toBuffer(),left:(i%3)*360,top:Math.floor(i/3)*450});
await sharp({create:{width:1080,height:1350,channels:3,background:'#f4f0e4'}}).composite(tiles).jpeg({quality:90}).toFile(join(root,'carousel-contact.jpg'));
await copyFile(join(root,'photos',data.images[1]),join(root,'single-post.jpg'));
await sharp(join(root,'photos',data.images[0])).resize(1080,1920,{fit:'cover'}).jpeg({quality:93}).toFile(join(root,'story.jpg'));
const pack={'caption.txt':strToU8(data.caption),'source-record.json':strToU8(JSON.stringify(data.sourceRecord,null,2)),'alt-text.json':strToU8(JSON.stringify(data.scenes.map((s,i)=>({slide:i+1,alt:s.alt})),null,2)),'manifest.json':strToU8(JSON.stringify(data,null,2))};
for(const [i,file] of data.images.entries())pack[`carousel/${String(i+1).padStart(2,'0')}.jpg`]=new Uint8Array(await readFile(join(root,'photos',file)));
pack['single-post.jpg']=new Uint8Array(await readFile(join(root,'single-post.jpg')));pack['story.jpg']=new Uint8Array(await readFile(join(root,'story.jpg')));
await writeFile(join(root,'finished-example.zip'),Buffer.from(zipSync(pack,{level:6})));
console.log(JSON.stringify({images:9,single:true,story:true,zip:'examples/fieldwork/finished-example.zip'}));
