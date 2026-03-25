# Experiment 43: Cache store-specific regex patterns in proxy.ts

## Hypothesis
Caching the escaped storeFqdn string and compiled regex patterns per store will eliminate 4 `getStoreFqdnForRegEx()` calls and 4 `new RegExp()` calls per HTML response, reducing allocations on the hot proxy path.

## Background
In `proxy.ts`, the functions `injectCdnProxy`, `patchBaseUrlAttributes`, and `patchCookieDomains` each create new RegExp objects using `getStoreFqdnForRegEx(ctx)`. Since the storeFqdn doesn't change during a dev session, these can be cached.

Current calls per HTML response:
- Line 136-137: beaconEndpointRE (injectCdnProxy)
- Line 141: vanityCdnRE (injectCdnProxy)
- Line 177: dataBaseUrlRE (patchBaseUrlAttributes)
- Line 184: domainRE (patchCookieDomains)

## Approach
1. Create a cache Map at module level keyed by storeFqdn
2. Cache the escaped FQDN string and all 4 compiled regex patterns
3. Return cached patterns on subsequent calls for the same store

## Code Changes

In `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/proxy.ts`:

1. Add a cache structure after the existing constants (around line 45):
```typescript
// Cache for store-specific regex patterns (keyed by storeFqdn)
interface StorePatternCache {
  escapedFqdn: string
  beaconEndpointRE: RegExp
  vanityCdnRE: RegExp
  dataBaseUrlRE: RegExp
  domainRE: RegExp
}
const storePatternCache = new Map<string, StorePatternCache>()

function getStorePatterns(ctx: DevServerContext): StorePatternCache {
  const storeFqdn = ctx.session.storeFqdn
  let cached = storePatternCache.get(storeFqdn)
  if (!cached) {
    const escapedFqdn = storeFqdn.replace(/[\\.]/g, (char) => (char === '\\' ? '\\\\' : '\\.'))
    cached = {
      escapedFqdn,
      beaconEndpointRE: new RegExp(`(data-shs-beacon-endpoint=["'])https://${escapedFqdn}${API_COLLECT_PATH}`, 'g'),
      vanityCdnRE: new RegExp(`(https?:)?//${escapedFqdn}${VANITY_CDN_PREFIX}`, 'g'),
      dataBaseUrlRE: new RegExp(`data-base-url=["']((?:https?:)?//${escapedFqdn})[^"']*?["']`, 'g'),
      domainRE: new RegExp(`Domain=${escapedFqdn};\\s*`, 'gi'),
    }
    storePatternCache.set(storeFqdn, cached)
  }
  return cached
}
```

2. Update `injectCdnProxy` to use cached patterns (lines 132-142):
```typescript
export function injectCdnProxy(originalContent: string, ctx: DevServerContext) {
  let content = originalContent
  const patterns = getStorePatterns(ctx)

  // -- The beacon endpoint is patched in injectCdnProxy to be proxied and ignored locally
  content = content.replace(patterns.beaconEndpointRE, `$1${API_COLLECT_PATH}`)

  // -- Redirect all usages to the vanity CDN to the local server:
  content = content.replace(patterns.vanityCdnRE, VANITY_CDN_PREFIX)
```

3. Update `patchBaseUrlAttributes` to use cached patterns (lines 175-180):
```typescript
function patchBaseUrlAttributes(html: string, ctx: DevServerContext) {
  const newBaseUrl = `http://${ctx.options.host}:${ctx.options.port}`
  const patterns = getStorePatterns(ctx)

  return html.replace(patterns.dataBaseUrlRE, (match, m1) => match.replace(m1, newBaseUrl))
}
```

4. Update `patchCookieDomains` to use cached patterns (lines 182-186):
```typescript
function patchCookieDomains(cookieHeader: string[], ctx: DevServerContext) {
  // Domains are invalid for localhost:
  const patterns = getStorePatterns(ctx)
  return cookieHeader.map((value) => value.replace(patterns.domainRE, ''))
}
```

5. Remove the now-unused `getStoreFqdnForRegEx` function (lines 123-125).

## Success Criteria
- All 561 tests pass
- Type checking passes
- 4 regex compilations eliminated per HTML response (now cached per store)

## Verification
```bash
pnpm --filter @shopify/theme vitest run
pnpm type-check
```
