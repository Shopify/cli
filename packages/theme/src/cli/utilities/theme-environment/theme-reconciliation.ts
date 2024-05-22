import {REMOTE_STRATEGY, LOCAL_STRATEGY} from './remote-theme-watcher.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchThemeAsset, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {Checksum, ThemeFileSystem, ThemeAsset, Theme} from '@shopify/cli-kit/node/themes/types'
import {renderInfo, renderSelectPrompt} from '@shopify/cli-kit/node/ui'

type ReconciliationStrategy = typeof LOCAL_STRATEGY | typeof REMOTE_STRATEGY | undefined

interface FilePartitions {
  localFilesToDelete: Checksum[]
  filesToDownload: Checksum[]
  remoteFilesToDelete: Checksum[]
}

interface ReconciliationOptions {
  noDelete?: boolean
  only?: string[]
  ignore?: string[]
}

export async function reconcileJsonFiles(
  targetTheme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  localThemeFileSystem: ThemeFileSystem,
  options?: ReconciliationOptions,
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

  const partitionedFiles = await partitionFilesByReconciliationStrategy(
    {
      filesOnlyPresentLocally,
      filesOnlyPresentOnRemote,
      filesWithConflictingChecksums,
    },
    options,
  )

  await performFileReconciliation(targetTheme, session, localThemeFileSystem, partitionedFiles)
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
    filesOnlyPresentOnRemote: filesOnlyPresentOnRemote.filter((file) => file.key.endsWith('.json')),
    filesOnlyPresentLocally: filesOnlyPresentLocally.filter((file) => file.key.endsWith('.json')),
    filesWithConflictingChecksums: filesWithConflictingChecksums.filter((file) => file.key.endsWith('.json')),
  }
}

async function promptFileReconciliationStrategy(
  files: Checksum[],
  title: string,
  options: {
    remote: {
      label: string
      callback: (files: Checksum[]) => void
    }
    local: {
      label: string
      callback: (files: Checksum[]) => void
    }
  },
): Promise<ReconciliationStrategy | undefined> {
  if (files.length === 0) {
    return
  }

  renderInfo({
    body: {
      list: {
        title,
        items: files.map((file) => file.key),
      },
    },
  })

  const selectedStrategy = await renderSelectPrompt({
    message: 'Reconciliation Strategy',
    choices: [
      {label: options.remote.label, value: REMOTE_STRATEGY},
      {label: options.local.label, value: LOCAL_STRATEGY},
    ],
  })

  if (selectedStrategy === REMOTE_STRATEGY) {
    options.remote.callback(files)
  } else {
    options.local.callback(files)
  }
}

async function performFileReconciliation(
  targetTheme: Theme,
  session: AdminSession,
  localThemeFileSystem: ThemeFileSystem,
  partitionedFiles: FilePartitions,
) {
  const {localFilesToDelete, filesToDownload, remoteFilesToDelete} = partitionedFiles

  const deleteLocalFiles = localFilesToDelete.map((file) => localThemeFileSystem.delete(file.key))
  const downloadRemoteFiles = filesToDownload.map(async (file) => {
    const asset = await fetchThemeAsset(targetTheme.id, file.key, session)
    if (asset) {
      return localThemeFileSystem.write(asset)
    }
  })
  const deleteRemoteFiles = remoteFilesToDelete.map((file) => deleteThemeAsset(targetTheme.id, file.key, session))

  if (downloadRemoteFiles.length > 0 || deleteRemoteFiles.length > 0) {
    renderInfo({
      body: 'Starting file synchronization. This may take a while if there are many or large files to download...',
    })
  }

  await Promise.all([...deleteLocalFiles, ...downloadRemoteFiles, ...deleteRemoteFiles])
}

async function partitionFilesByReconciliationStrategy(
  files: {
    filesOnlyPresentLocally: Checksum[]
    filesOnlyPresentOnRemote: Checksum[]
    filesWithConflictingChecksums: Checksum[]
  },
  options?: ReconciliationOptions,
): Promise<FilePartitions> {
  const {filesOnlyPresentLocally, filesOnlyPresentOnRemote, filesWithConflictingChecksums} = files

  const localFilesToDelete: Checksum[] = []
  const filesToDownload: Checksum[] = []
  const remoteFilesToDelete: Checksum[] = []

  if (!options?.noDelete) {
    await promptFileReconciliationStrategy(
      filesOnlyPresentLocally,
      'The files listed below are only present locally. What would you like to do?',
      {
        remote: {
          label: 'Delete files from the local directory',
          callback: (files) => {
            localFilesToDelete.push(...files)
          },
        },
        local: {
          label: 'Upload local files to the remote theme',
          callback: () => {},
        },
      },
    )
  }

  await promptFileReconciliationStrategy(
    filesOnlyPresentOnRemote,
    'The files listed below are only present on the remote theme. What would you like to do?',
    {
      remote: {
        label: 'Download remote files to the local directory',
        callback: (files) => {
          filesToDownload.push(...files)
        },
      },
      local: {
        label: 'Delete files from the remote theme',
        callback: (files) => {
          remoteFilesToDelete.push(...files)
        },
      },
    },
  )

  await promptFileReconciliationStrategy(
    filesWithConflictingChecksums,
    'The files listed below differ between the local and remote versions. What would you like to do?',
    {
      remote: {
        label: 'Keep the remote version',
        callback: (files) => {
          filesToDownload.push(...files)
        },
      },
      local: {
        label: 'Keep the local version',
        callback: () => {},
      },
    },
  )

  return {localFilesToDelete, filesToDownload, remoteFilesToDelete}
}
