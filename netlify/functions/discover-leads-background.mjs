import {
  checkAccess, cleanUrl, domainFromUrl, openAIJson,
  supabaseConfig, supabaseRequest, mapCompanyRow
} from './_shared.mjs';

const CAMPAIGNS = {
  voice: { label: 'Voice, DIDs and termination', queries: [
    'cloud communications company expanding into Australia local phone numbers',
    'business phone provider launching New Zealand virtual numbers',
    'CPaaS company expanding into Singapore local numbers voice'
  ]},
  sms: { label: 'A2P and two-way SMS', queries: [
    'customer engagement platform expanding transactional SMS Australia',
    'software company launching two way SMS New Zealand',
    'fintech customer messaging platform expanding APAC'
  ]},
  mobile: { label: 'MVNO, eSIM and IoT SIMs', queries: [
    'company launching MVNO Australia partnership',
    'eSIM company expanding Australia New Zealand',
    'IoT platform cellular connectivity Australia expansion'
  ]},
  data: { label: 'DIA, NBN, backhaul and dark fibre', queries: [
    'company opening Australian data centre network expansion',
    'managed service provider expanding infrastructure Australia',
    'cloud provider Australia dark fibre backhaul expansion'
  ]},
  nuwave: { label: 'NuWave BYOC', queries: [
    'NuWave BYOC APAC company',
    'Microsoft Teams voice provider APAC carrier connectivity',
    'UCaaS provider launching Australia New Zealand voice services'
  ]}
};

const BLOCKED = ['linkedin.com','facebook.com','youtube.com','wikipedia.org','reddit.com','medium.com','substack.com','prnewswire.com','businesswire.com','globenewswire.com','reuters.com','bloomberg.com','forbes.com','techcrunch.com','statista.com','researchandmarkets.com','marketsandmarkets.com','indeed.com','seek.com.au','glassdoor.com','crunchbase.com'];

const blockedHost = url => {
  const host = domainFromUrl(url);
  return BLOCKED.some(x => host === x || host.endsWith(`.${x}`));
};
const officialUrl = value => {
  try { const u = new URL(value); return `https://${u.hostname.replace(/^www\./, '')}/`; }
  catch { return ''; }
};

async function updateJob(id, patch) {
  await supabaseRequest(`search_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
}

async function tavily(query, maxResults) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: maxResults, include_answer: false, include_raw_content: false, topic: 'general' })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tavily ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text).results || [];
}

async function extractCompanies(results, campaign) {
  const compact = results.map((r, index) => ({ index, title: String(r.title || '').slice(0, 220), url: cleanUrl(r.url || ''), snippet: String(r.content || '').slice(0, 1200) }));
  const out = await openAIJson({
    schemaName: 'company extraction',
    system: `Identify real potential customer companies for Symbio Wholesale. Campaign: ${campaign.label}.
Reject article titles, reports, publishers, directories, job boards, government pages and social networks.
Only return genuine organisations with evidence of a plausible buying signal. Do not invent websites or needs.
Symbio services include AU/NZ/SG DIDs, call termination, Australian mobile numbers, A2P/two-way SMS, MVNO enablement, eSIM, IoT SIM, DIA, NBN, OptiComm, IP transit, backhaul, dark fibre and NuWave BYOC. Never mention Twilio BYOC.
Return JSON only: {"companies":[{"company":"","officialWebsite":"","country":"","industry":"","opportunity":"","products":[""],"buyingSignal":"","reason":"","score":75,"sourceIndexes":[0]}]}. Scores below 65 must be omitted.`,
    user: JSON.stringify(compact)
  });
  return Array.isArray(out.companies) ? out.companies : [];
}

async function verify(candidate, sources, campaign) {
  const name = String(candidate.company || '').trim();
  if (!name) return null;
  const claimed = officialUrl(candidate.officialWebsite || '');
  const checks = await tavily(`"${name}" official company website ${campaign.label}`, 3);
  const evidence = [...checks, ...sources.filter((_, i) => (candidate.sourceIndexes || []).includes(i))].slice(0, 7).map((r, index) => ({ index, title: String(r.title || '').slice(0, 220), url: cleanUrl(r.url || ''), snippet: String(r.content || '').slice(0, 1200) }));
  const out = await openAIJson({
    schemaName: 'company verification',
    system: `Verify a B2B company lead. Accept only if the actual company and its official corporate website are supported by evidence. Reject publishers, directories, social pages, reports and unsupported claims. Campaign: ${campaign.label}. Return JSON only: {"accepted":true,"company":"","officialWebsite":"https://example.com/","country":"","industry":"","opportunity":"","products":[""],"buyingSignal":"","research":"","score":75,"bestEvidenceUrl":"","rejectionReason":""}.`,
    user: JSON.stringify({ candidate, claimedWebsite: claimed, evidence })
  });
  if (!out.accepted) return null;
  const website = officialUrl(out.officialWebsite || claimed);
  const score = Math.max(0, Math.min(100, Number(out.score) || 0));
  if (!website || blockedHost(website) || score < 65) return null;
  return {
    company: String(out.company || name).slice(0, 140), website,
    country: String(out.country || candidate.country || 'Global').slice(0, 80),
    industry: String(out.industry || candidate.industry || 'Telecommunications prospect').slice(0, 180),
    employees: 'Unknown', opportunity: String(out.opportunity || candidate.opportunity || campaign.label).slice(0, 500),
    products: Array.isArray(out.products) ? out.products.map(String).slice(0, 12) : [],
    signal: String(out.buyingSignal || candidate.buyingSignal || '').slice(0, 900),
    research: String(out.research || candidate.reason || '').slice(0, 1800),
    score, status: 'qualified', sourceUrl: cleanUrl(out.bestEvidenceUrl || evidence[0]?.url || website),
    contacts: [], selectedContactId: null, subject: '', emailBody: '', createdAt: new Date().toISOString()
  };
}

async function saveLead(lead) {
  const domain = domainFromUrl(lead.website);
  const existing = await supabaseRequest(`companies?select=*&website=ilike.${encodeURIComponent(`%${domain}%`)}&limit=1`);
  const body = { name: lead.company, website: lead.website, country: lead.country, industry: lead.industry, employees: lead.employees, opportunity: lead.opportunity, products: lead.products, signal: lead.signal, research: lead.research, score: lead.score, status: lead.status, source_url: lead.sourceUrl, updated_at: new Date().toISOString() };
  const rows = existing.length
    ? await supabaseRequest(`companies?id=eq.${existing[0].id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) })
    : await supabaseRequest('companies', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
  return mapCompanyRow(rows[0] || existing[0], [], null);
}

