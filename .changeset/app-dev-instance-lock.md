---
'@shopify/cli-kit': minor
'@shopify/app': minor
---

`app dev` records its running session in `.shopify/dev/` with a lock and a JSON Lines log of every process's output. A second `app dev` for the same app configuration reports the running session and exits instead of starting a duplicate.
