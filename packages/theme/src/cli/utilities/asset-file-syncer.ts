import {uploadTheme} from './theme-uploader.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {renderInfo, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {deleteThemeAsset, fetchChecksums, fetchThemeAsset} from '@shopify/cli-kit/node/themes/api'

const POLLING_INTERVAL = 3000
export const LOCAL_STRATEGY = 'local'
export const REMOTE_STRATEGY = 'remote'

type ReconciliationStrategy = typeof LOCAL_STRATEGY | typeof REMOTE_STRATEGY | undefined

interface FilePartitions {
  localFilesToDelete: Checksum[]
  filesToDownload: Checksum[]
  filesToUpload: Checksum[]
  remoteFilesToDelete: Checksum[]
}

export async function initializeThemeEditorSync(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  outputDebug('Initiating theme asset reconciliation process')
  await reconcileThemeFiles(targetTheme, session, remoteChecksums, localThemeFileSystem)

  pollThemeEditorChanges(targetTheme, session, localThemeFileSystem)
}

async function reconcileThemeFiles(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  const {filesOnlyPresentLocally, filesOnlyPresentOnRemote, filesWithConflictingChecksums} = identifyFilesToReconcile(
    remoteChecksums,
    localThemeFileSystem,
  )

  if (
    filesOnlyPresentLocally.length === 0 &&
    filesOnlyPresentOnRemote.length === 0 &&
    filesWithConflictingChecksums.length === 0
  ) {
    outputDebug('Local and remote checksums match - no need to reconcile theme assets')
    return localThemeFileSystem
  }

  const partitionedFiles = await partitionFilesByReconciliationStrategy({
    filesOnlyPresentLocally,
    filesOnlyPresentOnRemote,
    filesWithConflictingChecksums,
  })

  await performFileReconciliation(targetTheme, session, remoteChecksums, localThemeFileSystem, partitionedFiles)
}

function identifyFilesToReconcile(
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
): {
  filesOnlyPresentOnRemote: Checksum[]
  filesOnlyPresentLocally: Checksum[]
  filesWithConflictingChecksums: Checksum[]
} {
  const remoteChecksumKeys = new Set()
  const filesOnlyPresentOnRemote: Checksum[] = []
  const filesWithConflictingChecksums: Checksum[] = []

  remoteChecksums.forEach((remoteChecksum) => {
    remoteChecksumKeys.add(remoteChecksum.key)
    const localChecksum = localThemeFileSystem.files.get(remoteChecksum.key)

    if (!localChecksum) {
      filesOnlyPresentOnRemote.push(remoteChecksum)
    } else if (remoteChecksum.checksum !== localChecksum.checksum) {
      filesWithConflictingChecksums.push(remoteChecksum)
    }
  })

  const filesOnlyPresentLocally: Checksum[] = Array.from(localThemeFileSystem.files.values()).filter(
    (asset: ThemeAsset) => !remoteChecksumKeys.has(asset.key),
  )

  return {
    filesOnlyPresentOnRemote,
    filesOnlyPresentLocally,
    filesWithConflictingChecksums,
  }
}

async function promptFileReconciliationStrategy(
  files: Checksum[],
  message: {
    title: string
    remoteStrategyLabel: string
    localStrategyLabel: string
  },
): Promise<ReconciliationStrategy | undefined> {
  if (files.length === 0) {
    return
  }

  renderInfo({
    body: {
      list: {
        title: message.title,
        items: files.map((file) => file.key),
      },
    },
  })

  return renderSelectPrompt({
    message: 'Reconciliation Strategy',
    choices: [
      {label: message.remoteStrategyLabel, value: REMOTE_STRATEGY},
      {label: message.localStrategyLabel, value: LOCAL_STRATEGY},
    ],
  })
}

