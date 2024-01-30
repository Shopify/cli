---
'@shopify/app': minor
---

- Deploy command will push the configuration to the server
- Added a new flag in the toml to opt-in/opt-out deploying the configuration with the deploy command
- Deploy and release prompts will display the differences between the local and the remote app configuration
- Deploy and release prompts will display if the dashboard managed extensions are new or deleted for the new version
- Added support to configure the `Direct API offline access` in the `toml`
- Configuration will be pushed automatically to the draft version when you run the `dev` command
