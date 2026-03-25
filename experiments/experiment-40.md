# Experiment 40: Replace chained .replace() with single replace in getStoreFqdnForRegEx

## Hypothesis
Replacing chained `.replace(/\\/g, '\\\\').replace(/\./g, '\\.')` with a single `.replace(/[\\.]/g, callback)` in `getStoreFqdnForRegEx` will eliminate an intermediate string allocation per call. This function is called multiple times per HTML response (in `injectCdnProxy`, `patchBaseUrlAttributes`, `patchCookieDomains`).

## Approach
Replace:
```javascript
function getStoreFqdnForRegEx(ctx: DevServerContext) {
  return ctx.session.storeFqdn.replace(/\\/g, '\\\\').replace(/\./g, '\\.')
}
```

With:
```javascript
function getStoreFqdnForRegEx(ctx: DevServerContext) {
  return ctx.session.storeFqdn.replace(/[\\.]/g, (char) => (char === '\\' ? '\\\\' : '\\.'))
}
```

## Changes

### File: packages/theme/src/cli/utilities/theme-environment/proxy.ts

Find this function (around line 123-125):
```javascript
function getStoreFqdnForRegEx(ctx: DevServerContext) {
  return ctx.session.storeFqdn.replace(/\\/g, '\\\\').replace(/\./g, '\\.')
}
```

Replace with:
```javascript
function getStoreFqdnForRegEx(ctx: DevServerContext) {
  return ctx.session.storeFqdn.replace(/[\\.]/g, (char) => (char === '\\' ? '\\\\' : '\\.'))
}
```

## Success Criteria
- All 561 tests pass
- Type checking passes
- Single regex replace instead of chained replace calls
