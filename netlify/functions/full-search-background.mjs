import { checkAccess, supabaseRequest } from './_shared.mjs';
import { runDiscovery } from './_discovery-core.mjs';

async function update(jobId,patch){
  await supabaseRequest(`search_jobs?id=eq.${encodeURIComponent(jobId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
}

export default async request => {
  const denied=checkAccess(request); if(denied)return denied;
  const body=await request.json().catch(()=>({}));
  const jobId=body.jobId;
  if(!jobId) return new Response('Missing jobId',{status:400});
  try{
    await update(jobId,{status:'running',stage:'starting',progress:2,message:'Starting automatic pipeline…'});
    const result=await runDiscovery({
      campaignKey:body.campaign,maximumLeads:body.maximumLeads||5,resultsPerQuery:body.resultsPerQuery||4,
      autoContacts:body.autoContacts!==false,autoEmail:body.autoEmail!==false,maximumContacts:body.maximumContacts||1,
      onProgress:async p=>update(jobId,p)
    });
    await update(jobId,{status:'complete',stage:'complete',progress:100,message:`${result.qualifiedLeads} leads, ${result.contactsFound} contacts and ${result.emailsGenerated} emails prepared.`,
      searched_results:result.searchedResults,candidate_companies:result.candidateCompanies,qualified_leads:result.qualifiedLeads,
      contacts_found:result.contactsFound,emails_generated:result.emailsGenerated,completed_at:new Date().toISOString()});
  }catch(error){
    console.error(error); await update(jobId,{status:'failed',stage:'failed',message:error.message||'Background search failed.',error:error.message||'Unknown error'});
  }
};