async function performFileReconciliation(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  partitionedFiles: FilePartitions,
) {
  const {localFilesToDelete, filesToUpload, filesToDownload, remoteFilesToDelete} = partitionedFiles

  const deleteLocalFiles = localFilesToDelete.map((file) => localThemeFileSystem.delete(file.key))
  const downloadRemoteFiles = filesToDownload.map(async (file) => {
    const asset = await fetchThemeAsset(targetTheme.id, file.key, session)
    if (asset) {
      return localThemeFileSystem.write(asset)
    }
  })
  const deleteRemoteFiles = remoteFilesToDelete.map((file) => deleteThemeAsset(targetTheme.id, file.key, session))

  await Promise.all([...deleteLocalFiles, ...downloadRemoteFiles, ...deleteRemoteFiles])

  if (filesToUpload.length > 0) {
    await uploadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {nodelete: true})
  }
}

async function partitionFilesByReconciliationStrategy(files: {
  filesOnlyPresentLocally: Checksum[]
  filesOnlyPresentOnRemote: Checksum[]
  filesWithConflictingChecksums: Checksum[]
}): Promise<FilePartitions> {
  const {filesOnlyPresentLocally, filesOnlyPresentOnRemote, filesWithConflictingChecksums} = files

  const localFilesToDelete: Checksum[] = []
  const filesToDownload: Checksum[] = []
  const filesToUpload: Checksum[] = []
  const remoteFilesToDelete: Checksum[] = []

  const localFileReconciliationStrategy = await promptFileReconciliationStrategy(filesOnlyPresentLocally, {
    title: 'The files listed below are only present locally. What would you like to do?',
    remoteStrategyLabel: 'Delete files from the local directory',
    localStrategyLabel: 'Upload local files to the remote theme',
  })

  if (localFileReconciliationStrategy === LOCAL_STRATEGY) {
    filesToUpload.push(...filesOnlyPresentLocally)
  } else if (localFileReconciliationStrategy === REMOTE_STRATEGY) {
    localFilesToDelete.push(...filesOnlyPresentLocally)
  }

  const remoteFileReconciliationStrategy = await promptFileReconciliationStrategy(filesOnlyPresentOnRemote, {
    title: 'The files listed below are only present on the remote theme. What would you like to do?',
    remoteStrategyLabel: 'Download remote files to the local directory',
    localStrategyLabel: 'Delete files from the remote theme',
  })

  if (remoteFileReconciliationStrategy === REMOTE_STRATEGY) {
    filesToDownload.push(...filesOnlyPresentOnRemote)
  } else if (remoteFileReconciliationStrategy === LOCAL_STRATEGY) {
    remoteFilesToDelete.push(...filesOnlyPresentOnRemote)
  }

  const conflictingChecksumsReconciliationStrategy = await promptFileReconciliationStrategy(
    filesWithConflictingChecksums,
    {
      title: 'The files listed below differ between the local and remote versions. What would you like to do?',
      remoteStrategyLabel: 'Keep the remote version',
      localStrategyLabel: 'Keep the local version',
    },
  )

  if (conflictingChecksumsReconciliationStrategy === REMOTE_STRATEGY) {
    filesToDownload.push(...filesWithConflictingChecksums)
  } else {
    filesToUpload.push(...filesWithConflictingChecksums)
  }

  return {localFilesToDelete, filesToDownload, filesToUpload, remoteFilesToDelete}
}

function pollThemeEditorChanges(targetTheme: Theme, session: AdminSession, localThemeFileSystem: ThemeFileSystem) {
  outputDebug('Checking for changes in the theme editor')
  const reconcileThemeChanges = async () => {
    const currentChecksums = await fetchChecksums(targetTheme.id, session)
    return reconcileThemeFiles(targetTheme, session, currentChecksums, localThemeFileSystem)
  }

  return setTimeout(() => {
    reconcileThemeChanges()
      .then(() => {
        pollThemeEditorChanges(targetTheme, session, localThemeFileSystem)
      })
      .catch((error) => {
        outputDebug(`Error while checking for changes in the theme editor: ${error.message}`)
        pollThemeEditorChanges(targetTheme, session, localThemeFileSystem)
      })
  }, POLLING_INTERVAL)
}
