# Experiment 42: Pre-compute directory names from static pattern arrays

## Hypothesis

Pre-computing the directory names from `THEME_DIRECTORY_PATTERNS` and `THEME_EXT_DIRECTORY_PATTERNS` at module initialization will eliminate array allocations from `split('/').shift()` on each call to `mountThemeFileSystem` and `mountThemeExtensionFileSystem`.

Since these pattern arrays are static and never change, we can extract the unique directory prefixes once at module load time rather than computing them on every function call.

## Target Files

1. `packages/theme/src/cli/utilities/theme-fs.ts` - line 264
2. `packages/theme/src/cli/utilities/theme-ext-environment/theme-ext-fs.ts` - line 95

## Current Code

### theme-fs.ts:264
```typescript
const directoriesToWatch = new Set(
  THEME_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
)
```

### theme-ext-fs.ts:95
```typescript
const directoriesToWatch = new Set(
  THEME_EXT_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
)
```

## Changes

### theme-fs.ts

Add after `THEME_DIRECTORY_PATTERNS` array (around line 47):
```typescript
// Pre-computed unique directory names from THEME_DIRECTORY_PATTERNS
const THEME_DIRECTORIES = [...new Set(
  THEME_DIRECTORY_PATTERNS.map((pattern) => pattern.substring(0, pattern.indexOf('/')))
)]
```

Change line 264 from:
```typescript
const directoriesToWatch = new Set(
  THEME_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
)
```
to:
```typescript
const directoriesToWatch = new Set(
  THEME_DIRECTORIES.map((dir) => joinPath(root, dir)),
)
```

### theme-ext-fs.ts

Add after `THEME_EXT_DIRECTORY_PATTERNS` array (around line 23):
```typescript
// Pre-computed unique directory names from THEME_EXT_DIRECTORY_PATTERNS
const THEME_EXT_DIRECTORIES = [...new Set(
  THEME_EXT_DIRECTORY_PATTERNS.map((pattern) => pattern.substring(0, pattern.indexOf('/')))
)]
```

Change line 95 from:
```typescript
const directoriesToWatch = new Set(
  THEME_EXT_DIRECTORY_PATTERNS.map((pattern) => joinPath(root, pattern.split('/').shift() ?? '')),
)
```
to:
```typescript
const directoriesToWatch = new Set(
  THEME_EXT_DIRECTORIES.map((dir) => joinPath(root, dir)),
)
```

## Success Criteria

1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type check passes: `pnpm type-check`
3. The split() calls are eliminated from the function bodies, moved to module init

## Expected Benefit

- Eliminates 9 array allocations per `mountThemeFileSystem` call (one per pattern)
- Eliminates 4 array allocations per `mountThemeExtensionFileSystem` call
- Directory extraction computed once at module load instead of per function call

## Implementation

Make the changes described above to both files, then run tests to verify correctness.
