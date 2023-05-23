import {themeExtensionConfig as generateThemeExtensionConfig} from './theme-extension-config.js'
import {Identifiers, IdentifiersExtensions} from '../../models/app/identifiers.js'
import {FunctionExtension, ThemeExtension} from '../../models/app/extensions.js'
import {
  UploadUrlGenerateMutation,
  UploadUrlGenerateMutationSchema,
} from '../../api/graphql/functions/upload_url_generate.js'
import {
  ExtensionUpdateDraftInput,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateSchema,
} from '../../api/graphql/update_draft.js'
import {
  CreateDeployment,
  CreateDeploymentSchema,
  CreateDeploymentVariables,
  ExtensionSettings,
} from '../../api/graphql/create_deployment.js'
import {
  GenerateSignedUploadUrl,
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'
import {
  AppFunctionSetMutation,
  AppFunctionSetMutationSchema,
  AppFunctionSetVariables,
} from '../../api/graphql/functions/app_function_set.js'
import {functionProxyRequest, partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {fileExists, readFile, readFileSync} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AlertCustomSection, ListToken, TokenItem} from '@shopify/cli-kit/node/ui'
import {partition} from '@shopify/cli-kit/common/collection'

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
      const themeExtensionInput: ExtensionUpdateDraftInput = {
        apiKey,
        config: JSON.stringify(themeExtensionConfig),
        context: undefined,
        registrationId: themeId,
      }
      const mutation = ExtensionUpdateDraftMutation
      const result: ExtensionUpdateSchema = await partnersRequest(mutation, token, themeExtensionInput)
      if (result.extensionUpdateDraft?.userErrors?.length > 0) {
        const errors = result.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
        throw new AbortError(errors)
      }
    }),
  )
}

interface UploadExtensionsBundleOptions {
  /** The application API key */
  apiKey: string

  /** The path to the bundle file to be uploaded */
  bundlePath?: string

  /** The token to send authenticated requests to the partners' API  */
  token: string

  /** Extensions extra data */
  extensions: ExtensionSettings[]

  /** The extensions' numeric identifiers (expressed as a string). */
  extensionIds: IdentifiersExtensions
}

export interface UploadExtensionValidationError {
  uuid: string
  errors: {
    message: string
    field: string[]
  }[]
}

type ErrorSectionBody = TokenItem
interface ErrorCustomSection extends AlertCustomSection {
  body: ErrorSectionBody
}

/**
 * Uploads a bundle.
 * @param options - The upload options
 */
export async function uploadExtensionsBundle(
  options: UploadExtensionsBundleOptions,
): Promise<{validationErrors: UploadExtensionValidationError[]; deploymentId: number}> {
  const deploymentUUID = randomUUID()
  let signedURL

  if (options.bundlePath) {
    signedURL = await getExtensionUploadURL(options.apiKey, deploymentUUID)

    const form = formData()
    const buffer = readFileSync(options.bundlePath)
    form.append('my_upload', buffer)
    await fetch(signedURL, {
      method: 'put',
      body: buffer,
      headers: form.getHeaders(),
    })
  }

  const variables: CreateDeploymentVariables = {
    apiKey: options.apiKey,
    uuid: deploymentUUID,
  }

  if (signedURL) {
    variables.bundleUrl = signedURL
  }

  if (options.extensions.length > 0) {
    variables.extensions = options.extensions
  }

  const mutation = CreateDeployment
  const result: CreateDeploymentSchema = await partnersRequest(mutation, options.token, variables)

  if (result.deploymentCreate?.userErrors?.length > 0) {
    const customSections: AlertCustomSection[] = deploymentErrorsToCustomSections(
      result.deploymentCreate.userErrors,
      options.extensionIds,
    )

    throw new AbortError('There has been an error creating your deployment.', null, [], customSections)
  }

  const validationErrors = result.deploymentCreate.deployment.deployedVersions
    .filter((ver) => ver.extensionVersion.validationErrors.length > 0)
    .map((ver) => {
      return {uuid: ver.extensionVersion.registrationUuid, errors: ver.extensionVersion.validationErrors}
    })

  return {validationErrors, deploymentId: result.deploymentCreate.deployment.id}
}

const VALIDATION_ERRORS_TITLE = '\nValidation errors'
const GENERIC_ERRORS_TITLE = '\n'

