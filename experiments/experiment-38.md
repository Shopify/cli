# Experiment 38: Hoist defaultHeaders object to module level

## Hypothesis

The `defaultHeaders()` function in `storefront-utils.ts` creates a new object on every call, but the `CLI_KIT_VERSION` is a constant imported at module load time. By hoisting the headers object to a module-level constant, we eliminate object allocation per request.

This function is called in:
- `storefront-renderer.ts` (2 calls per render request)
- `storefront-session.ts` (2 calls per session request)
- `proxy.ts` (1 call per proxy request)

## Approach

1. Create a `DEFAULT_HEADERS` constant at module level with the User-Agent header
2. Change `defaultHeaders()` to return the constant instead of creating a new object
3. Since the object is spread into new objects at call sites (e.g., `{...headers, ...defaultHeaders()}`), returning the same reference is safe - the spread creates new objects at the call site

## Code Changes

File: `packages/theme/src/cli/utilities/theme-environment/storefront-utils.ts`

Change from:
```typescript
export function defaultHeaders() {
  return {
    'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
  }
}
```

Change to:
```typescript
const DEFAULT_HEADERS = {
  'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
}

export function defaultHeaders() {
  return DEFAULT_HEADERS
}
```

## Success Criteria

1. All 561 tests pass
2. Type check passes
3. Object allocation eliminated from defaultHeaders() calls

## Implementation

Make the edit to `packages/theme/src/cli/utilities/theme-environment/storefront-utils.ts`:

1. Add `DEFAULT_HEADERS` constant after the import statements (before line 4)
2. Modify `defaultHeaders()` to return `DEFAULT_HEADERS` instead of creating new object

The constant should be defined as:
```typescript
const DEFAULT_HEADERS = {
  'User-Agent': `Shopify CLI; v=${CLI_KIT_VERSION}`,
}
```