export default async request => {
  if (request.method === 'OPTIONS') return new Response('', { status: 204 });
  const denied = checkAccess(request); if (denied) return denied;
  let jobId = '';
  try {
    if (!supabaseConfig().configured) throw new Error('Supabase is not configured.');
    const body = await request.json().catch(() => ({}));
    jobId = String(body.jobId || '');
    if (!jobId) throw new Error('Search job id is required.');
    const jobs = await supabaseRequest(`search_jobs?id=eq.${encodeURIComponent(jobId)}&select=*&limit=1`);
    const job = jobs?.[0]; if (!job) throw new Error('Search job was not found.');
    const campaign = CAMPAIGNS[job.campaign] || CAMPAIGNS.voice;

    await updateJob(jobId, { status: 'running', stage: 'Searching public sources', progress: 8 });
    const batches = [];
    for (let i = 0; i < campaign.queries.length; i++) {
      batches.push(await tavily(campaign.queries[i], job.results_per_query || 3));
      await updateJob(jobId, { stage: `Searching public sources (${i + 1}/${campaign.queries.length})`, progress: 12 + Math.round(((i + 1) / campaign.queries.length) * 23) });
    }
    const seen = new Set();
    const raw = batches.flat().filter(r => { const url = cleanUrl(r.url || ''); if (!url || seen.has(url)) return false; seen.add(url); return true; });
    await updateJob(jobId, { searched_results: raw.length, stage: 'Identifying real companies', progress: 42 });
    const candidates = await extractCompanies(raw, campaign);
    await updateJob(jobId, { candidate_companies: candidates.length, stage: 'Verifying official company websites', progress: 55 });

    const accepted = [];
    const limit = Math.min(candidates.length, Math.max(3, (job.maximum_leads || 3) * 2));
    for (let i = 0; i < limit; i++) {
      try { const lead = await verify(candidates[i], raw, campaign); if (lead) accepted.push(lead); }
      catch (e) { console.warn('Verification skipped:', e.message); }
      await updateJob(jobId, { stage: `Verifying companies (${i + 1}/${limit})`, progress: 55 + Math.round(((i + 1) / Math.max(1, limit)) * 30) });
    }

    const deduped = new Map();
    for (const lead of accepted) { const domain = domainFromUrl(lead.website); const old = deduped.get(domain); if (domain && (!old || old.score < lead.score)) deduped.set(domain, lead); }
    const chosen = [...deduped.values()].sort((a, b) => b.score - a.score).slice(0, job.maximum_leads || 3);
    await updateJob(jobId, { stage: 'Saving verified leads', progress: 90 });
    const saved = [];
    for (const lead of chosen) saved.push(await saveLead(lead));
    await updateJob(jobId, { status: 'completed', stage: 'Search complete', progress: 100, qualified_leads: saved.length, completed_at: new Date().toISOString(), result_summary: { leadIds: saved.map(x => x.id), campaign: campaign.label } });
  } catch (error) {
    console.error(error);
    if (jobId) {
      try { await updateJob(jobId, { status: 'failed', stage: 'Search failed', error: error.message || 'Unknown error', completed_at: new Date().toISOString() }); } catch {}
    }
  }
};
