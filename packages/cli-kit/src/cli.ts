import {file, path} from './index.js'
import {Flags} from '@oclif/core'

/**
 * An object that contains the flags that
 * are shared across all the commands.
 */
export const globalFlags = {
  verbose: Flags.boolean({
    hidden: false,
    description: 'Increase the verbosity of the logs.',
    env: 'SHOPIFY_FLAG_VERBOSE',
  }),
}

export async function isCliProject(directory: string) {
  const configFilesExist = await Promise.all(
    ['shopify.app.toml', 'hydrogen.config.js', 'hydrogen.config.ts'].map(async (configFile) => {
      return file.exists(path.join(directory, configFile))
    }),
  )
  return configFilesExist.some((bool) => bool)
}

export async function getCliProjectDir(directory: string) {
  return path.findUp(
    async (dir: string) => {
      if (await isCliProject(dir)) return dir
    },
    {
      cwd: directory,
      type: 'directory',
    },
  )
}
