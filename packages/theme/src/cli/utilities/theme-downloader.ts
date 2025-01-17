/* eslint-disable no-console */
import {batchedTasks, Task} from './batching.js'
import {MAX_GRAPHQL_THEME_FILES} from '../constants.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem, Theme, Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

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
    try {
      for (const task of tasks) {
        console.log(`[${theme.id}] Executing task: ${task.title}`)
        // eslint-disable-next-line no-await-in-loop
        await task.task()
        console.log(`[${theme.id}] Completed task: ${task.title}`)
      }
    } catch (error) {
      console.error(`[${theme.id}] Failed to execute tasks:`, error)
      throw error
    }
  }
  console.log(`[${theme.id}] Completed downloadTheme`)
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
    return localAsset?.checksum !== remoteChecksumValue
  })

  const filenames = checksums.map((checksum) => checksum.key)

  const batches = batchedTasks(filenames, MAX_GRAPHQL_THEME_FILES, (batchedFilenames, i) => {
    const title = `[${theme.id}] Downloading files ${i}..${i + batchedFilenames.length} / ${filenames.length} files`
    return {
      title,
      task: async () => {
        await downloadFiles(theme, themeFileSystem, batchedFilenames, session)
      },
    }
  })
  return batches
}

async function downloadFiles(theme: Theme, fileSystem: ThemeFileSystem, filenames: string[], session: AdminSession) {
  const assets = await fetchThemeAssets(theme.id, filenames, session)
  if (!assets) {
    return
  }

  await Promise.all(
    assets.map(async (asset: ThemeAsset) => {
      await fileSystem.write(asset)
    }),
  )
}
