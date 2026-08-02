export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    mode: 'placeholder',
    message: 'Add your approved OpenAI model and corporate-safe prompt here. Never include unsupported claims in outreach.'
  }), { headers: { 'Content-Type': 'application/json' } });
};
