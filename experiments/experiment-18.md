# Experiment 18: Hoist request duration RegExp to module level in log-request-line.ts

## Hypothesis

Hoisting the `cfRequestDuration` regex pattern to module level will eliminate repeated RegExp compilation on every HTTP request, reducing object allocation and CPU overhead in the hot path.

## Background

In `packages/theme/src/cli/utilities/log-request-line.ts`, the `logRequestLine` function is called for every HTTP request. At line 27, a regex `/cfRequestDuration;dur=([\d.]+)/` is created inline to extract request duration from server-timing headers.

Currently:
```typescript
const requestDuration = serverTiming?.match(/cfRequestDuration;dur=([\d.]+)/)?.[1]
```

This creates a new RegExp object on every request. Moving it to module level ensures the pattern is compiled once at module initialization.

## Approach

1. Add a new module-level constant `CF_REQUEST_DURATION_PATTERN` at the top of `log-request-line.ts`
2. Replace the inline regex with the constant

## Code Changes

### File: packages/theme/src/cli/utilities/log-request-line.ts

**Before (line 27):**
```typescript
const requestDuration = serverTiming?.match(/cfRequestDuration;dur=([\d.]+)/)?.[1]
```

**After:**
Add at module level (after line 11):
```typescript
const CF_REQUEST_DURATION_PATTERN = /cfRequestDuration;dur=([\d.]+)/
```

And change line 27 to:
```typescript
const requestDuration = serverTiming?.match(CF_REQUEST_DURATION_PATTERN)?.[1]
```

## Implementation

Edit the file `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/log-request-line.ts`:

1. After line 11 (`const CHARACTER_TRUNCATION_LIMIT = 80`), add:
   ```typescript
   const CF_REQUEST_DURATION_PATTERN = /cfRequestDuration;dur=([\d.]+)/
   ```

2. Change line 27 from:
   ```typescript
   const requestDuration = serverTiming?.match(/cfRequestDuration;dur=([\d.]+)/)?.[1]
   ```
   to:
   ```typescript
   const requestDuration = serverTiming?.match(CF_REQUEST_DURATION_PATTERN)?.[1]
   ```

## Success Criteria

1. All 561 tests pass (`pnpm --filter @shopify/theme vitest run`)
2. Type checking passes (`pnpm type-check`)
3. The regex is compiled once at module init instead of once per request

## Verification

After making the changes, run:
```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
pnpm --filter @shopify/theme vitest run
```

All tests should pass, confirming the refactor maintains correct behavior.
