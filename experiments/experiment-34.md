# Experiment 34: Replace split(';') with indexOf iteration in parseCookies

## Hypothesis
Replacing `cookies.split(';').forEach()` with manual string iteration using indexOf will eliminate array allocation per cookie parsing call, improving performance on the request hot path.

## Background
The `parseCookies` function in `cookies.ts` is called for every request that needs to parse cookies. Currently it uses `cookies.split(';')` which allocates a new array on each call. By iterating through the string manually with indexOf, we can process each cookie without creating intermediate arrays.

## Approach
Modify `parseCookies` in `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/cookies.ts` to:

1. Use a while loop with indexOf(';') to find each cookie boundary
2. Extract cookie substrings directly without creating an intermediate array
3. Process each cookie segment the same way (finding '=' and extracting key/value)

## Code Changes

### File: packages/theme/src/cli/utilities/theme-environment/cookies.ts

**Current code:**
```typescript
export function parseCookies(cookies: string) {
  const cookiesRecord: Record<string, string> = {}

  cookies.split(';').forEach((cookie) => {
    const eqIdx = cookie.indexOf('=')
    if (eqIdx === -1) return

    const key = cookie.substring(0, eqIdx).trim()
    const value = cookie.substring(eqIdx + 1).trim()

    if (key) {
      cookiesRecord[key] = value
    }
  })

  return cookiesRecord
}
```

**New code:**
```typescript
export function parseCookies(cookies: string) {
  const cookiesRecord: Record<string, string> = {}

  let start = 0
  let end = cookies.indexOf(';')

  while (end !== -1) {
    const cookie = cookies.substring(start, end)
    const eqIdx = cookie.indexOf('=')
    if (eqIdx !== -1) {
      const key = cookie.substring(0, eqIdx).trim()
      const value = cookie.substring(eqIdx + 1).trim()
      if (key) {
        cookiesRecord[key] = value
      }
    }
    start = end + 1
    end = cookies.indexOf(';', start)
  }

  // Process the last cookie (or only cookie if no semicolons)
  if (start < cookies.length) {
    const cookie = cookies.substring(start)
    const eqIdx = cookie.indexOf('=')
    if (eqIdx !== -1) {
      const key = cookie.substring(0, eqIdx).trim()
      const value = cookie.substring(eqIdx + 1).trim()
      if (key) {
        cookiesRecord[key] = value
      }
    }
  }

  return cookiesRecord
}
```

## Success Criteria
1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type check passes: `pnpm type-check`
3. Cookie parsing behavior unchanged (same output for same input)

## Instructions for Implementation

1. Read the current cookies.ts file
2. Replace the parseCookies function with the optimized version that uses indexOf iteration
3. Run tests to verify correctness
4. Run type-check to ensure TypeScript compliance
