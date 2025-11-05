import {partitionThemeFiles} from './theme-fs.js'
import {rejectGeneratedStaticAssets} from './asset-checksum.js'
import {createSyncingCatchError, renderThrownError} from './errors.js'
import {triggerBrowserFullReload} from './theme-environment/hot-reload/server.js'
import {renderTasksToStdErr} from './theme-ui.js'
import {downloadFiles} from './theme-downloader.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Result, Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {AssetParams, bulkUploadThemeAssets, deleteThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {renderInfo, Task} from '@shopify/cli-kit/node/ui'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {Writable} from 'stream'

interface UploadOptions {
  nodelete?: boolean
  deferPartialWork?: boolean
  backgroundWorkCatch?: (error: Error) => never
  environment?: string
  multiEnvironment?: boolean
  handleRewrittenFiles?: 'warn' | 'fix'
}

type ChecksumWithSize = Checksum & {size: number}
type FileBatch = ChecksumWithSize[]

/**
 * Even though the API itself can handle a higher batch size, we limit the batch file count + bytesize
 * to avoid timeout issues happening on the theme access proxy level.
 *
 * The higher the batch size, the longer the proxy request lasts. We should also generally avoid long running
 * queries against our API (i.e. over 30 seconds). There is no specific reason for these values, but were
 * previously used against the AssetController.
 */
// Limits for Bulk Requests
export const MAX_BATCH_FILE_COUNT = 20
// 1MB
export const MAX_BATCH_BYTESIZE = 1024 * 1024
export const MAX_UPLOAD_RETRY_COUNT = 2

export function uploadTheme(
  theme: Theme,
  session: AdminSession,
  checksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions = {},
  context?: {stdout?: Writable; stderr?: Writable},
) {
  const remoteChecksums = rejectGeneratedStaticAssets(checksums)
  const uploadResults = new Map<string, Result>()
  const getProgress = (params: {current: number; total: number}) =>
    params.total === 0 ? `[100%]` : `[${Math.round((params.current / params.total) * 100)}%]`

  const themeCreationPromise = ensureThemeCreation(theme, session, remoteChecksums)

  const uploadJobPromise = Promise.all([themeFileSystem.ready(), themeCreationPromise]).then(() =>
    buildUploadJob(remoteChecksums, themeFileSystem, theme, session, uploadResults),
  )

  const deleteJobPromise = uploadJobPromise
    .then((result) => result.promise)
    .then(() => buildDeleteJob(remoteChecksums, themeFileSystem, theme, session, options, uploadResults))

  const workPromise = options?.deferPartialWork
    ? themeCreationPromise.then(() => {})
    : deleteJobPromise.then((result) => result.promise)

  if (options?.backgroundWorkCatch) {
    // Aggregate all background work in a single promise and handle errors
    Promise.all([
      themeCreationPromise,
      uploadJobPromise.then((result) => result.promise),
      deleteJobPromise.then((result) => result.promise),
    ]).catch(options.backgroundWorkCatch)
  }

  const syncRewrittenFilesPromise = options?.handleRewrittenFiles
    ? Promise.all([themeFileSystem.ready(), themeCreationPromise, uploadJobPromise, deleteJobPromise]).then(
        async () => {
          const filesDifferentFromRemote: string[] = []

          for (const uploadResult of uploadResults.values()) {
            if (!uploadResult.key.endsWith('.liquid')) continue

            const localFile = themeFileSystem.files.get(uploadResult.key)

            if (
              localFile?.value &&
              uploadResult.success &&
              uploadResult.asset?.checksum &&
              uploadResult.asset.checksum !== localFile.checksum
            ) {
              filesDifferentFromRemote.push(uploadResult.key)
            }
          }

          if (filesDifferentFromRemote.length > 0) {
            if (options.handleRewrittenFiles === 'fix') {
              renderInfo({
                headline: `Updated Liquid files to conform to latest Liquid standards.`,
                body: [
                  `The following Liquid files were updated locally and remotely:`,
                  {
                    list: {
                      items: filesDifferentFromRemote,
                    },
                  },
                ],
              })
              await downloadFiles(theme, themeFileSystem, filesDifferentFromRemote, session)
            } else if (options.handleRewrittenFiles === 'warn') {
              renderInfo({
                headline: `Liquid files were updated remotely to conform to latest Liquid standards.`,
                body: [
                  'The following Liquid files were updated remotely:',
                  {
                    list: {
                      items: filesDifferentFromRemote,
                    },
                  },
                ],
                nextSteps: [
                  [
                    'Fetch the latest files using',
                    {
                      command: 'shopify theme pull',
                    },
                    'to sync them locally.',
                  ],
                ],
              })
            }
          }
        },
      )
    : Promise.resolve()

  return {
    uploadResults,
    workPromise,
    syncRewrittenFilesPromise,
    renderThemeSyncProgress: async () => {
      if (options?.deferPartialWork) return

      const {progress: uploadProgress, promise: uploadPromise} = await uploadJobPromise

      const updateInterval = options.multiEnvironment ? 4000 : 1000

      await renderTasksToStdErr(
        createIntervalTask({
          promise: uploadPromise,
          titleGetter: () => `Uploading files to remote theme ${getProgress(uploadProgress)}`,
          updateInterval,
        }),
        context?.stderr,
        options?.multiEnvironment,
      )

      const {progress: deleteProgress, promise: deletePromise} = await deleteJobPromise
      await renderTasksToStdErr(
        createIntervalTask({
          promise: deletePromise,
          titleGetter: () => `Cleaning your remote theme ${getProgress(deleteProgress)}`,
          updateInterval,
        }),
        context?.stderr,
        options?.multiEnvironment,
      )

      await renderTasksToStdErr(
        [{title: 'Theme upload complete', task: async () => {}}],
        context?.stderr,
        options?.multiEnvironment,
      )

      // Report any failed uploads after all progress rendering is complete
      reportFailedUploads(uploadResults, options?.environment)
    },
  }
}

