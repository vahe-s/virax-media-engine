import { createHash } from 'node:crypto';

export const postTypes=['Funny','Facts','History','Theme','News','Trends','Comparisons','Health','Surprising facts','Share with a friend','Tag a friend'];
export const ctaOptions=['Follow for useful content','Save for later','Send this to a friend','Tag a friend in the comments','Visit our website','Send an inquiry','Visit our location','View a confirmed offer','No call to action'];
export const creativeStage={id:'creative',title:'Choose the personality of your posts',note:'Choose a mix, request random variety, or give exact counts. Counts below apply to each week.',fields:[
  {key:'postTypes',label:'Which types of posts do you want?',type:'multi',options:[...postTypes,'Random mix','Custom'],required:true},
  {key:'mixCounts',label:'How many of each type should appear each week?',placeholder:'2 funny, 2 facts, 1 comparison. Leave blank for variety.'},
  {key:'cta',label:'What is the main call to action (CTA)?',type:'select',options:[...ctaOptions,'Random from suitable CTAs','Custom'],required:true},
  {key:'ctaPrompt',label:'Which custom CTA or rules should we use?',type:'textarea',placeholder:'Example: Ask readers to send this to a friend who needs help with this exact topic.'},
  {key:'customPrompt',label:'What else should guide the content?',type:'textarea',placeholder:'A custom theme, humor style, hook, reference, or detailed request. Write Random for theme variety.'}
]};
const aliases={funny:'Funny',humor:'Funny',humour:'Funny',jokes:'Funny',fact:'Facts',facts:'Facts',history:'History',theme:'Theme',news:'News',trend:'Trends',trends:'Trends',comparison:'Comparisons',comparisons:'Comparisons',health:'Health',shocking:'Surprising facts',surprising:'Surprising facts','surprising facts':'Surprising facts',shareable:'Share with a friend',share:'Share with a friend',tag:'Tag a friend',mention:'Tag a friend',custom:'Custom',random:'Random mix'};
export function parseMix(text='') {
  const counts={};
  for(const part of text.split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean)) {
    const m=part.match(/^(\d+)\s+(.+?)\s*$/);if(!m)throw new Error('Use counts such as: 2 funny, 2 facts, 1 comparison.');
    const type=aliases[m[2].toLowerCase()]||postTypes.find(t=>t.toLowerCase()===m[2].toLowerCase());
    if(!type)throw new Error(`Unknown post type: ${m[2]}. Use Custom for your own type.`);
    const n=Number(m[1]);if(n>7)throw new Error('Use up to seven posts per type each week.');counts[type]=(counts[type]||0)+n;
  }
  if(Object.values(counts).reduce((a,b)=>a+b,0)>7)throw new Error('This release supports up to seven main posts each week.');
  return counts;
}
function random(seed) {let value=parseInt(createHash('sha256').update(seed).digest('hex').slice(0,8),16);return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
export function applyCreative(answers,topics) {
  const rng=random(JSON.stringify(answers)),pick=values=>values[Math.floor(rng()*values.length)];
  const counts=parseMix(answers.mixCounts),total=Object.values(counts).reduce((a,b)=>a+b,0),requested=/random/i.test(answers.frequency||'')?2+Math.floor(rng()*4):Number(answers.frequency==='Custom'?answers.frequencyCustom:answers.frequency)||3;
  const frequency=Math.max(2,Math.min(7,Math.max(requested,total))),selected=(answers.postTypes||['Facts','Comparisons','Theme']).filter(t=>postTypes.includes(t)||t==='Custom');
  const pool=selected.length?selected:postTypes;
  const requestedFormats=answers.formats||['Carousel','Single image'],formatMap={'Carousel':'carousel','Single image':'single','Instagram Story':'story','Video':'video'};
  const allowed=requestedFormats.map(f=>formatMap[f]).filter(Boolean),formats=allowed.length?allowed:['carousel','single','story'];
  const randomFormat=requestedFormats.some(f=>/random/i.test(f));
  const rotateTypes=()=>{const list=[];for(const [type,count]of Object.entries(counts))for(let i=0;i<count;i++)list.push(type==='Random mix'?pick(pool):type);while(list.length<frequency)list.push(pick(pool));for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
  const typeSequence=[...rotateTypes(),...rotateTypes()];
  const randomTheme=/^random( themes?)?$/i.test((answers.topics||'').trim());
  const theme=(randomTheme?answers.business||'your work':answers.topics||answers.business||'your work').split(/[\n.!]/)[0].slice(0,90);
  const creativeIdeas={
    Funny:{hook:'A familiar moment, with a twist',purpose:'Use a relatable situation and a warm joke that fits the brand.',needs:'Original humor; no fabricated customer story or harmful target'},
    Facts:{hook:'One fact that changes the question',purpose:'Give one useful fact, its evidence, and its practical meaning.',needs:'A current primary source and the necessary qualification'},
    History:{hook:'The story behind one detail',purpose:'Explain a documented change through distinct visual stages.',needs:'Original records, museum sources, or scholarly evidence'},
    Theme:{hook:'A new perspective on the familiar',purpose:'Create a distinct visual theme from the approved brand and reference.',needs:'Accurate asset records and reference inspection'},
    News:{hook:'What changed, and why it matters',purpose:'Explain a current development that affects this audience.',needs:'A dated primary announcement; research is required before creation'},
    Trends:{hook:'What is behind this trend?',purpose:'Explain a current pattern and its limits without a popularity promise.',needs:'Current attributable trend evidence; no invented trend label'},
    Comparisons:{hook:'Two choices. Details worth a closer look.',purpose:'Compare the same criteria with clear side-by-side evidence.',needs:'Comparable source data and fair qualifications'},
    Health:{hook:'A health question that deserves a careful answer',purpose:'Explain relevant general information without a diagnosis or treatment promise.',needs:'Current authoritative health guidance and explicit limits'},
    'Surprising facts':{hook:'The useful detail you might not expect',purpose:'Create surprise from a verified fact, then show why it matters.',needs:'Primary evidence; no false urgency or unsupported shock claim'},
    'Share with a friend':{hook:'For the friend who asks this question',purpose:'Give a specific answer that helps a real person or situation.',needs:'A useful takeaway and factual support where required'},
    'Tag a friend':{hook:'Who does this remind you of?',purpose:'Invite a relevant, optional conversation about a familiar situation.',needs:'Original content; no false incentive or compulsory tags'},
    Custom:{hook:'Your custom creative brief',purpose:answers.postTypesCustom||answers.customPrompt||'Ask for the custom idea before artwork creation.',needs:'The saved custom brief and all normal quality rules'}
  };
  const entries=typeSequence.map((type,i)=>{
    const base=topics[i],idea=creativeIdeas[type],week=Math.floor(i/frequency)+1,day=(week-1)*7+Math.floor((i%frequency)*7/frequency)+1;
    let cta=answers.cta||'Follow for useful content';if(/random/i.test(cta))cta=pick(ctaOptions.filter(x=>x!=='View a confirmed offer'&&x!=='Visit our location'));
    if(cta==='Custom')cta=answers.ctaPrompt||'Custom CTA needs a brief.';
    const mode=answers.textMode==='Images only'||(type==='Theme'&&[4,7,10].includes(i))?'image-only':'educational';
    return {...base,title:`${idea.hook} · ${base.title}`,type,theme:randomTheme?`${theme}: ${base.title}`:theme,variant:i+1,week,day,format:randomFormat?pick(formats):formats.includes(base.format)?base.format:formats[0],mode,cta,customPrompt:[type==='Custom'?answers.postTypesCustom:'',answers.customPrompt].filter(Boolean).join('\n'),purpose:idea.purpose,requires:idea.needs,story:answers.storyPlan==='Yes, create a separate Story asset'};
  });
  return {frequency,entries,counts,notes:total>requested?['The exact type counts raise the weekly frequency to match your request.']:[]};
}
