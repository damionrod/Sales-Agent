import { corsJson, requirePost, checkAccess, supabaseConfig, supabaseRequest } from './_shared.mjs';

export default async request => {
  const method = requirePost(request);
  if (method) return method;
  const denied = checkAccess(request);
  if (denied) return denied;

  try {
    if (!supabaseConfig().configured) {
      throw new Error('Supabase is required for background searches. Add SUPABASE_URL and SUPABASE_SECRET_KEY.');
    }
    if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY is not configured.');
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');

    const body = await request.json().catch(() => ({}));
    const campaign = ['voice', 'sms', 'mobile', 'data', 'nuwave'].includes(body.campaign) ? body.campaign : 'voice';
    const maximumLeads = Math.max(1, Math.min(50, Number(body.maximumLeads) || 50));
    const resultsPerQuery = Math.max(3, Math.min(10, Number(body.resultsPerQuery) || 10));

    const rows = await supabaseRequest('search_jobs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        campaign,
        status: 'queued',
        stage: 'Waiting to start',
        progress: 0,
        maximum_leads: maximumLeads,
        results_per_query: resultsPerQuery,
        searched_results: 0,
        candidate_companies: 0,
        qualified_leads: 0
      })
    });

    const job = rows?.[0];
    if (!job?.id) throw new Error('Could not create the background search job.');

    return corsJson({ ok: true, jobId: job.id, status: job.status, message: 'Search job created.' }, 202);
  } catch (error) {
    console.error(error);
    return corsJson({ ok: false, error: error.message || 'Could not start search.' }, 500);
  }
};
