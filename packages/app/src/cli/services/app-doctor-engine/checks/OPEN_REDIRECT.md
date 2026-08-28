---
id: OPEN_REDIRECT
version: 1
tier: agentic
severity: medium
---

Find redirect URLs that are built from user input without validation,
allowing an attacker to redirect users to a malicious site.

An open redirect occurs when a web application redirects to a URL that
comes from an untrusted source (query parameters, form fields, headers)
without checking that the destination is safe. In Shopify apps, this is
particularly dangerous because the app runs inside an iframe in the admin
— a redirect to an external site can be used for phishing.

## What to look for

1. **Find redirect calls.** Search for:
   - Rails: `redirect_to`, `head :redirect`, `redirect`
   - Remix/Express: `redirect()`, `Response.redirect()`, `res.redirect()`
   - PHP: `header("Location: ...")`, `Redirect::to()`
   - Python: `redirect()`, `HttpResponseRedirect()`

2. **Trace the URL source.** For each redirect, determine where the
   destination URL comes from:
   - `params[:return_url]`, `params[:redirect_url]`, `request.query_params`
   - `url.searchParams.get("return_url")`
   - `$_GET['redirect']`, `request.args.get('next')`

3. **Check for validation.** Is the URL checked against an allowlist? Is
   it restricted to relative paths? Is it compared to a known-safe list of
   domains? If none of these, it's an open redirect.

4. **Consider the `flow_redirect_url` pattern.** Shopify Flow connectors
   use signed URLs for redirects — the URL is HMAC-signed, so it's not
   user-controlled even though it comes from params. Verify the signature
   check exists before flagging.

## What to report

```json
{
  "file": "app/controllers/...",
  "line": 42,
  "message": "Redirect to user-supplied URL without validation",
  "snippet": "redirect_to(params[:return_url])",
  "evidence": [
    { "file": "path", "line": 42, "quote": "redirect_to(params[:return_url])" },
    {
      "file": "path",
      "line": 30,
      "quote": "no allowlist or validation found in this controller"
    }
  ],
  "confidence": "high",
  "reasoning": "The redirect target comes from params[:return_url] with no allowlist, path validation, or signature check."
}
```

Do not report:

- Redirects to hardcoded paths (`redirect_to("/dashboard")`)
- Redirects with allowlist validation (`if ALLOWED_HOSTS.include?(uri.host)`)
- Signed redirect URLs (verify the HMAC check first)
- Test controllers
