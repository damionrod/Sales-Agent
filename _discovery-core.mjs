import {
  corsJson, requirePost, checkAccess, cleanUrl, domainFromUrl,
  openAIJson, supabaseConfig, supabaseRequest, mapCompanyRow, fetchWithTimeout, friendlyExternalError
} from './_shared.mjs';

const CAMPAIGNS = {
  all: { label: 'All active service categories', queries: [] },
  voice: {
    label: 'Voice, DIDs and termination',
    queries: [
      'company expanding cloud communications services into Australia local phone numbers',
      'telecom software company launching New Zealand virtual numbers voice services',
      'CPaaS company expanding into Singapore local numbers voice',
      'contact centre platform APAC expansion carrier partnership',
      'business phone provider entering Australia New Zealand Singapore'
    ]
  },
  mobile: {
    label: 'MVNO, eSIM and IoT SIMs',
    queries: [
      'company launching MVNO in Australia partnership',
      'eSIM company expanding into Australia New Zealand',
      'IoT platform company launching cellular connected devices Australia',
      'fleet telematics company expanding Australia cellular connectivity',
      'retailer launching branded mobile service Australia'
    ]
  },
  data: {
    label: 'DIA, NBN, backhaul and dark fibre',
    queries: [
      'company opening Australian data centre network expansion',
      'managed service provider expanding infrastructure Australia New Zealand',
      'cloud provider Australia dark fibre backhaul expansion',
      'Australian ISP network expansion IP transit backhaul',
      'enterprise opening multiple Australian sites dedicated internet'
    ]
  },
  nuwave: {
    label: 'NuWave BYOC',
    queries: [
      'company using NuWave BYOC APAC',
      'cloud contact centre company expanding Australia New Zealand Singapore BYOC',
      'Microsoft Teams voice provider APAC carrier connectivity',
      'UCaaS provider launching APAC voice services',
      'contact centre platform seeking local carrier Australia'
    ]
  },
  sms: {
    label: 'A2P and two-way SMS',
    queries: [
      'software company launching SMS notifications Australia New Zealand',
      'workflow platform expanding transactional SMS New Zealand',
      'fintech company expanding customer messaging Australia',
      'customer engagement platform entering Australia SMS',
      'two way SMS software company APAC expansion'
    ]
  }
};

const BLOCKED_HOSTS = [
  'linkedin.com', 'facebook.com', 'youtube.com', 'wikipedia.org', 'reddit.com',
  'medium.com', 'substack.com', 'prnewswire.com', 'businesswire.com', 'globenewswire.com',
  'news.google.com', 'techcrunch.com', 'forbes.com', 'reuters.com', 'bloomberg.com',
  'statista.com', 'researchandmarkets.com', 'marketsandmarkets.com', 'indeed.com',
  'seek.com.au', 'glassdoor.com', 'crunchbase.com'
];

function isBlockedHost(url = '') {
  const host = domainFromUrl(url);
  return BLOCKED_HOSTS.some(x => host === x || host.endsWith(`.${x}`));
}

function normaliseOfficialWebsite(value = '') {
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.hostname.replace(/^www\./, '')}/`;
  } catch {
    return '';
  }
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try { results[index] = await worker(items[index], index); }
      catch (error) { results[index] = { __error: error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function tavilySearch(query, maxResults = 5) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not configured.');

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: attempt === 1 ? 'advanced' : 'basic',
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false,
          topic: 'general'
        })
      }, attempt === 1 ? 22000 : 18000);
      const text = await response.text();
      if (!response.ok) throw new Error(`Tavily ${response.status}: ${friendlyExternalError(text, 'The web search provider did not respond.')}`);
      const data = JSON.parse(text);
      return Array.isArray(data.results) ? data.results : [];
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(1200);
    }
  }
  throw lastError || new Error('The web search provider did not respond.');
}

async function extractCompanies(results, campaign) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for accurate company extraction. Without it, article titles can be mistaken for companies.');
  }

  const compact = results.map((r, index) => ({
    index,
    title: String(r.title || '').slice(0, 240),
    url: cleanUrl(r.url || ''),
    snippet: String(r.content || '').slice(0, 1800)
  }));

  const output = await openAIJson({
    schemaName: 'company extraction',
    system: `You are a strict B2B company-identification analyst for Symbio Wholesale.
