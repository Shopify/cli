# Experiment 16: Hoist cookie parsing RegExp to module level

## Hypothesis

The `parseCookies` function in `cookies.ts` creates a new `RegExp` object `/(.*?)=(.*)$/` for each cookie parsed within the `forEach` loop. Since this function is called on every HTTP request to parse incoming cookies, hoisting the regex to module level will eliminate repeated object instantiation in a hot path.

## Background

From the results of previous experiments (1-15), hoisting frequently-used RegExp patterns and constants to module level consistently improves performance by:
1. Eliminating per-call object allocation
2. Allowing the regex to be compiled once at module init

## Approach

Hoist the cookie parsing regex pattern to a module-level constant:

```typescript
// Before (inside forEach on every call):
const parts = cookie.match(/(.*?)=(.*)$/) ?? []

// After (compiled once at module init):
const COOKIE_PARSE_PATTERN = /(.*?)=(.*)$/
// ... then in forEach:
const parts = cookie.match(COOKIE_PARSE_PATTERN) ?? []
```

## Files to Modify

- `packages/theme/src/cli/utilities/theme-environment/cookies.ts`

## Implementation

Edit `cookies.ts` to:
1. Add `const COOKIE_PARSE_PATTERN = /(.*?)=(.*)$/` at module level
2. Replace the inline regex in `parseCookies` with `COOKIE_PARSE_PATTERN`

## Success Criteria

1. All theme tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. The regex is now created once at module initialization instead of once per cookie

## Commands

```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli

# Run tests
pnpm --filter @shopify/theme vitest run
```
