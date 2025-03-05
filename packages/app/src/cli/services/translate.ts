import {renderErrorMessage, renderSuccessMessage, noLanguagesConfiguredMessage, confirmChanges} from './translate/ui.js'
import {
  deleteEmptyObjects,
  targetFileWithKey,
  getManifestData,
  manifestFilePath,
  sourceTextForKey,
  flatObject,
  pathHasPrefix,
} from './translate/utilities.js'
import {
  collectRequestData,
  breakUpTranslationRequests,
  updateManifest,
} from './translate/translation-request-utilities.js'
import {TranslateOptions, TaskContext} from './translate/types.js'

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
    manual_translations_key_prefix: manualTranslationKeyPrefix,
    non_translatable_key_prefix: nonTranslatableKeyPrefix,
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
        let translationRequestsToCreate: CreateTranslationRequestInput[] = targetLanguages.map((targetLanguage) => {
          const sourceTextsRequireingTranslations = translationRequestData.updatedSourceFiles.flatMap((file) => {
            const flat = flatObject(file.content)
            const keysToTranslate = Object.entries(flat).filter(([key, _value]) => {
              if (pathHasPrefix(key, manualTranslationKeyPrefix) || pathHasPrefix(key, nonTranslatableKeyPrefix)) {
                return false
              }

              // if key is not in any target files, then it should not be translated
              if (
                !translationRequestData.targetFilesToUpdate.some(
                  (targetFile) => targetFile.keysToUpdate.includes(key) || targetFile.keysToCreate.includes(key),
                )
              ) {
                return false
              }

              return true
            })

            return keysToTranslate.map(([key, value]) => ({
              key,
              value,
            }))
          })

          return {
            sourceLanguage: SOURCE_LANGUAGE,
            targetLanguage,
            sourceTexts: sourceTextsRequireingTranslations,
            nonTranslatableTerms,
            promptContext,
          }
        })

        // TODO, should we filter out any requests that have no source texts? If so updating files needs to be updated to handle dnt/manual keys
        // translationRequestsToCreate = translationRequestsToCreate.filter((request) => request.sourceTexts.length > 0)

        // TODO, dose this cause a bug when we save the files?  We might need to reload the target files after we save them or change the strcture of how we save the files
        translationRequestsToCreate = breakUpTranslationRequests(translationRequestsToCreate, MAX_KEYS_PER_REQUEST)

        // make the requests
        const translationRequestCreateResponses = await Promise.all(
          translationRequestsToCreate.map((input) =>
            developerPlatformClient.createTranslationRequest(remoteApp.organizationId, input),
          ),
        )

        // update the context with the new requests
        context.transationRequests = translationRequestCreateResponses.map(
          (createResponse) => createResponse.translationRequestCreate.translationRequest,
        )

        // update the context with the errors
        context.errors = translationRequestCreateResponses.flatMap((createResponse) =>
          createResponse.translationRequestCreate.userErrors.map((error) => error.message),
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
              .then((response) => response.translationRequest),
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

            manifestData = updateManifest(targetFile, manifestData, targetText.key, sourceText)
          })
        })

        // Create or update keys that are "do not translate"
        translationRequestData.targetFilesToUpdate.forEach((targetFile) => {
          const keys = [...targetFile.keysToCreate, ...targetFile.keysToUpdate]
          keys.forEach((key) => {
            if (pathHasPrefix(key, nonTranslatableKeyPrefix)) {
              // Update the target file
              const sourceText = sourceTextForKey(translationRequestData.updatedSourceFiles, key)
              if (!sourceText) {
                context.errors.push(`Source text not found for key: ${key}`)
                return
              }

              setPathValue(targetFile.content, key, sourceText)

              manifestData = updateManifest(targetFile, manifestData, key, sourceText)
            }
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
