# Experiment 28: Hoist hot reload script injection strings to module level

## Hypothesis

In `handleHotReloadScriptInjection` (hot-reload/server.ts), multiple template strings and the `/<\/head>/` regex pattern are created inline on each call. Since this function is called for every HTML response, hoisting these to module-level constants will eliminate repeated string/regex creation and improve performance.

## Approach

Hoist the following to module level in `hot-reload/server.ts`:

1. `/<\/head>/` regex pattern - used twice for script injection
2. `<script id="${hotReloadScriptId}"` - used in includes() check
3. Local hot reload script tag replacement string
4. Remote hot reload script tag replacement string

## Code Changes

In `/Users/joshuafaigan/src/github.com/Shopify/cli/packages/theme/src/cli/utilities/theme-environment/hot-reload/server.ts`:

After line 399 (after `const localHotReloadScriptEndpoint = '/@shopify/theme-hot-reload'`), add:

```typescript
const CLOSE_HEAD_PATTERN = /<\/head>/
const HOT_RELOAD_SCRIPT_TAG_PREFIX = `<script id="${hotReloadScriptId}"`
const LOCAL_HOT_RELOAD_SCRIPT_TAG = `<script id="${hotReloadScriptId}" src="${localHotReloadScriptEndpoint}" defer></script></head>`
const REMOTE_HOT_RELOAD_SCRIPT_TAG = `<script id="${hotReloadScriptId}" src="${hotReloadScriptUrl}" defer></script></head>`
```

Then modify `handleHotReloadScriptInjection` to use these constants:

```typescript
export function handleHotReloadScriptInjection(html: string, ctx: DevServerContext) {
  if (ctx.options.liveReload === 'off') return html.replace(hotReloadScriptRE, '')

  if (process.env.SHOPIFY_CLI_LOCAL_HOT_RELOAD) {
    // When running locally, use the local script for easy development.
    return html
      .replace(hotReloadScriptRE, '')
      .replace(CLOSE_HEAD_PATTERN, LOCAL_HOT_RELOAD_SCRIPT_TAG)
  }

  if (html.includes(HOT_RELOAD_SCRIPT_TAG_PREFIX)) {
    // Already injected in SFR, do nothing
    return html
  }

  // Inject the HotReload script in the HTML Head
  return html.replace(CLOSE_HEAD_PATTERN, REMOTE_HOT_RELOAD_SCRIPT_TAG)
}
```

## Success Criteria

1. All existing tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes: `pnpm type-check`
3. No functional changes to behavior

## Implementation

Apply these specific edits to the file.
