# Experiment 24: Replace split('?') with indexOf/substring in log-request-line.ts

## Hypothesis
Replacing `event.path.split('?')[0]` with `indexOf('?')` + `substring()` in `shouldLog()` will eliminate an array allocation per request without changing behavior.

## Rationale
The `shouldLog()` function is called for every HTTP request to determine if it should be logged. Currently line 47 uses:
```typescript
const [pathname] = event.path.split('?') as [string]
```

This creates an array just to extract the first element. Using `indexOf` + `substring` avoids the array allocation entirely.

## Approach
In `/packages/theme/src/cli/utilities/log-request-line.ts`, change line 47 from:
```typescript
const [pathname] = event.path.split('?') as [string]
```
to:
```typescript
const qIdx = event.path.indexOf('?')
const pathname = qIdx === -1 ? event.path : event.path.substring(0, qIdx)
```

## Success Criteria
- All 561 tests pass
- Type checking passes
- No behavioral changes

## Files to Modify
- `packages/theme/src/cli/utilities/log-request-line.ts`

## Implementation

Read the file first, then apply the edit:

1. In `shouldLog()`, replace the split pattern with indexOf/substring:
   - Line 47: `const [pathname] = event.path.split('?') as [string]`
   - Becomes:
     ```typescript
     const qIdx = event.path.indexOf('?')
     const pathname = qIdx === -1 ? event.path : event.path.substring(0, qIdx)
     ```

After making the change, verify with:
```bash
pnpm --filter @shopify/theme vitest run
```
