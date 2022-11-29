import {themeExtensionConfig as generateThemeExtensionConfig} from './theme-extension-config.js'
import {Identifiers, IdentifiersExtensions} from '../../models/app/identifiers.js'
import {FunctionExtension, ThemeExtension} from '../../models/app/extensions.js'
import {api, error, session, http, id, output, file} from '@shopify/cli-kit'

import fs from 'fs'

interface DeployThemeExtensionOptions {
  /** The application API key */
  apiKey: string

  /** Set of local identifiers */
  identifiers: Identifiers

  /** The token to send authenticated requests to the partners' API  */
  token: string
}

/**
 * Uploads theme extension(s)
 * @param options - The upload options
 */
export async function uploadThemeExtensions(
  themeExtensions: ThemeExtension[],
  options: DeployThemeExtensionOptions,
): Promise<void> {
  const {apiKey, identifiers, token} = options
  await Promise.all(
    themeExtensions.map(async (themeExtension) => {
      const themeExtensionConfig = await generateThemeExtensionConfig(themeExtension)
      const themeId = identifiers.extensionIds[themeExtension.localIdentifier]!
      const themeExtensionInput: api.graphql.ExtensionUpdateDraftInput = {
        apiKey,
        config: JSON.stringify(themeExtensionConfig),
        context: undefined,
        registrationId: themeId,
      }
      const mutation = api.graphql.ExtensionUpdateDraftMutation
      const result: api.graphql.ExtensionUpdateSchema = await api.partners.request(mutation, token, themeExtensionInput)
      if (result.extensionUpdateDraft?.userErrors?.length > 0) {
        const errors = result.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
        throw new error.Abort(errors)
      }
    }),
  )
}

interface UploadUIExtensionsBundleOptions {
  /** The application API key */
  apiKey: string

  /** The path to the bundle file to be uploaded */
  bundlePath: string

  /** The token to send authenticated requests to the partners' API  */
  token: string

  /** Extensions extra data */
  extensions: api.graphql.ExtensionSettings[]
}

export interface UploadExtensionValidationError {
  uuid: string
  errors: {
    message: string
    field: string[]
  }[]
}

/**
 * Uploads a bundle.
 * @param options - The upload options
 */
