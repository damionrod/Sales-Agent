export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const required = ['MICROSOFT_TENANT_ID','MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET','MICROSOFT_SENDER_EMAIL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    return new Response(JSON.stringify({ error: `Missing Microsoft 365 settings: ${missing.join(', ')}` }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    mode: 'safety-placeholder',
    message: 'Direct sending is intentionally disabled. Implement Microsoft Graph only after Symbio IT/security approval. Start by creating Outlook drafts.'
  }), { headers: { 'Content-Type': 'application/json' } });
};
