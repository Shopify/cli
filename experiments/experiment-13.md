# Experiment 13: Hoist inline constants in getUpdatedFileParts hot path

## Hypothesis

Hoisting `validPrefixes`, `liquidTags`, and comment-stripping RegExp patterns to module level in `hot-reload/server.ts` will reduce allocations in `getUpdatedFileParts`, a function called on every file change during hot reload.

## Approach

1. Hoist `validPrefixes` array to module-level constant
2. Hoist `liquidTags` array to module-level constant (keeping `as const`)
3. Hoist three inline RegExp patterns for HTML/Liquid comment stripping to module level

## Success Criteria

- All tests pass: `pnpm --filter @shopify/theme vitest run`
- Type checking passes (implied by test run)

## Implementation

Edit `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`:

### Step 1: Add module-level constants near other constants (after line ~30)

Add these constants near the top of the file, after the existing module-level constants:

```typescript
// Constants for getUpdatedFileParts - hoisted from function body to avoid per-call allocation
const VALID_FILE_PREFIXES = ['sections/', 'snippets/', 'blocks/']
const LIQUID_TAGS = ['stylesheet', 'javascript', 'schema'] as const
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g
const LIQUID_COMMENT_PATTERN = /{%\s*comment\s*%}[\s\S]*?{%\s*endcomment\s*%}/g
const LIQUID_DOC_PATTERN = /{%\s*doc\s*%}[\s\S]*?{%\s*enddoc\s*%}/g
```

### Step 2: Update getUpdatedFileParts function

Replace the inline constants with module-level references:

1. Change line 424 from:
```typescript
  const validPrefixes = ['sections/', 'snippets/', 'blocks/']
```
to:
```typescript
  // Use module-level VALID_FILE_PREFIXES
```
(delete the line entirely and use VALID_FILE_PREFIXES on line 425)

2. Change line 425 from:
```typescript
  const isValidFileType = validPrefixes.some((prefix) => file.key.startsWith(prefix)) && file.key.endsWith('.liquid')
```
to:
```typescript
  const isValidFileType = VALID_FILE_PREFIXES.some((prefix) => file.key.startsWith(prefix)) && file.key.endsWith('.liquid')
```

3. Replace line 450 from:
```typescript
  const liquidTags = ['stylesheet', 'javascript', 'schema'] as const
```
Delete this line entirely.

4. Update type definition at line 451 from:
```typescript
  type LiquidTag = (typeof liquidTags)[number]
```
to:
```typescript
  type LiquidTag = (typeof LIQUID_TAGS)[number]
```

5. Update the for loop at line 464 from:
```typescript
  for (const tag of liquidTags) {
```
to:
```typescript
  for (const tag of LIQUID_TAGS) {
```

6. Update comment stripping at lines 471-473 from:
```typescript
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/{%\s*comment\s*%}[\s\S]*?{%\s*endcomment\s*%}/g, '')
      .replace(/{%\s*doc\s*%}[\s\S]*?{%\s*enddoc\s*%}/g, ''),
```
to:
```typescript
      .replace(HTML_COMMENT_PATTERN, '')
      .replace(LIQUID_COMMENT_PATTERN, '')
      .replace(LIQUID_DOC_PATTERN, ''),
```

## Verification

Run: `pnpm --filter @shopify/theme vitest run`
