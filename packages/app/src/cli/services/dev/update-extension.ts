import {
  ExtensionUpdateDraftInput,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateSchema,
} from '../../api/graphql/update_draft.js'
import {findSpecificationForConfig, parseConfigurationFile} from '../../models/app/loader.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {OutputMessage, outputInfo} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

interface UpdateExtensionDraftOptions {
  extension: ExtensionInstance
  token: string
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
  unifiedDeployment: boolean
}

export async function updateExtensionDraft({
  extension,
  token,
  apiKey,
  registrationId,
  stdout,
  stderr,
  unifiedDeployment,
}: UpdateExtensionDraftOptions) {
  let encodedFile: string | undefined
  if (extension.features.includes('esbuild')) {
    const content = await readFile(extension.outputPath)
    if (!content) return
    encodedFile = Buffer.from(content).toString('base64')
  }

  const configValue = (await extension.deployConfig({apiKey, token, unifiedDeployment})) || {}
  const {handle, ...remainingConfigs} = configValue
  const extensionInput: ExtensionUpdateDraftInput = {
    apiKey,
    config: JSON.stringify({
      ...remainingConfigs,
      serialized_script: encodedFile,
    }),
    context: handle as string,
    registrationId,
  }
  const mutation = ExtensionUpdateDraftMutation

  const mutationResult: ExtensionUpdateSchema = await partnersRequest(mutation, token, extensionInput)
  if (mutationResult.extensionUpdateDraft?.userErrors?.length > 0) {
    const errors = mutationResult.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
    stderr.write(`Error while updating drafts: ${errors}`)
  } else {
    outputInfo(`Draft updated successfully for extension: ${extension.localIdentifier}`, stdout)
  }
}

interface UpdateExtensionConfigOptions {
  extension: ExtensionInstance
  token: string
  apiKey: string
  registrationId: string
  stdout: Writable
  stderr: Writable
  specifications: ExtensionSpecification[]
  unifiedDeployment: boolean
}

export async function updateExtensionConfig({
  extension,
  token,
  apiKey,
  registrationId,
  stdout,
  stderr,
  specifications,
  unifiedDeployment,
}: UpdateExtensionConfigOptions) {
  const abort = (errorMessage: OutputMessage) => {
    throw new AbortError(errorMessage)
  }

  const specification = await findSpecificationForConfig(specifications, extension.configurationPath, abort)

  if (!specification) {
    return
  }

  const configuration = await parseConfigurationFile(specification.schema, extension.configurationPath, abort)
  // eslint-disable-next-line require-atomic-updates
  extension.configuration = configuration
  return updateExtensionDraft({extension, token, apiKey, registrationId, stdout, stderr, unifiedDeployment})
}
