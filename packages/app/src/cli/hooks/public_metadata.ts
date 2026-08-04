import metadata from '../metadata.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins'
import {cwd} from '@shopify/cli-kit/node/path'
import {getCurrentCommandId} from '@shopify/cli-kit/node/global-context'

const APP_CONTEXT_METADATA_TIMEOUT_MS = 3000

/**
 * Loading an app to gather `app_*` analytics only makes sense for `app` commands. Every other
 * command (`version`, `theme *`, `store *`, ...) would load the whole app graph — which reaches
 * theme-check and its ohm-js Liquid grammar — to report metadata it can't produce anyway.
 *
 * The command id is the canonical oclif id (`app:dev`), set by cli-kit's BaseCommand. It is empty
 * for commands that don't extend BaseCommand, which are never app commands.
 */
function isAppCommand(commandId: string): boolean {
  return commandId === 'app' || commandId.startsWith('app:')
}

async function logAppContextMetadata(directory: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (metadata.getAllPublicMetadata().api_key !== undefined) return

    // Imported lazily so that non-app commands never pay for the app graph.
    const {localAppContext} = await import('../services/app-context.js')

    await Promise.race([
      localAppContext({directory, skipPrompts: true}),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, APP_CONTEXT_METADATA_TIMEOUT_MS)
      }),
    ])
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Metadata is strictly best-effort: never surface errors or affect the command.
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const gatherPublicMetadata: FanoutHookFunction<'public_command_metadata', '@shopify/app'> = async () => {
  if (isAppCommand(getCurrentCommandId())) {
    await logAppContextMetadata(cwd())
  }
  return metadata.getAllPublicMetadata()
}

export default gatherPublicMetadata
