# Experiment 27: Hoist whitespace normalization RegExp to module level in hot-reload/server.ts

## Hypothesis

The `/\s+/g` regex pattern inside the `normalizeContent` function in `getUpdatedFileParts` is recreated on every call. Since `normalizeContent` is called multiple times per hot-reload event (once per liquid tag match plus once for remaining content), hoisting this pattern to module level will eliminate redundant RegExp compilation.

## Approach

1. Add a `WHITESPACE_PATTERN` constant at module level: `const WHITESPACE_PATTERN = /\s+/g`
2. Update the `normalizeContent` function to use this pattern with reset (since global patterns maintain lastIndex state)

## Code Changes

In `packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`:

1. Add after line 63 (after SECTION_ID_PATTERN):
```typescript
const WHITESPACE_PATTERN = /\s+/g
```

2. Change line 461 from:
```typescript
const normalizeContent = (content: string) => content?.replace(/\s+/g, ' ').trim()
```
to:
```typescript
const normalizeContent = (content: string) => content?.replace(WHITESPACE_PATTERN, ' ').trim()
```

Note: Global regex patterns with the `g` flag maintain `lastIndex` state between matches. However, `String.prototype.replace()` always starts from the beginning of the string regardless of `lastIndex`, so this is safe to use as a module-level constant.

## Success Criteria

- All 561 tests pass
- Type checking passes
- Pattern is compiled once at module init instead of once per normalizeContent call

## Commands

```bash
# Apply changes
cd /Users/joshuafaigan/src/github.com/Shopify/cli

# Verify tests pass
pnpm --filter @shopify/theme vitest run

# Verify type checking passes
pnpm type-check
```
