# Experiment 25: Replace split('/').at(-1) with lastIndexOf/substring in local-assets.ts

## Hypothesis
Replacing `pathname.split('/').at(-1)` with `pathname.substring(pathname.lastIndexOf('/') + 1)` in `handleCompiledAssetRequest()` will eliminate an array allocation per compiled asset request while maintaining identical behavior.

## Approach
In `packages/theme/src/cli/utilities/theme-environment/local-assets.ts`, line 106:
```typescript
// Before:
const assetPath = pathname.split('/').at(-1)

// After:
const assetPath = pathname.substring(pathname.lastIndexOf('/') + 1) || undefined
```

The `|| undefined` handles the edge case where pathname might end with `/` or be empty, maintaining the same behavior as `at(-1)` which returns `undefined` for empty arrays.

## Success Criteria
1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. The behavior is identical (same asset paths extracted)

## Implementation

Edit `packages/theme/src/cli/utilities/theme-environment/local-assets.ts`:

Find line 106 in `handleCompiledAssetRequest()`:
```typescript
const assetPath = pathname.split('/').at(-1)
```

Replace with:
```typescript
const assetPath = pathname.substring(pathname.lastIndexOf('/') + 1) || undefined
```

## Verification
Run:
```bash
pnpm --filter @shopify/theme vitest run
pnpm type-check
```