function createIntervalTask({
  promise,
  titleGetter,
  updateInterval,
}: {
  promise: Promise<unknown>
  titleGetter: () => string
  updateInterval: number
}) {
  const tasks: Task[] = []

  const addNextCheck = () => {
    tasks.push({
      title: titleGetter(),
      task: async () => {
        const result = await Promise.race([
          promise,
          new Promise((resolve) => setTimeout(() => resolve('timeout'), updateInterval)),
        ])

        if (result === 'timeout') {
          addNextCheck()
        }
      },
    })
  }

  addNextCheck()
  return tasks
}

function buildDeleteJob(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  theme: Theme,
  session: AdminSession,
  options: Pick<UploadOptions, 'nodelete'>,
  uploadResults: Map<string, Result>,
): SyncJob {
  if (options.nodelete) {
    return {progress: {current: 0, total: 0}, promise: Promise.resolve()}
  }

  const remoteFilesToBeDeleted = getRemoteFilesToBeDeleted(remoteChecksums, themeFileSystem)
  const orderedFiles = orderFilesToBeDeleted(remoteFilesToBeDeleted)

  const progress = {current: 0, total: orderedFiles.length}
  if (orderedFiles.length === 0) {
    return {progress, promise: Promise.resolve()}
  }

  const deleteBatches = []
  for (let i = 0; i < orderedFiles.length; i += MAX_BATCH_FILE_COUNT) {
    const batch = orderedFiles.slice(i, i + MAX_BATCH_FILE_COUNT)
    const promise = deleteThemeAssets(
      theme.id,
      batch.map((file) => file.key),
      session,
    ).then((results) => {
      results.forEach((result) => {
        uploadResults.set(result.key, result)
        if (!result.success) {
          const errorMessage = result.errors?.asset?.map((err) => `-${err}`).join('\n')
          createSyncingCatchError(result.key, 'delete')(new Error(`Failed to delete ${result.key}: ${errorMessage}`))
        }
      })
      progress.current += batch.length
    })
    deleteBatches.push(promise)
  }

  const promise = Promise.all(deleteBatches).then(() => {
    progress.current = progress.total
  })

  return {progress, promise}
}

function getRemoteFilesToBeDeleted(remoteChecksums: Checksum[], themeFileSystem: ThemeFileSystem): Checksum[] {
  const filteredChecksums = themeFileSystem.applyIgnoreFilters(remoteChecksums)
  const filesToBeDeleted = filteredChecksums.filter((checksum) => !themeFileSystem.files.has(checksum.key))
  outputDebug(`Files to be deleted:\n${filesToBeDeleted.map((file) => `-${file.key}`).join('\n')}`)
  return filesToBeDeleted
}

