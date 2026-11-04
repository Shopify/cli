import {reconcileJsonFiles} from './theme-reconciliation.js'
import {pollThemeEditorChanges} from './theme-polling.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import type {ReconciliationStrategy} from './types.js'

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
    reconciliationStrategy?: ReconciliationStrategy
    signal?: AbortSignal
  },
  rejectBackgroundJob: (reason?: unknown) => void,
): Promise<{
  updatedRemoteChecksumsPromise: Promise<Checksum[]>
  workPromise: Promise<void>
  pollingPromise: Promise<void>
}> {
  outputDebug('Initiating theme asset reconciliation process')
  await localThemeFileSystem.ready()
  options.signal?.throwIfAborted()

  const {workPromise} = await reconcileJsonFiles(targetTheme, session, remoteChecksums, localThemeFileSystem, options)

  const updatedRemoteChecksumsPromise = workPromise.then(async () => {
    options.signal?.throwIfAborted()
    const updatedRemoteChecksums = await fetchChecksums(targetTheme.id, session)
    options.signal?.throwIfAborted()
    return updatedRemoteChecksums
  })
  const pollingPromise = updatedRemoteChecksumsPromise.then((updatedRemoteChecksums) =>
    pollThemeEditorChanges(
      targetTheme,
      session,
      updatedRemoteChecksums,
      localThemeFileSystem,
      options,
      rejectBackgroundJob,
    ),
  )

  return {updatedRemoteChecksumsPromise, workPromise, pollingPromise}
}
