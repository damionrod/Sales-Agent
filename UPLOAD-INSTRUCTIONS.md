# Simple upload instructions

This ZIP is a complete replacement for the current GitHub repository.

1. Download and unzip `Sales-Agent-v2-complete.zip`.
2. Open the extracted folder.
3. Upload **all files and folders inside it** to the root of the existing GitHub repository, replacing the old files.
4. Keep these folders exactly as supplied:
   - `netlify/functions/`
   - `supabase/`
5. In Supabase, open `supabase/schema.sql`, copy everything, paste it into **SQL Editor**, and click **Run**. It is safe to run again.
6. In Netlify, confirm these environment variables remain configured:
   - `TAVILY_API_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
   - `APOLLO_API_KEY`
7. Netlify should deploy automatically. If it does not, use **Deploys → Trigger deploy → Clear cache and deploy site**.
8. Hard-refresh the app with `Ctrl + Shift + R`.

## New features

- Up to **50 qualified leads per search run**.
- Leads, contacts, and combined CSV downloads.
- Editable services catalogue in **Settings**.
- Add, edit, disable, re-enable, reorder, or remove services.
- Only active catalogue services are used by lead discovery and personalised email generation.
- Company-level email drafts can be generated even before a contact is selected; select a contact before Outlook sending.
