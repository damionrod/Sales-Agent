import { corsJson, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  if (request.method === 'OPTIONS') return corsJson({ ok: true });
  if (request.method !== 'GET') return corsJson({ ok: false, error: 'Use GET.' }, 405);
  const denied = checkAccess(request);
  if (denied) return denied;

  try {
    if (!supabaseConfig().configured) throw new Error('Supabase is not configured.');
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('Search job id is required.');
    const rows = await supabaseRequest(`search_jobs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (!rows?.length) return corsJson({ ok: false, error: 'Search job was not found.' }, 404);
    return corsJson({ ok: true, job: rows[0] });
  } catch (error) {
    return corsJson({ ok: false, error: error.message || 'Could not read search status.' }, 500);
  }
};
