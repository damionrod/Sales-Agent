# Simple replacement instructions

1. In GitHub, open your `Sales-Agent` repository.
2. Delete the existing files, or upload these files and choose **Replace** when GitHub asks.
3. Upload **everything inside this folder** to the repository root. Keep the `netlify/functions` and `supabase` folders intact.
4. Commit the changes.
5. In Supabase, open **SQL Editor**, copy all of `supabase/schema.sql`, paste it, and click **Run**.
6. In Netlify, confirm these environment variables exist:
   - `TAVILY_API_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` = `gpt-5-mini`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
   - `APOLLO_API_KEY`
7. In Netlify select **Deploys → Trigger deploy → Clear cache and deploy site**.
8. Refresh the app with Ctrl+Shift+R.
9. Run **Find real leads**. The search now runs in the background and updates progress without the 60-second timeout.
10. Open a company and click **Find contacts** to use Apollo.

Do not add API secret values to GitHub files.
