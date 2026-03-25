# Experiment 48: Eliminate intermediate array in saveSectionsFromJson

## Hypothesis
Replacing `Object.entries(sections).map()` with a direct `for...in` loop in `saveSectionsFromJson` will eliminate one intermediate array allocation per JSON file processed.

## Background
In `packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`, line 87:
```typescript
Object.entries(sections || {}).map(([name, {type}]) => [type, name])
```

This creates two arrays:
1. Array from `Object.entries()`
2. Array from `.map()` transformation

By using a `for...in` loop, we build the result array directly, eliminating the intermediate `Object.entries()` array.

This function is called:
- During initial file loading (per JSON file in the theme)
- On every JSON file change during development

## Approach
Replace the `Object.entries().map()` pattern with a direct `for...in` loop that builds the result array in place.

## Changes

### File: packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts

Replace lines 84-88:
```typescript
  if (sections && !fileKey.startsWith('locales/')) {
    sectionNamesByFile.set(
      fileKey,
      Object.entries(sections || {}).map(([name, {type}]) => [type, name]),
    )
```

With:
```typescript
  if (sections && !fileKey.startsWith('locales/')) {
    const sectionEntries: [string, string][] = []
    for (const name in sections) {
      if (Object.hasOwn(sections, name)) {
        sectionEntries.push([sections[name]!.type, name])
      }
    }
    sectionNamesByFile.set(fileKey, sectionEntries)
```

## Success Criteria
1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No functional changes to behavior

## Verification
Run the benchmark command and verify tests pass.
