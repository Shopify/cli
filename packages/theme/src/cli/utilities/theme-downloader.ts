import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem, Theme, Checksum} from '@shopify/cli-kit/node/themes/types'
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
) {
  const checksums = themeFileSystem.applyIgnoreFilters(remoteChecksums)

  return checksums
    .map((checksum) => {
      const remoteChecksumValue = checksum.checksum
      const localAsset = themeFileSystem.files.get(checksum.key)

      if (localAsset?.checksum === remoteChecksumValue) {
        return
      }

      const progress = progressPct(remoteChecksums, checksum)
      const title = `Pulling theme "${theme.name}" (#${theme.id}) from ${session.storeFqdn} [${progress}%]`

      return {
        title,
        task: async () => downloadFile(theme, themeFileSystem, checksum, session),
      }
    })
    .filter(notNull)
}

async function downloadFile(theme: Theme, fileSystem: ThemeFileSystem, checksum: Checksum, session: AdminSession) {
  const themeAsset = await fetchThemeAsset(theme.id, checksum.key, session)

  if (!themeAsset) return

  await fileSystem.write(themeAsset)
}

function progressPct(themeChecksums: Checksum[], checksum: Checksum): number {
  const current = themeChecksums.indexOf(checksum) + 1
  const total = themeChecksums.length

  return Math.round((current / total) * 100)
}

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
