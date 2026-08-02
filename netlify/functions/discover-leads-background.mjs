import {
  checkAccess, cleanUrl, domainFromUrl, openAIJson,
  supabaseConfig, supabaseRequest, mapCompanyRow
} from './_shared.mjs';

const CAMPAIGNS = {
  all: { label: 'All active product categories', focus: 'all active Symbio Wholesale services across voice, numbering, messaging, mobile, eSIM, IoT, MVNO, data connectivity, IP transit, backhaul, dark fibre and NuWave BYOC' },
  voice: { label: 'Voice, DIDs and termination', focus: 'cloud communications, UCaaS, CPaaS, VoIP, contact centres, international carriers and communications software expanding into Australia, New Zealand or Singapore' },
  sms: { label: 'A2P and two-way SMS', focus: 'customer engagement, fintech, SaaS, logistics, healthcare, marketplaces and communications platforms needing business messaging in Australia, New Zealand or Singapore' },
  mobile: { label: 'MVNO, eSIM and IoT SIMs', focus: 'brands launching mobile services, eSIM platforms, IoT companies, fleet tracking, telematics, connected devices and travel connectivity businesses' },
  data: { label: 'DIA, NBN, backhaul and dark fibre', focus: 'MSPs, ISPs, cloud providers, data centres, system integrators and enterprises opening or expanding Australian network locations' },
  nuwave: { label: 'NuWave BYOC', focus: 'Microsoft Teams voice, UCaaS and cloud communications providers needing carrier connectivity across APAC' }
};

const BLOCKED = ['linkedin.com','facebook.com','youtube.com','wikipedia.org','reddit.com','medium.com','substack.com','prnewswire.com','businesswire.com','globenewswire.com','reuters.com','bloomberg.com','forbes.com','techcrunch.com','statista.com','researchandmarkets.com','marketsandmarkets.com','indeed.com','seek.com.au','glassdoor.com','crunchbase.com'];
const blockedHost = url => { const host = domainFromUrl(url); return BLOCKED.some(x => host === x || host.endsWith(`.${x}`)); };
const officialUrl = value => { try { const u = new URL(value); return `https://${u.hostname.replace(/^www\./, '')}/`; } catch { return ''; } };

async function updateJob(id, patch) {
  await supabaseRequest(`search_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
}

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function tavily(query, maxResults) {
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: maxResults, include_answer: false, include_raw_content: false, topic: 'general' })
  }, 35000);
  const text = await response.text();
  if (!response.ok) throw new Error(`Tavily ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text).results || [];
}

async function activeServices() {
  try {
    const rows = await supabaseRequest('services?select=name,category,description&active=eq.true&order=sort_order.asc,name.asc');
    return rows || [];
  } catch { return []; }
}

async function buildQueries(campaign, services) {
  const serviceText = services.map(s => `${s.name} (${s.category})`).join(', ');
  try {
    const out = await openAIJson({
      schemaName: 'lead search queries',
      system: `Create 12 concise web search queries for B2B lead discovery. Find actual company websites and strong recent buying signals, not directories or generic articles. Campaign: ${campaign.label}. Focus: ${campaign.focus}. Available services: ${serviceText}. Prioritise Australia, New Zealand and Singapore, then global companies expanding into those markets. Return JSON only: {"queries":["..."]}. Never include Twilio BYOC; NuWave BYOC is allowed.`,
      user: 'Generate the search queries.'
    });
    const queries = Array.isArray(out.queries) ? out.queries.map(String).filter(Boolean).slice(0, 12) : [];
    if (queries.length >= 6) return queries;
  } catch (error) { console.warn('Dynamic query generation failed:', error.message); }
  return [
    `companies expanding into Australia ${campaign.label}`,
    `companies expanding into New Zealand ${campaign.label}`,
    `companies expanding into Singapore ${campaign.label}`,
    `${campaign.focus} company official website Australia`,
    `${campaign.focus} company official website New Zealand`,
    `${campaign.focus} company official website Singapore`,
    `recent product launch APAC ${campaign.label} company`,
    `hiring carrier partnerships APAC company`,
    `telecommunications partnership Australia company expansion`,
    `cloud communications APAC expansion official company`,
    `wholesale telecom services Australia New Zealand Singapore company`,
    `international communications provider entering APAC company`
  ];
}

async function extractBatch(results, campaign, services, offset) {
  const compact = results.map((r, index) => ({ index: offset + index, title: String(r.title || '').slice(0, 220), url: cleanUrl(r.url || ''), snippet: String(r.content || '').slice(0, 1000) }));
  const serviceText = services.map(s => s.name).join(', ');
  const out = await openAIJson({
    schemaName: 'verified company extraction',
    system: `Identify genuine potential customer organisations for Symbio Wholesale from web results. Campaign: ${campaign.label}. Active services: ${serviceText}.
Reject article headlines, publishers, media sites, reports, directories, social networks, job boards, government pages and unsupported claims. A company is accepted only when an official corporate website URL is present in the supplied results. The officialWebsite domain must match one of the supplied result URLs. Do not invent a website or buying signal. Return JSON only: {"companies":[{"company":"","officialWebsite":"https://example.com/","country":"","industry":"","opportunity":"","products":[""],"buyingSignal":"","research":"","score":75,"sourceIndex":0}]}. Omit scores below 65. Never mention Twilio BYOC.`,
    user: JSON.stringify(compact)
  });
  return Array.isArray(out.companies) ? out.companies : [];
}

