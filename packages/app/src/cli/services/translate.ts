import {
  renderChangesConfirmation,
  renderNoChanges,
  renderErrorMessage,
  renderSuccessMessage,
  noLanguagesConfiguredMessage,
} from './translate/ui.js'
import {
  addFilesToTranslationFiles,
  getPaths,
  deleteEmptyObjects,
  targetFileWithKey,
  manifestHash,
  getManifestData,
  manifestFilePath,
} from './translate/utilities.js'
import {ManifestEntry, TranslationRequestData, TranslateOptions, TaskContext} from './translate/types.js'
import {AppLinkedInterface} from '../models/app/app.js'

import {renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'
import {getPathValue, setPathValue, compact} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExistsSync, writeFileSync, readFileSync} from '@shopify/cli-kit/node/fs'

export const DEFAULT_LOCALES_DIR = ['locales']
export const SOURCE_LANGUAGE = 'en'

export async function collectRequestData(app: AppLinkedInterface): Promise<TranslationRequestData> {
  const {
    target_languages: targetLanguages = [],
    locale_directories: localeDirectories = DEFAULT_LOCALES_DIR,
    manual_translations_key_prefix: manualTranslationKeyPrefix,
    non_translatable_key_prefix: nonTranslatableKeyPrefix,
  } = app.configuration.translations ?? {}

  const requestData: TranslationRequestData = {
    updatedSourceFiles: [],
    targetFilesToUpdate: [],
  }

  const manifestDatas = getManifestData(app)

  // Gather source language files
  await Promise.all(
    localeDirectories.map(async (localeDirectory) => {
      const baseDir = joinPath(app.directory, localeDirectory)
      await addFilesToTranslationFiles(baseDir, SOURCE_LANGUAGE, requestData.updatedSourceFiles)

      await Promise.all(
        targetLanguages.map(async (language) => {
          requestData.updatedSourceFiles.forEach((sourceFile) => {
            // Create target files if they don't exist.  Load target files.
            const targetFilePath = sourceFile.fileName.replace(`${SOURCE_LANGUAGE}.json`, `${language}.json`)

            if (!fileExistsSync(targetFilePath)) {
              // Create target file with an empty JSON object
              writeFileSync(targetFilePath, JSON.stringify({}, null, 2))
            }

            // Load the target file
            const targetFileContent = readFileSync(targetFilePath).toString()
            requestData.targetFilesToUpdate.push({
              fileName: targetFilePath,
              content: JSON.parse(targetFileContent),
              language,
              keysToCreate: [],
              keysToDelete: [],
              keysToUpdate: [],
              manifestStrings:
                manifestDatas.find((mData: ManifestEntry) => mData?.file === targetFilePath)?.strings ?? {},
            })
          })
        }),
      )
    }),
  )

  requestData.targetFilesToUpdate.forEach((targetFile) => {
    const sourceFilePath = targetFile.fileName.replace(`${targetFile.language}.json`, `${SOURCE_LANGUAGE}.json`)
    const sourceFile = requestData.updatedSourceFiles.find((sf) => sf.fileName === sourceFilePath)

    if (!sourceFile) {
      return
    }

    const allCurrentTargetPaths = getPaths(targetFile.content)
    const allCurrentSourcePaths = getPaths(sourceFile?.content)

    targetFile.manifestStrings =
      manifestDatas.find((mData: ManifestEntry) => mData?.file === targetFile.fileName)?.strings ?? {}

    // Find modified keys
    allCurrentTargetPaths.forEach((targetPath) => {
      const currentSourceValue = getPathValue(sourceFile.content, targetPath) as string
      if (!currentSourceValue) {
        return
      }

      const currentSourceHash = manifestHash(currentSourceValue)
      const updatedSourceHash = targetFile.manifestStrings[targetPath]

      if (currentSourceHash !== updatedSourceHash) {
        targetFile.keysToUpdate.push(targetPath)
      }
    })

    // Add keys in source that are not in target
    targetFile.keysToCreate = allCurrentSourcePaths.filter((path) => !allCurrentTargetPaths.includes(path))

    // Add keys in target that are not in source
    targetFile.keysToDelete = allCurrentTargetPaths.filter((path) => !allCurrentSourcePaths.includes(path))
  })

  // Remove files with no changes
  requestData.targetFilesToUpdate = requestData.targetFilesToUpdate.filter(
    (file) => file.keysToDelete.length !== 0 || file.keysToUpdate.length !== 0 || file.keysToCreate.length !== 0,
  )

  return requestData
}

