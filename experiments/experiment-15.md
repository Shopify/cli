# Experiment 15: Hoist CRLF and multiline comment RegExp patterns to module level in asset-checksum.ts

## Hypothesis
Hoisting the `/\r\n/g` regex pattern (used twice) and `/\/\*[\s\S]*?\*\//` pattern to module-level constants eliminates redundant RegExp allocations on each checksum calculation call. Since calculateChecksum is called for every file in a theme (potentially hundreds of files), this reduces N*2 to N*0 RegExp allocations.

## Approach
1. Create `CRLF_PATTERN` constant at module level for `/\r\n/g`
2. Create `MULTILINE_COMMENT_PATTERN` constant at module level for `/\/\*[\s\S]*?\*\//`
3. Replace inline regex usages in `minifiedJSONFileChecksum` and `regularFileChecksum` with the constants

## Target File
`packages/theme/src/cli/utilities/asset-checksum.ts`

## Current Code (lines 25-43)
```typescript
function minifiedJSONFileChecksum(fileContent: string) {
  let content = fileContent

  content = content.replace(/\r\n/g, '\n')
  content = content.replace(/\/\*[\s\S]*?\*\//, '')
  content = normalizeJson(content)

  return md5(content)
}

function regularFileChecksum(fileKey: string, fileContent: string) {
  let content = fileContent

  if (isTextFile(fileKey)) {
    content = content.replace(/\r\n/g, '\n')
  }

  return md5(content)
}
```

## Changes Required
After the imports at the top of the file (around line 4), add:

```typescript
// Pre-compiled regex patterns for checksum calculation (avoids N allocations per theme)
const CRLF_PATTERN = /\r\n/g
const MULTILINE_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//
```

Then update the functions to use these constants:

```typescript
function minifiedJSONFileChecksum(fileContent: string) {
  let content = fileContent

  content = content.replace(CRLF_PATTERN, '\n')
  content = content.replace(MULTILINE_COMMENT_PATTERN, '')
  content = normalizeJson(content)

  return md5(content)
}

function regularFileChecksum(fileKey: string, fileContent: string) {
  let content = fileContent

  if (isTextFile(fileKey)) {
    content = content.replace(CRLF_PATTERN, '\n')
  }

  return md5(content)
}
```

## Success Criteria
1. All 561 tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. Regex patterns compiled once at module init instead of once per checksum call

## Expected Impact
- For a theme with N files, eliminates up to 2N RegExp allocations (CRLF pattern used twice per settings_data.json + once per text file)
- Reduces GC pressure during theme operations
