import {partitionThemeFiles, readThemeFile} from './theme-fs.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {BulkUploadResult, Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {AssetParams, bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {fileSize} from '@shopify/cli-kit/node/fs'
import {Task, renderTasks as renderTaskOriginal} from '@shopify/cli-kit/node/ui'

interface UploadOptions {
  path: string
  nodelete?: boolean
}
type FileBatch = string[]

// Limits for Bulk Requests
export const MAX_BATCH_FILE_COUNT = 10
// 100KB
export const MAX_BATCH_BYTESIZE = 102400
export const MAX_UPLOAD_RETRY_COUNT = 3

export async function uploadTheme(
  theme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
) {
  const {jsonTasks, otherTasks} = buildDeleteTasks(remoteChecksums, themeFileSystem, options, theme, session)
  const {liquidUploadTasks, jsonUploadTasks, configUploadTasks, staticUploadTasks} = await buildUploadTasks(
    remoteChecksums,
    themeFileSystem,
    options,
    theme,
    session,
  )
  await renderTasks(jsonTasks)
  await renderTasks(otherTasks)

  await renderTasks(liquidUploadTasks)
  await renderTasks(jsonUploadTasks)
  await renderTasks(configUploadTasks)
  await renderTasks(staticUploadTasks)
}

function buildDeleteTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
  theme: Theme,
  session: AdminSession,
) {
  if (options.nodelete) {
    return {jsonTasks: [], otherTasks: []}
  }

  const localKeys = new Set(themeFileSystem.files.keys())

  const remoteFilesToBeDeleted = remoteChecksums.filter((checksum) => !localKeys.has(checksum.key))
  const {jsonFiles, liquidFiles, configFiles, staticAssetFiles} = partitionThemeFiles(
    remoteFilesToBeDeleted.map((checksum) => checksum.key),
  )
  const otherFiles = [...liquidFiles, ...configFiles, ...staticAssetFiles]

  const jsonTasks = jsonFiles.map((file) => ({
    title: `Cleaning your remote theme (removing ${file})`,
    task: async () => deleteFileFromRemote(theme.id, file, session),
  }))

  const otherTasks = otherFiles.map((file) => ({
    title: `Cleaning your remote theme (removing ${file})`,
    task: async () => deleteFileFromRemote(theme.id, file, session),
  }))

  return {jsonTasks, otherTasks}
}

async function deleteFileFromRemote(themeId: number, file: string, session: AdminSession) {
  await deleteThemeAsset(themeId, file, session)
}

async function buildUploadTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
  theme: Theme,
  session: AdminSession,
): Promise<{liquidUploadTasks: Task[]; jsonUploadTasks: Task[]; configUploadTasks: Task[]; staticUploadTasks: Task[]}> {
  const localChecksums = calculateLocalChecksums(themeFileSystem)
  // this seems incorrect (selecting too many files)
  const filesToUpload = (await selectUploadableFiles(remoteChecksums, localChecksums)).map((checksum) => checksum.key)
  await readThemeFilesFromDisk(filesToUpload, themeFileSystem)

  const {jsonFiles, liquidFiles, configFiles, staticAssetFiles} = partitionThemeFiles(filesToUpload)

  // build batches (liquid, json, config, static)
  const liquidBatches = await createBatches(liquidFiles, options.path)
  const jsonBatches = await createBatches(jsonFiles, options.path)
  const configBatches = await createBatches(configFiles, options.path)
  const staticBatches = await createBatches(staticAssetFiles, options.path)

  const totalFileCount = filesToUpload.length

  const {tasks: liquidUploadTasks, currentFileCount: liquidCount} = createUploadTasks(
    liquidBatches,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    0,
  )
  const {tasks: jsonUploadTasks, currentFileCount: jsonCount} = createUploadTasks(
    jsonBatches,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    liquidCount,
  )
  const {tasks: configUploadTasks, currentFileCount: configCount} = createUploadTasks(
    configBatches,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    jsonCount,
  )
  const {tasks: staticUploadTasks} = createUploadTasks(
    staticBatches,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    configCount,
  )

  return {liquidUploadTasks, jsonUploadTasks, configUploadTasks, staticUploadTasks}
}

