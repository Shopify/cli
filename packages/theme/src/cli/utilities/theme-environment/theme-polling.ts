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
  options: PollingOptions = {},
): Promise<Checksum[]> {
  const filteredRemoteChecksums = await applyFileFilters(remoteChecksums, localFileSystem, options)

  const latestChecksums = await fetchChecksums(targetTheme.id, currentSession).then((checksums) =>
    applyFileFilters(checksums, localFileSystem, options),
  )

  const previousChecksumsMap = new Map(filteredRemoteChecksums.map((checksum) => [checksum.key, checksum]))
  const assetsChangedOnRemote = latestChecksums.filter((latestAsset) => {
    const previousAsset = previousChecksumsMap.get(latestAsset.key)
    if (!previousAsset || previousAsset.checksum !== latestAsset.checksum) {
      return true
    }
  })

  const latestChecksumsMap = new Map(latestChecksums.map((checksum) => [checksum.key, checksum]))
  const assetsDeletedFromRemote = filteredRemoteChecksums.filter((previousChecksum) => {
    return latestChecksumsMap.get(previousChecksum.key) === undefined
  })

  const previousFileValues = new Map(localFileSystem.files)
  await Promise.all(assetsChangedOnRemote.map((file) => localFileSystem.read(file.key)))
  await abortIfMultipleSourcesChange(previousFileValues, localFileSystem, assetsChangedOnRemote)

  await Promise.all(
    assetsChangedOnRemote.map(async (file) => {
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

  if (!options?.noDelete) {
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
  return latestChecksums
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