// Contextual Json Files -> Json Files -> Liquid Files -> Config Files -> Static Asset Files
function orderFilesToBeDeleted(files: Checksum[]): Checksum[] {
  const fileSets = partitionThemeFiles(files)
  return [
    ...fileSets.contextualizedJsonFiles,
    ...fileSets.templateJsonFiles,
    ...fileSets.sectionJsonFiles,
    ...fileSets.otherJsonFiles,
    ...fileSets.sectionLiquidFiles,
    ...fileSets.blockLiquidFiles,
    ...fileSets.layoutFiles,
    ...fileSets.otherLiquidFiles,
    ...fileSets.configFiles,
    ...fileSets.staticAssetFiles,
  ]
}

export const MINIMUM_THEME_ASSETS = [
  {key: 'config/settings_schema.json', value: '[]'},
  {
    key: 'layout/password.liquid',
    value: '{{ content_for_header }}{{ content_for_layout }}',
  },
  {
    key: 'layout/theme.liquid',
    value: '{{ content_for_header }}{{ content_for_layout }}',
  },
] as const
/**
 * If there's no theme in the remote, we need to create it first so that
 * requests for _shopify_essential can work. We upload the minimum assets
 * here to make it faster.
 */
async function ensureThemeCreation(theme: Theme, session: AdminSession, remoteChecksums: Checksum[]) {
  const remoteAssetKeys = new Set(remoteChecksums.map((checksum) => checksum.key))
  const missingAssets = MINIMUM_THEME_ASSETS.filter(({key}) => !remoteAssetKeys.has(key))

  if (missingAssets.length === 0) {
    return Promise.resolve([])
  }

  return bulkUploadThemeAssets(theme.id, missingAssets, session)
}

interface SyncJob {
  progress: {current: number; total: number}
  promise: Promise<void>
}

function buildUploadJob(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  theme: Theme,
  session: AdminSession,
  uploadResults: Map<string, Result>,
): SyncJob {
  const filesToUpload = selectUploadableFiles(themeFileSystem, remoteChecksums)

  // Adjust unsyncedFileKeys to reflect only the files that are about to be uploaded
  themeFileSystem.unsyncedFileKeys.clear()
  filesToUpload.forEach((file) => themeFileSystem.unsyncedFileKeys.add(file.key))

  const {independentFiles, dependentFiles} = orderFilesToBeUploaded(filesToUpload)

  const progress = {current: 0, total: filesToUpload.length}

  const uploadFileBatches = (fileType: ChecksumWithSize[]) => {
    if (fileType.length === 0) return Promise.resolve()
    return Promise.all(
      createBatches(fileType).map((batch) =>
        uploadBatch(batch, themeFileSystem, session, theme.id, uploadResults).then(() => {
          progress.current += batch.length
          batch.forEach((file) => themeFileSystem.unsyncedFileKeys.delete(file.key))
        }),
      ),
    ).then(() => {})
  }

  const dependentFilesUploadPromise = dependentFiles.reduce(
    (promise, fileType) => promise.then(() => uploadFileBatches(fileType)),
    Promise.resolve(),
  )

  // Dependant and independant files are uploaded concurrently
  const independentFilesUploadPromise = Promise.resolve().then(() => uploadFileBatches(independentFiles.flat()))

  const promise = Promise.all([dependentFilesUploadPromise, independentFilesUploadPromise]).then(() => {
    progress.current = progress.total
  })

  return {progress, promise}
}

function selectUploadableFiles(themeFileSystem: ThemeFileSystem, remoteChecksums: Checksum[]): ChecksumWithSize[] {
  const localChecksums = calculateLocalChecksums(themeFileSystem)
  const filteredLocalChecksums = themeFileSystem.applyIgnoreFilters(localChecksums)
  const remoteChecksumsMap = new Map(remoteChecksums.map((remote) => [remote.key, remote]))

  const filesToUpload = filteredLocalChecksums.filter((local) => {
    const remote = remoteChecksumsMap.get(local.key)
    return !remote || remote.checksum !== local.checksum
  })

  outputDebug(`Files to be uploaded:\n${filesToUpload.map((file) => `-${file.key}`).join('\n')}`)

  return filesToUpload
}

