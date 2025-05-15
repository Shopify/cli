import {Task} from './batching.js'
import {MAX_GRAPHQL_THEME_FILES} from '../constants.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem, Theme, Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

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
  const getProgress = (params: {current: number; total: number}) =>
    `[${Math.round((params.current / params.total) * 100)}%]`
  const deleteTasks = buildDeleteTasks(remoteChecksums, themeFileSystem, options)
  const downloadTasks = buildDownloadTasks(remoteChecksums, theme, themeFileSystem, session)

  await renderTasks(
    createIntervalTask({
      promise: deleteTasks.promise,
      titleGetter: () => `Cleaning your local directory ${getProgress(deleteTasks.progress)}`,
      timeout: 1000,
    }),
  )

  outputInfo('!!! yooo')

  await renderTasks(
    createIntervalTask({
      promise: downloadTasks.promise,
      titleGetter: () => `Downloading files ${getProgress(downloadTasks.progress)}`,
      timeout: 1000,
    }),
  )

  await deleteTasks.promise
  await downloadTasks.promise
  outputInfo('!!! done')

  // const tasks = [...deleteTasks, ...downloadTasks]

  // if (tasks.length > 0) {
  //   await renderTasks(
  //     createIntervalTask({
  //       promise: deleteTasks,
  //       titleGetter: () => 'Downloading files',
  //       timeout: 1000,
  //     }),
  //   )
  // }
}

function buildDeleteTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: DownloadOptions,
): SyncJob {
  if (options.nodelete) return {progress: {current: 0, total: 0}, promise: Promise.resolve()}

  const remoteKeys = new Set(remoteChecksums.map((checksum) => checksum.key))

  const localKeys = themeFileSystem.applyIgnoreFilters([...themeFileSystem.files.values()]).map(({key}) => key)
  const localFilesToBeDeleted = localKeys.filter((key) => !remoteKeys.has(key))

  const progress = {current: 0, total: localFilesToBeDeleted.length}
  const deletionPromise = localFilesToBeDeleted.map((key) =>
    themeFileSystem.delete(key).then(() => {
      progress.current += 1
    }),
  )

  const promise = Promise.all(deletionPromise).then(() => {
    progress.current = progress.total
  })

  // return localFilesToBeDeleted.map((key) => {
  //   return {
  //     title: `Cleaning your local directory (removing ${key})`,
  //     task: async () => themeFileSystem.delete(key),
  //   }
  // })
  return {progress, promise}
}

interface SyncJob {
  progress: {current: number; total: number}
  promise: Promise<void>
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

function buildDownloadTasks(
  remoteChecksums: Checksum[],
  theme: Theme,
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
): SyncJob {
  const checksums = themeFileSystem.applyIgnoreFilters(remoteChecksums)

  // Filter out files we already have
  const filesToDownload = checksums
    .filter((checksum) => {
      const remoteChecksumValue = checksum.checksum
      const localAsset = themeFileSystem.files.get(checksum.key)

      if (localAsset?.checksum === remoteChecksumValue) {
        return false
      } else {
        return true
      }
    })
    .map((checksum) => checksum.key)

  const progress = {current: 0, total: filesToDownload.length}
  const batches: string[][] = []
  for (let i = 0; i < filesToDownload.length; i += MAX_GRAPHQL_THEME_FILES) {
    batches.push(filesToDownload.slice(i, i + MAX_GRAPHQL_THEME_FILES))
  }

  const downloadPromises = batches.map((batch) =>
    downloadFiles(theme, themeFileSystem, batch, session).then(() => {
      progress.current += batch.length
    }),
  )

  const promise = Promise.all(downloadPromises).then(() => {
    progress.current = progress.total
  })

  return {progress, promise}
}

async function downloadFiles(theme: Theme, fileSystem: ThemeFileSystem, filenames: string[], session: AdminSession) {
  const assets = await fetchThemeAssets(theme.id, filenames, session)
  if (!assets) return

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  assets.forEach(async (asset: ThemeAsset) => {
    await fileSystem.write(asset)
  })
}
