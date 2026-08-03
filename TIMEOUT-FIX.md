# Timeout reliability fix

This release changes discovery so one slow external search no longer fails the entire job.

- Tavily requests retry once and fall back from advanced to basic search.
- Searches run in groups of three rather than all at once.
- Company verification runs with a concurrency limit of three.
- Partial results are kept if one source times out.
- "All active services" groups services by category instead of firing one query per service.

For best reliability, use one product category when testing. The automatic contact and email steps continue after verified companies are saved.
