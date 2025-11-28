import {pollThemeEditorChanges} from './theme-polling.js'
import {reconcileJsonFiles} from './theme-reconciliation.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'

export const LOCAL_STRATEGY = 'local'
export const REMOTE_STRATEGY = 'remote'

/**
 * Synchronizes changes applied to JSON files via the theme editor to the local directory
 * Does not upload any local changes to the remote theme
 */
export async function reconcileAndPollThemeEditorChanges(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  options: {
    noDelete: boolean
    ignore: string[]
    only: string[]
  },
  rejectBackgroundJob: (reason?: unknown) => void,
): Promise<{
  updatedRemoteChecksumsPromise: Promise<Checksum[]>
  workPromise: Promise<void>
}> {
  outputDebug('Initiating theme asset reconciliation process')
  await localThemeFileSystem.ready()

  const {workPromise} = await reconcileJsonFiles(targetTheme, session, remoteChecksums, localThemeFileSystem, options)

  const updatedRemoteChecksumsPromise = workPromise.then(async () => {
    const updatedRemoteChecksums = await fetchChecksums(targetTheme.id, session)
    pollThemeEditorChanges(
      targetTheme,
      session,
      updatedRemoteChecksums,
      localThemeFileSystem,
      options,
      rejectBackgroundJob,
    )
    return updatedRemoteChecksums
  })

  return {updatedRemoteChecksumsPromise, workPromise}
}
