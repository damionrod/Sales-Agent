import {
  corsJson, requirePost, checkAccess, cleanUrl, domainFromUrl,
  openAIJson, supabaseConfig, supabaseRequest, mapCompanyRow
} from './_shared.mjs';

const CAMPAIGNS = {
  voice: {
    label: 'Voice, DIDs and termination',
    queries: [
      'VoIP provider Australia hosted PBX SIP trunk business phone company',
      'VoIP provider New Zealand cloud PBX UCaaS telecom company',
      'VoIP provider Singapore cloud telephony SIP trunk company'
    ]
  },
  omnichannel: {
    label: 'Omnichannel and contact centre',
    queries: [
      'omnichannel contact centre software company Australia New Zealand Singapore',
      'CCaaS provider APAC cloud contact centre company',
      'customer engagement platform voice SMS omnichannel company'
    ]
  },
  aivoice: {
    label: 'AI voice and conversational AI',
    queries: [
      'AI voice platform company Australia New Zealand Singapore',
      'voice AI conversational AI contact centre company APAC',
      'AI phone agent startup voice calling platform'
    ]
  },
  flashcalling: {
    label: 'Flash Calling and authentication',
    queries: [
      'flash calling authentication API provider company',
      'voice OTP flash call verification platform',
      'CPaaS flash calling phone verification company'
    ]
  },
  sms: {
    label: 'A2P and two-way SMS',
    queries: [
      'A2P SMS provider Australia New Zealand Singapore company',
      'two way SMS gateway CPaaS provider APAC',
      'transactional messaging platform SMS company'
    ]
  },
  mobile: {
    label: 'MVNO, eSIM and IoT SIMs',
    queries: [
      'MVNO enabler Australia company',
      'eSIM provider Australia New Zealand Singapore company',
      'IoT SIM connectivity platform APAC company'
    ]
  },
  data: {
    label: 'DIA, NBN, backhaul and dark fibre',
    queries: [
      'managed service provider Australia NBN DIA business fibre company',
      'ISP Australia IP transit backhaul dark fibre company',
      'data centre connectivity provider Australia New Zealand company'
    ]
  },
  nuwave: {
    label: 'NuWave BYOC',
    queries: [
      'NuWave BYOC provider company',
      'Microsoft Teams voice provider APAC BYOC company',
      'UCaaS provider Australia New Zealand Singapore carrier connectivity'
    ]
  },
  all: {
    label: 'All priority telecom categories',
    queries: [
      'VoIP cloud PBX UCaaS provider Australia New Zealand Singapore company',
      'omnichannel CCaaS AI voice CPaaS provider APAC company',
      'A2P SMS flash calling MVNO eSIM IoT connectivity company APAC'
    ]
  }
};

const BLOCKED_HOSTS = [
  'linkedin.com','facebook.com','youtube.com','wikipedia.org','reddit.com','medium.com',
  'substack.com','prnewswire.com','businesswire.com','globenewswire.com','news.google.com',
  'techcrunch.com','forbes.com','reuters.com','bloomberg.com','statista.com',
  'researchandmarkets.com','marketsandmarkets.com','indeed.com','seek.com.au',
  'glassdoor.com','crunchbase.com','g2.com','capterra.com'
];

function blocked(url='') {
  const host = domainFromUrl(url);
  return !host || BLOCKED_HOSTS.some(x => host === x || host.endsWith(`.${x}`));
}

function officialRoot(value='') {
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.hostname.replace(/^www\./,'')}/`;
  } catch { return ''; }
}

async function fetchWithTimeout(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function tavilySearch(query, maxResults = 6) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not configured.');
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      topic: 'general'
    })
  }, 14000);
  const text = await response.text();
  if (!response.ok) throw new Error(`Tavily ${response.status}: ${text.slice(0,400)}`);
  const data = JSON.parse(text);
  return Array.isArray(data.results) ? data.results : [];
}

async function extractCompaniesInOneCall(results, campaign, maximumLeads) {
  const evidence = results.map((r, i) => ({
    index: i,
    title: String(r.title || '').slice(0,180),
    url: cleanUrl(r.url || ''),
    snippet: String(r.content || '').slice(0,900)
  }));

  if (!process.env.OPENAI_API_KEY) {
    return evidence
      .filter(x => !blocked(x.url))
      .slice(0, maximumLeads)
      .map(x => ({
        company: domainFromUrl(x.url).split('.')[0].replace(/[-_]/g,' '),
        officialWebsite: officialRoot(x.url),
        country: 'Global',
        industry: 'Telecommunications prospect',
        opportunity: campaign.label,
        products: [campaign.label],
        buyingSignal: x.snippet,
        reason: 'Matched the selected telecom search profile.',
        score: 68,
        sourceUrl: x.url
      }));
  }

  const out = await openAIJson({
    schemaName: 'fast company extraction',
    system: `You are a fast, conservative B2B telecom prospect analyst for Symbio Wholesale.
