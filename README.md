# Symbio AI Sales Agent — automatic pipeline + services + phone fields

This complete replacement release keeps the working background workflow and adds:

- Automatic lead → Apollo contact → personalised email generation.
- Direct/contact phone and company-phone fields when Apollo returns them.
- Editable Services Catalogue in Settings.
- “All active services” campaign using the catalogue.
- Lead categories with Existing and Unqualified hidden from Active view.
- Friendly timeout messages; raw HTML timeout/login pages are never shown.

## Required deployment step

After uploading all files to GitHub, run `supabase/schema.sql` in the Supabase SQL Editor. This migration is safe to run again and adds the service catalogue and phone fields. Then clear-cache deploy on Netlify.
