# Upload instructions

1. Download and unzip this package.
2. Upload **everything inside `Sales-Agent-v3-complete`** to the root of your GitHub repository and replace the older files.
3. In Supabase, open `supabase/schema.sql`, copy all of it into SQL Editor, and click **Run**. It is safe to run again.
4. In Netlify, use **Deploys → Trigger deploy → Clear cache and deploy site**.
5. Hard-refresh the app with `Ctrl + Shift + R`.

## New features

- Lead categories: Existing, Emailed, Unqualified, Other.
- Category filter on Lead Discovery.
- Category selector in every table row and company drawer.
- CSV exports include lead category.
- Master campaign: **Search ALL product categories**.
- Search limit remains configurable up to 50 qualified leads per run.
