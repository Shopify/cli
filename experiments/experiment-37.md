# Experiment 37: Replace chained .replace() regex with startsWith/endsWith in getInMemoryTemplates

## Hypothesis

The expression `currentRoute.replace(/^\//, '').replace(/\.html$/, '')` on line 94 of `hot-reload/server.ts` creates two RegExp patterns and two intermediate strings per call. Replacing this with native string methods (`startsWith`/`substring` and `endsWith`/`slice`) will eliminate regex compilation overhead and reduce string allocations.

## Approach

Replace the chained `.replace()` calls with a helper function that uses:
- `startsWith('/')` + `substring(1)` instead of `replace(/^\//, '')`
- `endsWith('.html')` + `slice(0, -5)` instead of `replace(/\.html$/, '')`

## Specific Code Changes

In `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`:

### Step 1: Change line 94 from:
```typescript
const filterTemplate = currentRoute
  ? `${joinPath('templates', currentRoute.replace(/^\//, '').replace(/\.html$/, '') || 'index')}.json`
  : ''
```

### To:
```typescript
const filterTemplate = currentRoute
  ? `${joinPath('templates', normalizeRoute(currentRoute) || 'index')}.json`
  : ''
```

### Step 2: Add helper function after the module-level constants (around line 65):
```typescript
/**
 * Removes leading slash and trailing .html from a route path.
 * Optimized to use string methods instead of regex.
 */
function normalizeRoute(route: string): string {
  let result = route.startsWith('/') ? route.substring(1) : route
  if (result.endsWith('.html')) {
    result = result.slice(0, -5)
  }
  return result
}
```

## Success Criteria

1. All 561 tests pass
2. Type checking passes
3. Regex patterns eliminated from hot path, replaced with O(1) string operations

## Verification Commands

```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run
pnpm type-check
```
