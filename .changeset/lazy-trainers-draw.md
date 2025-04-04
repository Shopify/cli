---
'@shopify/cli': minor
---

Add HTTP proxy support with the environment variables `SHOPIFY_HTTP_PROXY` and `SHOPIFY_HTTPS_PROXY`

If your proxy uses basic authentication, provide the auth in the following format:

```bash
SHOPIFY_HTTP_PROXY=http://user:pass@yourproxy.com:PORT
```
