import { corsJson, requirePost, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method=requirePost(request); if(method)return method;
  const denied=checkAccess(request); if(denied)return denied;
  try {
    if(!supabaseConfig().configured) throw new Error('Supabase is required for the automatic background pipeline.');
    const body=await request.json().catch(()=>({}));
    const rows=await supabaseRequest('search_jobs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
      status:'queued',stage:'queued',progress:0,message:'Search queued',campaign:body.campaign||'voice',
      requested_leads:Math.max(1,Math.min(50,Number(body.maximumLeads)||5)),
      auto_contacts:body.autoContacts!==false,auto_email:body.autoEmail!==false
    })});
    const job=rows[0];
    const origin=new URL(request.url).origin;
    const headers={'Content-Type':'application/json'};
    if(process.env.APP_ACCESS_TOKEN)headers['X-App-Token']=process.env.APP_ACCESS_TOKEN;
    const launch=await fetch(`${origin}/.netlify/functions/full-search-background`,{method:'POST',headers,body:JSON.stringify({...body,jobId:job.id})});
    if(!launch.ok && launch.status!==202){
      const text=await launch.text();
      await supabaseRequest(`search_jobs?id=eq.${job.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'failed',stage:'failed',message:text.slice(0,500),updated_at:new Date().toISOString()})});
      throw new Error(`Could not start background search (${launch.status}).`);
    }
    return corsJson({ok:true,jobId:job.id,message:'Lead, contact and email discovery started.'},202);
  }catch(error){return corsJson({ok:false,error:error.message},500)}
};
