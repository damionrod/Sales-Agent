import { corsJson, requirePost, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

async function graphToken(){
  const tenant=process.env.MICROSOFT_TENANT_ID, client=process.env.MICROSOFT_CLIENT_ID, secret=process.env.MICROSOFT_CLIENT_SECRET;
  if(!tenant||!client||!secret) throw new Error('Microsoft 365 credentials are not configured.');
  const form=new URLSearchParams({client_id:client,client_secret:secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'});
  const r=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  const text=await r.text();if(!r.ok)throw new Error(`Microsoft token ${r.status}: ${text.slice(0,700)}`);return JSON.parse(text).access_token;
}
function htmlBody(text=''){return text.split(/\n/).map(line=>line?`<p>${line.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>`:'<p><br></p>').join('');}
export default async(request)=>{
 const method=requirePost(request);if(method)return method;const denied=checkAccess(request);if(denied)return denied;
 try{
  const b=await request.json();const sender=process.env.MICROSOFT_SENDER_EMAIL;if(!sender)throw new Error('MICROSOFT_SENDER_EMAIL is not configured.');
  if(!b.contact?.email)throw new Error('The selected contact does not have an email address.');if(!b.subject||!b.body)throw new Error('Subject and body are required.');
  const action=b.action==='send'?'send':'draft';if(action==='send'&&String(process.env.ALLOW_DIRECT_SEND).toLowerCase()!=='true')throw new Error('Direct sending is disabled. Set ALLOW_DIRECT_SEND=true only after Symbio IT approval.');
  if(supabaseConfig().configured&&b.id){const rows=await supabaseRequest(`companies?select=status&id=eq.${encodeURIComponent(b.id)}&limit=1`);if(!rows.length)throw new Error('Lead not found in Supabase.');if(action==='send'&&rows[0].status!=='approved')throw new Error('Lead must be approved before direct sending.');}
  const token=await graphToken();const message={subject:b.subject,body:{contentType:'HTML',content:htmlBody(b.body)},toRecipients:[{emailAddress:{address:b.contact.email,name:b.contact.name||''}}]};
  let providerId=null;
  if(action==='draft'){
    const r=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(message)});const text=await r.text();if(!r.ok)throw new Error(`Microsoft Graph ${r.status}: ${text.slice(0,800)}`);providerId=JSON.parse(text).id;
  }else{
    const r=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message,saveToSentItems:true})});const text=await r.text();if(!r.ok)throw new Error(`Microsoft Graph ${r.status}: ${text.slice(0,800)}`);providerId='sent';
  }
  if(supabaseConfig().configured&&b.id){
    const draftPatch={provider_message_id:providerId,updated_at:new Date().toISOString()};if(action==='send')draftPatch.sent_at=new Date().toISOString();
    if(b.draftId)await supabaseRequest(`email_drafts?id=eq.${encodeURIComponent(b.draftId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(draftPatch)});
    if(action==='send')await supabaseRequest(`companies?id=eq.${encodeURIComponent(b.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'sent',updated_at:new Date().toISOString()})});
  }
  return corsJson({ok:true,action,providerMessageId:providerId,message:action==='draft'?'Outlook draft created.':'Email sent through Outlook.'});
 }catch(e){return corsJson({ok:false,error:e.message},500);}
};
