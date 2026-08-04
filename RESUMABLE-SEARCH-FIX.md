# Resumable lead-search fix

This release changes only lead-discovery reliability and duplicate handling.

- Searches are processed one query at a time.
- Verified companies are saved after every batch.
- One Tavily or OpenAI timeout no longer cancels the whole search.
- Existing websites are refreshed rather than inserted again.
- Existing CRM category and workflow status are preserved.
- Contacts and email drafting remain separate bulk actions.

No Supabase schema migration is required for this release.