function validateCandidate(candidate, allResults, campaign) {
  const website = officialUrl(candidate.officialWebsite || '');
  const company = String(candidate.company || '').trim();
  const score = Math.max(0, Math.min(100, Number(candidate.score) || 0));
  if (!company || !website || score < 65 || blockedHost(website)) return null;
  const websiteDomain = domainFromUrl(website);
  const sourceIndex = Number(candidate.sourceIndex);
  const source = Number.isInteger(sourceIndex) ? allResults[sourceIndex] : null;
  const matchingResult = allResults.find(r => domainFromUrl(r.url || '') === websiteDomain);
  if (!matchingResult) return null;
  const evidence = source || matchingResult;
  return {
    company: company.slice(0, 140), website,
    country: String(candidate.country || 'Global').slice(0, 80),
    industry: String(candidate.industry || 'Telecommunications prospect').slice(0, 180),
    employees: 'Unknown',
    opportunity: String(candidate.opportunity || campaign.label).slice(0, 500),
    products: Array.isArray(candidate.products) ? candidate.products.map(String).slice(0, 12) : [],
    signal: String(candidate.buyingSignal || '').slice(0, 900),
    research: String(candidate.research || '').slice(0, 1800),
    score, status: 'qualified', leadCategory: 'other', sourceUrl: cleanUrl(evidence?.url || website),
    contacts: [], selectedContactId: null, subject: '', emailBody: '', createdAt: new Date().toISOString()
  };
}

async function saveLead(lead) {
  const domain = domainFromUrl(lead.website);
  const existing = await supabaseRequest(`companies?select=*&website=ilike.${encodeURIComponent(`%${domain}%`)}&limit=1`);
  const body = { name: lead.company, website: lead.website, country: lead.country, industry: lead.industry, employees: lead.employees, opportunity: lead.opportunity, products: lead.products, signal: lead.signal, research: lead.research, score: lead.score, status: lead.status, lead_category: lead.leadCategory || 'other', source_url: lead.sourceUrl, updated_at: new Date().toISOString() };
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
    const services = await activeServices();
    const queries = await buildQueries(campaign, services);

    await updateJob(jobId, { status: 'running', stage: 'Searching public sources', progress: 5 });
    const batches = [];
    for (let i = 0; i < queries.length; i++) {
      try { batches.push(await tavily(queries[i], job.results_per_query || 10)); }
      catch (error) { console.warn(`Tavily query ${i + 1} skipped:`, error.message); }
      await updateJob(jobId, { stage: `Searching public sources (${i + 1}/${queries.length})`, progress: 5 + Math.round(((i + 1) / queries.length) * 35) });
    }
    const seen = new Set();
    const raw = batches.flat().filter(r => { const url = cleanUrl(r.url || ''); if (!url || blockedHost(url) || seen.has(url)) return false; seen.add(url); return true; });
    await updateJob(jobId, { searched_results: raw.length, stage: 'Identifying and verifying real companies', progress: 45 });

    const candidates = [];
    const chunkSize = 25;
    for (let start = 0; start < raw.length; start += chunkSize) {
      const chunk = raw.slice(start, start + chunkSize);
      try { candidates.push(...await extractBatch(chunk, campaign, services, start)); }
      catch (error) { console.warn('Company extraction batch skipped:', error.message); }
      await updateJob(jobId, { candidate_companies: candidates.length, stage: `Analysing company evidence (${Math.min(raw.length, start + chunkSize)}/${raw.length})`, progress: 45 + Math.round((Math.min(raw.length, start + chunkSize) / Math.max(1, raw.length)) * 35) });
    }

    const accepted = candidates.map(c => validateCandidate(c, raw, campaign)).filter(Boolean);
    const deduped = new Map();
    for (const lead of accepted) { const domain = domainFromUrl(lead.website); const old = deduped.get(domain); if (domain && (!old || old.score < lead.score)) deduped.set(domain, lead); }
    const chosen = [...deduped.values()].sort((a, b) => b.score - a.score).slice(0, Math.min(50, job.maximum_leads || 50));
    await updateJob(jobId, { stage: 'Saving verified leads', progress: 85, candidate_companies: deduped.size });
    const saved = [];
    for (let i = 0; i < chosen.length; i++) {
      try { saved.push(await saveLead(chosen[i])); } catch (error) { console.warn('Lead save skipped:', error.message); }
      await updateJob(jobId, { stage: `Saving verified leads (${i + 1}/${chosen.length})`, progress: 85 + Math.round(((i + 1) / Math.max(1, chosen.length)) * 14), qualified_leads: saved.length });
    }
    await updateJob(jobId, { status: 'completed', stage: 'Search complete', progress: 100, qualified_leads: saved.length, completed_at: new Date().toISOString(), result_summary: { leadIds: saved.map(x => x.id), campaign: campaign.label, requested: job.maximum_leads, activeServices: services.map(s => s.name) } });
  } catch (error) {
    console.error(error);
    if (jobId) { try { await updateJob(jobId, { status: 'failed', stage: 'Search failed', error: error.message || 'Unknown error', completed_at: new Date().toISOString() }); } catch {} }
  }
};
