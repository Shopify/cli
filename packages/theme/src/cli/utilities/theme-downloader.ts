import {applyIgnoreFilters} from './asset-ignore.js'

import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem, Theme, Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'
import {renderTasks} from '@shopify/cli-kit/node/ui'

interface DownloadOptions {
  nodelete: boolean
  only?: string[]
  ignore?: string[]
}

export async function downloadTheme(
  theme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: DownloadOptions,
) {
  const deleteTasks = buildDeleteTasks(remoteChecksums, themeFileSystem, options)
  const downloadTasks = await buildDownloadTasks(remoteChecksums, theme, themeFileSystem, session, options)

  const tasks = [...deleteTasks, ...downloadTasks]

  if (tasks.length > 0) {
    await renderTasks(tasks)
  }
}

function buildDeleteTasks(remoteChecksums: Checksum[], themeFileSystem: ThemeFileSystem, options: DownloadOptions) {
  if (options.nodelete) return []

  const remoteKeys = new Set(remoteChecksums.map((checksum) => checksum.key))

  const localKeys = Array.from(themeFileSystem.files.keys())
  const localFilesToBeDeleted = localKeys.filter((key) => !remoteKeys.has(key))

  return localFilesToBeDeleted.map((key) => {
    return {
      title: `Cleaning your local directory (removing ${key})`,
      task: async () => themeFileSystem.delete(key),
    }
  })
}

async function buildDownloadTasks(
  remoteChecksums: Checksum[],
  theme: Theme,
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  options: DownloadOptions,
) {
  const maxFilenames = 50
  let checksums = await applyIgnoreFilters(remoteChecksums, themeFileSystem, options)
  // const originalSize = checksums.length
  await themeFileSystem.ready()
  checksums = checksums.filter((checksum) => {
    const remoteChecksumValue = checksum.checksum
    const localAsset = themeFileSystem.files.get(checksum.key)

    if (localAsset?.checksum && localAsset?.checksum !== remoteChecksumValue) {
      // console.log(`File ${checksum.key} has checksum mismatch ${localAsset?.checksum} != ${remoteChecksumValue}`)
    }
    if (localAsset?.checksum === remoteChecksumValue) {
      return false
    } else {
      return true
    }
  })
  // console.log(`Downloading ${checksums.length} files out of ${original_size}`)
  const filenames = checksums.map((checksum) => checksum.key)

  const batches = []
  for (let i = 0; i < filenames.length; i += maxFilenames) {
    const batchFilenames = filenames.slice(i, i + maxFilenames)
    const title = `Downloading files ${i}..${i + batchFilenames.length} / ${filenames.length} files`
    batches.push({
      title,
      task: async () => downloadFiles(theme, themeFileSystem, batchFilenames, session),
    })
  }
  return batches
}

// async function downloadFile(theme: Theme, fileSystem: ThemeFileSystem, checksum: Checksum, session: AdminSession) {
//   const themeAsset = await fetchThemeAsset(theme.id, checksum.key, session)
//
//   if (!themeAsset) return
//
//   await fileSystem.write(themeAsset)
// }
//
async function downloadFiles(theme: Theme, fileSystem: ThemeFileSystem, filenames: string[], session: AdminSession) {
  const assets = await fetchThemeAssets(theme.id, filenames, session)
  if (!assets) return

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  assets.forEach(async (asset: ThemeAsset) => {
    await fileSystem.write(asset)
  })
}

// function progressPct(themeChecksums: Checksum[], checksum: Checksum): number {
//   const current = themeChecksums.indexOf(checksum) + 1
//   const total = themeChecksums.length
//
//   return Math.round((current / total) * 100)
// }

// function notNull<T>(value: T | null | undefined): value is T {
//   return value !== null && value !== undefined
// }
