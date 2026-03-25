# Experiment 23: Replace split('?') with indexOf/substring in html.ts

## Hypothesis

Replacing `event.path.split('?')` calls with `indexOf`/`substring` patterns in `html.ts` will eliminate array allocations from the HTML request handler hot path. Since every HTML request goes through `getHtmlHandler` and potentially `isKnownRenderingRequest`, this should reduce GC pressure.

## Target File

`packages/theme/src/cli/utilities/theme-environment/html.ts`

## Current Code

### Line 31 (in getHtmlHandler):
```typescript
const [browserPathname = '/', browserSearch = ''] = event.path.split('?')
```

### Line 167 (in isKnownRenderingRequest):
```typescript
const searchParams = new URLSearchParams(event.path.split('?')[1])
```

## Proposed Changes

### Change 1: Line 31
Replace array destructuring of split() result with indexOf/substring:
```typescript
const questionMarkIndex = event.path.indexOf('?')
const browserPathname = questionMarkIndex === -1 ? event.path : event.path.substring(0, questionMarkIndex) || '/'
const browserSearch = questionMarkIndex === -1 ? '' : event.path.substring(questionMarkIndex + 1)
```

### Change 2: Line 167
Replace split()[1] with indexOf/substring:
```typescript
const questionMarkIndex = event.path.indexOf('?')
const searchParams = new URLSearchParams(questionMarkIndex === -1 ? '' : event.path.substring(questionMarkIndex + 1))
```

## Implementation

Edit `packages/theme/src/cli/utilities/theme-environment/html.ts`:

1. In `getHtmlHandler` function (around line 31), replace:
```typescript
const [browserPathname = '/', browserSearch = ''] = event.path.split('?')
```
with:
```typescript
const questionMarkIndex = event.path.indexOf('?')
const browserPathname = questionMarkIndex === -1 ? event.path : event.path.substring(0, questionMarkIndex) || '/'
const browserSearch = questionMarkIndex === -1 ? '' : event.path.substring(questionMarkIndex + 1)
```

2. In `isKnownRenderingRequest` function (around line 167), replace:
```typescript
const searchParams = new URLSearchParams(event.path.split('?')[1])
```
with:
```typescript
const questionMarkIndex = event.path.indexOf('?')
const searchParams = new URLSearchParams(questionMarkIndex === -1 ? '' : event.path.substring(questionMarkIndex + 1))
```

## Success Criteria

1. All 561 tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No behavioral changes - the extracted pathname and search values should be identical

## Rationale

This follows the same pattern successfully applied in experiments 21 and 22, where split() operations were replaced with indexOf/substring to eliminate array allocations. The html.ts file handles every HTML request, making it a high-value optimization target.
