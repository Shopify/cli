# Experiment 26: Replace split('/')[0] with indexOf/substring in storefront-utils.ts

## Hypothesis

In `storefront-utils.ts`, the pattern `path.split('/')[0]` creates an array allocation every time the function is called to extract extension template parameters. Replacing this with `indexOf/substring` eliminates the array allocation while producing identical results.

## Target File

`packages/theme/src/cli/utilities/theme-environment/storefront-utils.ts`

## Current Code (line 15)

```typescript
const bucket = path.split('/')[0]
```

## Proposed Change

Replace with indexOf/substring pattern:

```typescript
const slashIndex = path.indexOf('/')
const bucket = slashIndex !== -1 ? path.substring(0, slashIndex) : path
```

## Implementation

Edit line 15 in `packages/theme/src/cli/utilities/theme-environment/storefront-utils.ts`:

**Before:**
```typescript
    const bucket = path.split('/')[0]
```

**After:**
```typescript
    const slashIndex = path.indexOf('/')
    const bucket = slashIndex !== -1 ? path.substring(0, slashIndex) : path
```

## Success Criteria

1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type check passes: `pnpm type-check`
3. No behavioral changes - the bucket extraction logic must be identical

## Rationale

- `split('/')[0]` creates a new array with all path segments, then discards all but the first
- `indexOf/substring` achieves the same result without array allocation
- This pattern has been successfully applied in experiments 21-25
- The function `storefrontReplaceTemplatesParams` is called during storefront rendering for extension templates
