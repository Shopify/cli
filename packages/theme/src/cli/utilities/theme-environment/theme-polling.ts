import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderError, renderText} from '@shopify/cli-kit/node/ui'

const POLLING_INTERVAL = 3000
class PollingError extends Error {}

export function pollThemeEditorChanges(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksum: Checksum[],
  localFileSystem: ThemeFileSystem,
) {
  outputDebug('Listening for changes in the theme editor')

  return setTimeout(() => {
    pollRemoteJsonChanges(targetTheme, session, remoteChecksum, localFileSystem)
      .then((latestChecksums) => {
        pollThemeEditorChanges(targetTheme, session, latestChecksums, localFileSystem)
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
): Promise<Checksum[]> {
  const latestChecksums = await fetchChecksums(targetTheme.id, currentSession)

  const previousChecksums = new Map(remoteChecksums.map((checksum) => [checksum.key, checksum]))
  const assetsChangedOnRemote = latestChecksums.filter((latestAsset) => {
    const previousAsset = previousChecksums.get(latestAsset.key)
    if (!previousAsset || previousAsset.checksum !== latestAsset.checksum) {
      return true
    }
  })

  const latestChecksumsMap = new Map(latestChecksums.map((checksum) => [checksum.key, checksum]))
  const assetsDeletedFromRemote = remoteChecksums.filter((previousChecksum) => {
    return latestChecksumsMap.get(previousChecksum.key) === undefined
  })

  await abortIfMultipleSourcesChange(localFileSystem, assetsChangedOnRemote)

  await Promise.all(
    assetsChangedOnRemote
      .filter((file) => file.key.endsWith('.json'))
      .map(async (file) => {
        if (localFileSystem.files.get(file.key)?.checksum === file.checksum) {
          return
        }
        const asset = await fetchThemeAsset(targetTheme.id, file.key, currentSession)
        if (asset) {
          return localFileSystem.write(asset).then(() => {
            renderText({text: `Synced: get '${asset.key}' from remote theme`})
          })
        }
      }),
  )

  await Promise.all(
    assetsDeletedFromRemote
      .filter((file) => file.key.endsWith('.json'))
      .map((file) =>
        localFileSystem.delete(file.key).then(() => {
          renderText({text: `Synced: remove '${file.key}' from local theme`})
        }),
      ),
  )
  return latestChecksums
}

async function abortIfMultipleSourcesChange(localFileSystem: ThemeFileSystem, assetsChangedOnRemote: Checksum[]) {
  for (const asset of assetsChangedOnRemote) {
    const previousChecksum = localFileSystem.files.get(asset.key)?.checksum
    // eslint-disable-next-line no-await-in-loop
    await localFileSystem.read(asset.key)
    const newChecksum = localFileSystem.files.get(asset.key)?.checksum
    if (previousChecksum !== newChecksum) {
      throw new PollingError(
        `Detected changes to the file '${asset.key}' on both local and remote sources. Aborting...`,
      )
    }
  }
}