/**
 * We use this 2d array to batch files of the same type together
 * while maintaining the order between file types. The files with
 * dependencies we have are:
 * 1. Layout files don't necessarily need to be the first, but they must uploaded before templates.
 * 2. Liquid blocks need to be uploaded before sections
 * 3. Liquid sections need to be uploaded afterwards
 * 4. JSON sections need to be uploaded after sections
 * 5. JSON templates need to be uploaded after all sections and layouts
 * 6. Contextualized templates should be uploaded after as they are variations of templates
 * 7. Config files must be the last ones, but we need to upload config/settings_schema.json first, followed by config/settings_data.json
 *
 * The files with no dependencies we have are:
 * - The other Liquid files (for example, snippets, and liquid templates)
 * - The other JSON files (for example, locales)
 * - The static assets
 *
 */
function orderFilesToBeUploaded(files: ChecksumWithSize[]): {
  independentFiles: ChecksumWithSize[][]
  dependentFiles: ChecksumWithSize[][]
} {
  const fileSets = partitionThemeFiles(files)
  return {
    // Most JSON files here are locales. Since we filter locales out in `replaceTemplates`,
    // and assets can be served locally, we can give priority to the unique Liquid files:
    independentFiles: [fileSets.otherLiquidFiles, fileSets.otherJsonFiles, fileSets.staticAssetFiles],
    // Follow order of dependencies:
    dependentFiles: [
      fileSets.layoutFiles,
      fileSets.blockLiquidFiles,
      fileSets.sectionLiquidFiles,
      fileSets.sectionJsonFiles,
      fileSets.templateJsonFiles,
      fileSets.contextualizedJsonFiles,
      fileSets.configFiles,
    ],
  }
}

function createBatches<T extends {size: number}>(files: T[]): T[][] {
  const batches: T[][] = []
  let currentBatch: T[] = []
  let currentBatchSize = 0

  for (const file of files) {
    const hasEnoughItems = currentBatch.length >= MAX_BATCH_FILE_COUNT
    const hasEnoughByteSize = currentBatchSize >= MAX_BATCH_BYTESIZE

    if (hasEnoughItems || hasEnoughByteSize) {
      batches.push(currentBatch)
      currentBatch = []
      currentBatchSize = 0
    }

    currentBatch.push(file)
    currentBatchSize += file.size ?? 0
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

function calculateLocalChecksums(localThemeFileSystem: ThemeFileSystem): ChecksumWithSize[] {
  const checksums: ChecksumWithSize[] = []

  localThemeFileSystem.files.forEach((file, key) => {
    // Text files: use UTF-8 byte count
    // Binary files: use base64 length
    const size = file.value ? Buffer.byteLength(file.value, 'utf8') : file.attachment?.length ?? 0

    checksums.push({
      key,
      checksum: file.checksum,
      size,
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
    updateUploadErrors(result, localThemeFileSystem, themeId)
  })
}

export function updateUploadErrors(result: Result, localThemeFileSystem: ThemeFileSystem, themeId: number) {
  if (result.success) {
    localThemeFileSystem.uploadErrors.delete(result.key)
  } else {
    const errors = result.errors?.asset ?? ['Response was not successful.']
    localThemeFileSystem.uploadErrors.set(result.key, errors)
    triggerBrowserFullReload(themeId, result.key)
  }
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

  const failedUploadResults = results.filter((result) => !result.success)
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
    recordEvent(`theme-service:upload-failed-retry:max-retry`)

    outputDebug(
      `Max retry count reached for the following files:\n${failedUploadParams
        .map((param) => `-${param.key}`)
        .join('\n')}`,
    )
    return failedUploadResults
  }

  recordEvent(`theme-service:upload-failed-retry:${failedUploadParams.length}`)
  return handleBulkUpload(failedUploadParams, themeId, session, count + 1)
}

function reportFailedUploads(uploadResults: Map<string, Result>, environment?: string) {
  for (const [key, result] of uploadResults.entries()) {
    if (!result.success) {
      const errorMessage = result.errors?.asset?.join('\n') ?? 'File upload failed'
      const headline = environment ? `[${environment}] ${key}` : key
      renderThrownError(headline, new Error(errorMessage))
    }
  }
}
