# Experiment 49: Eliminate URLSearchParams allocation in isKnownRenderingRequest

## Hypothesis

The `isKnownRenderingRequest` function in `html.ts` creates a new `URLSearchParams` object on every HTML request just to check if any of 3 known params (`section_id`, `sections`, `app_block_id`) exist. This allocation can be eliminated by using string indexOf checks instead, avoiding the parsing overhead of URLSearchParams.

## Current Code (html.ts:179-186)

```typescript
function isKnownRenderingRequest(event: H3Event) {
  const questionMarkIndex = event.path.indexOf('?')
  const searchParams = new URLSearchParams(questionMarkIndex === -1 ? '' : event.path.substring(questionMarkIndex + 1))
  for (const key of KNOWN_RENDERING_PARAMS) {
    if (searchParams.has(key)) return true
  }
  return false
}
```

## Proposed Change

Replace URLSearchParams allocation with direct string indexOf checks:

```typescript
function isKnownRenderingRequest(event: H3Event) {
  const questionMarkIndex = event.path.indexOf('?')
  if (questionMarkIndex === -1) return false

  const queryString = event.path.substring(questionMarkIndex + 1)
  for (const param of KNOWN_RENDERING_PARAMS) {
    const paramWithEquals = param + '='
    const idx = queryString.indexOf(paramWithEquals)
    // Match if param is at start or preceded by &
    if (idx === 0 || (idx > 0 && queryString.charCodeAt(idx - 1) === 38)) { // 38 = '&'
      return true
    }
  }
  return false
}
```

## Implementation

Edit `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/html.ts`:

Replace lines 179-186 with the new implementation that avoids URLSearchParams.

## Success Criteria

1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. URLSearchParams allocation eliminated from hot path
