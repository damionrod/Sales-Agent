import { corsJson, requirePost, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method = requirePost(request);
  if (method) return method;
  const denied = checkAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return corsJson({ ok: false, error: 'Lead ID is required.' }, 400);
    if (supabaseConfig().configured) {
      await supabaseRequest(`companies?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE' });
    }
    return corsJson({ ok: true });
  } catch (error) {
    return corsJson({ ok: false, error: error.message }, 500);
  }
};
