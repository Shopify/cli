import {
  renderChangesConfirmation,
  renderNoChanges,
  renderErrorMessage,
  renderSuccessMessage,
  noLanguagesConfiguredMessage,
} from './translate/ui.js'
import {searchDirectory, getPaths, deleteEmptyObjects, targetFileWithKey} from './translate/utilities.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {AppTranslateSchema} from '../api/graphql/app_translate.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'

import {hashString} from '@shopify/cli-kit/node/crypto'
import {getPathValue, setPathValue, compact} from '@shopify/cli-kit/common/object'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExistsSync, writeFileSync, readFileSync} from '@shopify/cli-kit/node/fs'

export interface TaskContext {
  appTranslates: AppTranslateSchema[]
  allFulfiled: boolean
  errors: string[]
}
export interface TranslateOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be translated */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, do not prompt */
  force: boolean
}

export interface TranslationRequestData {
  updatedSourceFiles: TranslationSourceFile[]
  targetFilesToUpdate: TranslationTargetFile[]
}
export interface TranslationSourceFile {
  fileName: string
  language: string
  content: {[key: string]: unknown}
}
export interface TranslationTargetFile {
  fileName: string
  language: string
  keysToCreate: string[]
  keysToDelete: string[]
  keysToUpdate: string[]
  content: {[key: string]: unknown}
  manifestStrings: {[key: string]: string}
}

interface ManifestEntry {
  file: string
  strings: {[key: string]: string}
}

type Manifest = ManifestEntry[]

function manifestFileName(app: AppLinkedInterface): string {
  return joinPath(app.directory, '.shopiofy_translation_manifest.json')
}

export function getManifestData(app: AppLinkedInterface): Manifest {
  const filePath = manifestFileName(app)
  if (!fileExistsSync(filePath)) {
    // Create the file with an empty object or any default content
    writeFileSync(filePath, JSON.stringify({}, null, 2))
  }
  const rawData = readFileSync(filePath)
  const manifestDatas = JSON.parse(rawData.toString())

  return manifestDatas as Manifest
}

export const DEFAULT_LOCALES_DIR = ['locales']
export const SOURCE_LANGUAGE = 'en'

export function collectRequestData(app: AppLinkedInterface): TranslationRequestData {
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

  // Gather source langauge files
  localeDirectories.forEach((dir) => {
    const baseDir = joinPath(app.directory, dir)
    searchDirectory(baseDir, SOURCE_LANGUAGE, requestData.updatedSourceFiles)

    targetLanguages.forEach((language) => {
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
          manifestStrings: manifestDatas.find((mData: ManifestEntry) => mData?.file === targetFilePath)?.strings ?? {},
        })
      })
    })
  })

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

      const currentSourceHash = hashString(currentSourceValue)
      const manifestHash = targetFile.manifestStrings[targetPath]

      if (currentSourceHash !== manifestHash) {
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

  const translationRequestData = collectRequestData(app)

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
        context.appTranslates = []
        context.allFulfiled = false
        context.errors = []
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
        context.appTranslates = [
          {
            appTranslate: {
              translationRequest: {
                id: 'bla',
                fulfilled: true,
                sourceTexts: [
                  {
                    targetLanguage: 'en',
                    key: 'links.home',
                    value: 'Home',
                  },
                  {
                    targetLanguage: 'en',
                    key: 'links.more',
                    value: 'Additional pages',
                  },
                ],
                targetTexts: [
                  {
                    targetLanguage: 'fr',
                    key: 'links.home',
                    value: 'Home in french',
                  },
                  {
                    targetLanguage: 'fr',
                    key: 'links.more',
                    value: 'More in french',
                  },
                ],
              },
              userErrors: [],
            },
          },
        ]

        // TODO Check if reqeusts are fulfilled.
        context.allFulfiled = context.appTranslates.every(
          (translate) => translate.appTranslate.translationRequest.fulfilled,
        )

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

        context.appTranslates.forEach((appTranslate) => {
          appTranslate.appTranslate.translationRequest.targetTexts?.forEach((targetText) => {
            const targetFile = targetFileWithKey(translationRequestData.targetFilesToUpdate, targetText.key)

            if (!targetFile) {
              context.errors.push(`Target file not found for key: ${targetText.key}`)
              return
            }

            // update target file data
            setPathValue(targetFile.content, targetText.key, targetText.value)

            const sourceText = appTranslate.appTranslate.translationRequest.sourceTexts.find(
              (sourceText) => sourceText.key === targetText.key,
            )

            if (!sourceText) {
              context.errors.push(`Source text not found for key: ${targetText.key}`)
              return
            }

            // update manifest for targetFile
            targetFile.manifestStrings[targetText.key] = hashString(sourceText.value)

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
        writeFileSync(manifestFileName(app), JSON.stringify(manifestData, null, 2))
      },
    })
  }

  // enqueue translation request
  tasks.push({
    title: 'Requesting translations',
    task: async (context: TaskContext) => {
      context.appTranslates = [
        // Make multiple requests w/o blocking
        await developerPlatformClient.translate({
          app: remoteApp,
        }),

        // todo, add errors
        //   const allErrors = renderResponse.appTranslates?.flatMap((translate) =>
        // (translate.appTranslate.userErrors || []).map((error) => error.message),
        // )
      ]
    },
  })

  enqueueFullfillmentCheck()

  const renderResponse = await renderTasks(tasks)

  if (renderResponse.errors.length > 0) {
    renderErrorMessage(renderResponse)
  } else if (renderResponse.allFulfiled) {
    renderSuccessMessage(renderResponse)
  }
}
