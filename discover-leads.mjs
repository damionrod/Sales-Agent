import { corsJson, requirePost, checkAccess } from './_shared.mjs';
import { runDiscovery } from './_discovery-core.mjs';
export default async request => {
  const method=requirePost(request); if(method)return method;
  const denied=checkAccess(request); if(denied)return denied;
  try {
    const body=await request.json().catch(()=>({}));
    const result=await runDiscovery({
      campaignKey: body.campaign,
      maximumLeads: body.maximumLeads,
      resultsPerQuery: body.resultsPerQuery,
      autoContacts: body.autoContacts !== false,
      autoEmail: body.autoEmail !== false,
      maximumContacts: body.maximumContacts || 1
    });
    return corsJson({ok:true,...result});
  } catch(error) {
    console.error(error); return corsJson({ok:false,error:error.message||'Lead discovery failed.'},500);
  }
};
