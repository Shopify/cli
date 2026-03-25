# Experiment 20: Replace split().pop() with pre-compiled regex in local-assets.ts

## Hypothesis
Replacing `key.split('/').pop()?.replace('.liquid', '')` with a pre-compiled regex pattern will eliminate array allocation per file during compiled asset requests, improving performance of handleBlockScriptsJs.

## Context
In `packages/theme/src/cli/utilities/theme-environment/local-assets.ts`, line 163:
```javascript
const baseName = key.split('/').pop()?.replace('.liquid', '')
```

This is called inside a loop in `handleBlockScriptsJs` for each liquid file when serving compiled assets (styles.css, scripts.js, etc.). Each call:
1. Creates a new array from split('/')
2. Extracts the last element with pop()
3. Creates a new string with replace()

## Approach
1. Add a pre-compiled regex pattern at module level to extract the basename without the .liquid extension
2. Replace the split().pop()?.replace() chain with a single regex match

## Implementation

### File: packages/theme/src/cli/utilities/theme-environment/local-assets.ts

Add after the existing pattern constants (around line 17):
```javascript
// Pattern to extract liquid file basename (last path segment without .liquid extension)
const LIQUID_BASENAME_PATTERN = /([^/]+)\.liquid$/
```

Replace line 163:
```javascript
// Before:
const baseName = key.split('/').pop()?.replace('.liquid', '')

// After:
const baseName = key.match(LIQUID_BASENAME_PATTERN)?.[1]
```

## Success Criteria
1. All 561 theme package tests pass
2. Type checking passes
3. Code compiles without errors

## Verification Commands
```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run
pnpm type-check
```
