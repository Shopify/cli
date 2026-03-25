# Experiment 11: Hoist filterKeys to module-level Set in storefront-renderer.ts

## Hypothesis
Converting the `filterKeys` array in `buildThemeAccessHeaders()` from an inline array with `.includes()` to a module-level Set with `.has()` will eliminate repeated array creation and provide O(1) lookup instead of O(n).

## Current Code
In `packages/theme/src/cli/utilities/theme-environment/storefront-renderer.ts`, line 91-94:
```typescript
async function buildThemeAccessHeaders(session: DevServerSession, context: Pick<DevServerRenderContext, 'headers'>) {
  const cookies = await buildCookies(session, context)
  const storefrontToken = session.storefrontToken
  const filteredHeaders: Record<string, string> = {}
  const filterKeys = ['ACCEPT', 'CONTENT-TYPE', 'CONTENT-LENGTH']

  for (const [key, value] of Object.entries(context.headers)) {
    if (filterKeys.includes(key.toUpperCase())) {
      filteredHeaders[key] = value
    }
  }
  // ...
}
```

## Problem
1. `filterKeys` array is recreated on every call to `buildThemeAccessHeaders()`
2. `.includes()` on an array is O(n) lookup
3. This function is called for every request when using Theme Access

## Solution
1. Hoist `filterKeys` to module-level constant `FILTER_KEYS_SET`
2. Convert to Set for O(1) lookup via `.has()`

## Implementation

Edit `packages/theme/src/cli/utilities/theme-environment/storefront-renderer.ts`:

1. Add near top of file (after imports):
```typescript
const FILTER_KEYS_SET = new Set(['ACCEPT', 'CONTENT-TYPE', 'CONTENT-LENGTH'])
```

2. In `buildThemeAccessHeaders()`, remove the `filterKeys` line and change:
```typescript
if (filterKeys.includes(key.toUpperCase())) {
```
to:
```typescript
if (FILTER_KEYS_SET.has(key.toUpperCase())) {
```

## Success Criteria
- All tests pass: `pnpm --filter @shopify/theme vitest run`
- Type checking passes: `pnpm type-check`
- Array allocation eliminated from hot path
- O(1) lookup instead of O(n)

## Commands to Run
```bash
# Apply the change
cd /Users/joshuafaigan/src/github.com/Shopify/cli

# Run tests
pnpm --filter @shopify/theme vitest run
```
