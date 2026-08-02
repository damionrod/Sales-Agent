import { corsJson, requirePost, checkAccess, cleanUrl, domainFromUrl, openAIJson, supabaseConfig, supabaseRequest, mapCompanyRow } from './_shared.mjs';

const CAMPAIGNS = {
  voice: { label: 'Voice, DIDs and termination', queries: [
    'cloud communications company expanding into Australia local phone numbers voice',
    'virtual number provider launching New Zealand coverage telecom',
    'CPaaS provider expanding into Singapore local numbers voice',
    'contact centre platform APAC expansion carrier partnership',
    'wholesale voice provider entering Australia New Zealand Singapore'
  ]},
  mobile: { label: 'MVNO, eSIM and IoT SIMs', queries: [
    'company launching MVNO Australia partnership',
    'eSIM platform expanding into Australia New Zealand',
    'IoT connected device company Australia cellular connectivity expansion',
    'fleet telematics company launching connected devices Australia',
    'retailer considering branded mobile service Australia'
  ]},
  data: { label: 'DIA, NBN, backhaul and dark fibre', queries: [
    'Australian company opening new data centre network expansion',
    'New Zealand managed service provider expanding network infrastructure',
    'Australia enterprise requiring dark fibre backhaul data centre expansion',
    'Australian ISP network expansion IP transit backhaul',
    'business opening multiple Australian sites dedicated internet connectivity'
  ]},
  nuwave: { label: 'NuWave BYOC', queries: [
    'NuWave BYOC contact centre company',
    'NuWave BYOC APAC voice provider',
    'cloud contact centre expanding Australia New Zealand Singapore BYOC',
    'enterprise voice platform APAC carrier connectivity NuWave',
    'Microsoft Teams voice provider APAC NuWave BYOC'
  ]},
  sms: { label: 'A2P and two-way SMS', queries: [
    'software platform launching SMS notifications Australia New Zealand',
    'government workflow SMS provider New Zealand integration',
    'fintech expanding transactional messaging Australia',
    'customer engagement platform entering Australia SMS',
    'two way SMS platform APAC expansion'
  ]}
};

