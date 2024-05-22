import {applyIgnoreFilters} from '../asset-ignore.js'
import {Checksum, Theme, ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderError, renderText} from '@shopify/cli-kit/node/ui'

const POLLING_INTERVAL = 3000

class PollingError extends Error {}

interface PollingOptions {
  noDelete?: boolean
  only?: string[]
  ignore?: string[]
}

export function pollThemeEditorChanges(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksum: Checksum[],
  localFileSystem: ThemeFileSystem,
  options?: PollingOptions,
) {
  outputDebug('Listening for changes in the theme editor')

  return setTimeout(() => {
    pollRemoteJsonChanges(targetTheme, session, remoteChecksum, localFileSystem, options)
      .then((latestChecksums) => {
        pollThemeEditorChanges(targetTheme, session, latestChecksums, localFileSystem, options)
      })
      .catch(handlePollingError)
  }, POLLING_INTERVAL)
}

export async function pollRemoteJsonChanges(
  targetTheme: Theme,
  currentSession: AdminSession,
  remoteChecksums: Checksum[],
  localFileSystem: ThemeFileSystem,
  options: PollingOptions = {},
): Promise<Checksum[]> {
  const previousChecksums = await applyFileFilters(remoteChecksums, localFileSystem, options)
  const latestChecksums = await fetchLatestChecksums(targetTheme, currentSession, localFileSystem, options)

  const assetsChangedOnRemote = getChangedAssets(previousChecksums, latestChecksums)
  const assetsDeletedFromRemote = getDeletedAssets(previousChecksums, latestChecksums)

  const previousFileValues = new Map(localFileSystem.files)
  await updateFileSystemValues(localFileSystem, assetsChangedOnRemote)
  await abortIfMultipleSourcesChange(previousFileValues, localFileSystem, assetsChangedOnRemote)

  await syncChangedAssets(targetTheme, currentSession, localFileSystem, assetsChangedOnRemote)
  if (!options.noDelete) {
    await deleteRemovedAssets(localFileSystem, assetsDeletedFromRemote)
  }

  return latestChecksums
}

async function fetchLatestChecksums(
  targetTheme: Theme,
  currentSession: AdminSession,
  localFileSystem: ThemeFileSystem,
  options: PollingOptions,
): Promise<Checksum[]> {
  const checksums = await fetchChecksums(targetTheme.id, currentSession)
  return applyFileFilters(checksums, localFileSystem, options)
}

function getChangedAssets(previousChecksums: Checksum[], latestChecksums: Checksum[]): Checksum[] {
  const previousChecksumsMap = new Map(previousChecksums.map((checksum) => [checksum.key, checksum]))
  return latestChecksums.filter((latestAsset) => {
    const previousAsset = previousChecksumsMap.get(latestAsset.key)
    return !previousAsset || previousAsset.checksum !== latestAsset.checksum
  })
}

function getDeletedAssets(previousChecksums: Checksum[], latestChecksums: Checksum[]): Checksum[] {
  const latestChecksumsMap = new Map(latestChecksums.map((checksum) => [checksum.key, checksum]))
  return previousChecksums.filter((previousChecksum) => !latestChecksumsMap.has(previousChecksum.key))
}

async function updateFileSystemValues(localFileSystem: ThemeFileSystem, filesToRead: Checksum[]) {
  await Promise.all(filesToRead.map((file) => localFileSystem.read(file.key)))
}

async function syncChangedAssets(
  targetTheme: Theme,
  currentSession: AdminSession,
  localFileSystem: ThemeFileSystem,
  assetsChangedOnRemote: Checksum[],
) {
  await Promise.all(
    assetsChangedOnRemote.map(async (file) => {
      if (localFileSystem.files.get(file.key)?.checksum === file.checksum) {
        return
      }
      const asset = await fetchThemeAsset(targetTheme.id, file.key, currentSession)
      if (asset) {
        await localFileSystem.write(asset)
        renderText({text: `Synced: get '${asset.key}' from remote theme`})
      }
    }),
  )
}

async function deleteRemovedAssets(localFileSystem: ThemeFileSystem, assetsDeletedFromRemote: Checksum[]) {
  await Promise.all(
    assetsDeletedFromRemote
      .filter((file) => file.key.endsWith('.json'))
      .map((file) =>
        localFileSystem.delete(file.key).then(() => {
          renderText({text: `Synced: remove '${file.key}' from local theme`})
        }),
      ),
  )
}

async function abortIfMultipleSourcesChange(
  previousFileValues: Map<string, ThemeAsset>,
  localFileSystem: ThemeFileSystem,
  assetsChangedOnRemote: Checksum[],
) {
  for (const asset of assetsChangedOnRemote) {
    const previousChecksum = previousFileValues.get(asset.key)?.checksum
    const newChecksum = localFileSystem.files.get(asset.key)?.checksum
    if (previousChecksum !== newChecksum) {
      throw new PollingError(
        `Detected changes to the file '${asset.key}' on both local and remote sources. Aborting...`,
      )
    }
  }
}

async function applyFileFilters(files: Checksum[], localThemeFileSystem: ThemeFileSystem, options: PollingOptions) {
  const filteredFiles = await applyIgnoreFilters(files, localThemeFileSystem, options)
  return filteredFiles.filter((file) => file.key.endsWith('.json'))
}

function handlePollingError(err: Error) {
  if (err instanceof PollingError) {
    renderError({body: err.message})
  } else {
    throw err
  }
}
