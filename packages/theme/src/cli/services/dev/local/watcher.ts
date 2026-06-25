import {ChangeEvent, LocalDevServerContext} from './types.js'
import {debounce} from '@shopify/cli-kit/common/function'

/**
 * Default debounce window (ms) for collapsing bursts of file events (e.g. an
 * editor saving several files at once) into a single reload.
 */
const DEFAULT_DEBOUNCE_MS = 100

/**
 * A running watcher. `close()` detaches the debounce so no further reloads
 * fire after shutdown.
 */
export interface ThemeFileWatcher {
  close(): Promise<void>
}

/**
 * Watches the local theme file system and forwards normalized change events to
 * `onChange`, debounced so a burst of writes triggers a single reload.
 *
 * It subscribes to the same `add`/`change`/`unlink` events the remote
 * in-memory watcher uses, but maps them to a minimal `{type, path}` payload —
 * the local flow does a full-page reload regardless of which file changed.
 *
 * The file system is taken from `ctx` and `onChange` is injected, so tests can
 * drive it with a fake fs and never touch disk.
 */
export function watchThemeFiles(
  ctx: LocalDevServerContext,
  onChange: (event: ChangeEvent) => void,
  options: {debounceMs?: number} = {},
): ThemeFileWatcher {
  const fileSystem = ctx.localThemeFileSystem
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  const debouncedOnChange = debounce(onChange, debounceMs, {leading: false, trailing: true})

  fileSystem.addEventListener('add', ({fileKey}) => debouncedOnChange({type: 'add', path: fileKey}))
  fileSystem.addEventListener('change', ({fileKey}) => debouncedOnChange({type: 'change', path: fileKey}))
  fileSystem.addEventListener('unlink', ({fileKey}) => debouncedOnChange({type: 'unlink', path: fileKey}))

  return {
    close: async () => {
      /* Cancel any pending trailing invocation so a reload can't fire after
         the server has been torn down. */
      debouncedOnChange.cancel()
    },
  }
}
