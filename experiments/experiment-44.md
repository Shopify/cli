# Experiment 44: Eliminate temporary Sets in injectCdnProxy

## Hypothesis
The `injectCdnProxy` function in proxy.ts creates two temporary Sets (`existingAssets` and `existingExtAssets`) on every HTML response by iterating over all files in both file systems. These Sets are only used to check if a matched asset exists. We can eliminate these Set allocations and iterations by checking directly on the files Map, since the `matchedAsset` variable already contains the full key (e.g., `assets/file.css`).

## Approach
In `/packages/theme/src/cli/utilities/theme-environment/proxy.ts`, replace the Set construction loops with direct Map lookups:

**Before:**
```typescript
const existingAssets = new Set<string>()
for (const key of ctx.localThemeFileSystem.files.keys()) {
  if (key.startsWith('assets/')) existingAssets.add(key)
}
const existingExtAssets = new Set<string>()
for (const key of ctx.localThemeExtensionFileSystem.files.keys()) {
  if (key.startsWith('assets/')) existingExtAssets.add(key)
}

content = content.replace(mainCdnRE, (matchedUrl, pathname, matchedAsset) => {
  const isLocalAsset = matchedAsset && existingAssets.has(matchedAsset)
  const isLocalExtAsset = matchedAsset && existingExtAssets.has(matchedAsset) && pathname.startsWith('extensions/')
  // ...
})
```

**After:**
```typescript
content = content.replace(mainCdnRE, (matchedUrl, pathname, matchedAsset) => {
  const isLocalAsset = matchedAsset && ctx.localThemeFileSystem.files.has(matchedAsset)
  const isLocalExtAsset = matchedAsset && ctx.localThemeExtensionFileSystem.files.has(matchedAsset) && pathname.startsWith('extensions/')
  // ...
})
```

## Success Criteria
1. All 561 tests pass (`pnpm --filter @shopify/theme vitest run`)
2. Type checking passes (`pnpm type-check`)
3. Two Set allocations and two file system iterations eliminated per HTML response

## Implementation

Edit `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/proxy.ts`:

1. Remove lines 167-174 (the Set construction loops)
2. Update lines 177-178 to use direct Map lookups instead of Set lookups

The change is purely a performance optimization - the semantics remain identical since:
- `matchedAsset` already contains the full key (e.g., `assets/file.css`)
- The Set only contained keys that start with `assets/` and exist in the Map
- So `existingAssets.has(matchedAsset)` is equivalent to `ctx.localThemeFileSystem.files.has(matchedAsset)` when `matchedAsset` starts with `assets/` (which it always does given the regex)