Campaign: ${campaign.label}.
Active services catalogue: ${campaign.serviceContext || 'Use the standard Symbio capabilities listed below' }.

Your task is to identify ACTUAL POTENTIAL CUSTOMER COMPANIES mentioned in the supplied search evidence.

Strict rules:
- Never use an article headline, report title, blog title, product-page title, event title or search-result title as a company name.
- Reject media publishers, research firms, directories, job boards, government pages and generic informational pages.
- A company must have a clear legal/trading identity and an official corporate website.
- The company must plausibly BUY a Symbio service, not merely be a direct carrier competitor with no buyer signal.
- Do not invent an official website. Return an empty website when it is not supported by evidence.
- Only include a company when the evidence contains a credible signal connected to the campaign.
- Use conservative scoring. Scores below 65 must not be returned.
- Relevant Symbio capabilities include AU/NZ/SG DIDs, voice termination, Australian mobile numbers, A2P/two-way SMS, MVNO enablement, eSIM, IoT SIM, DIA, NBN, OptiComm, IP transit, backhaul, dark fibre and NuWave BYOC.

Return JSON only in this exact shape:
{"companies":[{"company":"","officialWebsite":"","country":"","industry":"","opportunity":"","products":[""],"buyingSignal":"","reason":"","score":75,"sourceIndexes":[0]}]}`,
    user: `Analyse these search results and extract only real potential customer companies:\n${JSON.stringify(compact)}`
  });

  return Array.isArray(output.companies) ? output.companies : [];
}

async function verifyCompany(candidate, sourceResults, campaign) {
  const name = String(candidate.company || '').trim();
  if (!name) return null;

  const claimedWebsite = normaliseOfficialWebsite(candidate.officialWebsite || '');
  const verificationResults = await tavilySearch(`"${name}" official company website ${campaign.label}`, 5);
  const combined = [...verificationResults, ...sourceResults.filter((_, i) => (candidate.sourceIndexes || []).includes(i))]
    .filter(x => x?.url)
    .slice(0, 10)
    .map((r, index) => ({
      index,
      title: String(r.title || '').slice(0, 240),
      url: cleanUrl(r.url || ''),
      snippet: String(r.content || '').slice(0, 1700)
    }));

  const output = await openAIJson({
    schemaName: 'company verification',
    system: `You verify company identities for a B2B sales database.
Return JSON only.
Reject the record unless you can identify the actual company and its official corporate website.
The official website must belong to the company, not a news publisher, app store, directory, social network, report or partner.
Do not infer unsupported facts.
The company must plausibly be a potential buyer for this campaign: ${campaign.label}. Active services: ${campaign.serviceContext || 'standard Symbio services'}.
Return:
{"accepted":true,"company":"","officialWebsite":"https://example.com/","country":"","industry":"","opportunity":"","products":[""],"buyingSignal":"","research":"","score":75,"bestEvidenceUrl":"","rejectionReason":""}`,
    user: `Candidate company: ${name}
