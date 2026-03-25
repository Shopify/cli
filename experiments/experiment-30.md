# Experiment 30: Replace regex cookie parsing with indexOf/substring in parseCookies

## Hypothesis
Replacing `cookie.match(COOKIE_PARSE_PATTERN)` with `indexOf('=')` and `substring()` in `parseCookies` will eliminate regex matching overhead on every cookie in every HTTP request.

## Background
The `parseCookies` function in `cookies.ts` parses cookie strings into key-value records. Currently it uses a regex pattern `/(.*?)=(.*)$/` to extract the key and value. Since cookies follow a simple `key=value` format, this can be done more efficiently with `indexOf` to find the `=` separator, then `substring` to extract parts.

## Approach
In `packages/theme/src/cli/utilities/theme-environment/cookies.ts`:

1. Remove the `COOKIE_PARSE_PATTERN` constant (no longer needed)
2. Replace the regex match with indexOf/substring:
   - Use `indexOf('=')` to find the separator
   - Use `substring(0, idx)` for the key
   - Use `substring(idx + 1)` for the value
   - Handle edge case where no `=` exists (skip the cookie)

## Code Changes

**File: `packages/theme/src/cli/utilities/theme-environment/cookies.ts`**

Replace the entire file with:

```typescript
export function parseCookies(cookies: string) {
  const cookiesRecord: Record<string, string> = {}

  cookies.split(';').forEach((cookie) => {
    const eqIdx = cookie.indexOf('=')
    if (eqIdx === -1) return

    const key = cookie.substring(0, eqIdx).trim()
    const value = cookie.substring(eqIdx + 1).trim()

    if (key) {
      cookiesRecord[key] = value
    }
  })

  return cookiesRecord
}

export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
```

## Success Criteria
1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. The regex pattern constant is removed
4. Cookie parsing uses indexOf/substring instead of regex match

## Execution
```bash
cd /Users/joshuafaigan/src/github.com/Shopify/cli
```

Apply the changes to `packages/theme/src/cli/utilities/theme-environment/cookies.ts` as specified above, then run the tests.
