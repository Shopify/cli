import {AppLinkedInterface} from '../models/app/app.js'
import {AppTranslateSchema} from '../api/graphql/app_translate.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {
  renderSuccess,
  renderError,
  renderTasks,
  renderInfo,
  renderConfirmationPrompt,
  TokenItem,
} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'

import {hashString} from '@shopify/cli-kit/node/crypto'
import {pluralize} from '@shopify/cli-kit/common/string'
import {getPathValue, setPathValue, isEmpty, compact} from '@shopify/cli-kit/common/object'
import fs from 'fs'
import path from 'path'

interface TaskContext {
  appTranslates: AppTranslateSchema[]
  allFulfiled: boolean
  errors: string[]
}

interface TranslateOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be translated */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, do not prompt */
  force: boolean
}

interface TranslationRequestData {
  updatedSourceFiles: TranslationSourceFile[]
  targetFilesToUpdate: TranslationTargetFile[]
}
interface TranslationSourceFile {
  fileName: string
  language: string
  content: {[key: string]: unknown}
}
interface TranslationTargetFile {
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

function generateTranslationFileSummary(file: TranslationTargetFile) {
  const changes = []
  const createSummary = pluralize(
    file.keysToCreate,
    () => [`${file.keysToCreate.length} key to create`],
    () => [`${file.keysToCreate.length} keys to create`],
  ) as string

  const deleteSummary = pluralize(
    file.keysToDelete,
    () => [`${file.keysToDelete.length} key to delete`],
    () => [`${file.keysToDelete.length} keys to delete`],
  ) as string

  const updateSummary = pluralize(
    file.keysToUpdate,
    () => [`${file.keysToUpdate.length} key to update`],
    () => [`${file.keysToUpdate.length} keys to update`],
  ) as string

  if (file.keysToCreate.length > 0) changes.push(createSummary)
  if (file.keysToDelete.length > 0) changes.push(deleteSummary)
  if (file.keysToUpdate.length > 0) changes.push(updateSummary)

  return `${file.fileName} (${changes.join(', ')})`
}

function manifestFileName(app: AppLinkedInterface): string {
  return `${app.directory}/.shopiofy_translation_manifest.json`
}

function getManifestData(app: AppLinkedInterface): Manifest {
  const filePath = manifestFileName(app)
  if (!fs.existsSync(filePath)) {
    // Create the file with an empty object or any default content
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2))
  }
  const rawData = fs.readFileSync(filePath, 'utf8')
  const manifestDatas = JSON.parse(rawData)

  return manifestDatas as Manifest
}

const DEFAULT_LOCALES_DIR = ['locales']
const SOURCE_LANGUAGE = 'en'

function searchDirectory(
  directory: string,
  language: string,
  translationFiles: TranslationTargetFile[] | TranslationSourceFile[],
) {
  const files = fs.readdirSync(directory)

  files.forEach((file) => {
    const fullPath = path.join(directory, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      searchDirectory(fullPath, language, translationFiles)
    } else if (stat.isFile() && file === `${language}.json`) {
      const data = fs.readFileSync(fullPath, 'utf-8')
      translationFiles.push({
        fileName: fullPath,
        language,
        content: JSON.parse(data),
        keysToCreate: [],
        keysToDelete: [],
        keysToUpdate: [],
        manifestStrings: {},
      })
    }
  })
}

function getPaths(obj: {[key: string]: unknown} | undefined, prefix = ''): string[] {
  if (obj === undefined) {
    return []
  }

  const paths = []

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        paths.push(...getPaths(obj[key] as {[key: string]: unknown}, newPrefix))
      } else {
        paths.push(newPrefix)
      }
    }
  }

  return paths
}