function titleToCompany(title = '', url = '') {
  const clean = title.replace(/\s+[|–—-]\s+.*$/, '').replace(/\b(press release|news|blog|careers?)\b/gi, '').trim();
  if (clean.length >= 2 && clean.length <= 100) return clean;
  return (domainFromUrl(url).split('.')[0] || 'Unknown company').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function guessCountry(text='') {
  const t = text.toLowerCase();
  if (t.includes('new zealand')) return 'New Zealand';
  if (t.includes('singapore')) return 'Singapore';
  if (t.includes('australia')) return 'Australia';
  if (t.includes('united kingdom') || /\buk\b/.test(t)) return 'United Kingdom';
  if (t.includes('united states') || /\busa\b/.test(t)) return 'United States';
  return 'Global';
}
function heuristic(item, campaignKey) {
  const text = `${item.title || ''} ${item.content || ''}`;
  const l = text.toLowerCase(); const products=[];
  if (/did|virtual number|local number|phone number/.test(l)) products.push('Virtual Numbers / DIDs');
  if (/termination|voice|calling|sip|telephony/.test(l)) products.push('Call Termination');
  if (/sms|messaging/.test(l)) products.push('A2P / Two-way SMS');
  if (/mvno|mobile service/.test(l)) products.push('MVNO Enablement');
  if (/esim/.test(l)) products.push('eSIMs');
  if (/iot|connected device|telematics/.test(l)) products.push('IoT SIMs');
  if (/dark fibre|dark fiber/.test(l)) products.push('Dark Fibre');
  if (/backhaul/.test(l)) products.push('Backhaul');
  if (/ip transit/.test(l)) products.push('IP Transit');
  if (/dedicated internet|\bdia\b|enterprise ethernet|\bnbn\b/.test(l)) products.push('DIA / NBN');
  if (/nuwave|byoc/.test(l)) products.push('NuWave BYOC');
  const defaults={voice:['Virtual Numbers / DIDs','Call Termination'],mobile:['eSIMs','IoT SIMs'],data:['DIA / NBN','Backhaul'],nuwave:['NuWave BYOC'],sms:['A2P / Two-way SMS']};
  if (!products.length) products.push(...defaults[campaignKey]);
  const signalHits=['launch','expand','expansion','new market','partnership','growth','opening','hiring'].filter(w=>l.includes(w)).length;
  const score=Math.min(86,55+products.length*5+signalHits*4);
  return { company:titleToCompany(item.title,item.url), website:cleanUrl(item.url), country:guessCountry(text), industry:'Potential wholesale telecommunications prospect', employees:'Unknown', opportunity:products.join(', '), products:[...new Set(products)], signal:(item.content||item.title||'').slice(0,500), research:`Public web evidence suggests a possible ${products.join(' and ')} opportunity. Review the source before contacting the company.`, score, status:score>=65?'qualified':'new', sourceUrl:cleanUrl(item.url), contacts:[], selectedContactId:null, subject:'', emailBody:'', createdAt:new Date().toISOString() };
}
async function tavilySearch(query,maxResults){
  const key=process.env.TAVILY_API_KEY; if(!key) throw new Error('TAVILY_API_KEY is not configured.');
  const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,query,search_depth:'basic',max_results:maxResults,include_answer:false,include_raw_content:false,topic:'general'})});
  const text=await r.text(); if(!r.ok) throw new Error(`Tavily ${r.status}: ${text.slice(0,600)}`);
  const data=JSON.parse(text); return Array.isArray(data.results)?data.results:[];
}
async function aiQualify(items,label){
  const compact=items.map((x,i)=>({index:i,title:x.title,url:x.url,content:(x.content||'').slice(0,1400)}));
  const out=await openAIJson({schemaName:'lead qualification',system:`You are a conservative B2B telecom lead analyst for Symbio Wholesale. Campaign: ${label}. Only accept identifiable companies with a credible buying signal in supplied evidence. Never invent facts. Reject generic articles, directories, job boards, government pages, and companies that are merely competitors without a potential buyer requirement. Relevant capabilities: AU/NZ/SG DIDs, call termination, Australian mobile numbers, A2P/two-way SMS, MVNO enablement, eSIM, IoT SIM, DIA, NBN, OptiComm, IP transit, backhaul, dark fibre and NuWave BYOC. Return JSON only: {"leads":[...]}. Scores must be 65-100.`,user:`Review these public results: ${JSON.stringify(compact)}. Return {"leads":[{"sourceIndex":0,"company":"","website":"","country":"","industry":"","employees":"Unknown","opportunity":"","products":[""],"signal":"","research":"","score":75}]}. Use only supplied evidence.`});
  return (Array.isArray(out.leads)?out.leads:[]).map(x=>{const src=items[Number(x.sourceIndex)]||{}; const score=Math.max(0,Math.min(100,Number(x.score)||0)); return {company:String(x.company||titleToCompany(src.title,src.url)).slice(0,120),website:cleanUrl(x.website||src.url||''),country:String(x.country||guessCountry(`${src.title} ${src.content}`)).slice(0,80),industry:String(x.industry||'Telecommunications prospect').slice(0,180),employees:String(x.employees||'Unknown').slice(0,60),opportunity:String(x.opportunity||'').slice(0,500),products:Array.isArray(x.products)?x.products.map(String).slice(0,10):[],signal:String(x.signal||src.content||'').slice(0,700),research:String(x.research||'').slice(0,1400),score,status:'qualified',sourceUrl:cleanUrl(src.url||x.website||''),contacts:[],selectedContactId:null,subject:'',emailBody:'',createdAt:new Date().toISOString()};}).filter(x=>x.score>=65&&x.company&&x.sourceUrl);
}
async function saveLead(lead){
  if(!supabaseConfig().configured) return lead;
  const domain=domainFromUrl(lead.website||lead.sourceUrl);
  const existing=domain?await supabaseRequest(`companies?select=*&website=ilike.${encodeURIComponent(`%${domain}%`)}&limit=1`):[];
  let row;
  if(existing.length) row=existing[0]; else {
    const body={name:lead.company,website:lead.website||lead.sourceUrl,country:lead.country,industry:lead.industry,employees:lead.employees,opportunity:lead.opportunity,products:lead.products,signal:lead.signal,research:lead.research,score:lead.score,status:lead.status,source_url:lead.sourceUrl};
    const inserted=await supabaseRequest('companies',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)}); row=inserted[0];
  }
  return mapCompanyRow(row,[],null);
}
export default async(request)=>{
  const method=requirePost(request); if(method) return method; const denied=checkAccess(request); if(denied) return denied;
  try{
    const body=await request.json().catch(()=>({})); const key=CAMPAIGNS[body.campaign]?body.campaign:'voice'; const campaign=CAMPAIGNS[key];
    const maximumLeads=Math.max(1,Math.min(20,Number(body.maximumLeads)||10)); const resultsPerQuery=Math.max(2,Math.min(8,Number(body.resultsPerQuery)||5));
    const batches=await Promise.all(campaign.queries.map(q=>tavilySearch(q,resultsPerQuery))); const raw=batches.flat();
    const seen=new Set(); const unique=raw.filter(x=>{const k=cleanUrl(x.url||''); if(!k||seen.has(k)) return false; seen.add(k); return true;});
    let leads,mode='heuristic';
    if(process.env.OPENAI_API_KEY){try{leads=await aiQualify(unique,campaign.label);mode='OpenAI';}catch(e){leads=unique.map(x=>heuristic(x,key)).filter(x=>x.score>=65);mode=`heuristic fallback (${e.message})`;}}
    else leads=unique.map(x=>heuristic(x,key)).filter(x=>x.score>=65);
    const byDomain=new Map(); for(const lead of leads){const k=domainFromUrl(lead.website||lead.sourceUrl)||(lead.company||'').toLowerCase(); if(!byDomain.has(k)||byDomain.get(k).score<lead.score) byDomain.set(k,lead);}
    const chosen=[...byDomain.values()].sort((a,b)=>b.score-a.score).slice(0,maximumLeads); const saved=[]; for(const l of chosen) saved.push(await saveLead(l));
    return corsJson({ok:true,campaign:campaign.label,searchedResults:unique.length,qualifiedLeads:chosen.length,qualificationMode:mode,persistent:supabaseConfig().configured,leads:saved});
  }catch(e){return corsJson({ok:false,error:e.message},500);}
};
