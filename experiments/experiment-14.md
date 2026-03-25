# Experiment 14: Hoist KNOWN_RENDERING_PARAMS to module-level Set in html.ts

## Hypothesis
Converting the inline array `['section_id', 'sections', 'app_block_id']` in `isKnownRenderingRequest()` to a module-level Set will eliminate array allocation per request and provide O(1) lookup instead of O(n) array iteration.

## Context
The function `isKnownRenderingRequest()` in `html.ts` is called on every HTML request (line 60 in `getHtmlHandler`). Currently it creates a new array on each call:

```typescript
function isKnownRenderingRequest(event: H3Event) {
  const searchParams = new URLSearchParams(event.path.split('?')[1])
  return ['section_id', 'sections', 'app_block_id'].some((key) => searchParams.has(key))
}
```

## Approach
1. Add a module-level constant `KNOWN_RENDERING_PARAMS` as a Set containing the three param names
2. Modify `isKnownRenderingRequest()` to iterate over the Set or check params against the Set

## File to Modify
`packages/theme/src/cli/utilities/theme-environment/html.ts`

## Specific Changes

### Change 1: Add module-level constant after imports (around line 15)
Add after existing imports and before the `themeIdMismatchRedirects` variable:

```typescript
/**
 * URL params that indicate a request should be handled by SFR.
 * Pre-allocated as Set for O(1) lookup.
 */
const KNOWN_RENDERING_PARAMS = new Set(['section_id', 'sections', 'app_block_id'])
```

### Change 2: Update isKnownRenderingRequest function (line 160-163)
Replace the current implementation:

```typescript
function isKnownRenderingRequest(event: H3Event) {
  const searchParams = new URLSearchParams(event.path.split('?')[1])
  return ['section_id', 'sections', 'app_block_id'].some((key) => searchParams.has(key))
}
```

With:

```typescript
function isKnownRenderingRequest(event: H3Event) {
  const searchParams = new URLSearchParams(event.path.split('?')[1])
  for (const key of KNOWN_RENDERING_PARAMS) {
    if (searchParams.has(key)) return true
  }
  return false
}
```

## Success Criteria
- All 561 tests pass
- Array allocation eliminated from request hot path
- O(1) Set membership check (constant has pre-known keys)

## Rationale
This follows the same pattern as experiments 10, 11, and 13 which hoisted inline arrays to module-level constants in hot code paths. The `isKnownRenderingRequest()` function runs on every HTML request, so eliminating the array allocation provides a small but consistent win.
