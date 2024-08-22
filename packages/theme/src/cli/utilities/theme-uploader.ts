import {partitionThemeFiles, readThemeFilesFromDisk} from './theme-fs.js'
import {applyIgnoreFilters} from './asset-ignore.js'
import {renderTasksToStdErr} from './theme-ui.js'
import {rejectGeneratedStaticAssets} from './asset-checksum.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Result, Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {AssetParams, bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {fileSize} from '@shopify/cli-kit/node/fs'
import {Task} from '@shopify/cli-kit/node/ui'
import {outputDebug, outputInfo, outputNewline, outputWarn} from '@shopify/cli-kit/node/output'

interface UploadOptions {
  nodelete?: boolean
  ignore?: string[]
  only?: string[]
}
type FileBatch = Checksum[]

// Limits for Bulk Requests
export const MAX_BATCH_FILE_COUNT = 10
// 100KB
export const MAX_BATCH_BYTESIZE = 102400
export const MAX_UPLOAD_RETRY_COUNT = 2

export async function uploadTheme(
  theme: Theme,
  session: AdminSession,
  checksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions = {},
) {
  const remoteChecksums = rejectGeneratedStaticAssets(checksums)
  const uploadResults: Map<string, Result> = new Map()
  await themeFileSystem.ready()
  const deleteTasks = await buildDeleteTasks(remoteChecksums, themeFileSystem, options, theme, session)
  const uploadTasks = await buildUploadTasks(remoteChecksums, themeFileSystem, options, theme, session, uploadResults)

  return {
    uploadResults,
    renderThemeSyncProgress: async () => {
      // The task execution mechanism processes tasks sequentially in the order they are added.
      await renderTasksToStdErr(deleteTasks)
      await renderTasksToStdErr(uploadTasks)
      reportFailedUploads(uploadResults)
    },
  }
}

async function buildDeleteTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
  theme: Theme,
  session: AdminSession,
): Promise<Task<unknown>[]> {
  if (options.nodelete) {
    return []
  }

  const filteredChecksums = await applyIgnoreFilters(remoteChecksums, themeFileSystem, options)
  const remoteFilesToBeDeleted = await getRemoteFilesToBeDeleted(filteredChecksums, themeFileSystem, options)
  const orderedFiles = orderFilesToBeDeleted(remoteFilesToBeDeleted)

  return orderedFiles.map((file) => ({
    title: `Cleaning your remote theme (removing ${file.key})`,
    task: async () => {
      await deleteThemeAsset(theme.id, file.key, session)
    },
  }))
}

async function getRemoteFilesToBeDeleted(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
): Promise<Checksum[]> {
  const localKeys = new Set(themeFileSystem.files.keys())
  const filteredChecksums = await applyIgnoreFilters(remoteChecksums, themeFileSystem, options)
  const filesToBeDeleted = filteredChecksums.filter((checksum) => !localKeys.has(checksum.key))
  outputDebug(`Files to be deleted:\n${filesToBeDeleted.map((file) => `-${file.key}`).join('\n')}`)
  return filesToBeDeleted
}

// Contextual Json Files -> Json Files -> Liquid Files -> Config Files -> Static Asset Files
function orderFilesToBeDeleted(files: Checksum[]): Checksum[] {
  const fileSets = partitionThemeFiles(files)
  return [
    ...fileSets.contextualizedJsonFiles,
    ...fileSets.templateJsonFiles,
    ...fileSets.otherJsonFiles,
    ...fileSets.sectionLiquidFiles,
    ...fileSets.otherLiquidFiles,
    ...fileSets.configFiles,
    ...fileSets.staticAssetFiles,
  ]
}

async function buildUploadTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
  theme: Theme,
  session: AdminSession,
  uploadResults: Map<string, Result>,
): Promise<Task[]> {
  const filesToUpload = await selectUploadableFiles(themeFileSystem, remoteChecksums, options)
  await readThemeFilesFromDisk(filesToUpload, themeFileSystem)
  return createUploadTasks(filesToUpload, themeFileSystem, session, theme, uploadResults)
}

