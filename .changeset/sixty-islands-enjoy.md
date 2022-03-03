---
'@shopify/create-hydrogen': minor
---

Adds the following new flags for the create-hydrogen command

- template flag (-t): One of our templates such as, template-hydrogen-default, from the hydrogen /examples directory.
- name flag (-n): Dafaults to hydrogen-app
- path flag (-p)
- dependency-manager flag (-d): One of 'npm', 'yarn' or 'pnpm'
- shopify-cli-version flag (-s)
- hydrogen-version flag (-v)

Adds the following new Prompts for the create-hydrogen command

"Name your new Hydrogen storefront": (default: 'hydrogen-app')
"Choose a template": (default: 'template-hydrogen-minimal')

Uses new template functions from the @shopify/cli-kit package for scaffolding
