import {TranslationRequestData, ManifestEntry} from './types.js'
import {getManifestData, addFilesToTranslationFiles, getPaths, manifestHash} from './utilities.js'
import {SOURCE_LANGUAGE, DEFAULT_LOCALES_DIR} from '../translate.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {CreateTranslationRequestInput, TranslationText} from '../../api/graphql/app_translate.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExistsSync, writeFileSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'

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
    const allCurrentSourcePaths = getPaths(sourceFile.content)

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

// Used to break up translation requests to create if they have more than maxKeysPerRequest keys
export function breakUpTranslationRequests(
  translationRequestsInput: CreateTranslationRequestInput[],
  maxKeysPerRequest: number,
): CreateTranslationRequestInput[] {
  let translationRequests = [...translationRequestsInput]

  // Find translation requests that have more than maxKeysPerRequest keys
  const translationRequestsToCreateWithMoreThanMaxKeys = translationRequests.filter(
    (request) => request.sourceTexts.length > maxKeysPerRequest,
  )

  // Remove the translation requests that have more than maxKeysPerRequest keys
  translationRequests = translationRequests.filter((request) => request.sourceTexts.length <= maxKeysPerRequest)

  // Break up & create the translation requests that have more than maxKeysPerRequest keys
  translationRequestsToCreateWithMoreThanMaxKeys.forEach((request) => {
    const keys = request.sourceTexts.map((text) => text.key)
    const chunks = keys.reduce<string[][]>((acc, key, index) => {
      const chunkIndex = Math.floor(index / maxKeysPerRequest)
      if (!acc[chunkIndex]) {
        acc[chunkIndex] = []
      }
      acc[chunkIndex].push(key)
      return acc
    }, [])

    // Add the translation requests to the array
    chunks.forEach((chunk) => {
      translationRequests.push({
        ...request,
        sourceTexts: chunk
          .map((key) => request.sourceTexts.find((text) => text.key === key))
          .filter((text): text is TranslationText => text !== undefined),
      })
    })
  })

  return translationRequests
}
