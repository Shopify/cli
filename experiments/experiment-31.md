# Experiment 31: Hoist Shopify.theme ID extraction RegExp to module level in html.ts

## Hypothesis

Hoisting the `Shopify.theme` ID extraction RegExp pattern from `assertThemeId` function to module level will eliminate redundant regex compilation on every HTML response, reducing CPU overhead in the request hot path.

## Background

In `packages/theme/src/cli/utilities/theme-environment/html.ts`, the `assertThemeId` function extracts the theme ID from HTML responses using an inline RegExp:

```typescript
const obtainedThemeId = html.match(/Shopify\.theme\s*=\s*{[^}]+?"id":\s*"?(\d+)"?(}|,)/)?.[1]
```

This pattern is compiled on every call to `assertThemeId`, which happens for every HTML response. The pattern is complex (with multiple character classes and quantifiers), so compilation has measurable cost.

## Approach

1. Create a module-level constant `SHOPIFY_THEME_ID_PATTERN` with the pre-compiled RegExp
2. Update `assertThemeId` to use the hoisted constant instead of the inline pattern
3. Add a comment explaining the pattern's purpose

## Code Changes

**File: `packages/theme/src/cli/utilities/theme-environment/html.ts`**

Add constant near the top of the file (after the imports, near other constants):

```typescript
/**
 * Pattern to extract theme ID from Shopify.theme object in HTML.
 * Matches: Shopify.theme = {"name":"...","id":12345,...} or Shopify.theme = {...,"id":"12345",...}
 */
const SHOPIFY_THEME_ID_PATTERN = /Shopify\.theme\s*=\s*{[^}]+?"id":\s*"?(\d+)"?(}|,)/
```

Update the `assertThemeId` function to use the constant:

```typescript
function assertThemeId(response: Response, html: string, expectedThemeId: string) {
  const obtainedThemeId = html.match(SHOPIFY_THEME_ID_PATTERN)?.[1]

  if (obtainedThemeId && obtainedThemeId !== expectedThemeId) {
    throw new ThemeIdMismatchError(expectedThemeId, obtainedThemeId, response)
  }
}
```

## Success Criteria

1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. The pattern is compiled once at module initialization instead of once per HTML response

## Expected Impact

- Eliminates regex compilation overhead per HTML request
- Reduces garbage collection pressure from transient RegExp objects
- Consistent with patterns established in experiments 7-9, 15-19, 27-28 (hoisting regex patterns)
