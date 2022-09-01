---
'@shopify/cli-kit': minor
'@shopify/create-hydrogen': minor
'@shopify/cli-hydrogen': patch
---

- cli-hydrogen:
  - add support for asset URL rewriting when doing `shopify hydrogen build`
- cli-kit:
  - expose additional git functionality for commits, creating .gitignore, and insuring command is run in a git directory
  - add additional 'dms' service type
  - add additional exposed api & file functionality
- create-hydrogen
  - add support for initializing a new local git repository when you initialize a new project