Claimed website: ${claimedWebsite || 'not supplied'}
Candidate opportunity: ${candidate.opportunity || ''}
Candidate signal: ${candidate.buyingSignal || ''}
Evidence: ${JSON.stringify(combined)}`
  });

  if (!output.accepted) return null;
  const website = normaliseOfficialWebsite(output.officialWebsite || claimedWebsite);
  if (!website || isBlockedHost(website)) return null;
  const score = Math.max(0, Math.min(100, Number(output.score) || 0));
  if (score < 65) return null;

  const sourceUrl = cleanUrl(output.bestEvidenceUrl || combined[0]?.url || website);
  return {
    company: String(output.company || name).trim().slice(0, 140),
    website,
    country: String(output.country || candidate.country || 'Global').slice(0, 80),
    industry: String(output.industry || candidate.industry || 'Potential wholesale telecommunications prospect').slice(0, 180),
    employees: 'Unknown',
    opportunity: String(output.opportunity || candidate.opportunity || campaign.label).slice(0, 500),
    products: Array.isArray(output.products) ? output.products.map(String).slice(0, 12) : [],
    signal: String(output.buyingSignal || candidate.buyingSignal || '').slice(0, 900),
    research: String(output.research || candidate.reason || '').slice(0, 1800),
    score,
    status: 'qualified',
    sourceUrl,
    contacts: [],
    selectedContactId: null,
    subject: '',
    emailBody: '',
    createdAt: new Date().toISOString()
  };
}

async function findExistingCompany(website) {
  const domain = domainFromUrl(website);
  if (!domain) return [];
  const exact = await supabaseRequest(`companies?select=*&website=eq.${encodeURIComponent(website)}&limit=1`).catch(() => []);
  if (exact.length) return exact;
  return await supabaseRequest(`companies?select=*&website=ilike.${encodeURIComponent(`%${domain}%`)}&limit=1`).catch(() => []);
}

async function saveLead(lead) {
  if (!supabaseConfig().configured) return { ...lead, id: `live-${crypto.randomUUID()}` };
  let existing = await findExistingCompany(lead.website);

  let row;
  const researchBody = {
    name: lead.company,
    website: lead.website,
    country: lead.country,
    industry: lead.industry,
    employees: lead.employees,
    opportunity: lead.opportunity,
    products: lead.products,
    signal: lead.signal,
    research: lead.research,
    score: lead.score,
    source_url: lead.sourceUrl,
    updated_at: new Date().toISOString()
  };

  if (existing.length) {
    // Preserve the user's CRM category and workflow status when refreshing research.
    const updated = await supabaseRequest(`companies?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(researchBody)
    });
    row = updated[0] || existing[0];
  } else {
    try {
      const inserted = await supabaseRequest('companies', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...researchBody, status: lead.status || 'qualified', lead_category: lead.leadCategory || 'other' })
      });
      row = inserted[0];
    } catch (error) {
      // Another batch may have inserted the same website milliseconds earlier.
      if (!String(error.message || '').includes('409')) throw error;
      existing = await findExistingCompany(lead.website);
      if (!existing.length) throw error;
      const updated = await supabaseRequest(`companies?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(researchBody)
      });
      row = updated[0] || existing[0];
    }
  }
  return mapCompanyRow(row, [], null);
}


async function internalJson(handler, path, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.APP_ACCESS_TOKEN) headers['X-App-Token'] = process.env.APP_ACCESS_TOKEN;
  const response = await handler(new Request(`https://internal.local/${path}`, {
    method: 'POST', headers, body: JSON.stringify(payload)
  }));
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { ok: false, error: text }; }
  if (!response.ok || data.ok === false) throw new Error(data.error || `${path} failed (${response.status})`);
  return data;
}

async function activeServices(){
  if(!supabaseConfig().configured) return [];
  try{return await supabaseRequest('services?select=name,category,description&active=eq.true&include_in_all=eq.true&order=sort_order.asc');}
  catch{return [];}
}
function serviceQueries(services){
  const grouped = new Map();
  for (const service of services) {
    const category = service.category || 'Other';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(service.name);
  }
  return [...grouped.entries()].slice(0, 6).map(([category, names]) =>
    `companies expanding or launching ${category} services (${names.slice(0, 5).join(', ')}) in Australia New Zealand Singapore seeking wholesale partners`
  );
}

