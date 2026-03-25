# Experiment 36: Replace .match() with .test() in canProxyRequest

## Hypothesis
In `canProxyRequest()` (proxy.ts lines 107-111), using `string.match(PATTERN)` creates a match array just to check boolean truthiness. Using `PATTERN.test(string)` returns a boolean directly without allocating an array. This function is called on every request, so eliminating 5 array allocations per request should improve performance.

## Approach
Replace all 5 `.match(PATTERN)` calls with `PATTERN.test()` in the `canProxyRequest` function.

Before:
```javascript
if (event.path.match(CART_PATTERN)) return true
if (event.path.match(CHECKOUT_PATTERN)) return true
if (event.path.match(ACCOUNT_PATTERN)) return true
if (event.path.match(VANITY_CDN_PATTERN)) return true
if (event.path.match(EXTENSION_CDN_PATTERN)) return true
```

After:
```javascript
if (CART_PATTERN.test(event.path)) return true
if (CHECKOUT_PATTERN.test(event.path)) return true
if (ACCOUNT_PATTERN.test(event.path)) return true
if (VANITY_CDN_PATTERN.test(event.path)) return true
if (EXTENSION_CDN_PATTERN.test(event.path)) return true
```

## Code Changes
File: `packages/theme/src/cli/utilities/theme-environment/proxy.ts`

Edit lines 107-111 to use `.test()` instead of `.match()`.

## Success Criteria
- All 561 tests pass
- Type check passes
- No functional change (same boolean behavior)

## Implementation Steps
1. Edit proxy.ts to replace .match() with .test()
2. Run tests: `pnpm --filter @shopify/theme vitest run`
3. Run type check: `pnpm type-check`
