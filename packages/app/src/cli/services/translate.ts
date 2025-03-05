import {renderErrorMessage, renderSuccessMessage, noLanguagesConfiguredMessage, confirmChanges} from './translate/ui.js'
import {
  deleteEmptyObjects,
  targetFileWithKey,
  manifestHash,
  getManifestData,
  manifestFilePath,
  sourceTextForKey,
} from './translate/utilities.js'
import {collectRequestData, breakUpTranslationRequests} from './translate/translation-request-utilities.js'
import {ManifestEntry, TranslateOptions, TaskContext} from './translate/types.js'

import {CreateTranslationRequestInput} from '../api/graphql/app_translate.js'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'
import {setPathValue, compact} from '@shopify/cli-kit/common/object'
import {writeFileSync} from '@shopify/cli-kit/node/fs'

export const DEFAULT_LOCALES_DIR = ['locales']
export const SOURCE_LANGUAGE = 'en'
const MAX_WAIT_TIME_IN_SECONDS = 4 * 60
const SLEEP_TIME_IN_SECONDS = 4
export const MAX_KEYS_PER_REQUEST = 100

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
    await confirmChanges(app, remoteApp, translationRequestData, promptContext, nonTranslatableTerms)
  }

  const tasks = [
    {
      title: 'Initializing',
      task: async (context: TaskContext) => {
        // Update context state atomically
        Object.assign(context, {
          transationRequests: [],
          allFulfiled: false,
          errors: [],
          startTime: Date.now(),
        })
      },
    },
    {
      title: 'Requesting translations',
      task: async (context: TaskContext) => {
        // Each target language should have a request
        let translationRequestsToCreate: CreateTranslationRequestInput[] = targetLanguages.map((targetLanguage) => ({
          sourceLanguage: SOURCE_LANGUAGE,
          targetLanguage,
          sourceTexts: translationRequestData.updatedSourceFiles.flatMap((file) =>
            Object.entries(file.content).map(([key, value]) => ({
              key,
              value: value as string,
            })),
          ),
          nonTranslatableTerms,
          promptContext,
        }))

        translationRequestsToCreate = breakUpTranslationRequests(translationRequestsToCreate, MAX_KEYS_PER_REQUEST)

        // make the requests
        const translationRequestCreateResponses = await Promise.all(
          translationRequestsToCreate.map((input) =>
            developerPlatformClient.createTranslationRequest(remoteApp.organizationId, input),
          ),
        )

        // update the context with the new requests
        context.transationRequests = translationRequestCreateResponses.map(
          (createResponse) => createResponse.createTranslationRequest.translationRequest,
        )

        // update the context with the errors
        context.errors = translationRequestCreateResponses.flatMap((createResponse) =>
          createResponse.userErrors.map((error) => error.message),
        )
      },
    },
  ]

  const enqueueFullfillmentCheck = () => {
    tasks.push({
      title: 'Awaiting fullfilment. This may take some time.',

      task: async (context: TaskContext) => {
        const timeSinceStart = Date.now() - context.startTime

        // get the current status of the requests
        const updatedRequests = await Promise.all(
          context.transationRequests.map((request) =>
            developerPlatformClient
              .getTranslationRequest(remoteApp.organizationId, {requestId: request.id})
              .then((response) => response.getTranslationRequest.translationRequest),
          ),
        )

        Object.assign(context, {
          transationRequests: updatedRequests,
          allFulfiled: updatedRequests.every((request) => request.fulfilled),
        })

        if (context.allFulfiled) {
          enqueueUpdateFiles()
          return
        }
        if (timeSinceStart / 1000 > MAX_WAIT_TIME_IN_SECONDS) {
          context.errors.push(`Request timed out after ${MAX_WAIT_TIME_IN_SECONDS} seconds`)
          return
        }

        if (context.transationRequests.every((request) => request.fulfilled)) {
          enqueueUpdateFiles()
        } else {
          // Sleep so we don't hammer the API
          await sleep(SLEEP_TIME_IN_SECONDS)
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

            const sourceText = sourceTextForKey(translationRequestData.updatedSourceFiles, targetText.key)

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
