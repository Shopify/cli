---
'@shopify/cli-kit': patch
---

Add better TypeScript support when formating files with the fs module by explicitly setting the parser to "typescript" in the prettier config. Fixes issues where the babel parser was not able to process JSX in TypeScript files.