export async function translate(options: TranslateOptions) {
  const {developerPlatformClient, app, remoteApp, force} = options

  const {
    target_languages: targetLanguages = [],
    prompt_context: promptContext,
    non_translatable_terms: nonTranslatableTerms = [],
  } = app.configuration.translations ?? {}

  if (targetLanguages.length === 0) {
    noLanguagesConfiguredMessage()
    throw new AbortSilentError()
  }

  const translationRequestData = await collectRequestData(app)

  if (!force) {
    if (translationRequestData.targetFilesToUpdate.length > 0) {
      const confirmationResponse = await renderChangesConfirmation(
        app,
        remoteApp,
        translationRequestData,
        promptContext,
        nonTranslatableTerms,
      )
      if (!confirmationResponse) throw new AbortSilentError()
    } else {
      renderNoChanges()
      process.exit(0)
    }
  }

  const maxWaitTimeInSeconds = 4 * 60
  const sleepTimeInSeconds = 4
  const start = Date.now()
  const tasks = [
    {
      title: 'Initializing',
      task: async (context: TaskContext) => {
        context.transationRequests = []
        context.allFulfiled = false
        context.errors = []
      },
    },
    {
      title: 'Requesting translations',
      task: async (context: TaskContext) => {
        const translationRequest = await developerPlatformClient.createTranslationRequest(remoteApp.organizationId, {
          sourceLanguage: SOURCE_LANGUAGE,
          // @ts-expect-error // fix me
          targetLanguage: targetLanguages[0],
          // @ts-expect-error // fix me
          sourceTexts: translationRequestData.updatedSourceFiles.map((file) => file.content),
          nonTranslatableTerms,
          promptContext,
        })

        console.log('translationRequest', translationRequest)

        context.transationRequests = [
          // TODO, Make multiple requests w/o blocking
          // await developerPlatformClient.createTranslationRequest(remoteApp, {
          //   sourceLanguage: SOURCE_LANGUAGE,
          //   targetLanguage: targetLanguages[0],
          //   sourceTexts: translationRequestData.updatedSourceFiles.map((file) => file.content),
          //   nonTranslatableTerms,
          //   promptContext,
          // }),
          // todo, add errors
          //   const allErrors = renderResponse.appTranslates?.flatMap((translate) =>
          // (translate.appTranslate.userErrors || []).map((error) => error.message),
          // )
        ]
      },
    },
  ]

  const enqueueFullfillmentCheck = () => {
    tasks.push({
      title: 'Awaiting fullfilment. This may take some time.',

      task: async (context: TaskContext) => {
        const deltaMs = Date.now() - start

        // Make request
        await sleep(1)
        // update request with id that matches.  just write for now.
        // context.appTranslates = [
        //   {
        //     appTranslate: {
        //       translationRequest: {
        //         id: 'bla',
        //         fulfilled: true,
        //         sourceTexts: [
        //           {
        //             targetLanguage: 'en',
        //             key: 'links.home',
        //             value: 'Home',
        //           },
        //           {
        //             targetLanguage: 'en',
        //             key: 'links.more',
        //             value: 'Additional pages',
        //           },
        //         ],
        //         targetTexts: [
        //           {
        //             targetLanguage: 'fr',
        //             key: 'links.home',
        //             value: 'Home in french',
        //           },
        //           {
        //             targetLanguage: 'fr',
        //             key: 'links.more',
        //             value: 'More in french',
        //           },
        //         ],
        //       },
        //       userErrors: [],
        //     },
        //   },
        // ]

        context.allFulfiled = context.transationRequests.every((translationRequest) => translationRequest.fulfilled)

        if (context.allFulfiled) {
          enqueueUpdateFiles()
          return
        }
        if (deltaMs / 1000 > maxWaitTimeInSeconds) {
          // Failure checked for and handled outside of tasks.
          return
        }

        // if (!context.appTranslate.appTranslate.translationRequest.fulfilled) {
        if (deltaMs / 1000 > 10) {
          context.allFulfiled = true
          enqueueUpdateFiles()
        } else {
          await sleep(sleepTimeInSeconds)
          enqueueFullfillmentCheck()
        }
      },
    })
  }

  const enqueueUpdateFiles = () => {
    tasks.push({
      title: 'Updating target files',
      task: async (context: TaskContext) => {
        let manifestData = getManifestData(app)

        context.transationRequests.forEach((translationRequest) => {
          translationRequest.targetTexts?.forEach((targetText) => {
            const targetFile = targetFileWithKey(translationRequestData.targetFilesToUpdate, targetText.key)

            if (!targetFile) {
              context.errors.push(`Target file not found for key: ${targetText.key}`)
              return
            }

            // update target file data
            setPathValue(targetFile.content, targetText.key, targetText.value)

            // @ts-ignore // fix me
            const sourceText: string | undefined = translationRequestData.updatedSourceFiles.find(
              (sourceText) => sourceText.content[targetText.key] === targetText.value,
            )?.content[targetText.key]

            if (!sourceText) {
              context.errors.push(`Source text not found for key: ${targetText.key}`)
              return
            }

            // update manifest for targetFile
            targetFile.manifestStrings[targetText.key] = manifestHash(sourceText)

            // update shared manifest
            const existingManifestEntry = manifestData.find(
              (mData: ManifestEntry) => mData?.file === targetFile.fileName,
            ) ?? {
              file: targetFile.fileName,
              strings: {},
            }

            // Remove the existing entry if it exists
            manifestData = manifestData.filter((mData: ManifestEntry) => mData?.file !== targetFile.fileName)

            // Add the updated entry
            manifestData.push({
              file: targetFile.fileName,
              strings: {...existingManifestEntry.strings, ...targetFile.manifestStrings},
            })
          })
        })

        // Remove keys in target that are not in source
        translationRequestData.targetFilesToUpdate.forEach((targetFile) => {
          targetFile.keysToDelete.forEach((key) => {
            setPathValue(targetFile.content, key, undefined)
          })

          // Remove empty keys and objects
          compact(targetFile.content)
          deleteEmptyObjects(targetFile.content)
        })

        // save files
        translationRequestData.targetFilesToUpdate.forEach((fileToUpdate) => {
          const jsonContent = JSON.stringify(fileToUpdate?.content, null, 2)
          writeFileSync(fileToUpdate.fileName, jsonContent)
        })

        // save manifest
        writeFileSync(manifestFilePath(app), JSON.stringify(manifestData, null, 2))
      },
    })
  }

  // Enqueue the first fullfillment check, which will continue to enqueue itself until the requests are fulfilled.
  enqueueFullfillmentCheck()

  const renderResponse = await renderTasks(tasks)

  if (renderResponse.errors.length > 0) {
    renderErrorMessage(renderResponse)
  } else if (renderResponse.allFulfiled) {
    renderSuccessMessage(renderResponse)
  }
}
