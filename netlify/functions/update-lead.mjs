import { corsJson, requirePost, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';
const ALLOWED=new Set(['new','qualified','email_ready','approved','sent','replied','held','rejected']);
export default async(request)=>{
 const method=requirePost(request);if(method)return method;const denied=checkAccess(request);if(denied)return denied;
 try{
  const b=await request.json(); if(!b.id) throw new Error('Lead id is required.');
  if(!supabaseConfig().configured) return corsJson({ok:true,persistent:false});
  const patch={updated_at:new Date().toISOString()};
  if(b.status){if(!ALLOWED.has(b.status)) throw new Error('Invalid status.');patch.status=b.status;}
  if(typeof b.subject==='string'||typeof b.body==='string'){
    if(b.draftId) await supabaseRequest(`email_drafts?id=eq.${encodeURIComponent(b.draftId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({subject:b.subject||'',body:b.body||'',approved_at:b.status==='approved'?new Date().toISOString():null,updated_at:new Date().toISOString()})});
    else if(b.subject||b.body){const rows=await supabaseRequest('email_drafts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({company_id:b.id,contact_id:b.contactId||null,subject:b.subject||'',body:b.body||'',approved_at:b.status==='approved'?new Date().toISOString():null})});b.draftId=rows[0]?.id;}
  }
  await supabaseRequest(`companies?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
  if(b.contactId){await supabaseRequest(`contacts?company_id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_selected:false})});await supabaseRequest(`contacts?id=eq.${encodeURIComponent(b.contactId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_selected:true})});}
  return corsJson({ok:true,persistent:true,draftId:b.draftId||null});
 }catch(e){return corsJson({ok:false,error:e.message},500);}
};
