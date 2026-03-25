# Experiment 10: Hoist TEMPLATE_UPDATE_EXTENSIONS array to module-level Set

## Hypothesis
Converting the inline array `['.liquid', '.json']` in `needsTemplateUpdate()` to a module-level Set will:
1. Eliminate array allocation on every call
2. Provide O(1) lookup instead of O(n) array traversal

## Target File
`packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`

## Current Code (line 70)
```typescript
function needsTemplateUpdate(fileKey: string) {
  return !fileKey.startsWith('assets/') && ['.liquid', '.json'].includes(extname(fileKey))
}
```

## Proposed Change
```typescript
// Add at module level (near other constants)
const TEMPLATE_UPDATE_EXTENSIONS = new Set(['.liquid', '.json'])

// Update function
function needsTemplateUpdate(fileKey: string) {
  return !fileKey.startsWith('assets/') && TEMPLATE_UPDATE_EXTENSIONS.has(extname(fileKey))
}
```

## Implementation Steps
1. Read the file to find the appropriate location for the constant
2. Add the `TEMPLATE_UPDATE_EXTENSIONS` Set constant at module level
3. Update `needsTemplateUpdate` to use `TEMPLATE_UPDATE_EXTENSIONS.has()` instead of `[...].includes()`
4. Run tests to verify no regressions

## Success Criteria
- All tests pass
- No type errors
- Set is used instead of inline array allocation

## Verification Commands
```bash
pnpm --filter @shopify/theme vitest run
pnpm type-check
```