function collectRequestData(app: AppLinkedInterface): TranslationRequestData {
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
    const baseDir = path.join(app.directory, dir)
    searchDirectory(baseDir, SOURCE_LANGUAGE, requestData.updatedSourceFiles)

    targetLanguages.forEach((language) => {
      requestData.updatedSourceFiles.forEach((sourceFile) => {
        // Create target files if they don't exist.  Load target files.
        const targetFilePath = sourceFile.fileName.replace(`${SOURCE_LANGUAGE}.json`, `${language}.json`)

        if (!fs.existsSync(targetFilePath)) {
          // Create target file with an empty JSON object
          fs.writeFileSync(targetFilePath, JSON.stringify({}, null, 2))
        }

        // Load the target file
        const targetFileContent = fs.readFileSync(targetFilePath, 'utf-8')
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

/**
 * Deletes empty objects from the given object. Also deletes objects which only have empty objects as children.
 *
 * @param obj - The object to delete empty objects from.
 */
function deleteEmptyObjects(obj: {[key: string]: unknown}): boolean {
  let hasDeleted = false

  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'object') {
      if (isEmpty(obj[key] as object)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key]
        hasDeleted = true
      } else if (deleteEmptyObjects(obj[key] as {[key: string]: unknown})) {
        // Check if parent became empty after cleaning children
        if (isEmpty(obj[key] as object)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete obj[key]
          hasDeleted = true
        }
      }
    }
  })

  return hasDeleted
}

function targetFileWithKey(targetFiles: TranslationTargetFile[], key: string): TranslationTargetFile | undefined {
  return targetFiles.find((targetFile) => [...targetFile.keysToCreate, ...targetFile.keysToUpdate].includes(key))
}

export async function translate(options: TranslateOptions) {
  const {developerPlatformClient, app, remoteApp, force} = options

  const {
    target_languages: targetLanguages = [],
    prompt_context: promptContext,
    non_translatable_terms: nonTranslatableTerms = [],
  } = app.configuration.translations ?? {}

  const helpLink: TokenItem = {link: {label: 'Learn more.', url: 'https://todo.com'}}

  if (targetLanguages.length === 0) {
    renderError({
      headline: 'No target languages configured.',
      body: ['You must configure at least one target language to use this command.', helpLink],
    })
    throw new AbortSilentError()
  }

  const translationRequestData = collectRequestData(app)

  const targetFilesToUpdate = translationRequestData.targetFilesToUpdate.map(generateTranslationFileSummary)

  if (!force) {
    if (targetFilesToUpdate.length > 0) {
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
            console.log('translationRequestData.targetFilesToUpdate', translationRequestData.targetFilesToUpdate)
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
          fs.writeFileSync(fileToUpdate.fileName, jsonContent)
        })

        // save manifest
        fs.writeFileSync(manifestFileName(app), JSON.stringify(manifestData, null, 2))
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

// Prompts, todo, is there a better place for these?

async function renderChangesConfirmation(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  translationRequestData: TranslationRequestData,
  promptContext: string | undefined,
  nonTranslatableTerms: string[],
): Promise<boolean> {
  const targetFilesToUpdate = translationRequestData.targetFilesToUpdate.map(generateTranslationFileSummary)

  const appContext = [`App name: ${app.name}`, `App title: ${remoteApp.title}`]
  if (typeof promptContext === 'string') appContext.push(promptContext)

  const confirmInfoTable = {
    'Detected source files': translationRequestData.updatedSourceFiles.map((file) => file.fileName),
    'Target files to update': targetFilesToUpdate,
    ...(nonTranslatableTerms.length > 0 && {'Non translatable terms': nonTranslatableTerms}),
    'Extra app context': appContext,
  }

  const confirmationResponse = await renderConfirmationPrompt({
    message: 'Translation update',
    infoTable: confirmInfoTable,
    confirmationMessage: `Yes, update translations`,
    cancellationMessage: 'No, cancel',
  })
  return confirmationResponse
}

function renderNoChanges() {
  renderInfo({
    headline: 'Translation Check Complete.',
    body: 'All translation files are already up to date. No changes are required at this time.',
  })
}

function renderErrorMessage(renderResponse: TaskContext) {
  const headline = pluralize(
    renderResponse.errors,
    () => ['Translation request failed.'],
    () => ['Translation requests failed'],
  ) as string

  renderError({
    headline,
    body: [
      {
        list: {
          title: 'Errors',
          items: renderResponse.errors,
        },
      },
    ],
  })
}

function renderSuccessMessage(_response: TaskContext) {
  renderSuccess({
    headline: 'Translation request successful.',
    body: 'Updated translations. Please review the changes and commit them to your preferred version control system if applicable.',
  })
}