export async function uploadUIExtensionsBundle(
  options: UploadUIExtensionsBundleOptions,
): Promise<UploadExtensionValidationError[]> {
  const deploymentUUID = id.generateRandomUUID()
  const signedURL = await getUIExtensionUploadURL(options.apiKey, deploymentUUID)

  const formData = http.formData()
  const buffer = fs.readFileSync(options.bundlePath)
  formData.append('my_upload', buffer)
  await http.fetch(signedURL, {
    method: 'put',
    body: buffer,
    headers: formData.getHeaders(),
  })

  const variables: api.graphql.CreateDeploymentVariables = {
    apiKey: options.apiKey,
    uuid: deploymentUUID,
    bundleUrl: signedURL,
    extensions: options.extensions,
  }

  const mutation = api.graphql.CreateDeployment
  const result: api.graphql.CreateDeploymentSchema = await api.partners.request(mutation, options.token, variables)

  if (result.deploymentCreate?.userErrors?.length > 0) {
    const errors = result.deploymentCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  const validationErrors = result.deploymentCreate.deployment.deployedVersions
    .filter((ver) => ver.extensionVersion.validationErrors.length > 0)
    .map((ver) => {
      return {uuid: ver.extensionVersion.registrationUuid, errors: ver.extensionVersion.validationErrors}
    })

  return validationErrors
}

/**
 * It generates a URL to upload an app bundle.
 * @param apiKey - The application API key
 * @param deploymentUUID - The unique identifier of the deployment.
 */
export async function getUIExtensionUploadURL(apiKey: string, deploymentUUID: string) {
  const mutation = api.graphql.GenerateSignedUploadUrl
  const token = await session.ensureAuthenticatedPartners()
  const variables: api.graphql.GenerateSignedUploadUrlVariables = {
    apiKey,
    deploymentUuid: deploymentUUID,
    bundleFormat: 1,
  }

  const result: api.graphql.GenerateSignedUploadUrlSchema = await api.partners.request(mutation, token, variables)
  if (result.deploymentGenerateSignedUploadUrl?.userErrors?.length > 0) {
    const errors = result.deploymentGenerateSignedUploadUrl.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  return result.deploymentGenerateSignedUploadUrl.signedUploadUrl
}

interface UploadFunctionExtensionsOptions {
  /** The token to send authenticated requests to the partners' API  */
  token: string

  // Set of local identifiers
  identifiers: Identifiers
}

/**
 * This function takes a list of function extensions and uploads them.
 * As part of the upload it creates a function server-side if it does not exist
 * and includes its remote identifier in the returned identifiers instance.
 * If the function already has a local id, that one is used and the upload
 * does an override of the function existing server-side.
 *
 * @param extensions - The list of extensions to upload.
 * @param options - Options to adjust the upload.
 * @returns A promise that resolves with the identifiers.
 */
export async function uploadFunctionExtensions(
  extensions: FunctionExtension[],
  options: UploadFunctionExtensionsOptions,
): Promise<Identifiers> {
  let identifiers = options.identifiers

  const functionIds: IdentifiersExtensions = {}

  // Functions are uploaded sequentially to avoid reaching the API limit
  for (const extension of extensions) {
    // eslint-disable-next-line no-await-in-loop
    const remoteIdentifier = await uploadFunctionExtension(extension, {
      apiKey: options.identifiers.app,
      token: options.token,
      identifier: identifiers.extensions[extension.localIdentifier],
    })
    functionIds[extension.localIdentifier] = remoteIdentifier
  }

  identifiers = {
    ...identifiers,
    extensions: {
      ...identifiers.extensions,
      ...functionIds,
    },
  }

  return identifiers
}

interface UploadFunctionExtensionOptions {
  apiKey: string
  identifier?: string
  token: string
}

async function uploadFunctionExtension(
  extension: FunctionExtension,
  options: UploadFunctionExtensionOptions,
): Promise<string> {
  const url = await uploadWasmBlob(extension, options.apiKey, options.token)

  let inputQuery: string | undefined
  if (await file.exists(extension.inputQueryPath())) {
    inputQuery = await file.read(extension.inputQueryPath())
  }

  const query = api.graphql.AppFunctionSetMutation
  const variables: api.graphql.AppFunctionSetVariables = {
    // NOTE: This is a shim to support CLI projects that currently use the UUID instead of the ULID
    ...(options.identifier?.includes('-') ? {legacyUuid: options.identifier} : {id: options.identifier}),
    title: extension.configuration.name,
    description: extension.configuration.description,
    apiType: extension.configuration.type,
    apiVersion: extension.configuration.apiVersion,
    inputQuery,
    appBridge: extension.configuration.ui?.paths
      ? {
          detailsPath: extension.configuration.ui.paths.details,
          createPath: extension.configuration.ui.paths.create,
        }
      : undefined,
    moduleUploadUrl: url,
  }

  const res: api.graphql.AppFunctionSetMutationSchema = await api.partners.functionProxyRequest(
    options.apiKey,
    query,
    options.token,
    variables,
  )
  const userErrors = res.data.functionSet.userErrors ?? []
  if (userErrors.length !== 0) {
    const errorMessage = output.content`The deployment of functions failed with the following errors:
${output.token.json(userErrors)}
    `
    throw new error.Abort(errorMessage)
  }
  return res.data.functionSet.function?.id as string
}

async function uploadWasmBlob(extension: FunctionExtension, apiKey: string, token: string): Promise<string> {
  const {url, headers, maxSize} = await getFunctionExtensionUploadURL({apiKey, token})
  headers['Content-Type'] = 'application/wasm'

  const functionContent = await file.read(extension.buildWasmPath(), {})
  const res = await http.fetch(url, {body: functionContent, headers, method: 'PUT'})
  const resBody = res.body?.read()?.toString() || ''

  if (res.status === 200) {
    return url
  } else if (res.status === 400 && resBody.includes('EntityTooLarge')) {
    const errorMessage = output.content`The size of the Wasm binary file for Function ${extension.localIdentifier} is too large. It must be less than ${maxSize}.`
    throw new error.Abort(errorMessage)
  } else if (res.status >= 400 && res.status < 500) {
    const errorMessage = output.content`Something went wrong uploading the Function ${
      extension.localIdentifier
    }. The server responded with status ${res.status.toString()} and body: ${resBody}`
    throw new error.Bug(errorMessage)
  } else {
    const errorMessage = output.content`Something went wrong uploading the Function ${extension.localIdentifier}. Try again.`
    throw new error.Abort(errorMessage)
  }
}

interface GetFunctionExtensionUploadURLOptions {
  apiKey: string
  token: string
}

interface GetFunctionExtensionUploadURLOutput {
  url: string
  maxSize: string
  headers: {[key: string]: string}
}

async function getFunctionExtensionUploadURL(
  options: GetFunctionExtensionUploadURLOptions,
): Promise<GetFunctionExtensionUploadURLOutput> {
  const query = api.graphql.UploadUrlGenerateMutation
  const res: api.graphql.UploadUrlGenerateMutationSchema = await api.partners.functionProxyRequest(
    options.apiKey,
    query,
    options.token,
  )
  return res.data.uploadUrlGenerate
}
