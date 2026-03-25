# Experiment 17: Hoist newline split RegExp to module level in asset-ignore.ts

## Hypothesis
Hoisting the newline split RegExp pattern `/(\r\n|\r|\n)/` from inside `getPatternsFromShopifyIgnore` to module level will eliminate redundant RegExp compilation on each function call.

## Background
In `packages/theme/src/cli/utilities/asset-ignore.ts`, the function `getPatternsFromShopifyIgnore` creates a RegExp `/(\r\n|\r|\n)/` inline at line 78 for splitting file content into lines. This RegExp is compiled every time the function is called. Since the pattern is static, it can be pre-compiled once at module initialization.

## Approach
1. Add a module-level constant `NEWLINE_PATTERN` with the pre-compiled RegExp
2. Update `getPatternsFromShopifyIgnore` to use the constant instead of the inline pattern

## Code Changes

In `packages/theme/src/cli/utilities/asset-ignore.ts`:

**Add constant near the top of the file (after existing constants):**
```typescript
const NEWLINE_PATTERN = /(\r\n|\r|\n)/
```

**Update `getPatternsFromShopifyIgnore` function to use the constant:**

Change line 78 from:
```typescript
    .split(/(\r\n|\r|\n)/)
```

To:
```typescript
    .split(NEWLINE_PATTERN)
```

## Success Criteria
- All existing tests pass: `pnpm --filter @shopify/theme vitest run`
- No type errors: `pnpm type-check`
- RegExp is compiled once at module init instead of once per function call

## Implementation Instructions
Make only the two changes described above. Do not modify any other code.
