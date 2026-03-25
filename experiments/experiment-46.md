# Experiment 46: Group IGNORED_ENDPOINTS by first character for faster prefix lookup

## Hypothesis
Replacing `IGNORED_ENDPOINTS.some((endpoint) => event.path.startsWith(endpoint))` with a Map-based lookup grouped by the first significant path character will reduce iteration count from 8 to ~1-2 per request on average.

## Current Code (proxy.ts lines 27-38, 76)
```typescript
const IGNORED_ENDPOINTS = [
  '/.well-known',
  '/shopify/monorail',
  '/mini-profiler-resources',
  '/web-pixels-manager',
  '/web-pixels@',
  '/wpm',
  '/services/',
  API_COLLECT_PATH,  // '/api/collect'
  '/cdn-cgi/challenge-platform',
]

// Line 76 in getProxyHandler:
if (IGNORED_ENDPOINTS.some((endpoint) => event.path.startsWith(endpoint))) {
```

## Approach
1. Create a Map that groups endpoints by their first character after `/` (e.g., 'a' -> ['/api/collect'], 'w' -> ['/wpm', '/web-pixels-manager', '/web-pixels@'])
2. Create a helper function `isIgnoredEndpoint(path)` that:
   - Extracts the first character after `/` from the path
   - Looks up the endpoints group in the Map (O(1))
   - Only iterates over the small group of endpoints with matching prefix
3. Replace the `.some()` call with the new function

## Code Changes

### File: packages/theme/src/cli/utilities/theme-environment/proxy.ts

Replace lines 27-38 (IGNORED_ENDPOINTS array) with:
```typescript
// Group ignored endpoints by first character after '/' for efficient prefix lookup
const IGNORED_ENDPOINT_GROUPS = new Map<string, string[]>()
const IGNORED_ENDPOINTS_LIST = [
  '/.well-known',
  '/shopify/monorail',
  '/mini-profiler-resources',
  '/web-pixels-manager',
  '/web-pixels@',
  '/wpm',
  '/services/',
  API_COLLECT_PATH,
  '/cdn-cgi/challenge-platform',
]

// Build the grouped Map at module init
for (const endpoint of IGNORED_ENDPOINTS_LIST) {
  const key = endpoint.charAt(1) // First char after '/'
  const group = IGNORED_ENDPOINT_GROUPS.get(key)
  if (group) {
    group.push(endpoint)
  } else {
    IGNORED_ENDPOINT_GROUPS.set(key, [endpoint])
  }
}

function isIgnoredEndpoint(path: string): boolean {
  const key = path.charAt(1)
  const group = IGNORED_ENDPOINT_GROUPS.get(key)
  if (!group) return false
  return group.some((endpoint) => path.startsWith(endpoint))
}
```

Then replace line 76:
```typescript
// Before:
if (IGNORED_ENDPOINTS.some((endpoint) => event.path.startsWith(endpoint))) {
// After:
if (isIgnoredEndpoint(event.path)) {
```

## Success Criteria
- All 561 tests pass
- Type check passes
- The optimization groups 8 endpoints into 6 buckets (average group size ~1.3)
- Most requests only check 1-2 endpoints instead of 8

## Implementation Instructions
1. Read the current proxy.ts file
2. Apply the changes described above
3. Run: `pnpm --filter @shopify/theme vitest run`
4. Run: `pnpm type-check`
