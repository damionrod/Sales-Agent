# Upload instructions

This is a complete replacement package based on the Sales-Agent-main project you uploaded.

1. Extract this ZIP.
2. Upload everything inside `Sales-Agent-auto-pipeline` to the root of your GitHub repository, replacing the older files.
3. In Supabase, open `supabase/schema.sql`, copy all SQL, paste it into SQL Editor, and click Run.
4. Confirm these Netlify environment variables exist:
   - TAVILY_API_KEY
   - OPENAI_API_KEY
   - OPENAI_MODEL (recommended: gpt-5-mini)
   - APOLLO_API_KEY
   - SUPABASE_URL (must start with https://)
   - SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
5. In Netlify choose Deploys → Trigger deploy → Clear cache and deploy site.
6. Refresh the app with Ctrl+Shift+R.

## New automatic workflow

Clicking `Find leads + contacts + emails` now starts one background job:

1. Tavily searches for candidate companies.
2. OpenAI extracts and verifies real companies.
3. Each verified company is saved to Supabase.
4. Apollo finds the best available decision-maker.
5. OpenAI writes a personalised first-contact email.
6. The contact and email appear automatically after the job completes.

The first version processes up to five companies per run and one best contact per company. This keeps Apollo and OpenAI usage controlled and avoids synchronous Netlify timeouts.
