# Stable setup — no external reconnection required

This release uses the exact Netlify environment-variable names already configured:

- `TAVILY_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `APOLLO_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (or the already-supported legacy `SUPABASE_SERVICE_ROLE_KEY`)

No new API account, key, callback URL, Microsoft registration, or Supabase migration is required.

## What changed

Only lead discovery was simplified:

1. Three focused Tavily searches per profile.
2. Basic search depth for speed.
3. One OpenAI extraction call for all results.
4. No second website-verification search.
5. Existing companies are updated without changing the user's workflow status.
6. Contacts and email generation stay separate.

## Deploy

Upload all files to the root of the GitHub repository and replace the old files. Netlify can then deploy normally. No SQL is required for this release.
