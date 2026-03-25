# Experiment 9: Hoist asset path RegExp patterns in local-assets.ts

## Hypothesis
Hoisting the two static RegExp patterns in `findLocalFile()` to module-level constants will reduce object allocations. These patterns are recreated on every asset request during theme development.

## Approach
Move the inline RegExp patterns from the `tryGetFile` calls to module-level constants.

## Changes

In `packages/theme/src/cli/utilities/theme-environment/local-assets.ts`:

1. Add two new module-level constants after the `tagContentCache` definition (around line 13):

```typescript
// Pre-compiled RegExp patterns for asset path matching
const THEME_ASSET_PATTERN = /^(?:\/cdn\/.*?)?\/assets\/([^?]+)/
const EXTENSION_ASSET_PATTERN = /^(?:\/ext\/cdn\/extensions\/.*?)?\/assets\/([^?]+)/
```

2. Update the `findLocalFile` function to use these constants instead of inline patterns:

Change line 86 from:
```typescript
    tryGetFile(/^(?:\/cdn\/.*?)?\/assets\/([^?]+)/, ctx.localThemeFileSystem) ??
```
To:
```typescript
    tryGetFile(THEME_ASSET_PATTERN, ctx.localThemeFileSystem) ??
```

Change line 87 from:
```typescript
    tryGetFile(/^(?:\/ext\/cdn\/extensions\/.*?)?\/assets\/([^?]+)/, ctx.localThemeExtensionFileSystem) ?? {
```
To:
```typescript
    tryGetFile(EXTENSION_ASSET_PATTERN, ctx.localThemeExtensionFileSystem) ?? {
```

## Success Criteria
- All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
- Type checking passes: `pnpm type-check`
- The RegExp patterns are compiled once at module load vs once per function call

## Verification
After applying changes, verify the patterns are at module level by checking the file structure.
