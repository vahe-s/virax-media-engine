import { creativeStage, ctaOptions, applyCreative } from './creative.mjs';
export const stages = [
  { id:'business', title:'Tell us what you do', note:'Start with your business. Your plan takes shape from these answers.', fields:[
    {key:'name',label:'What is your business called?',required:true,placeholder:'Your business name'},
    {key:'business',label:'What do you sell or do?',required:true,type:'textarea',placeholder:'Describe your products, services, and what makes them useful.'},
    {key:'website',label:'Where can we learn about your business?',placeholder:'https://your-website.com'},
    {key:'location',label:'Where do you serve customers?',placeholder:'A city, region, or online market'},
    {key:'competitors',label:'Which competitors should we study?',type:'textarea',placeholder:'Names or links. Explain what you want to do differently.'} ]},
  { id:'audience',title:'Find your people',note:'Specific customers lead to specific, useful content.',fields:[
    {key:'audience',label:'Who should your content help?',required:true,type:'textarea',placeholder:'Describe the people, their needs, and their experience.'},
    {key:'problems',label:'What questions do customers ask?',type:'textarea'},
    {key:'goals',label:'What should content achieve?',required:true,type:'select',options:['Build trust and awareness','Bring qualified inquiries','Increase store visits','Support product sales','Teach and retain customers']},
    {key:'language',label:'Which language should we use?',placeholder:'English'},
    {key:'captionStyle',label:'What should the captions contain?',type:'textarea',placeholder:'Length, tone, useful details, and calls to action.'} ]},
  {id:'content',title:'Choose your content mix',note:'We will suggest topics. You decide what fits.',fields:[
    {key:'formats',label:'Which formats do you want?',type:'multi',options:['Carousel','Single image','Instagram Story','Video','Random supported format','Custom'],required:true},
    {key:'frequency',label:'How many main posts each week?',type:'select',options:['2','3','4','5','6','7','Random (2–5 each week)','Custom'],required:true},
    {key:'topics',label:'Which topics or products should lead?',type:'textarea'},
    {key:'cta',label:'What should people do next?',type:'select',options:[...ctaOptions,'Random from suitable CTAs','Custom']},
    {key:'storyPlan',label:'Should each Feed post also have an Instagram Story?',type:'select',options:['Yes, create a separate Story asset','Only when I request one','No Stories']} ]},
  {id:'brand',title:'Make it look like you',note:'Add your brand files in the asset library. Your rules stay with every task.',fields:[
    {key:'colors',label:'Which colors should we use?',placeholder:'#e56942, #f6f3e9, #20251f'},
    {key:'fonts',label:'Which fonts and spacing rules are required?',type:'textarea',placeholder:'Font names, licensed files, margins, and logo spacing.'},
    {key:'tone',label:'How should your brand sound?',type:'select',options:['Clear and practical','Warm and personal','Quiet and refined','Bold and playful','Expert and precise','Random within my brand rules','Custom']},
    {key:'special',label:'What must we always include or avoid?',type:'textarea'},
    {key:'logoRules',label:'Where should the logo appear?',type:'textarea',placeholder:'Upload the real logo. State its position, clear space, and when to omit it.'} ]},
  {id:'media',title:'Choose the source of your images',note:'A reference defines the format. It does not prove factual claims.',fields:[
    {key:'media',label:'Where should the images come from?',type:'multi',options:['Original generated images','My photographs','Licensed stock','A mixture','Random from permitted sources','Custom'],required:true},
    {key:'textMode',label:'What text belongs on the images?',type:'select',options:['Follow each reference','Educational text and captions','Images only','Random when no reference is supplied','Custom'],required:true},
    {key:'creativeStart',label:'How would you like to start?',type:'select',options:['I do not have references. Give me ideas.','I have a reference or Instagram link.','Help me explore both.','Custom']},
    {key:'references',label:'Reference links (optional)',type:'textarea',placeholder:'Leave this empty for original ideas. Or paste links and explain what you like.'} ]},
  {id:'facts',title:'Keep the content true',note:'We separate your confirmed business facts from external research.',fields:[
    {key:'facts',label:'Which business facts can we use?',type:'textarea',placeholder:'Confirmed services, product details, hours, and approved offers.'},
    {key:'limits',label:'Which claims or subjects must we avoid?',type:'textarea'},
    {key:'sources',label:'Which primary sources do you trust?',type:'textarea'},
    {key:'rights',label:'Can you use the supplied assets?',type:'select',options:['I own them or have permission','Some assets still need a rights check']},
    {key:'sourceDisplay',label:'Where should verified sources appear in public posts?',type:'select',options:['Caption','Final carousel slide','On each factual slide','Caption and final slide','Private source record only','Random from approved source placements','Custom']} ]},
  {id:'delivery',title:'Set the boundaries',note:'A content approval and permission to publish are separate decisions.',fields:[
    {key:'platforms',label:'Where should the posts appear?',type:'multi',options:['Instagram','Facebook','LinkedIn','Pinterest','TikTok'],required:true},
    {key:'timezone',label:'What is your publication timezone?',required:true,placeholder:'America/New_York'},
    {key:'budget',label:'What is the monthly limit for paid tools?',placeholder:'0 USD. Use my existing tools only.'},
    {key:'approval',label:'How should content reach publication?',type:'select',options:['Review each post','Review each batch','Consider ongoing approval after a test']},
    {key:'publicationHours',label:'Which audience data or time limits should guide the schedule?',type:'textarea',placeholder:'Audience activity, past results, timezone, and times to avoid.'},
    {key:'tips',label:'How often should your agent suggest useful features?',type:'select',options:['Regular useful tips','Fewer tips','No tips']} ]}
  ,creativeStage,
  {id:'storage',title:'Keep your work available',note:'Google Drive sync needs your own Google connection. You can activate it in Settings.',fields:[
    {key:'storage',label:'Where should we keep a copy?',type:'select',options:['Local files only','Google Drive and local files']},
    {key:'driveSyncPreference',label:'When should Google Drive sync run?',type:'select',options:['Manual sync when I request it','Automatic sync after changes']},
    {key:'storageNotes',label:'Which private folder or storage rules should we use?',type:'textarea',placeholder:'The app creates its own private folder. Describe any additional backup requirements.'}
  ]}
];
// Retain saved music requirements for existing users, without offering automatic music in setup.
export const answerKeys = new Set([...stages.flatMap(s => s.fields.flatMap(f => [f.key,f.key+'Custom'])),'music','randomSeed','customChoices']);
export function nextQuestions(answers) {
  const vague = /^(everyone|anything|everything|all people|not sure|idk)$/i;
  const followups = [];
  if (vague.test(answers.audience?.trim() || '')) followups.push('Describe one customer you most want to reach. What do they need?');
  if (answers.business && answers.business.trim().length < 12) followups.push('Name one product or service and explain the problem it solves.');
  if (answers.music === 'Always required; hold if unavailable') followups.push('Music needs a native platform check. Which account and track rights can you use?');
  if (answers.rights === 'Some assets still need a rights check') followups.push('Identify the assets that need permission before we use them.');
  for(const field of new Map(stages.flatMap(s=>s.fields).map(f=>[f.key,f])).values()){
    const chosen=answers[field.key],custom=chosen==='Custom'||Array.isArray(chosen)&&chosen.includes('Custom');
    if(custom && !(field.key==='cta'?answers.ctaPrompt:answers[field.key+'Custom']))followups.push(`Add your custom instructions for: ${field.label}`);
  }
  return followups;
}
export function recommendations(answers) {
  const product = (answers.topics || answers.business || 'your work').split(/[\n.!]/)[0].slice(0,100);
  const topics = [
    {title:`Before you choose: ${product}`,format:'carousel',purpose:'Answer the decisions your audience needs to make.',requires:'Primary sources and confirmed product facts'},
    {title:'One detail, explained clearly',format:'single',purpose:'Show a useful detail with a close view.',requires:'A verified detail and an original or licensed image'},
    {title:'A closer look at the process',format:'carousel',purpose:'Show the work behind the result.',requires:'Real process evidence or clearly described concept imagery'},
    {title:'Your most common question',format:'carousel',purpose:answers.problems || 'Turn a customer question into practical steps.',requires:'A sourced answer with its limits'},
    {title:'The quiet product edit',format:'carousel',purpose:'An image-only showcase that follows the selected style.',requires:'Distinct compositions and accurate asset records'},
    {title:'A useful checklist to save',format:'carousel',purpose:'Give readers a practical takeaway.',requires:'Primary guidance with qualifications'},
    {title:'Two options, one clear comparison',format:'carousel',purpose:'Explain a real choice without a false winner.',requires:'Comparable evidence for both options'},
    {title:'One object, a different perspective',format:'single',purpose:'Reveal texture and shape through a new composition.',requires:'A complete object and an accurate image record'},
    {title:'What the label actually means',format:'carousel',purpose:'Explain a term customers see before a purchase.',requires:'The original specification or official definition'},
    {title:'From question to decision',format:'carousel',purpose:'Help one specific customer choose their next step.',requires:'A real question and a sourced answer'},
    {title:'A collection of small details',format:'carousel',purpose:'Build an image-only sequence with distinct views.',requires:'Original or licensed images; no invented stock claims'},
    {title:'The step people often miss',format:'single',purpose:'Show a useful action with its practical limits.',requires:'Primary evidence; no unsupported prevalence claim'},
    {title:'A closer view of the material',format:'carousel',purpose:'Show how one confirmed material affects the experience.',requires:'An accurate material specification'},
    {title:'Keep this before your next visit',format:'carousel',purpose:'Answer the useful questions before someone contacts the business.',requires:'Owner-confirmed details and a clear final action'}
  ];
  const creative=applyCreative(answers,topics);
  return {basis:'Editorial suggestions from your saved answers. No website research is implied.',...creative,weeks:2,topics,timingBasis:'Days are draft slots. Use audience data and current research before you select publication hours.',followups:nextQuestions(answers)};
}
export const styles = [
  {id:'editorial',name:'Warm editorial',description:'Natural texture. Generous space. A calm, human voice.',image:'01-ritual.jpg',palette:['#f5f0e4','#b85f3e','#292c23']},
  {id:'contrast',name:'Bold contrast',description:'Close detail. Strong color. Short, direct headlines.',image:'02-beans.jpg',palette:['#e76c42','#241a15','#faf5eb']},
  {id:'minimal',name:'Quiet precision',description:'Clean comparisons. Pale surfaces. Clear information.',image:'03-grind.jpg',palette:['#f6f4ed','#536150','#262923']},
  {id:'luxury',name:'Luxury editorial',description:'Sculpted light. Rich surfaces. Space around the product.',image:null,palette:['#13243d','#d6bd87','#f8f3e8']},
  {id:'educational',name:'Visual explanations',description:'Diagrams, useful labels, and comparisons that explain each claim.',image:null,palette:['#eff6ff','#1764ce','#172b45']},
  {id:'playful',name:'Playful collage',description:'Unexpected scale. Cutout shapes. Humor that fits the audience.',image:null,palette:['#ffc940','#dd398b','#372070']},
  {id:'documentary',name:'Documentary stories',description:'Real settings, process details, and sequences with a clear story.',image:null,palette:['#e6dfd0','#52625b','#282925']}
];
