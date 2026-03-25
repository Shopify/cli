# Experiment 22: Replace split() with indexOf/substring in proxy.ts

## Hypothesis
Replacing `split('?')[0]`, `split('/').at(-1)`, and array destructuring `split('?')` patterns in proxy.ts with indexOf/substring will eliminate array allocations in the proxy request hot path, improving performance.

## Background
The proxy handler in `proxy.ts` processes every non-HTML request. Currently, it allocates arrays unnecessarily:
- Line 53: `event.path.split('?')[0]` - allocates array to get pathname
- Line 60: `pathname.split('/').at(-1)` - allocates array to get filename
- Line 109: `const [pathname] = event.path.split('?')` - allocates array for destructuring

These patterns were successfully optimized in experiment-21 for hot-reload/server.ts. The same optimization applies here.

## Approach
Replace array-allocating split patterns with indexOf/substring:

1. **Line 53**: `event.path.split('?')[0] ?? ''`
   - Change to: `const qIdx = event.path.indexOf('?'); const pathname = qIdx === -1 ? event.path : event.path.substring(0, qIdx)`

2. **Line 60**: `pathname.split('/').at(-1) ?? ''`
   - Change to: `const slashIdx = pathname.lastIndexOf('/'); const fileName = slashIdx === -1 ? pathname : pathname.substring(slashIdx + 1)`

3. **Line 109**: `const [pathname] = event.path.split('?') as [string]`
   - Change to: `const qIdx2 = event.path.indexOf('?'); const pathname = qIdx2 === -1 ? event.path : event.path.substring(0, qIdx2)`

## Files to Modify
- `packages/theme/src/cli/utilities/theme-environment/proxy.ts`

## Success Criteria
- All 561 tests pass
- Type checking passes
- No array allocations in the proxy hot path for these string operations

## Implementation

Edit `packages/theme/src/cli/utilities/theme-environment/proxy.ts`:

### Change 1: Lines 52-55
Replace:
```typescript
    if (canProxyRequest(event)) {
      const pathname = event.path.split('?')[0] ?? ''
```

With:
```typescript
    if (canProxyRequest(event)) {
      const queryIdx = event.path.indexOf('?')
      const pathname = queryIdx === -1 ? event.path : event.path.substring(0, queryIdx)
```

### Change 2: Line 60
Replace:
```typescript
            const fileName = pathname.split('/').at(-1) ?? ''
```

With:
```typescript
            const slashIdx = pathname.lastIndexOf('/')
            const fileName = slashIdx === -1 ? pathname : pathname.substring(slashIdx + 1)
```

### Change 3: Line 109
Replace:
```typescript
  const [pathname] = event.path.split('?') as [string]
```

With:
```typescript
  const qIdx = event.path.indexOf('?')
  const pathname = qIdx === -1 ? event.path : event.path.substring(0, qIdx)
