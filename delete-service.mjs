import { corsJson, requirePost, checkAccess, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method = requirePost(request); if (method) return method;
  const denied = checkAccess(request); if (denied) return denied;
  try {
    const body = await request.json();
    if (!body.id) throw new Error('Service id is required.');
    await supabaseRequest(`services?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return corsJson({ ok: true });
  } catch (error) { return corsJson({ ok: false, error: error.message }, 500); }
};
