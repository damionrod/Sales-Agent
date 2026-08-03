# Separated workflow release

This release deliberately separates the expensive API operations:

1. **Find Leads** — Tavily + OpenAI company verification only.
2. Select worthwhile leads with the checkboxes.
3. **Find Contacts** — Apollo for selected leads only, two companies at a time.
4. **Generate Emails** — OpenAI for selected leads that already have contacts, two emails at a time.

This reduces Netlify timeouts and avoids wasting Apollo/OpenAI credits on weak or rejected leads.

No new database migration is required if the current schema already contains companies, contacts, email_drafts, search_jobs, services, phone fields and lead_category.
