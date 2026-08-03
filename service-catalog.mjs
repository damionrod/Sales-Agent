import { corsJson, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

const DEFAULTS = [
  ['Virtual Numbers / DIDs','Voice & Numbering','AU, NZ and Singapore virtual numbers and DIDs'],
  ['Call Termination','Voice & Numbering','Inbound and outbound call termination in AU, NZ and Singapore'],
  ['Australian Mobile Numbers','Mobile','Australian mobile numbering and porting'],
  ['A2P / Two-way SMS','Messaging','A2P, transactional and two-way SMS'],
  ['MVNO Enablement','Mobile','Australian MVNO and mobile wholesale enablement'],
  ['eSIMs','Mobile','eSIM connectivity and enablement'],
  ['IoT SIMs','Mobile','IoT and connected-device SIM connectivity'],
  ['DIA / NBN / OptiComm','Data','Dedicated internet, NBN and OptiComm connectivity'],
  ['IP Transit / Backhaul / Dark Fibre','Data','IP transit, backhaul and dark fibre'],
  ['NuWave BYOC','Cloud & Carrier','NuWave BYOC and carrier interconnect opportunities']
];

async function ensureDefaults(){
  const existing = await supabaseRequest('services?select=id&limit=1');
  if(existing.length) return;
  await supabaseRequest('services',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(DEFAULTS.map((x,i)=>({name:x[0],category:x[1],description:x[2],active:true,include_in_all:true,sort_order:i+1})))});
}

export default async request => {
  if(request.method==='OPTIONS') return corsJson({ok:true});
  const denied=checkAccess(request); if(denied) return denied;
  try{
    if(!supabaseConfig().configured) return corsJson({ok:true,configured:false,services:DEFAULTS.map((x,i)=>({id:`default-${i}`,name:x[0],category:x[1],description:x[2],active:true,include_in_all:true,sort_order:i+1}))});
    await ensureDefaults();
    if(request.method==='GET'){
      const services=await supabaseRequest('services?select=*&order=sort_order.asc,name.asc');
      return corsJson({ok:true,configured:true,services});
    }
    if(request.method!=='POST') return corsJson({ok:false,error:'Use GET or POST.'},405);
    const b=await request.json();
    if(b.action==='delete'){
      if(!b.id) throw new Error('Service id is required.');
      await supabaseRequest(`services?id=eq.${encodeURIComponent(b.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
    } else if(b.action==='save'){
      const row={name:String(b.name||'').trim(),category:String(b.category||'Other').trim(),description:String(b.description||'').trim(),active:b.active!==false,include_in_all:b.includeInAll!==false,sort_order:Number(b.sortOrder)||100,updated_at:new Date().toISOString()};
      if(!row.name) throw new Error('Service name is required.');
      if(b.id){
        await supabaseRequest(`services?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
      } else {
        await supabaseRequest('services',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
      }
    } else throw new Error('Unknown service action.');
    const services=await supabaseRequest('services?select=*&order=sort_order.asc,name.asc');
    return corsJson({ok:true,services});
  }catch(error){return corsJson({ok:false,error:error.message},500)}
};
