import {
  ExtensionUpdateDraftInput,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateSchema,
} from '../../api/graphql/update_draft.js'
import {UIExtension} from '../../models/app/extensions.js'
import {findSpecificationForConfig, parseConfigurationFile} from '../../models/app/loader.js'
import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {outputDebug, OutputMessage} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

interface UpdateExtensionDraftOptions {
  extension: UIExtension
  token: string
  apiKey: string
  registrationId: string
  stderr: Writable
}

export async function updateExtensionDraft({
  extension,
  token,
  apiKey,
  registrationId,
  stderr,
}: UpdateExtensionDraftOptions) {
  const content = await readFile(extension.outputBundlePath)
  if (!content) return
  const encodedFile = Buffer.from(content).toString('base64')

  const extensionInput: ExtensionUpdateDraftInput = {
    apiKey,
    config: JSON.stringify({
      ...(await extension.deployConfig()),
      serialized_script: encodedFile,
    }),
    context: undefined,
    registrationId,
  }
  const mutation = ExtensionUpdateDraftMutation

  const mutationResult: ExtensionUpdateSchema = await partnersRequest(mutation, token, extensionInput)
  if (mutationResult.extensionUpdateDraft?.userErrors?.length > 0) {
    const errors = mutationResult.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
    stderr.write(`Error while updating drafts: ${errors}`)
  } else {
    outputDebug(`Drafts updated successfully for extension: ${extension.localIdentifier}`)
  }
}

interface UpdateExtensionConfigOptions {
  extension: UIExtension
  token: string
  apiKey: string
  registrationId: string
  stderr: Writable
  specifications: UIExtensionSpec[]
}

export async function updateExtensionConfig({
  extension,
  token,
  apiKey,
  registrationId,
  stderr,
  specifications,
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
  return updateExtensionDraft({extension, token, apiKey, registrationId, stderr})
}
