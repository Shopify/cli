import metadata from '../metadata.js'
import {localAppContext} from '../services/app-context.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins'
import {cwd} from '@shopify/cli-kit/node/path'

const APP_CONTEXT_METADATA_TIMEOUT_MS = 3000

async function logAppContextMetadata(directory: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (metadata.getAllPublicMetadata().api_key !== undefined) return

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
  await logAppContextMetadata(cwd())
  return metadata.getAllPublicMetadata()
}

export default gatherPublicMetadata
