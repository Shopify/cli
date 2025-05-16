import {batchedTasks, Task} from './batching.js'
import {MAX_GRAPHQL_THEME_FILES} from '../constants.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem, Theme, Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {renderTasks} from '@shopify/cli-kit/node/ui'

interface DownloadOptions {
  nodelete: boolean
}

export async function downloadTheme(
  theme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: DownloadOptions,
) {
  const deleteTasks = buildDeleteTasks(remoteChecksums, themeFileSystem, options)
  const downloadTasks = buildDownloadTasks(remoteChecksums, theme, themeFileSystem, session)

  const tasks = [...deleteTasks, ...downloadTasks]

  if (tasks.length > 0) {
    await renderTasks(tasks)
  }
}

function buildDeleteTasks(remoteChecksums: Checksum[], themeFileSystem: ThemeFileSystem, options: DownloadOptions) {
  if (options.nodelete) return []

  const remoteKeys = new Set(remoteChecksums.map((checksum) => checksum.key))

  const localKeys = themeFileSystem.applyIgnoreFilters([...themeFileSystem.files.values()]).map(({key}) => key)
  const localFilesToBeDeleted = localKeys.filter((key) => !remoteKeys.has(key))

  return localFilesToBeDeleted.map((key) => {
    return {
      title: `Cleaning your local directory (removing ${key})`,
      task: async () => themeFileSystem.delete(key),
    }
  })
}

function buildDownloadTasks(
  remoteChecksums: Checksum[],
  theme: Theme,
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
): Task[] {
  let checksums = themeFileSystem.applyIgnoreFilters(remoteChecksums)

  // Filter out files we already have
  checksums = checksums.filter((checksum) => {
    const remoteChecksumValue = checksum.checksum
    const localAsset = themeFileSystem.files.get(checksum.key)

    if (localAsset?.checksum === remoteChecksumValue) {
      return false
    } else {
      return true
    }
  })

  const filenames = checksums.map((checksum) => checksum.key)

  const getProgress = (params: {current: number; total: number}) =>
    `[${Math.round((params.current / params.total) * 100)}%]`

  const batches = batchedTasks(filenames, MAX_GRAPHQL_THEME_FILES, (batchedFilenames, i) => {
    const title = `Downloading files from remote theme ${getProgress({
      current: i,
      total: filenames.length,
    })}`
    return {
      title,
      task: async () => downloadFiles(theme, themeFileSystem, batchedFilenames, session),
    }
  })
  return batches
}

async function downloadFiles(theme: Theme, fileSystem: ThemeFileSystem, filenames: string[], session: AdminSession) {
  const assets = await fetchThemeAssets(theme.id, filenames, session)
  if (!assets) return

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  assets.forEach(async (asset: ThemeAsset) => {
    await fileSystem.write(asset)
  })
}
