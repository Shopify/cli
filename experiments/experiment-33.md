# Experiment 33: Hoist asset path and query string RegExp patterns in proxyStorefrontRequest

## Hypothesis

In `packages/theme/src/cli/utilities/theme-environment/proxy.ts`, the `proxyStorefrontRequest` function has two inline regex patterns on line 317:

```javascript
if (/\/assets\/[^/]+\.(css|js)$/.test(url.pathname) && /\?\d+$/.test(url.search)) {
```

These patterns are compiled on every proxy request. By hoisting them to module-level constants, we eliminate repeated RegExp compilation on each request.

## Approach

1. Add two new constants at module level:
   - `ASSET_CSS_JS_PATTERN` for `/\/assets\/[^/]+\.(css|js)$/`
   - `NUMERIC_QUERY_PATTERN` for `/\?\d+$/`

2. Replace the inline patterns with references to these constants.

## Changes

File: `packages/theme/src/cli/utilities/theme-environment/proxy.ts`

### Add constants near other pattern constants (around line 24)

After the existing pattern constants, add:
```typescript
const ASSET_CSS_JS_PATTERN = /\/assets\/[^/]+\.(css|js)$/
const NUMERIC_QUERY_PATTERN = /\?\d+$/
```

### Update line 317

Replace:
```typescript
  if (/\/assets\/[^/]+\.(css|js)$/.test(url.pathname) && /\?\d+$/.test(url.search)) {
```

With:
```typescript
  if (ASSET_CSS_JS_PATTERN.test(url.pathname) && NUMERIC_QUERY_PATTERN.test(url.search)) {
```

## Success Criteria

1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No functional changes to behavior

## Implementation

Make the following edits:

1. In `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/proxy.ts`:

   Add after line 23 (after `const EXTENSION_CDN_GLOBAL_PATTERN`):
   ```typescript
   const ASSET_CSS_JS_PATTERN = /\/assets\/[^/]+\.(css|js)$/
   const NUMERIC_QUERY_PATTERN = /\?\d+$/
   ```

   Replace line 317:
   ```typescript
     if (/\/assets\/[^/]+\.(css|js)$/.test(url.pathname) && /\?\d+$/.test(url.search)) {
   ```
   With:
   ```typescript
     if (ASSET_CSS_JS_PATTERN.test(url.pathname) && NUMERIC_QUERY_PATTERN.test(url.search)) {
   ```
