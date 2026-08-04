import { corsJson, requirePost, checkAccess, domainFromUrl, randomId, supabaseConfig, supabaseRequest } from './_shared.mjs';

const TITLES=[
 'Carrier Relations Manager','Interconnect Manager','Head of Voice','Head of Telecommunications','Wholesale Manager','Product Manager Voice','Product Manager Mobile','Head of Product','Head of IoT','IoT Product Manager','Network Manager','Infrastructure Manager','Commercial Manager','Vendor Relationship Manager','Procurement Manager','Partnerships Manager','Managing Director','General Manager','Chief Operating Officer','COO','Chief Financial Officer','CFO','Chief Technology Officer','CTO','Chief Executive Officer','CEO','Founder'
];
const PRIORITY=['carrier relations','interconnect','head of voice','wholesale','vendor relationship','commercial manager','head of iot','iot product','product manager','partnerships','network manager','infrastructure manager','managing director','general manager','chief operating','coo','chief technology','cto','chief executive','ceo','chief financial','cfo','founder'];
function roleScore(title=''){const t=title.toLowerCase(); const i=PRIORITY.findIndex(x=>t.includes(x)); return i<0?50:100-i*2;}
async function apollo(path,body){
 const key=process.env.APOLLO_API_KEY; if(!key) throw new Error('APOLLO_API_KEY is not configured.');
 const r=await fetch(`https://api.apollo.io/api/v1/${path}`,{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','X-Api-Key':key},body:JSON.stringify(body)});
 const text=await r.text(); if(!r.ok) throw new Error(`Apollo ${r.status}: ${text.slice(0,700)}`); return JSON.parse(text);
}
async function enrichPerson(person,domain){
  try{
    const data=await apollo('people/match',{id:person.id,domain,reveal_personal_emails:false,reveal_phone_number:false});
    return data.person||person;
  }catch{return person;}
}
export default async(request)=>{
 const method=requirePost(request); if(method)return method; const denied=checkAccess(request);if(denied)return denied;
 try{
  const body=await request.json(); const domain=domainFromUrl(body.website||body.sourceUrl||''); if(!domain) throw new Error('A valid company website is required.');
  const search=await apollo('mixed_people/api_search',{q_organization_domains_list:[domain],person_titles:TITLES,page:1,per_page:15});
  const people=Array.isArray(search.people)?search.people:[];
  const ranked=people.map(p=>({...p,_score:roleScore(p.title||'')})).sort((a,b)=>b._score-a._score).slice(0,Math.max(1,Math.min(3,Number(body.maximumContacts)||3)));
  const enriched=[]; for(const p of ranked) enriched.push(await enrichPerson(p,domain));
  const contacts=enriched.map((p,i)=>({id:p.id||randomId('contact'),name:[p.first_name,p.last_name].filter(Boolean).join(' ')||p.name||'Unknown',title:p.title||'',email:p.email||'',linkedin:p.linkedin_url||'',confidence:p.email_status==='verified'?'Verified':p.email?'Likely':'Unknown',relevance:Math.max(60,roleScore(p.title||'')-i*3),reason:`Selected because the role ${p.title||'identified'} is relevant to telecom supplier, product, network or commercial decisions.`}));
  if(!contacts.length) return corsJson({ok:true,contacts:[],message:'Apollo found no matching contacts for this domain.'});
  if(supabaseConfig().configured&&body.id){
    await supabaseRequest(`contacts?company_id=eq.${encodeURIComponent(body.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
    const rows=contacts.map((c,i)=>({company_id:body.id,name:c.name,title:c.title,email:c.email||null,linkedin:c.linkedin||null,confidence:c.confidence,relevance:c.relevance,reason:c.reason,is_selected:i===0}));
    const inserted=await supabaseRequest('contacts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(rows)});
    return corsJson({ok:true,contacts:inserted.map(c=>({id:c.id,name:c.name,title:c.title,email:c.email||'',linkedin:c.linkedin||'',confidence:c.confidence,relevance:c.relevance,reason:c.reason})),message:`Found ${inserted.length} contact(s).`});
  }
  return corsJson({ok:true,contacts,message:`Found ${contacts.length} contact(s).`});
 }catch(e){return corsJson({ok:false,error:e.message},500);}
};
