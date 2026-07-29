import {Hook} from '@oclif/core'
import {randomUUID} from 'crypto'

/**
 * Inlined version of the `\@shopify/app` init hook.
 * The original hook imports `\@shopify/app` → local-storage → cli-kit error chain (~1s).
 * This inlined version avoids those imports entirely. It lazily imports the
 * LocalStorage class only at call time, and uses Node's native crypto.
 */
const init: Hook<'init'> = async (_options) => {
  // Lazy import to clear the command storage (equivalent to clearCachedCommandInfo).
  // Clearing writes the file atomically (temp file + rename + fsync), so skip it when the store is
  // already empty -- which is the case for every command that doesn't touch app command state.
  const {LocalStorage} = await import('@shopify/cli-kit/node/local-storage')
  const store = new LocalStorage({projectName: 'shopify-cli-app-command'})
  if (store.size > 0) store.clear()

  // Set a unique run ID so parallel commands don't collide in the cache
  process.env.COMMAND_RUN_ID = randomUUID()
}

export default init
