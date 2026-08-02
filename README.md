# Symbio AI Sales Agent — Complete V2

A human-approved lead generation application for Symbio Wholesale.

## Included workflow

1. Tavily searches public web sources.
2. OpenAI identifies and qualifies actual companies rather than article titles.
3. Verified companies are stored in Supabase.
4. Apollo finds suitable decision-makers where the Apollo plan permits the required endpoints.
5. OpenAI creates a personalised email using only the active Services Catalogue.
6. Damien reviews, edits, approves, and optionally creates an Outlook draft or sends after Microsoft 365 is configured.

## New in this release

- Maximum **50 qualified leads per run** (10, 25, or 50 selectable; default 50).
- Background processing to reduce browser request timeouts.
- CSV downloads for leads, contacts, or combined records.
- Editable Services Catalogue under Settings.
- Add, edit, disable, enable, reorder, and remove services.
- Disabled services are excluded from discovery and email writing.
- Batched company extraction to reduce Tavily/OpenAI calls and improve lead quality.
- Tavily request timeout handling.
- Email generation can begin without an Apollo contact; Outlook send still requires a real email address.

## Required environment variables

- `TAVILY_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (recommended: `gpt-5-mini`)
- `SUPABASE_URL` including `https://`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `APOLLO_API_KEY`

Microsoft Outlook variables remain optional until sending is enabled.

Read `UPLOAD-INSTRUCTIONS.md` for the simplest deployment steps.