Campaign: ${campaign.label}.
From the search results, return actual operating companies only.
Do not return article titles, publishers, directories, job boards, reports, social networks or government pages.
Use the likely official company website from the evidence. Do not perform extra web verification and do not invent facts.
A company must plausibly buy one or more of: AU/NZ/SG DIDs, voice termination, Australian mobile numbers, A2P/two-way SMS, MVNO, eSIM, IoT SIM, DIA, NBN, OptiComm, IP transit, backhaul, dark fibre or NuWave BYOC.
Return at most ${maximumLeads} companies and JSON only:
{"companies":[{"company":"","officialWebsite":"https://example.com/","country":"","industry":"","opportunity":"","products":[""],"buyingSignal":"","reason":"","score":75,"sourceUrl":""}]}`,
    user: JSON.stringify(evidence)
  });
  return Array.isArray(out.companies) ? out.companies : [];
}

async function saveLead(candidate, campaign) {
  const website = officialRoot(candidate.officialWebsite || candidate.sourceUrl || '');
  if (!website || blocked(website)) return null;
  const domain = domainFromUrl(website);
  const score = Math.max(55, Math.min(100, Number(candidate.score) || 65));
  const lead = {
    company: String(candidate.company || domain.split('.')[0]).trim().slice(0,140),
    website,
    country: String(candidate.country || 'Global').slice(0,80),
    industry: String(candidate.industry || 'Telecommunications prospect').slice(0,180),
    employees: 'Unknown',
    opportunity: String(candidate.opportunity || campaign.label).slice(0,500),
    products: Array.isArray(candidate.products) ? candidate.products.map(String).slice(0,12) : [campaign.label],
    signal: String(candidate.buyingSignal || '').slice(0,900),
    research: String(candidate.reason || 'Matched the selected telecom search profile.').slice(0,1500),
    score,
    status: score >= 65 ? 'qualified' : 'new',
    sourceUrl: cleanUrl(candidate.sourceUrl || website),
    contacts: [], selectedContactId: null, subject: '', emailBody: '',
    createdAt: new Date().toISOString()
  };

  if (!supabaseConfig().configured) return { ...lead, id: `live-${crypto.randomUUID()}` };

  const existing = await supabaseRequest(`companies?select=*&website=eq.${encodeURIComponent(website)}&limit=1`);
  const body = {
    name: lead.company, website: lead.website, country: lead.country, industry: lead.industry,
    employees: lead.employees, opportunity: lead.opportunity, products: lead.products,
    signal: lead.signal, research: lead.research, score: lead.score, source_url: lead.sourceUrl,
    updated_at: new Date().toISOString()
  };

  if (existing.length) {
    // Preserve status/category chosen by the user. Refresh only research fields.
    const updated = await supabaseRequest(`companies?id=eq.${existing[0].id}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body)
    });
    return mapCompanyRow(updated[0] || existing[0], [], null);
  }

  const inserted = await supabaseRequest('companies', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...body, status: lead.status })
  });
  return mapCompanyRow(inserted[0], [], null);
}

export default async request => {
  const method = requirePost(request); if (method) return method;
  const denied = checkAccess(request); if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const campaign = CAMPAIGNS[body.campaign] || CAMPAIGNS.voice;
    const maximumLeads = Math.max(1, Math.min(15, Number(body.maximumLeads) || 10));
    const resultsPerQuery = Math.max(3, Math.min(8, Number(body.resultsPerQuery) || 6));

    const settled = await Promise.allSettled(campaign.queries.map(q => tavilySearch(q, resultsPerQuery)));
    const raw = settled.flatMap(x => x.status === 'fulfilled' ? x.value : []);
    const seen = new Set();
    const results = raw.filter(r => {
      const url = cleanUrl(r.url || '');
      if (!url || blocked(url) || seen.has(url)) return false;
      seen.add(url); return true;
    });
    if (!results.length) throw new Error('No usable search results were returned. Please try the search again.');

    const candidates = await extractCompaniesInOneCall(results, campaign, maximumLeads);
    const deduped = new Map();
    for (const c of candidates) {
      const website = officialRoot(c.officialWebsite || c.sourceUrl || '');
      const domain = domainFromUrl(website);
      if (!domain || blocked(website)) continue;
      if (!deduped.has(domain) || Number(deduped.get(domain).score || 0) < Number(c.score || 0)) deduped.set(domain, c);
    }

    const saved = [];
    for (const candidate of [...deduped.values()].slice(0, maximumLeads)) {
      try { const row = await saveLead(candidate, campaign); if (row) saved.push(row); }
      catch (error) { console.warn('Lead save skipped:', error.message); }
    }

    return corsJson({
      ok: true, campaign: campaign.label, searchedResults: results.length,
      candidateCompanies: candidates.length, qualifiedLeads: saved.length,
      qualificationMode: 'Fast Tavily search + one OpenAI extraction call',
      persistent: supabaseConfig().configured, leads: saved
    });
  } catch (error) {
    console.error(error);
    const message = error?.name === 'AbortError' ? 'The search provider took too long. Please retry.' : (error.message || 'Lead discovery failed.');
    return corsJson({ ok: false, error: message }, 500);
  }
};
