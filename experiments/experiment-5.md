# Experiment 5: Convert TEXT_FILE_TYPES to Set for O(1) lookup

## Hypothesis
Converting `TEXT_FILE_TYPES` from an array with `includes()` to a Set with `has()` will reduce lookup complexity from O(n) to O(1) for every file read operation.

## Background
In `packages/theme/src/cli/utilities/theme-fs.ts`, the `isTextFile` function is called for every file read:
- `readThemeFile` calls `isTextFile` to determine encoding
- `readThemeFileWithListing` also calls `isTextFile`

Current implementation:
```typescript
const TEXT_FILE_TYPES = [
  'application/javascript',
  'application/json',
  'application/liquid',
  'text/css',
  'text/x-sass',
  'text/x-scss',
  'image/svg+xml',
]

export function isTextFile(path: string) {
  return TEXT_FILE_TYPES.includes(lookupMimeType(path))
}
```

The `includes()` method on arrays has O(n) complexity - it iterates through the array until it finds a match.

## Approach
Convert `TEXT_FILE_TYPES` to a Set constant `TEXT_FILE_TYPES_SET` and use `has()` for O(1) lookup.

## Code Changes

### File: packages/theme/src/cli/utilities/theme-fs.ts

Replace lines 61-69:
```typescript
const TEXT_FILE_TYPES = [
  'application/javascript',
  'application/json',
  'application/liquid',
  'text/css',
  'text/x-sass',
  'text/x-scss',
  'image/svg+xml',
]
```

With:
```typescript
const TEXT_FILE_TYPES_SET = new Set([
  'application/javascript',
  'application/json',
  'application/liquid',
  'text/css',
  'text/x-sass',
  'text/x-scss',
  'image/svg+xml',
])
```

Replace line 528-530:
```typescript
export function isTextFile(path: string) {
  return TEXT_FILE_TYPES.includes(lookupMimeType(path))
}
```

With:
```typescript
export function isTextFile(path: string) {
  return TEXT_FILE_TYPES_SET.has(lookupMimeType(path))
}
```

## Success Criteria
1. All theme package tests pass (`pnpm --filter @shopify/theme vitest run`)
2. No type errors
3. Complexity reduced from O(n) to O(1) for mime type lookups

## Verification
After making changes, run:
```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run
```
