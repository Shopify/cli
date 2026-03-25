# Experiment 4: Hoist matchOpts constant to module level

## Hypothesis
Hoisting the `matchOpts` object to module level in `asset-ignore.ts` will reduce memory allocations by avoiding the creation of a new object on every `matchGlob` call. Currently, `matchGlob` is called for every file × pattern combination during filtering operations, which can be thousands of calls for large themes.

## Approach
Move the `matchOpts` constant from inside `matchGlob` function to module scope. The options `{matchBase: true, noglobstar: true}` are static and never change, so creating them once is more efficient than creating them on every call.

## Code Changes

### File: `packages/theme/src/cli/utilities/asset-ignore.ts`

**Before:**
```typescript
function matchGlob(key: string, pattern: string) {
  const matchOpts = {
    matchBase: true,
    noglobstar: true,
  }

  if (originalMatchGlob(key, pattern, matchOpts)) return true
  ...
}
```

**After:**
```typescript
// Hoist matchGlob options to module level to avoid object allocation per call
const MATCH_GLOB_OPTIONS = {
  matchBase: true,
  noglobstar: true,
} as const

function matchGlob(key: string, pattern: string) {
  if (originalMatchGlob(key, pattern, MATCH_GLOB_OPTIONS)) return true
  ...
}
```

## Implementation

1. Add the constant at module level, near the other module-level constants (after `templatesRegex`)
2. Update `matchGlob` to use the constant instead of creating a new object

## Success Criteria
- All 561 theme package tests pass
- No type errors
- The optimization is semantically equivalent (same behavior, fewer allocations)

## Instructions

Execute these changes:
1. Open `packages/theme/src/cli/utilities/asset-ignore.ts`
2. Add after line 8 (after `const templatesRegex = ...`):
   ```typescript
   const MATCH_GLOB_OPTIONS = {
     matchBase: true,
     noglobstar: true,
   } as const
   ```
3. In the `matchGlob` function (around line 88-112), replace:
   ```typescript
   const matchOpts = {
     matchBase: true,
     noglobstar: true,
   }
   ```
   With nothing (remove these lines)
4. Replace all occurrences of `matchOpts` with `MATCH_GLOB_OPTIONS` in that function

Run tests with: `pnpm --filter @shopify/theme vitest run`
