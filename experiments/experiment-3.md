# Experiment 3: Pre-compile regex patterns in asset-ignore filters

## Hypothesis

Pre-compiling regex patterns once instead of creating a new RegExp object for every file-pattern combination will reduce CPU overhead during file filtering operations.

## Problem Analysis

In `packages/theme/src/cli/utilities/asset-ignore.ts`, the `filterBy` function calls `asRegex(pattern)` inside the filter loop:

```typescript
const match = patterns.some(
  (pattern) => matchGlob(key, pattern) || (isRegex(pattern) && regexMatch(key, asRegex(pattern))),
)
```

For N files and M regex patterns, this creates N*M new `RegExp` objects, even though the patterns themselves don't change. `new RegExp()` is relatively expensive because it parses and compiles the pattern each time.

## Approach

Pre-compile regex patterns at the start of `filterBy` function, then use the cached compiled versions during iteration:

1. In `filterBy`, before returning the filter function:
   - Create a Map or array of pre-compiled RegExp objects for patterns that are regex patterns
   - Use these cached regexes in the inner loop instead of calling `asRegex()` each time

## Code Changes

Edit `packages/theme/src/cli/utilities/asset-ignore.ts`:

Replace the `filterBy` function (lines 41-57) with an optimized version that pre-compiles regex patterns:

```typescript
function filterBy(patterns: string[], type: string, invertMatch = false) {
  // Pre-compile regex patterns once (O(m) where m = number of patterns)
  const compiledPatterns = patterns.map((pattern) => ({
    pattern,
    regex: isRegex(pattern) ? asRegex(pattern) : null,
  }))

  return ({key}: {key: string}) => {
    if (patterns.length === 0) return true

    const match = compiledPatterns.some(
      ({pattern, regex}) => matchGlob(key, pattern) || (regex !== null && regexMatch(key, regex)),
    )
    const shouldIgnore = invertMatch ? !match : match

    if (shouldIgnore) {
      outputDebug(`Ignoring theme file ${key} via ${type}...`)
      return false
    }

    return true
  }
}
```

## Success Criteria

1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No change in behavior - all existing filter patterns work identically

## Verification

Run the theme package tests to verify correctness:
```bash
pnpm --filter @shopify/theme vitest run
```
