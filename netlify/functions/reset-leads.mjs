import { corsJson, requirePost, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method = requirePost(request);
  if (method) return method;
  const denied = checkAccess(request);
  if (denied) return denied;
  try {
    if (!supabaseConfig().configured) return corsJson({ ok: true, message: 'Browser data can be cleared locally.' });
    await supabaseRequest('companies?id=not.is.null', { method: 'DELETE' });
    return corsJson({ ok: true, message: 'All lead records were removed.' });
  } catch (error) {
    return corsJson({ ok: false, error: error.message }, 500);
  }
};
