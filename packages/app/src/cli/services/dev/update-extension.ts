import {ExtensionUpdateDraftMutationVariables} from '../../api/graphql/partners/generated/update-draft.js'
import {AppConfigurationWithoutPath} from '../../models/app/app.js'
import {
  loadConfigurationFileContent,
  parseConfigurationFile,
  parseConfigurationObjectAgainstSpecification,
} from '../../models/app/loader.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {ExtensionsArraySchema, UnifiedSchema} from '../../models/extensions/schemas.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {themeExtensionConfig} from '../deploy/theme-extension-config.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage, outputInfo} from '@shopify/cli-kit/node/output'
import {relativizePath} from '@shopify/cli-kit/node/path'
import {errorsToString as zodErrorsToString, zod} from '@shopify/cli-kit/node/schema'
import {Writable} from 'stream'

interface UpdateExtensionDraftOptions {
  extension: ExtensionInstance
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
  appConfiguration: AppConfigurationWithoutPath
  bundlePath: string
}

export async function updateExtensionDraft({
  extension,
  developerPlatformClient,
  apiKey,
  registrationId,
  stdout,
  stderr,
  appConfiguration,
  bundlePath,
}: UpdateExtensionDraftOptions) {
  let encodedFile: string | undefined
  if (extension.features.includes('esbuild')) {
    const outputPath = extension.getOutputPathForDirectory(bundlePath)
    const content = await readFile(outputPath)
    if (!content) return
    encodedFile = Buffer.from(content).toString('base64')
  }

  let config
  if (extension.isThemeExtension) {
    // When updating just the theme extension draft, upload the files as part of the config.
    config = await themeExtensionConfig(extension)
  } else {
    config = (await extension.deployConfig({apiKey, appConfiguration})) || {}
  }

  const draftableConfig: {[key: string]: unknown} = {
    ...config,
    serialized_script: encodedFile,
  }
  if (extension.isFunctionExtension) {
    const compiledFiles = await readFile(extension.outputPath, {encoding: 'base64'})
    draftableConfig.uploaded_files = {'dist/index.wasm': compiledFiles}
  }
  const extensionInput: ExtensionUpdateDraftMutationVariables = {
    apiKey,
    config: JSON.stringify(draftableConfig),
    handle: extension.handle,
    context: extension.contextValue,
    registrationId,
  }

  const mutationResult = await developerPlatformClient.updateExtension(extensionInput)
  if (mutationResult.extensionUpdateDraft?.userErrors && mutationResult.extensionUpdateDraft?.userErrors?.length > 0) {
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

  let configObject = await loadConfigurationFileContent(extension.configurationPath)
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

  const newConfig = await parseConfigurationObjectAgainstSpecification(
    extension.specification,
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
