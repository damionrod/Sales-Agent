import { corsJson, checkAccess, supabaseConfig } from './_shared.mjs';
export default async (request) => {
  if (request.method === 'OPTIONS') return corsJson({ ok: true });
  const denied = checkAccess(request); if (denied) return denied;
  const sb = supabaseConfig();
  return corsJson({ ok: true, integrations: {
    tavily: Boolean(process.env.TAVILY_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: sb.configured,
    apollo: Boolean(process.env.APOLLO_API_KEY),
    microsoft: Boolean(process.env.MICROSOFT_TENANT_ID && process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_SENDER_EMAIL),
    directSend: String(process.env.ALLOW_DIRECT_SEND).toLowerCase() === 'true',
    accessTokenRequired: Boolean(process.env.APP_ACCESS_TOKEN)
  }});
};
