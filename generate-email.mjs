import { corsJson, requirePost, checkAccess, openAIJson, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method = requirePost(request); if (method) return method;
  const denied = checkAccess(request); if (denied) return denied;
  try {
    const b = await request.json();
    if (!b.company) throw new Error('Company is required.');
    let services = [];
    if (supabaseConfig().configured) {
      try { services = await supabaseRequest('services?select=name,category,description&active=eq.true&order=sort_order.asc,name.asc'); } catch {}
    }
    const contact = b.contact?.name ? b.contact : { name: `${b.company} team`, title: 'Relevant decision-maker', email: '' };
    const out = await openAIJson({
      schemaName: 'personalised email',
      system: `You write short, credible first-contact B2B emails for Damien Rodrigo at Symbio Wholesale. Use only supplied facts. Do not claim certainty that the prospect needs a product. Do not invent announcements, customer relationships, savings, network coverage, certifications or product features. Select at most three relevant capabilities from the supplied active service catalogue. Never mention a disabled or unlisted service. NuWave BYOC is allowed; Twilio BYOC must never be mentioned. Use friendly professional New Zealand/Australian business English. 90-150 words excluding signature. One simple call to action. Return JSON only with subject, body, claimsChecked and evidenceUsed.`,
      user: JSON.stringify({
        company: b.company, country: b.country, industry: b.industry, opportunity: b.opportunity,
        productsSuggestedByResearch: b.products, signal: b.signal, research: b.research, sourceUrl: b.sourceUrl,
        contact, activeServiceCatalogue: services,
        sender: { name: 'Damien Rodrigo', company: 'Symbio' },
        instructions: `Make the opening specific but cautious. Address ${contact.name}. End with Kind regards, Damien Rodrigo.`
      })
    });
    const subject = String(out.subject || 'Wholesale telecom support').slice(0, 160);
    const body = String(out.body || '').slice(0, 5000);
    if (!body) throw new Error('AI returned an empty email.');
    let draftId = null;
    if (supabaseConfig().configured && b.id) {
      const rows = await supabaseRequest('email_drafts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ company_id: b.id, contact_id: b.contact?.id || null, subject, body }) });
      draftId = rows[0]?.id || null;
      await supabaseRequest(`companies?id=eq.${encodeURIComponent(b.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'email_ready', updated_at: new Date().toISOString() }) });
    }
    return corsJson({ ok: true, subject, body, draftId, claimsChecked: Boolean(out.claimsChecked), evidenceUsed: out.evidenceUsed || [b.sourceUrl].filter(Boolean) });
  } catch (e) { return corsJson({ ok: false, error: e.message }, 500); }
};
