import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {outputDebug, outputInfo, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderError} from '@shopify/cli-kit/node/ui'

const POLLING_INTERVAL = 3000
class PollingError extends Error {}

export interface PollingOptions {
  noDelete: boolean
}

export function pollThemeEditorChanges(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksum: Checksum[],
  localFileSystem: ThemeFileSystem,
  options: PollingOptions,
) {
  outputDebug('Listening for changes in the theme editor')

  return setTimeout(() => {
    pollRemoteJsonChanges(targetTheme, session, remoteChecksum, localFileSystem, options)
      .then((latestChecksums) => {
        pollThemeEditorChanges(targetTheme, session, latestChecksums, localFileSystem, options)
      })
      .catch((err) => {
        if (err instanceof PollingError) {
          renderError({body: err.message})
        } else {
          throw err
        }
      })
  }, POLLING_INTERVAL)
}

export async function pollRemoteJsonChanges(
  targetTheme: Theme,
  currentSession: AdminSession,
  remoteChecksums: Checksum[],
  localFileSystem: ThemeFileSystem,
  options: PollingOptions,
): Promise<Checksum[]> {
  const previousChecksums = applyFileFilters(remoteChecksums, localFileSystem)
  const latestChecksums = await fetchChecksums(targetTheme.id, currentSession).then((checksums) =>
    applyFileFilters(checksums, localFileSystem),
  )

  const changedAssets = getAssetsChangedOnRemote(previousChecksums, latestChecksums)
  const deletedAssets = getAssetsDeletedFromRemote(latestChecksums, previousChecksums)

  await abortIfMultipleSourcesChange(localFileSystem, changedAssets)

  await syncChangedAssets(targetTheme, currentSession, localFileSystem, changedAssets)
  await deleteRemovedAssets(localFileSystem, deletedAssets, options)

  return latestChecksums
}

function getAssetsDeletedFromRemote(latestChecksums: Checksum[], previousChecksums: Checksum[]) {
  const latestChecksumsMap = new Map(latestChecksums.map((checksum) => [checksum.key, checksum]))
  const assetsDeletedFromRemote = previousChecksums.filter((previousChecksum) => {
    return latestChecksumsMap.get(previousChecksum.key) === undefined
  })
  return assetsDeletedFromRemote
}

function getAssetsChangedOnRemote(previousChecksums: Checksum[], latestChecksums: Checksum[]) {
  const previousChecksumsMap = new Map(previousChecksums.map((checksum) => [checksum.key, checksum]))
  const assetsChangedOnRemote = latestChecksums.filter((latestAsset) => {
    const previousAsset = previousChecksumsMap.get(latestAsset.key)
    if (!previousAsset || previousAsset.checksum !== latestAsset.checksum) {
      return true
    }
  })
  return assetsChangedOnRemote
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
        outputInfo(
          outputContent`• ${new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })} Synced ${outputToken.raw('»')} ${outputToken.gray(`get ${asset.key} from remote theme`)}`,
        )
      }
    }),
  )
}

function deleteRemovedAssets(
  localFileSystem: ThemeFileSystem,
  assetsDeletedFromRemote: Checksum[],
  options: {noDelete: boolean},
) {
  if (!options.noDelete) {
    return Promise.all(
      assetsDeletedFromRemote.map((file) =>
        localFileSystem.delete(file.key).then(() => {
          outputInfo(
            outputContent`• ${new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })} Synced ${outputToken.raw('»')} ${outputToken.gray(`remove ${file.key} from local theme`)}`,
          )
        }),
      ),
    )
  }
}

/**
 * Updates the local file system with the latest local changes and throws an error if the file has been changed on both local and remote sources.
 */
async function abortIfMultipleSourcesChange(localFileSystem: ThemeFileSystem, assetsChangedOnRemote: Checksum[]) {
  const previousFileValues = new Map(localFileSystem.files)
  await Promise.all(assetsChangedOnRemote.map((file) => localFileSystem.read(file.key)))

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

function applyFileFilters(files: Checksum[], localThemeFileSystem: ThemeFileSystem) {
  const filteredFiles = localThemeFileSystem.applyIgnoreFilters(files)
  return filteredFiles.filter((file) => file.key.endsWith('.json'))
}
