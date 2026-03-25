# Experiment 7: Hoist EXTENSION_CDN_PREFIX RegExp to module level

## Hypothesis
Creating `new RegExp(EXTENSION_CDN_PREFIX, 'g')` inside `proxyStorefrontRequest` allocates a new RegExp object on every function call. Since `EXTENSION_CDN_PREFIX` is a module-level constant (`'/ext/cdn/'`), this RegExp can be pre-compiled once at module initialization, eliminating repeated allocations.

## Target File
`packages/theme/src/cli/utilities/theme-environment/proxy.ts`

## Change Description
At line 298, there is:
```typescript
const path = event.path.replace(new RegExp(EXTENSION_CDN_PREFIX, 'g'), '/')
```

The fix:
1. Add a new module-level constant near line 22 (after `EXTENSION_CDN_PATTERN`):
   ```typescript
   const EXTENSION_CDN_GLOBAL_PATTERN = new RegExp(EXTENSION_CDN_PREFIX, 'g')
   ```

2. Replace line 298 to use the pre-compiled pattern:
   ```typescript
   const path = event.path.replace(EXTENSION_CDN_GLOBAL_PATTERN, '/')
   ```

Note: Using a global RegExp with `String.replace()` is safe because `replace()` always searches from the beginning of the string and does not use the `lastIndex` property.

## Success Criteria
- All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
- Type checking passes: `pnpm type-check`
- No functional changes to behavior

## Implementation Steps
1. Read the current proxy.ts file
2. Add `EXTENSION_CDN_GLOBAL_PATTERN` constant after line 22
3. Update line 298 to use `EXTENSION_CDN_GLOBAL_PATTERN`
4. Run tests to verify

## Commands to Run After Implementation
```bash
pnpm --filter @shopify/theme vitest run
```
