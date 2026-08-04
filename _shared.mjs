export function corsJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
    }
  });
}

export function requirePost(request) {
  if (request.method === 'OPTIONS') return corsJson({ ok: true });
  if (request.method !== 'POST') return corsJson({ ok: false, error: 'Use POST.' }, 405);
  return null;
}

export function checkAccess(request) {
  const configured = process.env.APP_ACCESS_TOKEN;
  if (!configured) return null;
  const supplied = request.headers.get('x-app-token') || '';
  if (supplied !== configured) return corsJson({ ok: false, error: 'Invalid app access token.' }, 401);
  return null;
}

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, key, configured: Boolean(url && key) };
}

export async function supabaseRequest(path, options = {}) {
  const { url, key, configured } = supabaseConfig();
  if (!configured) throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY.');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const detail = typeof data === 'string' ? data : data?.message || data?.hint || JSON.stringify(data);
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }
  return data;
}

export function cleanUrl(value = '') {
  try {
    const u = new URL(value);
    u.hash = '';
    return u.toString();
  } catch { return value; }
}

export function domainFromUrl(value = '') {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

export function randomId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function openAIJson({ system, user, schemaName = 'result' }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not configured.');
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const payload = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_object' }
  };
  let response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok && response.status === 400) {
    delete payload.response_format;
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.slice(0, 800)}`);
  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content.');
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); }
  catch { throw new Error(`OpenAI did not return valid JSON for ${schemaName}.`); }
}

export function mapCompanyRow(row, contacts = [], draft = null) {
  return {
    id: row.id,
    company: row.name,
    website: row.website || '',
    country: row.country || 'Unknown',
    industry: row.industry || '',
    employees: row.employees || 'Unknown',
    opportunity: row.opportunity || '',
    products: row.products || [],
    signal: row.signal || '',
    research: row.research || '',
    score: row.score || 0,
    status: row.status || 'new',
    sourceUrl: row.source_url || row.website || '',
    contacts: contacts.map(c => ({
      id: c.id,
      name: c.name,
      title: c.title || '',
      email: c.email || '',
      linkedin: c.linkedin || '',
      confidence: c.confidence || 'Unknown',
      relevance: c.relevance || 0,
      reason: c.reason || ''
    })),
    selectedContactId: contacts.find(c => c.is_selected)?.id || contacts[0]?.id || null,
    subject: draft?.subject || '',
    emailBody: draft?.body || '',
    draftId: draft?.id || null,
    createdAt: row.created_at,
    sentAt: draft?.sent_at || null
  };
}
