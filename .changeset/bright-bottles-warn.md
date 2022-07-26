---
'@shopify/cli-kit': patch
'@shopify/cli': patch
'@shopify/create-app': patch
'@shopify/create-hydrogen': patch
---

Better logging:
• include Prompt and List input/output
• distinguish commands via UUID and log lines for command start/finish
• use a command line flag to specify log stream to view (cli, create-app, create-hydrogen)
