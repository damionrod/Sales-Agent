# Lead-search timeout hard fix

This release keeps the manual email workflow and changes only lead-search reliability:

- Tavily calls have a 10-second hard limit.
- OpenAI qualification has an 18-second hard limit.
- If OpenAI is slow, the app saves conservative Tavily-derived candidates instead of failing.
- Supabase saves run in parallel.
- Raw HTML timeout/login pages are converted into a friendly message.
- Lead discovery remains separate from contacts and email generation.

No SQL or environment-variable changes are required.
