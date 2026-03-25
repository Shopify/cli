# Experiment 19: Hoist RegExp patterns to module level in getInMemoryTemplates and findSectionNamesToReload

## Hypothesis

Hoisting the `jsonTemplateRE`, `localeRE`, and section ID extraction RegExp patterns from function bodies to module-level constants will eliminate redundant RegExp compilation on every hot-reload file event.

## Background

In `packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`:
- `getInMemoryTemplates()` creates two RegExp patterns on every call (lines 89, 95)
- `findSectionNamesToReload()` creates an inline RegExp on every call (line 366)

These functions are called during the hot-reload file change hot path:
- File change → `triggerHotReload` → `collectReloadInfoForFile` → `getInMemoryTemplates`
- File change → `triggerHotReload` → `collectReloadInfoForFile` → `findSectionNamesToReload`

Every file change event recompiles these patterns unnecessarily.

## Approach

1. Add three new module-level constants near the existing hoisted patterns (around line 53-60):
   ```typescript
   const JSON_TEMPLATE_PATTERN = /^templates\/.+\.json$/
   const LOCALE_PATTERN = /^locales\/.+\.json$/
   const SECTION_ID_PATTERN = /^sections\/(.+)\.liquid$/
   ```

2. Update `getInMemoryTemplates()` to use `JSON_TEMPLATE_PATTERN` instead of inline `jsonTemplateRE`
3. Update `getInMemoryTemplates()` to use `LOCALE_PATTERN` instead of inline `localeRE`
4. Update `findSectionNamesToReload()` to use `SECTION_ID_PATTERN` instead of inline RegExp

## Code Changes

### File: packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts

**Change 1:** Add constants after the existing pattern constants (around line 60):

```typescript
const LIQUID_DOC_PATTERN = /{%\s*doc\s*%}[\s\S]*?{%\s*enddoc\s*%}/g
// Add after this line:
const JSON_TEMPLATE_PATTERN = /^templates\/.+\.json$/
const LOCALE_PATTERN = /^locales\/.+\.json$/
const SECTION_ID_PATTERN = /^sections\/(.+)\.liquid$/
```

**Change 2:** In `getInMemoryTemplates()`, replace the inline RegExp declarations:

Before:
```typescript
const jsonTemplateRE = /^templates\/.+\.json$/
const filterTemplate = currentRoute
  ? `${joinPath('templates', currentRoute.replace(/^\//, '').replace(/\.html$/, '') || 'index')}.json`
  : ''
const hasRouteTemplate = Boolean(currentRoute) && ctx.localThemeFileSystem.files.has(filterTemplate)

const localeRE = /^locales\/.+\.json$/
```

After:
```typescript
const filterTemplate = currentRoute
  ? `${joinPath('templates', currentRoute.replace(/^\//, '').replace(/\.html$/, '') || 'index')}.json`
  : ''
const hasRouteTemplate = Boolean(currentRoute) && ctx.localThemeFileSystem.files.has(filterTemplate)
```

And update the usage:
- Replace `jsonTemplateRE.test(fileKey)` with `JSON_TEMPLATE_PATTERN.test(fileKey)`
- Replace `localeRE.test(fileKey)` with `LOCALE_PATTERN.test(fileKey)`

**Change 3:** In `findSectionNamesToReload()`, replace the inline RegExp:

Before:
```typescript
const sectionId = key.match(/^sections\/(.+)\.liquid$/)?.[1]
```

After:
```typescript
const sectionId = key.match(SECTION_ID_PATTERN)?.[1]
```

## Success Criteria

1. All theme package tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. The three RegExp patterns are compiled once at module init instead of once per call

## Expected Impact

- Eliminates 3 RegExp compilations per file change event
- Follows the same pattern established in experiments 7, 8, 9, 15, 16, 17, 18
