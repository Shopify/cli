# Experiment 41: Pre-compute kind prefixes in getLiquidFilesByKind

## Hypothesis

The `getLiquidFilesByKind` function in `local-assets.ts` creates a template string `` `${kind}s/` `` on every call. Since `kind` is a fixed union type (`'section' | 'block' | 'snippet'`), we can pre-compute these prefixes as module-level constants using a Map lookup, eliminating string template creation per call.

## Approach

Replace the inline template string with a Map lookup:
- Add `KIND_PREFIXES` Map at module level with pre-computed prefix strings
- Update `getLiquidFilesByKind` to use Map.get() instead of template literal

## Code Changes

In `packages/theme/src/cli/utilities/theme-environment/local-assets.ts`:

1. Add after line 18 (after LIQUID_BASENAME_PATTERN):
```typescript
const KIND_PREFIXES = new Map([
  ['section', 'sections/'],
  ['block', 'blocks/'],
  ['snippet', 'snippets/'],
] as const)
```

2. Replace line 204:
```typescript
// OLD:
return key.endsWith('.liquid') && key.startsWith(`${kind}s/`)

// NEW:
return key.endsWith('.liquid') && key.startsWith(KIND_PREFIXES.get(kind)!)
```

## Implementation Instructions

1. Read the file `packages/theme/src/cli/utilities/theme-environment/local-assets.ts`
2. Add the KIND_PREFIXES constant after the LIQUID_BASENAME_PATTERN constant (around line 18)
3. Update the filter callback in getLiquidFilesByKind to use KIND_PREFIXES.get(kind)! instead of the template string

## Success Criteria

- All 561 theme package tests pass
- Type checking passes
- String template allocation eliminated from getLiquidFilesByKind hot path

## Verification

```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run
```
