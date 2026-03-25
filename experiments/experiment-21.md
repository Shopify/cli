# Experiment 21: Replace split()[0] with indexOf/substring in hot-reload/server.ts

## Hypothesis

Replacing `array = str.split(delimiter)[0]` patterns with `str.substring(0, str.indexOf(delimiter))` in the hot-reload/server.ts hot path will eliminate array allocations per event, improving performance during file watching.

## Background

From RESULTS.tsv, experiment-20 successfully replaced `split('/').pop()?.replace('.liquid','')` with a pre-compiled regex pattern. This experiment applies a similar optimization to two remaining `split()[0]` patterns in hot-reload/server.ts:

1. Line 244: `event.path.split('?')[0]` - extracts pathname from URL path
2. Line 383: `const [type] = key.split('/')` - extracts file type prefix (e.g., "sections" from "sections/foo.liquid")

Both patterns create arrays just to extract the first element. Using `indexOf` + `substring` avoids array allocation entirely.

## Approach

### Change 1: Line 244 - Extract pathname without query string

**Before:**
```ts
const browserPathname = event.path.split('?')[0] ?? ''
```

**After:**
```ts
const queryIndex = event.path.indexOf('?')
const browserPathname = queryIndex === -1 ? event.path : event.path.substring(0, queryIndex)
```

### Change 2: Line 383 - Extract file type prefix

**Before:**
```ts
const [type] = key.split('/')
```

**After:**
```ts
const slashIndex = key.indexOf('/')
const type = slashIndex === -1 ? key : key.substring(0, slashIndex)
```

## Files to Modify

- `packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`

## Success Criteria

1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type-check passes: `pnpm type-check`
3. Code review confirms array allocations eliminated from hot path

## Implementation

Make both changes in hot-reload/server.ts, then run tests.
