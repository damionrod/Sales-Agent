# Apollo contact discovery patch

This version connects the existing company records to Apollo contact discovery.

## What is now wired

1. Click **Open →** to open the company workspace.
2. Click **Find contacts** inside the company workspace, or click **Contacts** directly in the lead table.
3. The Netlify function searches Apollo by the verified company domain.
4. It ranks relevant roles and enriches up to three people.
5. Contacts are saved to Supabase and appear under **Contacts**.
6. Select a contact and click **Generate email** to create a personalised draft with OpenAI.

## Required Netlify variables

- `APOLLO_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (recommended: `gpt-5-mini`)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `TAVILY_API_KEY`

Apollo People Search requires a master API key. Email enrichment can consume Apollo credits. If Apollo returns a 403 error, recreate the key as a master key or enable the People Search and People Enrichment permissions.

## Deployment

Upload every file in this folder to the root of the GitHub repository, replacing the older files. Then run **Clear cache and deploy site** in Netlify. Hard refresh the website with `Ctrl + Shift + R`.