export async function runDiscovery({
  campaignKey = 'voice', maximumLeads = 10, resultsPerQuery = 5,
  autoContacts = false, autoEmail = false, maximumContacts = 1,
  onProgress = async () => {}
} = {}) {
  const services = await activeServices();
  const baseCampaign = CAMPAIGNS[campaignKey] || CAMPAIGNS.voice;
  const fallbackAll = Object.values(CAMPAIGNS).filter(x => x.queries.length).flatMap(x => x.queries).slice(0, 12);
  const campaign = campaignKey === 'all'
    ? { label: 'All active service categories', queries: serviceQueries(services).length ? serviceQueries(services) : fallbackAll }
    : baseCampaign;
  campaign.serviceContext = services.map(s => `${s.name} (${s.category}): ${s.description || ''}`).join('; ');

  maximumLeads = Math.max(1, Math.min(50, Number(maximumLeads) || 10));
  resultsPerQuery = Math.max(3, Math.min(7, Number(resultsPerQuery) || 5));

  const saved = [];
  const savedDomains = new Set();
  let searchedResults = 0;
  let candidateCompanies = 0;
  let failedSearches = 0;
  let failedExtractionBatches = 0;
  let failedVerifications = 0;

  // Process each query as its own resumable batch. A timeout in one batch no longer
  // cancels companies already saved by earlier batches.
  for (let queryIndex = 0; queryIndex < campaign.queries.length && saved.length < maximumLeads; queryIndex++) {
    const query = campaign.queries[queryIndex];
    const progressBase = Math.round((queryIndex / Math.max(1, campaign.queries.length)) * 85);
    await onProgress({
      stage: 'searching',
      progress: Math.min(90, 5 + progressBase),
      message: `Searching batch ${queryIndex + 1} of ${campaign.queries.length} · ${saved.length} lead(s) saved…`
    });

    let rawResults = [];
    try {
      rawResults = await tavilySearch(query, resultsPerQuery);
    } catch (error) {
      failedSearches++;
      console.warn('Search batch skipped:', query, error.message);
      continue;
    }

    const seenUrls = new Set();
    rawResults = rawResults.filter(result => {
      const url = cleanUrl(result.url || '');
      if (!url || seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });
    searchedResults += rawResults.length;
    if (!rawResults.length) continue;

    let candidates = [];
    try {
      candidates = await extractCompanies(rawResults, campaign);
    } catch (error) {
      failedExtractionBatches++;
      console.warn('Company extraction batch skipped:', error.message);
      continue;
    }
    candidateCompanies += candidates.length;

    const remaining = maximumLeads - saved.length;
    const candidatesToVerify = candidates.slice(0, Math.min(8, Math.max(3, remaining * 2)));
    const verificationResults = await mapLimit(candidatesToVerify, 2, async candidate => {
      try { return await verifyCompany(candidate, rawResults, campaign); }
      catch (error) {
        failedVerifications++;
        console.warn('Company verification skipped:', candidate.company, error.message);
        return null;
      }
    });

    const bestByDomain = new Map();
    for (const lead of verificationResults.filter(Boolean)) {
      const domain = domainFromUrl(lead.website);
      if (!domain || savedDomains.has(domain)) continue;
      const current = bestByDomain.get(domain);
      if (!current || current.score < lead.score) bestByDomain.set(domain, lead);
    }

    const verifiedBatch = [...bestByDomain.values()].sort((a, b) => b.score - a.score);
    for (const lead of verifiedBatch) {
      if (saved.length >= maximumLeads) break;
      try {
        const persisted = await saveLead(lead);
        const domain = domainFromUrl(persisted.website || lead.website);
        if (domain) savedDomains.add(domain);
        // Do not add the same existing company twice to this search response.
        if (!saved.some(x => x.id === persisted.id)) saved.push(persisted);
        await onProgress({
          stage: 'saving',
          progress: Math.min(95, 8 + progressBase),
          message: `Saved ${saved.length} verified lead(s). Continuing search…`
        });
      } catch (error) {
        console.warn('Saving lead skipped:', lead.company, error.message);
      }
    }
  }

  const skipped = failedSearches + failedExtractionBatches + failedVerifications;
  const summary = saved.length
    ? `Completed with ${saved.length} verified lead(s)${skipped ? ` · ${skipped} slow/failed item(s) skipped` : ''}.`
    : `Search completed with no new verified leads${skipped ? ` · ${skipped} slow/failed item(s) skipped` : ''}. Try another category or run again later.`;
  await onProgress({ stage: 'complete', progress: 100, message: summary });

  return {
    campaign: campaign.label,
    searchedResults,
    candidateCompanies,
    qualifiedLeads: saved.length,
    contactsFound: 0,
    emailsGenerated: 0,
    skippedItems: skipped,
    qualificationMode: 'Resumable OpenAI extraction + official website verification',
    persistent: supabaseConfig().configured,
    leads: saved
  };
}
