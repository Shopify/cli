# Experiment 6: Hoist shouldLog arrays and convert ignoredExtensions to Set

## Hypothesis
The `shouldLog` function in `log-request-line.ts` creates two arrays on every call and uses `.includes()` for extension lookup. This function is called for every request to the dev server. Hoisting these arrays to module-level constants and converting `ignoredExtensions` to a Set will:
1. Eliminate repeated array allocations (N allocations → 1)
2. Convert extension lookup from O(n) to O(1)

## Approach
1. Move `ignoredPathPrefixes` array to a module-level constant `IGNORED_PATH_PREFIXES`
2. Convert `ignoredExtensions` array to a module-level Set constant `IGNORED_EXTENSIONS`
3. Replace `.includes(extension)` with `.has(extension)`

## Code Changes

File: `packages/theme/src/cli/utilities/log-request-line.ts`

### Change 1: Add module-level constants after imports

After line 7 (`import type {DevServerContext} from './theme-environment/types.js'`), add:

```typescript
const IGNORED_PATH_PREFIXES = [EXTENSION_CDN_PREFIX, VANITY_CDN_PREFIX, '/checkouts', '/payments']
const IGNORED_EXTENSIONS = new Set(['.js', '.css', '.json', '.map'])
```

### Change 2: Simplify shouldLog function

Replace the `shouldLog` function (lines 41-53) with:

```typescript
export function shouldLog(event: H3Event) {
  if (IGNORED_PATH_PREFIXES.some((prefix) => event.path.startsWith(prefix))) return false

  const [pathname] = event.path.split('?') as [string]
  const extension = extname(pathname)

  if (IGNORED_EXTENSIONS.has(extension)) return false

  return true
}
```

## Success Criteria
1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No behavioral changes - only performance improvement

## Expected Impact
- Eliminates 2 array allocations per request
- O(1) extension lookup instead of O(n) where n=4
- Most impactful during high-frequency dev server usage
