# Netlify build fix

This release exports `fetchWithTimeout` and `friendlyExternalError` from `_shared.mjs` so both the current simplified discovery function and any older background functions still present in the GitHub repository can bundle successfully.

For the cleanest repository, delete old files under `netlify/functions` before uploading this package, then upload the complete contents of this folder.
