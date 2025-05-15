import {Task} from './batching.js'
import {renderTasksToStdErr} from './theme-ui.js'
import {MAX_GRAPHQL_THEME_FILES} from '../constants.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem, Theme, Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

interface DownloadOptions {
  nodelete: boolean
}

const getProgress = (params: {current: number; total: number}) =>
  `[${Math.round((params.current / params.total) * 100)}%]`

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
    await renderTasksToStdErr(tasks)
  }
}

function buildDeleteTasks(remoteChecksums: Checksum[], themeFileSystem: ThemeFileSystem, options: DownloadOptions) {
  if (options.nodelete) return []

  const remoteKeys = new Set(remoteChecksums.map((checksum) => checksum.key))

  const localKeys = themeFileSystem.applyIgnoreFilters([...themeFileSystem.files.values()]).map(({key}) => key)
  const localFilesToBeDeleted = localKeys.filter((key) => !remoteKeys.has(key))

  // If no files to delete, return empty array
  if (localFilesToBeDeleted.length === 0) {
    return []
  }

  // Create progress tracking for deletion
  const progress = {current: 0, total: localFilesToBeDeleted.length}
  const deletePromises = localFilesToBeDeleted.map((key) => {
    return themeFileSystem.delete(key).then(() => {
      progress.current += 1
    })
  })

  const deletePromise = Promise.all(deletePromises).then(() => {
    progress.current = progress.total
  })

  // Create interval task for showing progress
  return createIntervalTask({
    promise: deletePromise,
    titleGetter: () => `Cleaning your local directory ${getProgress(progress)}`,
    timeout: 1000,
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

  // If no files to download, return empty array
  if (filenames.length === 0) {
    return []
  }

  // Create batches for downloading files
  const progress = {current: 0, total: filenames.length}
  const downloadPromises: Promise<void>[] = []

  for (let i = 0; i < filenames.length; i += MAX_GRAPHQL_THEME_FILES) {
    const batchedFilenames = filenames.slice(i, i + MAX_GRAPHQL_THEME_FILES)
    const promise = downloadFiles(theme, themeFileSystem, batchedFilenames, session).then(() => {
      progress.current += batchedFilenames.length
    })
    downloadPromises.push(promise)
  }

  const downloadPromise = Promise.all(downloadPromises).then(() => {
    progress.current = progress.total
  })

  // Create interval task for showing progress
  return createIntervalTask({
    promise: downloadPromise,
    titleGetter: () => `Downloading files ${getProgress(progress)}`,
    timeout: 1000,
  })
}

async function downloadFiles(theme: Theme, fileSystem: ThemeFileSystem, filenames: string[], session: AdminSession) {
  const assets = await fetchThemeAssets(theme.id, filenames, session)
  if (!assets) return

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  assets.forEach(async (asset: ThemeAsset) => {
    await fileSystem.write(asset)
  })
}

function createIntervalTask({
  promise,
  titleGetter,
  timeout,
}: {
  promise: Promise<unknown>
  titleGetter: () => string
  timeout: number
}) {
  const tasks: Task[] = []

  const addNextCheck = () => {
    tasks.push({
      title: titleGetter(),
      task: async () => {
        const result = await Promise.race([
          promise,
          new Promise((resolve) => setTimeout(() => resolve('timeout'), timeout)),
        ])

        if (result === 'timeout') {
          addNextCheck()
        }
      },
    })
  }

  addNextCheck()
  return tasks
}
