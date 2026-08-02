export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!process.env.APOLLO_API_KEY) {
    return new Response(JSON.stringify({ error: 'APOLLO_API_KEY is not configured.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    mode: 'placeholder',
    message: 'Implement the Apollo enrichment call after confirming your Apollo plan, API access and company policy.'
  }), { headers: { 'Content-Type': 'application/json' } });
};
