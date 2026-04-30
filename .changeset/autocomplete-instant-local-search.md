---
'@shopify/cli-kit': patch
---

Make the autocomplete prompt feel instant when filtering against in-memory choices. The 400ms throttle on the search callback was designed for remote/paginated backends, but it also gated the default in-memory filter used by callers that don't supply their own `search` (e.g. the theme selector), producing a noticeable lag while typing. The prompt now exposes a `searchDebounceMs` prop, and `renderAutocompletePrompt` sets it to `0` when it injects its own synchronous filter. Custom remote-search consumers keep the existing 400ms throttle unless they opt out.