async function selectUploadableFiles(
  themeFileSystem: ThemeFileSystem,
  remoteChecksums: Checksum[],
  options: UploadOptions,
): Promise<Checksum[]> {
  const localChecksums = calculateLocalChecksums(themeFileSystem)
  const filteredLocalChecksums = await applyIgnoreFilters(localChecksums, themeFileSystem, options)
  const remoteChecksumsMap = new Map<string, Checksum>()
  remoteChecksums.forEach((remote) => {
    remoteChecksumsMap.set(remote.key, remote)
  })

  const filesToUpload = filteredLocalChecksums.filter((local) => {
    const remote = remoteChecksumsMap.get(local.key)
    return !remote || remote.checksum !== local.checksum
  })
  outputDebug(`Files to be uploaded:\n${filesToUpload.map((file) => `-${file.key}`).join('\n')}`)
  return filesToUpload
}

async function createUploadTasks(
  filesToUpload: Checksum[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  theme: Theme,
  uploadResults: Map<string, Result>,
): Promise<Task[]> {
  const orderedFiles = orderFilesToBeUploaded(filesToUpload)

  let currentFileCount = 0
  const totalFileCount = filesToUpload.length
  const uploadTasks = [] as Task[]

  for (const fileType of orderedFiles) {
    // eslint-disable-next-line no-await-in-loop
    const {tasks: newTasks, updatedFileCount} = await createUploadTaskForFileType(
      fileType,
      themeFileSystem,
      session,
      uploadResults,
      theme.id,
      totalFileCount,
      currentFileCount,
    )
    currentFileCount = updatedFileCount
    uploadTasks.push(...newTasks)
  }

  return uploadTasks
}

// We use this 2d array to batch files of the same type together while maintaining the order between file types
function orderFilesToBeUploaded(files: Checksum[]): Checksum[][] {
  const fileSets = partitionThemeFiles(files)
  return [
    fileSets.otherLiquidFiles,
    fileSets.sectionLiquidFiles,
    fileSets.otherJsonFiles,
    fileSets.templateJsonFiles,
    fileSets.contextualizedJsonFiles,
    fileSets.configFiles,
    fileSets.staticAssetFiles,
  ]
}

async function createUploadTaskForFileType(
  checksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  uploadResults: Map<string, Result>,
  themeId: number,
  totalFileCount: number,
  currentFileCount: number,
): Promise<{tasks: Task[]; updatedFileCount: number}> {
  if (checksums.length === 0) {
    return {tasks: [], updatedFileCount: currentFileCount}
  }

  const batches = await createBatches(checksums, themeFileSystem.root)
  return createBatchedUploadTasks(
    batches,
    themeFileSystem,
    session,
    uploadResults,
    themeId,
    totalFileCount,
    currentFileCount,
  )
}

function createBatchedUploadTasks(
  batches: FileBatch[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  uploadResults: Map<string, Result>,
  themeId: number,
  totalFileCount: number,
  currentFileCount: number,
): {tasks: Task[]; updatedFileCount: number} {
  let runningFileCount = currentFileCount
  const tasks = batches.map((batch) => {
    runningFileCount += batch.length
    const progress = Math.round((runningFileCount / totalFileCount) * 100)
    return {
      title: `Uploading files to remote theme [${progress}%]`,
      task: async () => uploadBatch(batch, themeFileSystem, session, themeId, uploadResults),
    }
  })
  return {
    tasks,
    updatedFileCount: runningFileCount,
  }
}

async function createBatches(files: Checksum[], path: string): Promise<FileBatch[]> {
  const fileSizes = await Promise.all(files.map((file) => fileSize(`${path}/${file.key}`)))
  const batches = []

  let currentBatch: Checksum[] = []
  let currentBatchSize = 0

  files.forEach((file, index) => {
    const hasEnoughItems = currentBatch.length >= MAX_BATCH_FILE_COUNT
    const hasEnoughByteSize = currentBatchSize >= MAX_BATCH_BYTESIZE

    if (hasEnoughItems || hasEnoughByteSize) {
      batches.push(currentBatch)
      currentBatch = []
      currentBatchSize = 0
    }

    currentBatch.push(file)
    currentBatchSize += fileSizes[index] ?? 0
  })

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

function calculateLocalChecksums(localThemeFileSystem: ThemeFileSystem): Checksum[] {
  const checksums: Checksum[] = []

  localThemeFileSystem.files.forEach((value, key) => {
    checksums.push({
      key,
      checksum: value.checksum,
    })
  })

  return checksums
}

async function uploadBatch(
  batch: FileBatch,
  localThemeFileSystem: ThemeFileSystem,
  session: AdminSession,
  themeId: number,
  uploadResults: Map<string, Result>,
) {
  const uploadParams = batch.map((file) => {
    const value = localThemeFileSystem.files.get(file.key)?.value
    const attachment = localThemeFileSystem.files.get(file.key)?.attachment
    return {
      key: file.key,
      ...(value && {value}),
      ...(attachment && {attachment}),
    }
  })
  outputDebug(`Uploading the following files:\n${batch.map((file) => `-${file.key}`).join('\n')}`)
  const results = await handleBulkUpload(uploadParams, themeId, session)
  // store the results in uploadResults, overwriting any existing results
  results.forEach((result) => {
    uploadResults.set(result.key, result)
  })
}

async function handleBulkUpload(
  uploadParams: AssetParams[],
  themeId: number,
  session: AdminSession,
  count = 0,
): Promise<Result[]> {
  if (uploadParams.length === 0) {
    return []
  }
  if (count > 0) {
    outputDebug(
      `Retry Attempt ${count}/${MAX_UPLOAD_RETRY_COUNT} for the following files:
      ${uploadParams.map((param) => `-${param.key}`).join('\n')}`,
    )
  }

  const results = await bulkUploadThemeAssets(themeId, uploadParams, session)
  outputDebug(
    `File Upload Results:\n${results
      .map((result) => `-${result.key}: ${result.success ? 'success' : 'failure'}`)
      .join('\n')}`,
  )

  const failedUploadResults = results.filter((result) => result.success === false)
  if (failedUploadResults.length > 0) {
    outputDebug(
      `The following files failed to upload:\n${failedUploadResults.map((param) => `-${param.key}`).join('\n')}`,
    )
    const failedResults = await handleFailedUploads(failedUploadResults, uploadParams, themeId, session, count)
    return results.concat(failedResults)
  }
  return results
}

async function handleFailedUploads(
  failedUploadResults: Result[],
  uploadParams: AssetParams[],
  themeId: number,
  session: AdminSession,
  count: number,
): Promise<Result[]> {
  const failedUploadsSet = new Set(failedUploadResults.map((result) => result.key))
  const failedUploadParams = uploadParams.filter((param) => failedUploadsSet.has(param.key))

  if (count === MAX_UPLOAD_RETRY_COUNT) {
    outputDebug(
      `Max retry count reached for the following files:\n${failedUploadParams
        .map((param) => `-${param.key}`)
        .join('\n')}`,
    )
    return failedUploadResults
  }

  return handleBulkUpload(failedUploadParams, themeId, session, count + 1)
}

function reportFailedUploads(uploadResults: Map<string, Result>) {
  for (const [key, result] of uploadResults.entries()) {
    if (!result.success) {
      const errorMessage = result.errors?.asset?.map((err) => `-${err}`).join('\n')
      outputWarn(`Failed to upload file ${key}:`)
      outputInfo(`${errorMessage}`)
      outputNewline()
    }
  }
}
