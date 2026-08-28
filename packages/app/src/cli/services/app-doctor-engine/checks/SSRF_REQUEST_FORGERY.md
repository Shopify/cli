---
id: SSRF_REQUEST_FORGERY
version: 1
tier: agentic
severity: high
---

Find cases where the app makes server-side HTTP requests to URLs
derived from user input, allowing an attacker to target internal
services or third-party APIs (Server-Side Request Forgery).

SSRF occurs when an application takes a URL from user input (form data,
query params, API payload) and fetches it server-side. An attacker can
use this to reach internal services, cloud metadata endpoints, or
third-party APIs that are only accessible from the server's network.

A related pattern is command injection — where user input flows into
`exec()`, `system()`, or shell commands without sanitisation.

## What to look for

1. **Find server-side HTTP calls.** Search for:
   - Rails: `HTTParty.get(url)`, `Net::HTTP.get(url)`, `Faraday.get(url)`,
     `open(url)`, `URI.parse(url)`, `HTTP.get(url)`
   - Remix/Node: `fetch(url)`, `axios.get(url)`, `http.get(url)`,
     `https.get(url)`, `request(url)`
   - PHP: `file_get_contents(url)`, `curl_exec($ch)`, `Guzzle::get(url)`
   - Python: `requests.get(url)`, `urllib.request.urlopen(url)`

2. **Trace the URL.** For each HTTP call, determine where the URL comes
   from:
   - `params[:url]`, `formData.get("url")`, `request.json().url` —
     user-controlled, SSRF risk
   - `request.headers["X-Callback-URL"]` — header, user-controlled
   - A database record — check if the record was set by user input
   - A config constant — safe
   - A variable — trace it back to its assignment

3. **Check for SSRF protections.** The call may be safe even with user
   input if:
   - The URL is validated against an allowlist of domains
   - The URL is parsed and internal IPs are blocked (169.254.169.254,
     localhost, 10.x.x.x, 192.168.x.x, etc.)
   - The URL scheme is restricted to https only

4. **Find command injection.** Search for:
   - Ruby: `system(cmd)`, `exec(cmd)`, `Open3.capture3(cmd)`,
     backticks `#{cmd}`, `IO.popen(cmd)`
   - Node: `exec(cmd)`, `execSync(cmd)`, `spawn(cmd)`, `child_process`
   - PHP: `system()`, `exec()`, `shell_exec()`, `passthru()`, backticks
   - Python: `os.system()`, `subprocess.run()`, `os.popen()`

   Trace the command argument — if it contains user input without
   shell escaping, it's command injection.

5. **Find GraphQL query injection.** Search for:
   - String concatenation building a GraphQL query: `"query { " + field + " }"`
   - Template literals with user input: `` `query { ${userField} }` ``
   - User input in query variables that aren't typed/validated

## What to report

For each HTTP call, command, or query where user input flows in without
validation:

```json
{
  "file": "app/services/webhook_forwarder.rb",
  "line": 15,
  "message": "Server-side HTTP request to user-supplied URL — SSRF",
  "snippet": "HTTParty.get(params[:callback_url])",
  "evidence": [
    {
      "file": "app/services/webhook_forwarder.rb",
      "line": 15,
      "quote": "HTTParty.get(params[:callback_url])"
    },
    {
      "file": "app/services/webhook_forwarder.rb",
      "line": 10,
      "quote": "params[:callback_url]"
    }
  ],
  "confidence": "high",
  "reasoning": "The URL comes from params[:callback_url] (user-controlled) and is fetched server-side with no allowlist or internal-IP filtering. An attacker can target internal services."
}
```

Do not report:

- HTTP calls to hardcoded URLs (`fetch("https://api.shopify.com/...")`)
- HTTP calls where the URL is validated against an allowlist
- `exec()` with literal strings (no user input)
- Shell calls with properly escaped arguments
