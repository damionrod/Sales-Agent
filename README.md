# Symbio AI Sales Agent — Version 1 MVP

A GitHub-ready, mobile-responsive prospecting dashboard for Symbio Wholesale. It demonstrates the complete human-controlled workflow:

1. Discover and score companies.
2. Match Symbio products.
3. Rank decision-makers.
4. Draft personalised emails.
5. Approve, edit, hold or reject.
6. Send only after approval.

The included app runs immediately in **demo mode** using browser storage. Live web discovery, Apollo, OpenAI, Supabase and Microsoft 365 are represented by secure integration points and environment-variable placeholders.

## Product coverage

- AU, NZ and Singapore DIDs / virtual numbers
- Australian mobile numbers
- Call termination and wholesale voice
- A2P and two-way SMS
- MVNO enablement
- eSIM and IoT SIMs
- DIA, NBN, OptiComm, IP transit, backhaul and dark fibre
- Singapore numbering and termination
- NuWave BYOC

## Contact roles

Includes technical and commercial contacts plus CEO, GM, COO, CFO, Commercial Manager, Managing Director, Vendor Relationship Manager, CTO, product, carrier, infrastructure and IoT roles.

## Run locally

Open `index.html` directly, or use any basic local web server. No npm installation or build step is required.

## Upload to GitHub

1. Create a new empty GitHub repository.
2. Upload every file and folder from this project.
3. Commit to the `main` branch.

Or use Git:

```bash
git init
git add .
git commit -m "Initial Symbio AI Sales Agent MVP"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## Deploy on Netlify

1. In Netlify, choose **Add new site → Import an existing project**.
2. Select the GitHub repository.
3. Leave the build command blank.
4. Publish directory: `.`
5. Deploy.

`netlify.toml` already contains these settings and the single-page-app redirect. This version is intentionally dependency-free.

## Demo workflow

- Open a lead.
- Select the best contact.
- Edit the subject or message.
- Click **Approve**.
- Click **Send approved**.

Demo mode records the lead as sent but never sends a real message.

## Connect Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

The current interface still uses local browser storage. The schema is ready for the next step: replacing `src/lib/storage.ts` with Supabase CRUD and adding login.

## Live integrations

Server-side placeholders are under `netlify/functions/`:

- `discover-leads.mjs`
- `enrich-contact.mjs`
- `generate-email.mjs`
- `send-approved-email.mjs`

Add secrets only in Netlify environment variables—not in source code.

### Apollo

Use Apollo only after confirming API access and acceptable-use terms. The production flow should:

1. Search company/person candidates.
2. Enrich the selected person.
3. Store source, verification status and retrieval date.
4. Never invent or silently guess email addresses.

### OpenAI

Use a server-side call to classify research and draft outreach. The prompt should require source-grounded statements, prohibit fabricated claims and return structured JSON.

### Microsoft 365

Direct sending is deliberately disabled. Obtain Symbio IT/security approval and Microsoft Graph application permissions first. The safest first production mode is to create an Outlook draft after approval, with Damien completing the final send in Outlook.

## Required production safeguards

- Current-customer and protected-account exclusion list
- Duplicate-company and duplicate-contact checks
- Suppression/unsubscribe list
- Source URL and collection date for every contact
- Country-specific outreach rule tracking
- Verified email requirement
- Human approval log
- Automatic stop after a reply
- No mailbox/API secrets in browser code
- Internal Symbio security and privacy approval before external services process company data

## Important limitation

This repository is a functional MVP interface and safe integration scaffold. It cannot lawfully or reliably “scan the whole internet” by itself. Production discovery needs licensed search/data providers, API accounts, usage policies, rate limits and compliance controls.
