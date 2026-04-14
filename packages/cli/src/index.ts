// Public API barrel for the CLI package.
//
// Commands are now discovered by oclif's pattern strategy from the commands/ directory.
// The CLI entry point is bootstrap.ts (used by bin/run.js and bin/dev.js).
//
// This file only re-exports public utilities that external consumers may depend on.

export {push, pull, fetchStoreThemes} from '@shopify/theme'
