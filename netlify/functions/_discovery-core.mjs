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

async function tavilySearch(query, maxResults = 5) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not configured.');
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      topic: 'general'
    })
  }, 30000);
  const text = await response.text();
  if (!response.ok) throw new Error(`Tavily ${response.status}: ${friendlyExternalError(text, 'The web search provider timed out.')}`);
  const data = JSON.parse(text);
  return Array.isArray(data.results) ? data.results : [];
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

async function saveLead(lead) {
  if (!supabaseConfig().configured) return { ...lead, id: `live-${crypto.randomUUID()}` };
  const domain = domainFromUrl(lead.website);
  const existing = domain
    ? await supabaseRequest(`companies?select=*&website=ilike.${encodeURIComponent(`%${domain}%`)}&limit=1`)
    : [];

  let row;
  const body = {
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
    status: lead.status,
    source_url: lead.sourceUrl,
    updated_at: new Date().toISOString()
  };

  if (existing.length) {
    const updated = await supabaseRequest(`companies?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    row = updated[0] || existing[0];
  } else {
    const inserted = await supabaseRequest('companies', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    row = inserted[0];
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
  return services.slice(0,12).map(s=>`company expanding or launching ${s.name} services in Australia New Zealand Singapore wholesale partner`);
}

export async function runDiscovery({
  campaignKey = 'voice', maximumLeads = 5, resultsPerQuery = 5,
  autoContacts = true, autoEmail = true, maximumContacts = 1,
  onProgress = async () => {}
} = {}) {
  const services = await activeServices();
  const baseCampaign = CAMPAIGNS[campaignKey] || CAMPAIGNS.voice;
  const campaign = campaignKey==='all' ? {label:'All active service categories',queries:serviceQueries(services).length?serviceQueries(services):Object.values(CAMPAIGNS).filter(x=>x.queries.length).flatMap(x=>x.queries).slice(0,12)} : baseCampaign;
  campaign.serviceContext = services.map(s=>`${s.name} (${s.category}): ${s.description||''}`).join('; ');
  maximumLeads = Math.max(1, Math.min(50, Number(maximumLeads) || 5));
  resultsPerQuery = Math.max(3, Math.min(7, Number(resultsPerQuery) || 5));

  await onProgress({ stage: 'searching', progress: 8, message: 'Searching public sources…' });
  const batches = await Promise.all(campaign.queries.map(query => tavilySearch(query, resultsPerQuery)));
  const seen = new Set();
  const rawResults = batches.flat().filter(result => {
    const url = cleanUrl(result.url || '');
    if (!url || seen.has(url)) return false;
    seen.add(url); return true;
  });

  await onProgress({ stage: 'qualifying', progress: 25, message: `Analysing ${rawResults.length} search results…` });
  const candidates = await extractCompanies(rawResults, campaign);
  const verificationJobs = candidates.slice(0, Math.min(12, maximumLeads * 2)).map(async candidate => {
    try { return await verifyCompany(candidate, rawResults, campaign); }
    catch (error) { console.warn('Company verification failed:', candidate.company, error.message); return null; }
  });
  const verified = (await Promise.all(verificationJobs)).filter(Boolean);
  const deduped = new Map();
  for (const lead of verified) {
    const domain = domainFromUrl(lead.website); if (!domain) continue;
    const current = deduped.get(domain);
    if (!current || current.score < lead.score) deduped.set(domain, lead);
  }
  const chosen = [...deduped.values()].sort((a,b)=>b.score-a.score).slice(0,maximumLeads);

  const saved = [];
  for (let i=0;i<chosen.length;i++) {
    let lead = await saveLead(chosen[i]);
    const baseProgress = 40 + Math.round((i / Math.max(1, chosen.length)) * 50);
    await onProgress({ stage: 'contacts', progress: baseProgress, message: `Preparing ${lead.company} (${i+1}/${chosen.length})…` });

    if (autoContacts && process.env.APOLLO_API_KEY) {
      try {
        const { default: enrichContact } = await import('./enrich-contact.mjs');
        const contactResult = await internalJson(enrichContact, 'enrich-contact', { ...lead, maximumContacts });
        lead.contacts = contactResult.contacts || [];
        lead.selectedContactId = lead.contacts[0]?.id || null;
      } catch (error) {
        lead.contactError = error.message;
        console.warn('Automatic contact discovery failed:', lead.company, error.message);
      }
    }

    if (autoEmail && lead.contacts?.length && process.env.OPENAI_API_KEY) {
      try {
        const { default: generateEmail } = await import('./generate-email.mjs');
        const contact = lead.contacts.find(c=>c.id===lead.selectedContactId) || lead.contacts[0];
        const emailResult = await internalJson(generateEmail, 'generate-email', { ...lead, contact });
        lead.subject = emailResult.subject || '';
        lead.emailBody = emailResult.body || '';
        lead.draftId = emailResult.draftId || null;
        lead.status = 'email_ready';
      } catch (error) {
        lead.emailError = error.message;
        console.warn('Automatic email generation failed:', lead.company, error.message);
      }
    }
    saved.push(lead);
  }

  await onProgress({ stage: 'complete', progress: 100, message: `Completed ${saved.length} lead(s).` });
  return {
    campaign: campaign.label,
    searchedResults: rawResults.length,
    candidateCompanies: candidates.length,
    qualifiedLeads: saved.length,
    contactsFound: saved.reduce((n,l)=>n+(l.contacts?.length||0),0),
    emailsGenerated: saved.filter(l=>l.emailBody).length,
    qualificationMode: 'OpenAI company extraction + official website verification',
    persistent: supabaseConfig().configured,
    leads: saved
  };
}
