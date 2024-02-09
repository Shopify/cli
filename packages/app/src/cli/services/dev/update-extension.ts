import {
  ExtensionUpdateDraftInput,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateSchema,
} from '../../api/graphql/update_draft.js'
import {loadConfigurationFile, parseConfigurationFile, parseConfigurationObject} from '../../models/app/loader.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {ExtensionsArraySchema, UnifiedSchema} from '../../models/extensions/schemas.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage, outputInfo} from '@shopify/cli-kit/node/output'
import {relativizePath} from '@shopify/cli-kit/node/path'
import {errorsToString as zodErrorsToString, zod} from '@shopify/cli-kit/node/schema'
import {Writable} from 'stream'

interface UpdateExtensionDraftOptions {
  extension: ExtensionInstance
  token: string
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
}

export async function updateExtensionDraft({
  extension,
  token,
  apiKey,
  registrationId,
  stdout,
  stderr,
}: UpdateExtensionDraftOptions) {
  let encodedFile: string | undefined
  if (extension.features.includes('esbuild')) {
    const content = await readFile(extension.outputPath)
    if (!content) return
    encodedFile = Buffer.from(content).toString('base64')
  }

  const config = (await extension.deployConfig({apiKey, token})) || {}

  const extensionInput: ExtensionUpdateDraftInput = {
    apiKey,
    config: JSON.stringify({
      ...config,
      serialized_script: encodedFile,
    }),
    handle: extension.handle,
    context: extension.contextValue,
    registrationId,
  }
  const mutation = ExtensionUpdateDraftMutation

  const mutationResult: ExtensionUpdateSchema = await partnersRequest(mutation, token, extensionInput)
  if (mutationResult.extensionUpdateDraft?.userErrors?.length > 0) {
    const errors = mutationResult.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
    stderr.write(`Error while updating drafts: ${errors}`)
  } else {
    const draftUpdateSuccesMessage = extension.draftMessages.successMessage
    if (draftUpdateSuccesMessage) outputInfo(draftUpdateSuccesMessage, stdout)
  }
}

interface UpdateExtensionConfigOptions {
  extension: ExtensionInstance
  stdout: Writable
}

export async function reloadExtensionConfig({extension}: UpdateExtensionConfigOptions) {
  const abort = (
    errorMessage: OutputMessage,
    _fallbackOutput?: unknown,
    _path?: string,
    rawErrors?: zod.ZodIssueBase[],
  ) => {
    let message = typeof errorMessage === 'string' ? errorMessage : errorMessage.value
    if (rawErrors) message = zodErrorsToString(rawErrors)
    throw new AbortError(message)
  }

  let configObject = await loadConfigurationFile(extension.configurationPath)
  const {extensions} = ExtensionsArraySchema.parse(configObject)

  if (extensions) {
    // If the config has an array, find our extension using the handle.
    const configuration = await parseConfigurationFile(UnifiedSchema, extension.configurationPath, abort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extensionConfig = configuration.extensions.find((config: any) => config.handle === extension.handle)
    if (!extensionConfig) {
      abort(
        `ERROR: Invalid handle
  - Expected handle: "${extension.handle}"
  - Configuration file path: ${relativizePath(extension.configurationPath)}.
  - Handles are immutable, you can't change them once they are set.`,
      )
    }

    configObject = {...configuration, ...extensionConfig}
  }

  const newConfig = await parseConfigurationObject(
    extension.specification.schema,
    extension.configurationPath,
    configObject,
    abort,
  )

  const previousConfig = extension.configuration
  extension.configuration = newConfig

  return {
    previousConfig,
    newConfig,
  }
}
