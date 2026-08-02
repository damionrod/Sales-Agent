# Symbio AI Sales Agent — Complete GitHub Package

A human-approved wholesale telecom prospecting application for Symbio. It runs as a static web app on Netlify with server-side Netlify Functions.

## Included workflows

1. **Real lead discovery** using Tavily.
2. **AI qualification** using OpenAI.
3. **Persistent storage** using Supabase.
4. **Decision-maker discovery** using Apollo.
5. **Personalised email generation** using OpenAI.
6. **Human approval** before sending.
7. **Outlook draft creation** using Microsoft Graph.
8. **Optional direct sending**, disabled until explicitly enabled.

The target products include:

- AU/NZ/SG virtual numbers and DIDs
- Call termination and wholesale voice
- Australian mobile numbers
- A2P and two-way SMS
- MVNO enablement
- eSIM and IoT SIMs
- DIA, NBN, OptiComm, IP transit, backhaul and dark fibre
- NuWave BYOC

## 1. Upload to GitHub

Upload the **contents of this folder** to the root of your existing GitHub repository. Replace the old files when prompted.

Netlify should deploy automatically. There is no build command and no `npm install` step.

Netlify settings:

- Build command: leave blank
- Publish directory: `.`
- Functions directory: `netlify/functions`

## 2. Supabase

Open Supabase → SQL Editor and run:

```text
supabase/schema.sql
```

It is safe to run again. The schema creates:

- `companies`
- `contacts`
- `email_drafts`
- `suppression_list`

Add these Netlify environment variables:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

For an older project, use `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SECRET_KEY`.

Never place the secret/service-role key in `app.js` or GitHub.

## 3. Tavily

Add:

```text
TAVILY_API_KEY
```

This enables **Find real leads**.

## 4. OpenAI

Add:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
```

OpenAI is used to qualify search results and generate company-specific outreach. If it is missing, discovery falls back to conservative keyword scoring, but email generation will not work.

## 5. Apollo

Add:

```text
APOLLO_API_KEY
```

The key must support:

- People API Search
- People Enrichment

The app searches for roles including CEO, Managing Director, GM, COO, CFO, Commercial Manager, Vendor Relationship Manager, Carrier Relations, Interconnect, Wholesale, Product, IoT, Network, Infrastructure, Procurement and Partnerships.

Apollo may charge credits for enrichment and may not reveal every email address.

## 6. Optional app access gate

Because the Netlify URL can call paid APIs, set a private application token:

```text
APP_ACCESS_TOKEN=a-long-random-value
```

Then open the app → **Settings** and enter the same value. It is stored only in that browser session.

This is a lightweight gate, not a replacement for full corporate SSO. Do not publish the site URL widely.

## 7. Microsoft 365 / Outlook

Outlook integration requires an Azure/Entra app registration and Symbio administrator approval.

Add:

```text
MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_SENDER_EMAIL=your.symbio.email@symbio.global
ALLOW_DIRECT_SEND=false
```

Application permissions typically required:

- `Mail.ReadWrite` for creating drafts
- `Mail.Send` for direct sending
- Administrator consent

Keep:

```text
ALLOW_DIRECT_SEND=false
```

until Symbio IT/security explicitly approves direct sending. With it set to false, the app can create an Outlook draft but cannot send directly.

To activate direct send later:

```text
ALLOW_DIRECT_SEND=true
```

The backend also checks that the lead is marked **approved** before sending when Supabase is connected.

## 8. Redeploy after environment changes

In Netlify:

1. Deploys
2. Trigger deploy
3. Clear cache and deploy site

Then open the app → Settings → Refresh status.

## Recommended first test

1. Confirm Tavily, OpenAI and Supabase show **Connected**.
2. Open Lead Discovery.
3. Select **Voice, DIDs & termination**.
4. Click **Find real leads**.
5. Review the source and research for every result.
6. Open one suitable company.
7. Click **Find contacts** after Apollo is configured.
8. Select a relevant contact.
9. Click **Generate email**.
10. Edit the message yourself.
11. Click **Approve**.
12. Use **Outlook draft** first.

## Important safeguards

- This system finds possible prospects, not confirmed buyers.
- Review the public source before contacting anyone.
- Do not contact existing customers, protected accounts or another salesperson's accounts without checking your CRM.
- Retain the source and business relevance for unsolicited B2B outreach.
- Respect Australian, New Zealand, Singaporean and recipient-country marketing laws.
- Maintain suppression/unsubscribe records.
- Never upload API keys to GitHub.
- Do not enable direct sending until authorised by Symbio.

## Troubleshooting

### “Invalid app access token”

Enter the value of `APP_ACCESS_TOKEN` in Settings. If you do not want the gate, remove that environment variable and redeploy.

### Tavily works but no leads appear

Try another campaign. The OpenAI qualification rules intentionally reject weak or generic results.

### Apollo finds people but no email

Apollo search does not always expose an email. The plan must include enrichment credits, and some people have no verified address in Apollo.

### Supabase error about a missing enum or table

Run `supabase/schema.sql` again in the SQL Editor.

### Microsoft Graph access denied

Confirm the Entra app has the correct **application** permissions, admin consent, and mailbox access. Keep direct sending disabled while this is being resolved.

## File structure

```text
index.html
styles.css
app.js
netlify.toml
.env.example
supabase/schema.sql
netlify/functions/
  _shared.mjs
  health.mjs
  list-leads.mjs
  discover-leads.mjs
  enrich-contact.mjs
  generate-email.mjs
  update-lead.mjs
  send-approved-email.mjs
```
