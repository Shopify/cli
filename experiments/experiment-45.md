# Experiment 45: Eliminate intermediate array in URLSearchParams filtering

## Hypothesis

Replacing `[...searchParams].filter()` with direct iteration eliminates an intermediate array allocation in the theme ID mismatch redirect handler.

## Approach

In `packages/theme/src/cli/utilities/theme-environment/html.ts` line 121:

**Current code:**
```typescript
const filteredParams = new URLSearchParams([...searchParams].filter(([key]) => !key.startsWith('__sfr')))
```

**Optimized code:**
```typescript
const filteredParams = new URLSearchParams()
for (const [key, value] of searchParams) {
  if (!key.startsWith('__sfr')) {
    filteredParams.append(key, value)
  }
}
```

## Specific Code Changes

Edit file: `packages/theme/src/cli/utilities/theme-environment/html.ts`

Find and replace line 121:
```typescript
            const filteredParams = new URLSearchParams([...searchParams].filter(([key]) => !key.startsWith('__sfr')))
```

With:
```typescript
            const filteredParams = new URLSearchParams()
            for (const [key, value] of searchParams) {
              if (!key.startsWith('__sfr')) {
                filteredParams.append(key, value)
              }
            }
```

## Success Criteria

1. All theme tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type check passes: `pnpm type-check`
3. Array allocation eliminated from redirect handler

## Validation Commands

```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run
pnpm type-check
```
