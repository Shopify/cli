# Experiment 39: Eliminate intermediate arrays in injectCdnProxy Set construction

## Hypothesis
Replacing `new Set([...map.keys()].filter(fn))` with direct iteration in `injectCdnProxy` will eliminate 4 intermediate array allocations (2 per Set) per HTML response.

## Background
In `packages/theme/src/cli/utilities/theme-environment/proxy.ts`, the `injectCdnProxy` function builds two Sets to track local assets:

```js
const filterAssets = (key: string) => key.startsWith('assets/')
const existingAssets = new Set([...ctx.localThemeFileSystem.files.keys()].filter(filterAssets))
const existingExtAssets = new Set([...ctx.localThemeExtensionFileSystem.files.keys()].filter(filterAssets))
```

Each line creates:
1. An array from `[...files.keys()]` spread
2. Another array from `.filter(filterAssets)`

Then the Set is constructed from that filtered array.

This can be replaced with direct iteration that adds to the Set conditionally, eliminating all intermediate arrays.

## Approach
Replace the spread+filter+Set pattern with a for...of loop that adds directly to the Set:

```typescript
const existingAssets = new Set<string>()
for (const key of ctx.localThemeFileSystem.files.keys()) {
  if (key.startsWith('assets/')) existingAssets.add(key)
}
const existingExtAssets = new Set<string>()
for (const key of ctx.localThemeExtensionFileSystem.files.keys()) {
  if (key.startsWith('assets/')) existingExtAssets.add(key)
}
```

This also inlines the `filterAssets` function since it's only used twice and the condition is simple.

## Code Changes

### File: packages/theme/src/cli/utilities/theme-environment/proxy.ts

**Before (lines 146-148):**
```typescript
  const filterAssets = (key: string) => key.startsWith('assets/')
  const existingAssets = new Set([...ctx.localThemeFileSystem.files.keys()].filter(filterAssets))
  const existingExtAssets = new Set([...ctx.localThemeExtensionFileSystem.files.keys()].filter(filterAssets))
```

**After:**
```typescript
  const existingAssets = new Set<string>()
  for (const key of ctx.localThemeFileSystem.files.keys()) {
    if (key.startsWith('assets/')) existingAssets.add(key)
  }
  const existingExtAssets = new Set<string>()
  for (const key of ctx.localThemeExtensionFileSystem.files.keys()) {
    if (key.startsWith('assets/')) existingExtAssets.add(key)
  }
```

## Success Criteria
1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No functional changes - Sets contain the same elements

## Implementation Instructions

1. Read the file to get exact context
2. Apply the edit to replace lines 146-148 with the direct iteration pattern
3. Run tests to verify
4. Run type-check to verify
