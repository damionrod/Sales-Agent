# Symbio AI Sales Agent — Verified Company Discovery

This is the complete replacement package for the existing Netlify app.

The lead-discovery pipeline now:

1. Searches public web pages with Tavily.
2. Uses OpenAI to identify the real company mentioned in those pages.
3. Rejects article titles, reports, directories, job boards and generic pages.
4. Runs a second verification search for each candidate.
5. Confirms an official corporate website.
6. Saves only verified organisations with a score of 65 or higher.
7. Opens every company in a detailed review drawer.
8. Allows incorrect records to be deleted individually or all at once.

## Upload to GitHub

Upload **all files inside this folder** to the root of the existing GitHub repository and replace the old files.

Netlify settings:

- Build command: blank
- Publish directory: `.`
- Functions directory: `netlify/functions`

After GitHub finishes uploading, use Netlify → Deploys → Trigger deploy → **Clear cache and deploy site**.

## Required Netlify environment variables

Real verified-company discovery requires all of these:

```text
TAVILY_API_KEY
OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
SUPABASE_URL
SUPABASE_SECRET_KEY
```

Older Supabase projects can use `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SECRET_KEY`.

The OpenAI key is now required for discovery because the earlier keyword fallback was what allowed article titles to be treated as companies.

Optional integrations:

```text
APOLLO_API_KEY
APP_ACCESS_TOKEN
```

Never commit secret values to GitHub.

## Remove the old incorrect leads

After deploying:

1. Open the app.
2. Go to **Settings**.
3. Click **Delete all existing leads**.
4. Confirm the warning.
5. Return to **Lead Discovery**.
6. Run a fresh campaign.

This deletes the earlier imported article-title records from Supabase and the browser.

## What a correct result looks like

A row should show an actual organisation such as:

```text
Airalo
airalo.com
Singapore
Travel eSIM / mobile connectivity opportunity
Open →
```

It should not show a headline such as:

```text
Travel's a breeze with unlimited data eSIMs
```

## Opening a company

Click anywhere on the company row or click **Open →**. The company drawer contains:

- Official website
- Country and industry
- Symbio opportunity
- Relevant products
- Buying signal
- Research summary
- Public evidence link
- Contact discovery
- Personalised email drafting
- Copy subject and email, hold, reject, mark emailed manually, and delete controls

## Supabase

The included `supabase/schema.sql` is the same compatible schema. It is safe to run again, but it is not necessary when the existing tables were already created successfully.

## First test

1. Confirm Tavily, OpenAI and Supabase show **Connected** in Settings.
2. Delete all old leads once.
3. Select **MVNO, eSIM & IoT SIMs**.
4. Click **Find real leads**.
5. The first search may take longer because each candidate is verified separately.
6. Open each saved company and inspect its official website and evidence before outreach.

## Cost and quality controls

- The app searches five focused queries per campaign.
- It verifies a limited number of candidate companies.
- It saves a maximum of five verified companies per run.
- It does not save a company without an official website.
- It does not use a non-AI fallback for company identification.

## Important

These are possible prospects, not confirmed buyers. Check Symbio CRM ownership, existing customer status, public evidence and applicable outreach rules before contacting anyone.


## Manual email workflow

This version never sends email and does not create Outlook drafts. Generate the personalised message, use **Copy subject** and **Copy email**, send it manually, then choose **Mark emailed manually**. No Microsoft 365 environment variables are required.
