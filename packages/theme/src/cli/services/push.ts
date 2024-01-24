import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Theme} from '@shopify/cli-kit/node/themes/types'

interface PushOptions {
  path?: string
}

export async function push(theme: Theme, session: AdminSession, options: PushOptions) {
  const workingDirectory = options.path ? resolvePath(options.path) : cwd()
  // check if directory does not have required structure
  if (!(await hasRequiredThemeDirectories(workingDirectory))) {
    throw new Error(`Invalid theme directory: ${workingDirectory}`)
  }
}