function createUploadTasks(
  batches: FileBatch[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  themeId: number,
  totalFileCount: number,
  currentFileCount: number,
): {tasks: Task[]; currentFileCount: number} {
  let runningFileCount = currentFileCount
  const tasks = batches.map((batch) => {
    runningFileCount += batch.length
    const progress = Math.round((currentFileCount / totalFileCount) * 100)
    return {
      title: `Uploading files to remote theme [${progress}%]`,
      task: async () => uploadBatch(batch, themeFileSystem, session, themeId),
    }
  })
  return {
    tasks,
    currentFileCount: runningFileCount,
  }
}

// Only upload files that are not present in the remote checksums or have different checksums
function selectUploadableFiles(remoteChecksums: Checksum[], localCheckSums: Checksum[]): Checksum[] {
  const remoteChecksumsMap = new Map<string, Checksum>()
  remoteChecksums.forEach((remote) => {
    remoteChecksumsMap.set(remote.key, remote)
  })

  return localCheckSums.filter((local) => {
    const remote = remoteChecksumsMap.get(local.key)
    return !remote || remote.checksum !== local.checksum
  })
}

async function createBatches(files: string[], path: string): Promise<FileBatch[]> {
  const fileSizes = await Promise.all(files.map((file) => fileSize(`${path}/${file}`)))
  const batches = []

  let currentBatch: string[] = []
  let currentBatchSize = 0

  files.forEach((file, index) => {
    const hasEnoughItems = currentBatch.length >= MAX_BATCH_FILE_COUNT
    const hasEnoughByteSize = currentBatchSize >= MAX_BATCH_BYTESIZE

    // If the current batch has reached the item or size limit, push it to the batches array
    if (hasEnoughItems || hasEnoughByteSize) {
      batches.push(currentBatch)
      currentBatch = []
      currentBatchSize = 0
    }

    currentBatch.push(file)
    currentBatchSize += fileSizes[index] ?? 0
  })

  // Push remainder of currentBatch if it's not empty
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
) {
  const uploadParams = batch.map((file) => ({
    key: file,
    value: localThemeFileSystem.files.get(file)?.value,
    attachment: localThemeFileSystem.files.get(file)?.attachment,
  }))
  const results = await bulkUploadThemeAssets(themeId, uploadParams, session)
  await retryFailures(uploadParams, results, themeId, session)
}

async function retryFailures(
  uploadParams: AssetParams[],
  results: BulkUploadResult[],
  themeId: number,
  session: AdminSession,
  count = 0,
) {
  const succesfulUploads = results.filter((result) => result.success).map((result) => result.key)
  if (succesfulUploads.length < uploadParams.length && count < MAX_UPLOAD_RETRY_COUNT) {
    const succesfulUploadsSet = new Set(succesfulUploads)
    const failedUploadParams = uploadParams.filter((param) => !succesfulUploadsSet.has(param.key))
    const results = await bulkUploadThemeAssets(themeId, failedUploadParams, session)
    await retryFailures(failedUploadParams, results, themeId, session, count + 1)
  }
}

async function readThemeFilesFromDisk(filesToUpload: string[], themeFileSystem: ThemeFileSystem) {
  await Promise.all(
    filesToUpload.map(async (file) => {
      const themeAsset = themeFileSystem.files.get(file)
      if (themeAsset === undefined) {
        return
      }

      const fileData = await readThemeFile(themeFileSystem.root, file)
      if (Buffer.isBuffer(fileData)) {
        themeAsset.attachment = fileData.toString('base64')
      } else {
        themeAsset.value = fileData
      }
      themeFileSystem.files.set(file, themeAsset)
    }),
  )
}

async function renderTasks(tasks: Task[]) {
  if (tasks.length > 0) {
    await renderTaskOriginal(tasks)
  }
}