export function deploymentErrorsToCustomSections(
  errors: CreateDeploymentSchema['deploymentCreate']['userErrors'],
  extensionIds: IdentifiersExtensions,
): ErrorCustomSection[] {
  const isCliError = (error: (typeof errors)[0], extensionIds: IdentifiersExtensions) => {
    const errorExtensionId =
      error.details?.find((detail) => typeof detail.extension_id !== 'undefined')?.extension_id.toString() ?? ''

    return Object.values(extensionIds).includes(errorExtensionId)
  }

  const [cliErrors, partnersErrors] = partition(errors, (error) => isCliError(error, extensionIds))

  const customSections = [...cliErrorsSections(cliErrors), ...partnersErrorsSections(partnersErrors)]
  return customSections
}

function cliErrorsSections(errors: CreateDeploymentSchema['deploymentCreate']['userErrors']) {
  return errors.reduce((sections, error) => {
    const field = error.field.join('.')
    const errorMessage = field === 'base' ? error.message : `${field}: ${error.message}`

    const extensionIdentifier = error.details.find(
      (detail) => typeof detail.extension_title !== 'undefined',
    )?.extension_title

    const existingSection = sections.find((section) => section.title === extensionIdentifier)

    if (existingSection) {
      const sectionBody = existingSection.body as ListToken[]
      const errorsList =
        error.category === 'invalid'
          ? sectionBody.find((listToken) => listToken.list.title === VALIDATION_ERRORS_TITLE)
          : sectionBody.find((listToken) => listToken.list.title === GENERIC_ERRORS_TITLE)

      if (errorsList) {
        errorsList.list.items.push(errorMessage)
      } else {
        sectionBody.push({
          list: {
            title: error.category === 'invalid' ? VALIDATION_ERRORS_TITLE : GENERIC_ERRORS_TITLE,
            items: [errorMessage],
          },
        })
      }
    } else {
      sections.push({
        title: extensionIdentifier,
        body: [
          {
            list: {
              title: error.category === 'invalid' ? VALIDATION_ERRORS_TITLE : GENERIC_ERRORS_TITLE,
              items: [errorMessage],
            },
          },
        ],
      })
    }

    sections.forEach((section) => {
      // eslint-disable-next-line id-length
      ;(section.body as ListToken[]).sort((a, b) => {
        if (a.list.title === VALIDATION_ERRORS_TITLE) {
          return 1
        }

        if (b.list.title === VALIDATION_ERRORS_TITLE) {
          return -1
        }

        return 0
      })
    })

    return sections
  }, [] as ErrorCustomSection[])
}

function partnersErrorsSections(errors: CreateDeploymentSchema['deploymentCreate']['userErrors']) {
  return errors
    .reduce((sections, error) => {
      const extensionIdentifier = error.details.find(
        (detail) => typeof detail.extension_title !== 'undefined',
      )?.extension_title

      const existingSection = sections.find((section) => section.title === extensionIdentifier)

      if (existingSection) {
        existingSection.errorCount += 1
      } else {
        sections.push({
          title: extensionIdentifier,
          errorCount: 1,
        })
      }

      return sections
    }, [] as {title: string | undefined; errorCount: number}[])
    .map((section) => ({
      title: section.title,
      body: `\n${section.errorCount} error${
        section.errorCount > 1 ? 's' : ''
      } found in your extension. Fix these issues in the Partner Dashboard and try deploying again.`,
    })) as ErrorCustomSection[]
}

/**
 * It generates a URL to upload an app bundle.
 * @param apiKey - The application API key
 * @param deploymentUUID - The unique identifier of the deployment.
 */
