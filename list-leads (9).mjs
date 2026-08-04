import { corsJson, checkAccess, supabaseConfig, supabaseRequest, mapCompanyRow } from './_shared.mjs';
export default async (request) => {
  if (request.method === 'OPTIONS') return corsJson({ ok: true });
  const denied = checkAccess(request); if (denied) return denied;
  if (request.method !== 'GET') return corsJson({ ok: false, error: 'Use GET.' }, 405);
  if (!supabaseConfig().configured) return corsJson({ ok: true, configured: false, leads: [] });
  try {
    const companies = await supabaseRequest('companies?select=*&order=created_at.desc&limit=250');
    const ids = companies.map(c => c.id);
    let contacts = [], drafts = [];
    if (ids.length) {
      const idFilter = `in.(${ids.join(',')})`;
      contacts = await supabaseRequest(`contacts?select=*&company_id=${encodeURIComponent(idFilter)}&order=relevance.desc`);
      drafts = await supabaseRequest(`email_drafts?select=*&company_id=${encodeURIComponent(idFilter)}&order=created_at.desc`);
    }
    const leads = companies.map(c => mapCompanyRow(c, contacts.filter(x => x.company_id === c.id), drafts.find(x => x.company_id === c.id)));
    return corsJson({ ok: true, configured: true, leads });
  } catch (error) { return corsJson({ ok: false, error: error.message }, 500); }
};
