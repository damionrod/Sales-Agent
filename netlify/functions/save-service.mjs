import { corsJson, requirePost, checkAccess, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method = requirePost(request); if (method) return method;
  const denied = checkAccess(request); if (denied) return denied;
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) throw new Error('Service name is required.');
    const payload = {
      name: name.slice(0, 160),
      category: String(body.category || 'Other').trim().slice(0, 100),
      description: String(body.description || '').trim().slice(0, 1000),
      active: body.active !== false,
      sort_order: Math.max(0, Math.min(9999, Number(body.sort_order) || 100)),
      updated_at: new Date().toISOString()
    };
    let rows;
    if (body.id) {
      rows = await supabaseRequest(`services?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
    } else {
      rows = await supabaseRequest('services', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
    }
    return corsJson({ ok: true, service: rows?.[0] });
  } catch (error) { return corsJson({ ok: false, error: error.message }, 500); }
};
