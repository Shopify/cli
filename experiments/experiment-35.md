# Experiment 35: Replace map().join() with direct string building in serializeCookies

## Hypothesis
Replacing `Object.entries(cookies).map(([key, value]) => \`${key}=${value}\`).join('; ')` with a loop that directly builds the string will eliminate the intermediate array allocation created by `.map()`, improving performance on the cookie serialization hot path.

## Approach
In `packages/theme/src/cli/utilities/theme-environment/cookies.ts`, modify the `serializeCookies` function to use a `for...in` loop with direct string concatenation instead of the `Object.entries().map().join()` chain.

## Specific Code Changes

### File: `packages/theme/src/cli/utilities/theme-environment/cookies.ts`

**Current code (lines 37-41):**
```typescript
export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
```

**New code:**
```typescript
export function serializeCookies(cookies: Record<string, string>) {
  let result = ''
  for (const key in cookies) {
    if (result) result += '; '
    result += `${key}=${cookies[key]}`
  }
  return result
}
```

## Success Criteria
1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. The intermediate array allocation from `.map()` is eliminated

## Rationale
- `Object.entries()` creates an array of [key, value] pairs
- `.map()` creates another intermediate array of formatted strings
- `.join()` then iterates over this array to build the final string
- A simple `for...in` loop avoids both intermediate arrays while producing the same output
- This pattern is consistent with the optimization done in experiment-34 for `parseCookies`
