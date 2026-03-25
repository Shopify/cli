# Experiment 1: Optimize rejectGeneratedStaticAssets from O(n²) to O(n)

## Hypothesis
The `rejectGeneratedStaticAssets` function in `packages/theme/src/cli/utilities/asset-checksum.ts` has O(n²) complexity because it calls `.some()` inside `.filter()`. By pre-computing a Set of liquid asset keys, we can achieve O(n) complexity, improving performance for themes with many files.

## Current Code Analysis
```typescript
export function rejectGeneratedStaticAssets(themeChecksums: Checksum[]) {
  return themeChecksums.filter(({key}) => {
    const isStaticAsset = key.startsWith('assets/')
    if (isStaticAsset) {
      return !hasLiquidSource(themeChecksums, key)  // O(n) scan per asset
    }
    return true
  })
}

function hasLiquidSource(checksums: Checksum[], key: string) {
  return checksums.some((checksum) => checksum.key === `${key}.liquid`)  // O(n)
}
```

## Approach
Refactor to use a Set-based lookup:
1. Pre-compute a Set of all keys ending with `.liquid` in the assets folder
2. Use O(1) Set.has() instead of O(n) Array.some()

## Task
Edit the file `packages/theme/src/cli/utilities/asset-checksum.ts`:

Replace the current `rejectGeneratedStaticAssets` function and `hasLiquidSource` helper with:

```typescript
export function rejectGeneratedStaticAssets(themeChecksums: Checksum[]) {
  // Pre-compute Set of liquid asset keys for O(1) lookup
  const liquidAssetKeys = new Set(
    themeChecksums
      .filter(({key}) => key.startsWith('assets/') && key.endsWith('.liquid'))
      .map(({key}) => key)
  )

  return themeChecksums.filter(({key}) => {
    const isStaticAsset = key.startsWith('assets/')

    if (isStaticAsset) {
      // O(1) lookup instead of O(n) scan
      return !liquidAssetKeys.has(`${key}.liquid`)
    }

    return true
  })
}
```

Remove the now-unused `hasLiquidSource` function entirely.

## Success Criteria
1. All existing tests pass: `pnpm --filter @shopify/theme vitest run`
2. The optimization maintains identical behavior (verified by existing test)
3. Type checking passes: `pnpm type-check`

## Verification
After making the change, run:
```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run src/cli/utilities/asset-checksum.test.ts
```
