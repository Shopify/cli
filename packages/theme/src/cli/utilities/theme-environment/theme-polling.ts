import {MAX_GRAPHQL_THEME_FILES, timestampDateFormat} from '../../constants.js'
import {batchedRequests} from '../batching.js'
import {renderThrownError} from '../errors.js'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {outputDebug, outputInfo, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'

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
  rejectBackgroundJob: (reason?: unknown) => void,
) {
  outputDebug('Listening for changes in the theme editor')

  const maxPollingAttempts = 5
  let failedPollingAttempts = 0
  let lastError = ''
  let latestChecksums = remoteChecksum

  const poll = async () => {
    // Asynchronously wait for the polling interval, similar to a setInterval
    // but ensure the polling work is done before starting the next interval.
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL))

    // eslint-disable-next-line require-atomic-updates
    latestChecksums = await pollRemoteJsonChanges(targetTheme, session, latestChecksums, localFileSystem, options)
      .then((checksums) => {
        failedPollingAttempts = 0
        lastError = ''

        return checksums
      })
      .catch((error: Error) => {
        failedPollingAttempts++

        if (error.message !== lastError) {
          lastError = error.message
          renderThrownError('Error while polling for changes.', error)
        }

        if (failedPollingAttempts >= maxPollingAttempts) {
          const fatalError = new AbortError(
            'Too many polling errors...',
            'Please check the errors above and ensure you have a stable internet connection.',
          )
          renderFatalError(fatalError)
          rejectBackgroundJob(fatalError)
        }

        return latestChecksums
      })
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      await poll()
    }
  })
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
  const filesToGet = assetsChangedOnRemote.filter(
    (file) => localFileSystem.files.get(file.key)?.checksum !== file.checksum,
  )

  const chunks = batchedRequests(filesToGet, MAX_GRAPHQL_THEME_FILES, async (chunk) => {
    return fetchThemeAssets(
      targetTheme.id,
      chunk.map((file) => file.key),
      currentSession,
    ).then((assets) => {
      return Promise.all(
        assets.map(async (asset) => {
          if (asset) {
            await localFileSystem.write(asset)
            outputInfo(
              outputContent`• ${timestampDateFormat.format(new Date())} Synced ${outputToken.raw(
                '»',
              )} ${outputToken.gray(`download ${asset.key} from remote theme`)}`,
            )
          }
        }),
      )
    })
  })

  await Promise.all(chunks)
}

export async function deleteRemovedAssets(
  localFileSystem: ThemeFileSystem,
  assetsDeletedFromRemote: Checksum[],
  options: {noDelete: boolean},
) {
  if (!options.noDelete) {
    return Promise.all(
      assetsDeletedFromRemote.map((file) => {
        if (localFileSystem.files.get(file.key)) {
          return localFileSystem.delete(file.key).then(() => {
            outputInfo(
              outputContent`• ${timestampDateFormat.format(new Date())} Synced ${outputToken.raw(
                '»',
              )} ${outputToken.gray(`remove ${file.key} from local theme`)}`,
            )
          })
        }
      }),
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
  return filteredFiles
    .filter((file) => file.key.endsWith('.json'))
    .filter((file) => !localThemeFileSystem.unsyncedFileKeys.has(file.key))
}
