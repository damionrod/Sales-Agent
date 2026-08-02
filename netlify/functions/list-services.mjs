import { corsJson, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  if (request.method === 'OPTIONS') return corsJson({ ok: true });
  const denied = checkAccess(request); if (denied) return denied;
  if (request.method !== 'GET') return corsJson({ ok: false, error: 'Use GET.' }, 405);
  if (!supabaseConfig().configured) return corsJson({ ok: true, configured: false, services: [] });
  try {
    const services = await supabaseRequest('services?select=*&order=sort_order.asc,name.asc');
    return corsJson({ ok: true, configured: true, services });
  } catch (error) { return corsJson({ ok: false, error: error.message }, 500); }
};
