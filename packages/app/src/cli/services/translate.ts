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
import fs from 'fs'
import path from 'path'

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
}

function generateTranslationFileSummary(file: TranslationTargetFile) {
  const changes = []
  if (file.keysToCreate.length > 0) changes.push(`${file.keysToCreate.length} key(s) to create`)
  if (file.keysToDelete.length > 0) changes.push(`${file.keysToDelete.length} key(s) to delete`)
  if (file.keysToUpdate.length > 0) changes.push(`${file.keysToUpdate.length} key(s) to update`)

  return `${file.fileName} (${changes.join(', ')})`
}

function getManifestData(app: AppLinkedInterface) {
  const filePath = `${app.directory}/.shopiofy_translation_manifest.json`
  if (!fs.existsSync(filePath)) {
    // Create the file with an empty object or any default content
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2))
  }
  const rawData = fs.readFileSync(filePath, 'utf8')
  const manifestDatas = JSON.parse(rawData)

  return manifestDatas
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

  interface ManifestEntry {
    file: string
    strings: {[key: string]: string}
  }

  type Manifest = ManifestEntry[]
  const manifestDatas = getManifestData(app) as Manifest

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
        })
      })
    })
  })

  requestData.targetFilesToUpdate.forEach((targetFile) => {
    const sourceFilePath = targetFile.fileName.replace(`${targetFile.language}.json`, `${SOURCE_LANGUAGE}.json`)
    const sourceFile = requestData.updatedSourceFiles.find((sf) => sf.fileName === sourceFilePath)

    const allCurrentTargetPaths = getPaths(targetFile.content)
    const allCurrentSourcePaths = getPaths(sourceFile?.content)

    const manifestData: ManifestEntry | undefined = manifestDatas.find(
      (mData: ManifestEntry) => mData?.file === targetFile.fileName,
    )

    // Find modified keys
    allCurrentTargetPaths.forEach((targetPath) => {
      // @ts-ignore TODO.. types. also take care of files to delete
      const currentSourceValue = targetPath.split('.').reduce((acc, part) => acc?.[part], sourceFile.content)
      const currentSourceHash = hashString(currentSourceValue)
      const manifestHash = manifestData?.strings[targetPath]

      if (currentSourceHash !== manifestHash) {
        targetFile.keysToUpdate.push(targetPath)
      }
    })

    // Find keys in source that are not in target
    targetFile.keysToCreate = allCurrentSourcePaths.filter((path) => !allCurrentTargetPaths.includes(path))

    // Find keys in target that are not in source
    targetFile.keysToDelete = allCurrentTargetPaths.filter((path) => !allCurrentSourcePaths.includes(path))
  })

  // Remove files with no changes
  requestData.targetFilesToUpdate = requestData.targetFilesToUpdate.filter(
    (file) => file.keysToDelete.length !== 0 || file.keysToUpdate.length !== 0 || file.keysToCreate.length !== 0,
  )

  console.log({requestData})
  return requestData
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
  const appContext = [`App name: ${app.name}`, `App title: ${remoteApp.title}`]
  if (typeof promptContext === 'string') appContext.push(promptContext)

  const confirmInfoTable = {
    'Detected source files': translationRequestData.updatedSourceFiles.map((file) => file.fileName),
    'Target files to update': targetFilesToUpdate,
    ...(nonTranslatableTerms.length > 0 && {'Non translatable terms': nonTranslatableTerms}),
    'Extra app context': appContext,
  }

  if (!force) {
    if (targetFilesToUpdate.length > 0) {
      const confirmationResponse = await renderConfirmationPrompt({
        message: 'Translation update',
        infoTable: confirmInfoTable,
        confirmationMessage: `Yes, update translations`,
        cancellationMessage: 'No, cancel',
      })
      if (!confirmationResponse) throw new AbortSilentError()
    } else {
      renderInfo({
        headline: 'Translation Check Complete.',
        body: 'All translation files are already up to date. No changes are required at this time.',
      })
      throw new AbortSilentError()
    }
  }

  interface Context {
    appTranslates: [AppTranslateSchema]
    allFulfiled: boolean
  }

  const maxWaitTimeInSeconds = 4 * 60
  const sleepTimeInSeconds = 4
  const start = Date.now()
  const tasks = []

  const enqueueFullfillmentCheck = () => {
    tasks.push({
      title: 'Awaiting fullfilment. This may take some time.',

      task: async (context: Context) => {
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
                sourceTexts: [],
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

  const enqueueUpdateFiles = (context: Context) => {
    tasks.push({
      title: 'Updating target files',
      task: async () => {
        const filesToSave: string[] = []
        context.appTranslates.forEach((appTranslate) => {
          // somethign like this.  im here
          appTranslate.translationRequest.targetTexts.forEach((targetText) => {
            const targetFile = targetFileWithKey(translationRequestData.targetFilesToUpdate, targetText.key)

            if (targetFile && !filesToSave.includes(targetFile.fileName)) {
              filesToSave.push(targetFile.fileName)
            }

            // update target file data
          })
        })

        // save updated files.
        await sleep(1)
      },
    })
  }

  // enqueue translation request
  tasks.push({
    title: 'Requesting translations',
    task: async (context: Context) => {
      context.appTranslates = [
        // Make multiple requests w/o blocking
        await developerPlatformClient.translate({
          app: remoteApp,
        }),
      ]
    },
  })

  enqueueFullfillmentCheck()

  const renderResponse = await renderTasks<Context>(tasks)
  const allErrors = renderResponse.appTranslates?.flatMap((translate) =>
    (translate.appTranslate.userErrors || []).map((error) => error.message),
  )

  if (renderResponse.allFulfiled) {
    renderSuccess({
      headline: 'Translation request successful.',
      body: 'Updated translations. Please review the changes and commit them to your preferred version control system if applicable.',
    })
  } else if (allErrors.length > 0) {
    renderError({
      headline: 'Translation request(s) failed.',
      body: allErrors,
    })
  }
}
