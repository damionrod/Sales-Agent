export default async () => {
  return new Response(JSON.stringify({
    mode: 'placeholder',
    message: 'Connect a licensed search provider and OpenAI here. The frontend currently uses demo leads.',
    requiredEnvironmentVariables: ['OPENAI_API_KEY']
  }), { headers: { 'Content-Type': 'application/json' } });
};
