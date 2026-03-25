# Experiment 47: Replace join().match() with direct iteration to find session cookie

## Hypothesis
Replacing `setCookieHeader.join(',').match(SESSION_COOKIE_REGEXP)` with direct iteration through cookies will eliminate string allocation and allow early return when the session cookie is found.

## Current Code (proxy.ts lines 307-314)
```typescript
const setCookieHeader = response.headers.getSetCookie()
if (setCookieHeader?.length) {
  response.headers.set('Set-Cookie', patchCookieDomains(setCookieHeader, ctx).join(','))

  const latestShopifyEssential = setCookieHeader.join(',').match(SESSION_COOKIE_REGEXP)?.[1]
  if (latestShopifyEssential) {
    ctx.session.sessionCookies[SESSION_COOKIE_NAME] = latestShopifyEssential
  }
}
```

## Approach
1. Add a helper function `findSessionCookieValue(cookies: string[])` that iterates through cookies and returns the session cookie value
2. Replace the `join().match()` pattern with the helper function call
3. The helper uses a simpler string search instead of regex for better performance

## Code Changes

### File: packages/theme/src/cli/utilities/theme-environment/proxy.ts

Add a helper function after the SESSION_COOKIE_REGEXP constant (around line 62):
```typescript
const SESSION_COOKIE_PREFIX = `${SESSION_COOKIE_NAME}=`

function findSessionCookieValue(cookies: string[]): string | undefined {
  for (const cookie of cookies) {
    const startIndex = cookie.indexOf(SESSION_COOKIE_PREFIX)
    if (startIndex !== -1) {
      const valueStart = startIndex + SESSION_COOKIE_PREFIX.length
      const endIndex = cookie.indexOf(';', valueStart)
      return endIndex === -1 ? cookie.substring(valueStart) : cookie.substring(valueStart, endIndex)
    }
  }
  return undefined
}
```

Then replace lines 311-314 in patchProxyResponseHeaders:
```typescript
// Before:
  const latestShopifyEssential = setCookieHeader.join(',').match(SESSION_COOKIE_REGEXP)?.[1]
  if (latestShopifyEssential) {
    ctx.session.sessionCookies[SESSION_COOKIE_NAME] = latestShopifyEssential
  }

// After:
  const latestShopifyEssential = findSessionCookieValue(setCookieHeader)
  if (latestShopifyEssential) {
    ctx.session.sessionCookies[SESSION_COOKIE_NAME] = latestShopifyEssential
  }
```

## Success Criteria
- All 561 tests pass
- Type check passes
- String allocation from join() eliminated
- RegExp matching replaced with faster indexOf/substring

## Implementation Instructions
1. Read the current proxy.ts file
2. Add the SESSION_COOKIE_PREFIX constant after SESSION_COOKIE_REGEXP
3. Add the findSessionCookieValue helper function
4. Update the code in patchProxyResponseHeaders to use the new helper
5. Run: `pnpm --filter @shopify/theme vitest run`
6. Run: `pnpm type-check`
