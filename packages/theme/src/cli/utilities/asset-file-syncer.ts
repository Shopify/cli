import {downloadTheme} from './theme-downloader.js'
import {uploadTheme} from './theme-uploader.js'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Checksum, Theme, ThemeAsset, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {renderInfo, renderSelectPrompt} from '@shopify/cli-kit/node/ui'

export const LOCAL_STRATEGY = 'local'
export const REMOTE_STRATEGY = 'remote'

type ReconciliationStrategy = typeof LOCAL_STRATEGY | typeof REMOTE_STRATEGY | undefined

interface FilePartitions {
  filesToDelete: Checksum[]
  filesToDownload: Checksum[]
  filesToUpload: Checksum[]
}

export async function initializeThemeEditorSync(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
) {
  outputDebug('Initiating theme asset reconciliation process')

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
    return
  }

  const partitionedFiles = await partitionFilesByReconciliationStrategy({
    filesOnlyPresentLocally,
    filesOnlyPresentOnRemote,
    filesWithConflictingChecksums,
  })

  await reconcileThemeFiles(targetTheme, session, remoteChecksums, localThemeFileSystem, partitionedFiles)
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

async function reconcileThemeFiles(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  partitionedFiles: FilePartitions,
) {
  const {filesToDelete, filesToDownload, filesToUpload} = partitionedFiles

  // the 'only' filter is empty, we want to treat that as a no-op rather than an empty filter
  if (filesToUpload.length > 0) {
    await uploadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {
      only: filesToUpload.map((file) => file.key),
    })
  }

  if (filesToDownload.length > 0 || filesToDelete.length > 0) {
    await downloadTheme(targetTheme, session, remoteChecksums, localThemeFileSystem, {
      nodelete: false,
      only: [...filesToDownload.map((file) => file.key), ...filesToDelete.map((file) => file.key)],
    })
  }
  outputInfo('done')
}

async function partitionFilesByReconciliationStrategy(files: {
  filesOnlyPresentLocally: Checksum[]
  filesOnlyPresentOnRemote: Checksum[]
  filesWithConflictingChecksums: Checksum[]
}): Promise<{filesToDelete: Checksum[]; filesToDownload: Checksum[]; filesToUpload: Checksum[]}> {
  const {filesOnlyPresentLocally, filesOnlyPresentOnRemote, filesWithConflictingChecksums} = files

  const localFileReconciliationStrategy = await promptFileReconciliationStrategy(filesOnlyPresentLocally, {
    title: 'The files listed below are only present locally. What would you like to do?',
    remoteStrategyLabel: 'Delete files from the local directory',
    localStrategyLabel: 'Upload local files to the remote theme',
  })

  const remoteFileReconciliationStrategy = await promptFileReconciliationStrategy(filesOnlyPresentOnRemote, {
    title: 'The files listed below are only present on the remote theme. What would you like to do?',
    remoteStrategyLabel: 'Download remote files to the local directory',
    localStrategyLabel: 'Delete files from the remote theme',
  })

  const conflictingChecksumsReconciliationStrategy = await promptFileReconciliationStrategy(
    filesWithConflictingChecksums,
    {
      title: 'The files listed below differ between the local and remote versions. What would you like to do?',
      remoteStrategyLabel: 'Keep the remote version',
      localStrategyLabel: 'Keep the local version',
    },
  )

  const filesToDelete = []
  const filesToDownload = []
  const filesToUpload = []

  if (localFileReconciliationStrategy === LOCAL_STRATEGY) {
    filesToUpload.push(...filesOnlyPresentLocally)
  } else if (localFileReconciliationStrategy === REMOTE_STRATEGY) {
    filesToDelete.push(...filesOnlyPresentLocally)
  }

  if (remoteFileReconciliationStrategy === REMOTE_STRATEGY) {
    filesToDownload.push(...filesOnlyPresentOnRemote)
  } else if (remoteFileReconciliationStrategy === LOCAL_STRATEGY) {
    filesToUpload.push(...filesOnlyPresentOnRemote)
  }

  if (conflictingChecksumsReconciliationStrategy === REMOTE_STRATEGY) {
    filesToDownload.push(...filesWithConflictingChecksums)
  } else {
    filesToUpload.push(...filesWithConflictingChecksums)
  }

  return {filesToDelete, filesToDownload, filesToUpload}
}
