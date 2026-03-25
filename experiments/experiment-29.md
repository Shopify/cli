# Experiment 29: Replace VALID_FILE_PREFIXES.some() with Set lookup in getUpdatedFileParts

## Hypothesis

Converting the `VALID_FILE_PREFIXES.some((prefix) => file.key.startsWith(prefix))` pattern to extract the directory and use a Set for O(1) lookup will eliminate the iteration overhead and closure allocation per call in `getUpdatedFileParts`, which is called frequently for every .liquid file during hot reloading.

## Current Code (hot-reload/server.ts)

```typescript
// Line 56:
const VALID_FILE_PREFIXES = ['sections/', 'snippets/', 'blocks/']

// Line 431:
const isValidFileType = VALID_FILE_PREFIXES.some((prefix) => file.key.startsWith(prefix)) && file.key.endsWith('.liquid')
```

## Proposed Change

Replace the array with a Set of directory names (without trailing slashes), then extract the directory from the file key using `indexOf` and check membership with `has()`:

```typescript
// Replace line 56 with:
const VALID_FILE_DIRECTORIES = new Set(['sections', 'snippets', 'blocks'])

// Replace line 431 with:
const slashIdx = file.key.indexOf('/')
const directory = slashIdx === -1 ? '' : file.key.substring(0, slashIdx)
const isValidFileType = VALID_FILE_DIRECTORIES.has(directory) && file.key.endsWith('.liquid')
```

## Approach

1. Change the constant name from `VALID_FILE_PREFIXES` to `VALID_FILE_DIRECTORIES`
2. Convert from array `['sections/', 'snippets/', 'blocks/']` to Set `new Set(['sections', 'snippets', 'blocks'])`
3. Update the `isValidFileType` check to extract directory name via indexOf/substring
4. Replace `.some()` iteration with Set `.has()` O(1) lookup

## Implementation

Edit file: `packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`

Change line 56 from:
```typescript
const VALID_FILE_PREFIXES = ['sections/', 'snippets/', 'blocks/']
```
to:
```typescript
const VALID_FILE_DIRECTORIES = new Set(['sections', 'snippets', 'blocks'])
```

Change line 431 from:
```typescript
  const isValidFileType = VALID_FILE_PREFIXES.some((prefix) => file.key.startsWith(prefix)) && file.key.endsWith('.liquid')
```
to:
```typescript
  const slashIdx = file.key.indexOf('/')
  const directory = slashIdx === -1 ? '' : file.key.substring(0, slashIdx)
  const isValidFileType = VALID_FILE_DIRECTORIES.has(directory) && file.key.endsWith('.liquid')
```

## Success Criteria

- All tests pass: `pnpm --filter @shopify/theme vitest run`
- Type checking passes: `pnpm type-check`
- No functional changes to behavior - file key validation remains semantically identical

## Expected Benefit

- Eliminates closure allocation for the `.some()` callback on every call
- Replaces O(n) array iteration with O(1) Set lookup
- `getUpdatedFileParts` is called for every liquid file during hot reload warmup and on file changes
