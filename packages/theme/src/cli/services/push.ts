import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {rejectLiquidChecksums} from '../utilities/asset-checksum.js'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'

interface PushOptions {
  path?: string
  nodelete?: boolean
}

export async function push(theme: Theme, session: AdminSession, options: PushOptions) {
  const {path} = options
  const workingDirectory = path ? resolvePath(path) : cwd()
  // check if directory does not have required structure
  if (!(await hasRequiredThemeDirectories(workingDirectory))) {
    throw new Error(`Invalid theme directory: ${workingDirectory}`)
  }

  const remoteChecksums = await fetchChecksums(theme.id, session)
  const themeFileSystem = await mountThemeFileSystem(workingDirectory)
  const themeChecksums = rejectLiquidChecksums(remoteChecksums)

  await uploadTheme(theme, session, themeChecksums, themeFileSystem, {path: workingDirectory, ...options})
}
