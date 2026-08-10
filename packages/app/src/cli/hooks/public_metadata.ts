import metadata from '../metadata.js'
import {appConfigurationFileGlob} from '../constants.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'
import {findPathUp, glob} from '@shopify/cli-kit/node/fs'

const APP_CONTEXT_METADATA_TIMEOUT_MS = 3000

async function insideAppProject(directory: string): Promise<boolean> {
  const found = await findPathUp(
    async (candidateDirectory) => {
      const matches = await glob(joinPath(candidateDirectory, appConfigurationFileGlob))
      if (matches.length > 0) return candidateDirectory
    },
    {cwd: directory, type: 'directory'},
  )
  return found !== undefined
}

async function logAppContextMetadata(directory: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (metadata.getAllPublicMetadata().api_key !== undefined) return
    if (!(await insideAppProject(directory))) return

    // Loading the app context pulls in a large module graph, so only import it
    // once we know the command ran inside an app project.
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
  await logAppContextMetadata(cwd())
  return metadata.getAllPublicMetadata()
}

export default gatherPublicMetadata
