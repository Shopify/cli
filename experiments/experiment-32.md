# Experiment 32: Combine chained filters in applyFileFilters (theme-polling.ts)

## Hypothesis

Combining two chained `.filter()` calls into a single filter will:
1. Eliminate one intermediate array allocation
2. Reduce iterations from 2N to N (where N = number of files after first filter)
3. Improve performance in the theme polling hot path

## Target

File: `packages/theme/src/cli/utilities/theme-environment/theme-polling.ts`
Function: `applyFileFilters` (line 204-207)

## Current Code

```typescript
function applyFileFilters(files: Checksum[], localThemeFileSystem: ThemeFileSystem, unsyncedKeys: Set<string>) {
  const filteredFiles = localThemeFileSystem.applyIgnoreFilters(files)
  return filteredFiles.filter((file) => file.key.endsWith('.json')).filter((file) => !unsyncedKeys.has(file.key))
}
```

## Proposed Change

```typescript
function applyFileFilters(files: Checksum[], localThemeFileSystem: ThemeFileSystem, unsyncedKeys: Set<string>) {
  const filteredFiles = localThemeFileSystem.applyIgnoreFilters(files)
  return filteredFiles.filter((file) => file.key.endsWith('.json') && !unsyncedKeys.has(file.key))
}
```

## Implementation Steps

1. Navigate to `packages/theme/src/cli/utilities/theme-environment/theme-polling.ts`
2. Find the `applyFileFilters` function at line 204-207
3. Replace the chained filters with a single combined filter

## Success Criteria

- All 561 tests pass
- Type checking passes
- The change is purely a performance optimization with identical behavior

## Validation Command

```bash
pnpm --filter @shopify/theme vitest run && pnpm type-check
```