export async function getExtensionUploadURL(apiKey: string, deploymentUUID: string) {
  const mutation = GenerateSignedUploadUrl
  const token = await ensureAuthenticatedPartners()
  const variables: GenerateSignedUploadUrlVariables = {
    apiKey,
    deploymentUuid: deploymentUUID,
    bundleFormat: 1,
  }

  const result: GenerateSignedUploadUrlSchema = await partnersRequest(mutation, token, variables)
  if (result.deploymentGenerateSignedUploadUrl?.userErrors?.length > 0) {
    const errors = result.deploymentGenerateSignedUploadUrl.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
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
  const {url} = await uploadWasmBlob(extension, options.apiKey, options.token)

  let inputQuery: string | undefined
  if (await fileExists(extension.inputQueryPath)) {
    inputQuery = await readFile(extension.inputQueryPath)
  }

  const query = AppFunctionSetMutation
  const variables: AppFunctionSetVariables = {
    // NOTE: This is a shim to support CLI projects that currently use the UUID instead of the ULID
    ...(options.identifier?.includes('-') ? {legacyUuid: options.identifier} : {id: options.identifier}),
    title: extension.configuration.name,
    description: extension.configuration.description,
    apiType: extension.configuration.type,
    apiVersion: extension.configuration.apiVersion,
    inputQuery,
    inputQueryVariables: extension.configuration.input?.variables
      ? {
          singleJsonMetafield: extension.configuration.input.variables,
        }
      : undefined,
    appBridge: extension.configuration.ui?.paths
      ? {
          detailsPath: extension.configuration.ui.paths.details,
          createPath: extension.configuration.ui.paths.create,
        }
      : undefined,
    enableCreationUi: extension.configuration.ui?.enable_create ?? true,
    moduleUploadUrl: url,
  }

  const res: AppFunctionSetMutationSchema = await functionProxyRequest(options.apiKey, query, options.token, variables)
  const userErrors = res.data.functionSet.userErrors ?? []
  if (userErrors.length !== 0) {
    const errorMessage = outputContent`The deployment of functions failed with the following errors:
${outputToken.json(userErrors)}
    `
    throw new AbortError(errorMessage)
  }
  return res.data.functionSet.function?.id as string
}

export async function uploadWasmBlob(
  extension: FunctionExtension,
  apiKey: string,
  token: string,
): Promise<{url: string; moduleId: string}> {
  const {url, moduleId, headers, maxSize} = await getFunctionExtensionUploadURL({apiKey, token})
  headers['Content-Type'] = 'application/wasm'

  const functionContent = await readFile(extension.buildWasmPath, {})
  const res = await fetch(url, {body: functionContent, headers, method: 'PUT'})
  const resBody = res.body?.read()?.toString() || ''

  if (res.status === 200) {
    return {url, moduleId}
  } else if (res.status === 400 && resBody.includes('EntityTooLarge')) {
    const errorMessage = outputContent`The size of the Wasm binary file for Function ${extension.localIdentifier} is too large. It must be less than ${maxSize}.`
    throw new AbortError(errorMessage)
  } else if (res.status >= 400 && res.status < 500) {
    const errorMessage = outputContent`Something went wrong uploading the Function ${
      extension.localIdentifier
    }. The server responded with status ${res.status.toString()} and body: ${resBody}`
    throw new BugError(errorMessage)
  } else {
    const errorMessage = outputContent`Something went wrong uploading the Function ${extension.localIdentifier}. Try again.`
    throw new AbortError(errorMessage)
  }
}

interface GetFunctionExtensionUploadURLOptions {
  apiKey: string
  token: string
}

interface GetFunctionExtensionUploadURLOutput {
  url: string
  moduleId: string
  maxSize: string
  headers: {[key: string]: string}
}

async function getFunctionExtensionUploadURL(
  options: GetFunctionExtensionUploadURLOptions,
): Promise<GetFunctionExtensionUploadURLOutput> {
  const res: UploadUrlGenerateMutationSchema = await functionProxyRequest(
    options.apiKey,
    UploadUrlGenerateMutation,
    options.token,
  )
  return res.data.uploadUrlGenerate
}

export async function functionConfiguration(
  extension: FunctionExtension,
  moduleId: string,
  appKey: string,
): Promise<object> {
  let inputQuery: string | undefined
  if (await fileExists(extension.inputQueryPath)) {
    inputQuery = await readFile(extension.inputQueryPath)
  }

  return {
    title: extension.configuration.name,
    module_id: moduleId,
    description: extension.configuration.description,
    app_key: appKey,
    api_type: extension.configuration.type,
    api_version: extension.configuration.apiVersion,
    input_query: inputQuery,
    input_query_variables: extension.configuration.input?.variables
      ? {
          single_json_metafield: extension.configuration.input.variables,
        }
      : undefined,
    ui: extension.configuration.ui?.paths
      ? {
          app_bridge: {
            details_path: extension.configuration.ui.paths.details,
            create_path: extension.configuration.ui.paths.create,
          },
        }
      : undefined,
    enable_creation_ui: extension.configuration.ui?.enable_create ?? true,
  }
}
