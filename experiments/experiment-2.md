# Experiment 2: Hoist setMimeTypes to module initialization

## Hypothesis
The `isTextFile` function in `theme-fs.ts` calls `setMimeTypes` on every invocation, which is redundant. Since `isTextFile` is called for every file during theme setup and checksum calculation, this results in hundreds of unnecessary function calls. Moving `setMimeTypes` to module-level initialization will eliminate this overhead.

## Approach
Modify `packages/theme/src/cli/utilities/theme-fs.ts` to:
1. Move `setMimeTypes` call to module initialization (top of file)
2. Keep `isTextFile` pure - it should only lookup mime types, not configure them

## Code Changes

In `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-fs.ts`:

Replace the `isTextFile` function:

```typescript
// BEFORE (lines 511-529):
export function isTextFile(path: string) {
  setMimeTypes({
    liquid: 'application/liquid',
    sass: 'text/x-sass',
    scss: 'text/x-scss',
  })

  const textFileTypes = [
    'application/javascript',
    'application/json',
    'application/liquid',
    'text/css',
    'text/x-sass',
    'text/x-scss',
    'image/svg+xml',
  ]

  return textFileTypes.includes(lookupMimeType(path))
}
```

```typescript
// AFTER:
// Add near line 10 (module-level initialization):
setMimeTypes({
  liquid: 'application/liquid',
  sass: 'text/x-sass',
  scss: 'text/x-scss',
})

// Add constant for text file types (also module-level):
const TEXT_FILE_TYPES = [
  'application/javascript',
  'application/json',
  'application/liquid',
  'text/css',
  'text/x-sass',
  'text/x-scss',
  'image/svg+xml',
]

// Simplified isTextFile function:
export function isTextFile(path: string) {
  return TEXT_FILE_TYPES.includes(lookupMimeType(path))
}
```

## Implementation Steps
1. Read the current `theme-fs.ts` file
2. Add `setMimeTypes` call immediately after the import from `@shopify/cli-kit/node/mimes`
3. Add `TEXT_FILE_TYPES` constant after the `THEME_PARTITION_REGEX` constant
4. Simplify `isTextFile` function to just do the lookup
5. Run tests to verify no regressions

## Success Criteria
- All theme package tests pass
- Type checking passes
- The change reduces redundant function calls from N (file count) to 1
