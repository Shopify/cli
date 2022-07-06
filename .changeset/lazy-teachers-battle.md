---
'@shopify/cli-kit': patch
---

Added a retrying implementation to the method that obtains a random local port. Occasionally that third party logic failed in the middle of the execution of a command and abort the process. Running the command for a second time solved that temporary problem
