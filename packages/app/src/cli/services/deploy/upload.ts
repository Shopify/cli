import {themeExtensionConfig as generateThemeExtensionConfig} from './theme-extension-config.js'
import {Identifiers, IdentifiersExtensions} from '../../models/app/identifiers.js'
import {FunctionExtension, ThemeExtension} from '../../models/app/extensions.js'
import {blocks, getFunctionExtensionPointName} from '../../constants.js'
import {api, error, session, http, id, output, file} from '@shopify/cli-kit'

import {unwrapOrThrow} from '@shopify/cli-kit/src/api/common.js'
import {err, ok, ResultAsync} from 'neverthrow'
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
 * @param options {DeployThemeExtensionOptions} The upload options
 */

export async function uploadThemeExtensions(
  themeExtensions: ThemeExtension[],
  options: DeployThemeExtensionOptions,
): Promise<void> {
  const {apiKey, identifiers, token} = options
  await Promise.all(
    themeExtensions.map(async (themeExtension) => {
      const themeExtensionConfig = await generateThemeExtensionConfig(themeExtension)
      const themeId = identifiers.extensionIds[themeExtension.localIdentifier]
      const themeExtensionInput: api.graphql.ExtensionUpdateDraftInput = {
        apiKey,
        config: JSON.stringify(themeExtensionConfig),
        context: undefined,
        registrationId: themeId,
      }
      const mutation = api.graphql.ExtensionUpdateDraftMutation
      unwrapOrThrow(
        api.partners
          .request<api.graphql.ExtensionUpdateSchema>(mutation, token, themeExtensionInput)
          .map(mapExtensionUpdateSchema),
      )
    }),
  )
}

function mapExtensionUpdateSchema(schema: api.graphql.ExtensionUpdateSchema) {
  if (schema.extensionUpdateDraft?.userErrors?.length > 0) {
    const errors = schema.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }
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
 * @param options {UploadUIExtensionsBundleOptions} The upload options
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
  return unwrapOrThrow(
    api.partners
      .request<api.graphql.CreateDeploymentSchema>(mutation, options.token, variables)
      .map(mapCreateDeploymentSchema),
  )
}

function mapCreateDeploymentSchema(schema: api.graphql.CreateDeploymentSchema) {
  if (schema.deploymentCreate?.userErrors?.length > 0) {
    const errors = schema.deploymentCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  const validationErrors = schema.deploymentCreate.deployment.deployedVersions
    .filter((ver) => ver.extensionVersion.validationErrors.length > 0)
    .map((ver) => {
      return {uuid: ver.extensionVersion.registrationUuid, errors: ver.extensionVersion.validationErrors}
    })
  return validationErrors
}

/**
 * It generates a URL to upload an app bundle.
 * @param apiKey {string} The application API key
 * @param deploymentUUID {string} The unique identifier of the deployment.
 * @returns
 */
export async function getUIExtensionUploadURL(apiKey: string, deploymentUUID: string) {
  const mutation = api.graphql.GenerateSignedUploadUrl
  const token = await session.ensureAuthenticatedPartners()
  const variables: api.graphql.GenerateSignedUploadUrlVariables = {
    apiKey,
    deploymentUuid: deploymentUUID,
    bundleFormat: 1,
  }

  return unwrapOrThrow(
    api.partners
      .request<api.graphql.GenerateSignedUploadUrlSchema>(mutation, token, variables)
      .andThen(mapGenerateSignedUploadUrlSchema),
  )
}
function mapGenerateSignedUploadUrlSchema(
  schema: api.graphql.GenerateSignedUploadUrlSchema,
): ResultAsync<string, Error> {
  if (schema.deploymentGenerateSignedUploadUrl?.userErrors?.length > 0) {
    const errors = schema.deploymentGenerateSignedUploadUrl.userErrors.map((error) => error.message).join(', ')
    return err(new error.Abort(errors))
  }

  return ok(schema.deploymentGenerateSignedUploadUrl.signedUploadUrl)
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
 * @param extensions {FunctionExtension[]} The list of extensions to upload.
 * @param options {UploadFunctionExtensionsOptions} Options to adjust the upload.
 * @returns {Promise<Identifiers>} A promise that resolves with the identifiers.
 */
export async function uploadFunctionExtensions(
  extensions: FunctionExtension[],
  options: UploadFunctionExtensionsOptions,
): Promise<Identifiers> {
  let identifiers = options.identifiers

  const functionUUIDs: IdentifiersExtensions = {}

  // Functions are uploaded sequentially to avoid reaching the API limit
  for (const extension of extensions) {
    // eslint-disable-next-line no-await-in-loop
    const remoteIdentifier = await uploadFunctionExtension(extension, {
      apiKey: options.identifiers.app,
      token: options.token,
      identifier: identifiers.extensions[extension.localIdentifier],
    })
    functionUUIDs[extension.localIdentifier] = remoteIdentifier
  }

  identifiers = {
    ...identifiers,
    extensions: {
      ...identifiers.extensions,
      ...functionUUIDs,
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
  const {url, headers} = await getFunctionExtensionUploadURL({apiKey: options.apiKey, token: options.token})
  headers['Content-Type'] = 'application/wasm'

  let inputQuery: string | undefined
  if (await file.exists(extension.inputQueryPath())) {
    inputQuery = await file.read(extension.inputQueryPath())
  }

  const functionContent = fs.readFileSync(extension.buildWasmPath())
  await http.fetch(url, {body: functionContent, headers, method: 'PUT'})
  await compileFunctionExtension(extension, options, url)

  const query = api.graphql.AppFunctionSetMutation
  const schemaVersions = Object.values(extension.metadata.schemaVersions).shift()
  const schemaMajorVersion = schemaVersions?.major
  const schemaMinorVersion = schemaVersions?.minor

  const variables: api.graphql.AppFunctionSetVariables = {
    uuid: options.identifier,
    extensionPointName: getFunctionExtensionPointName(extension.configuration.type),
    title: extension.configuration.name,
    description: extension.configuration.description,
    force: true,
    schemaMajorVersion: schemaMajorVersion === undefined ? '' : `${schemaMajorVersion}`,
    schemaMinorVersion: schemaMinorVersion === undefined ? '' : `${schemaMinorVersion}`,
    configurationUi: extension.configuration.configurationUi,
    moduleUploadUrl: url,
    apiVersion: extension.configuration.apiVersion,
    skipCompilationJob: true,
    appBridge: extension.configuration.ui?.paths
      ? {
          detailsPath: extension.configuration.ui.paths.details,
          createPath: extension.configuration.ui.paths.create,
        }
      : undefined,
    inputQuery,
  }
  const res: api.graphql.AppFunctionSetMutationSchema = await api.partners.functionProxyRequest(
    options.apiKey,
    query,
    options.token,
    variables,
  )
  const userErrors = res.data.appScriptSet.userErrors ?? []
  if (userErrors.length !== 0) {
    const errorMessage = output.content`The deployment of functions failed with the following errors:
${output.token.json(userErrors)}
    `
    throw new error.Abort(errorMessage)
  }
  const uuid = res.data.appScriptSet.appScript?.uuid as string
  return uuid
}

async function compileFunctionExtension(
  extension: FunctionExtension,
  options: UploadFunctionExtensionOptions,
  moduleUploadUrl: string,
): Promise<void> {
  const query = api.graphql.CompileModuleMutation
  const variables: api.graphql.CompileModuleMutationVariables = {
    moduleUploadUrl,
  }
  const res: api.graphql.CompileModuleMutationSchema = await api.partners.functionProxyRequest(
    options.apiKey,
    query,
    options.token,
    variables,
  )
  const jobId = res.data.compileModule.jobId

  await waitForCompilation(extension, options, jobId)
}

async function getCompilationStatus(options: UploadFunctionExtensionOptions, compilationJobId: string) {
  const query = api.graphql.ModuleCompilationStatusQuery
  const variables: api.graphql.ModuleCompilationQueryVariables = {
    jobId: compilationJobId,
  }
  const res: api.graphql.ModuleCompilationStatusQuerySchema = await api.partners.functionProxyRequest(
    options.apiKey,
    query,
    options.token,
    variables,
  )
  return res.data.moduleCompilationStatus.status
}

async function waitForCompilation(
  extension: FunctionExtension,
  options: UploadFunctionExtensionOptions,
  compilationJobId: string,
) {
  let retries = 0

  const poll = async (): Promise<void> => {
    const compilationStatus = await getCompilationStatus(options, compilationJobId)
    // eslint-disable-next-line no-empty
    if (compilationStatus === 'completed') {
    } else if (compilationStatus !== 'pending') {
      throw new error.Abort(output.content`Function ${extension.localIdentifier} compilation failed.`)
    } else if (retries < blocks.functions.maxCompilationStatusCheckCount) {
      retries++
      return sleep(blocks.functions.compilationStatusWaitMs).then(() => poll())
    } else {
      throw new error.Abort(output.content`Function ${extension.localIdentifier} compilation timed out.`)
    }
  }

  return poll()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface GetFunctionExtensionUploadURLOptions {
  apiKey: string
  token: string
}

interface GetFunctionExtensionUploadURLOutput {
  url: string
  headers: {[key: string]: string}
}

async function getFunctionExtensionUploadURL(
  options: GetFunctionExtensionUploadURLOptions,
): Promise<GetFunctionExtensionUploadURLOutput> {
  const query = api.graphql.ModuleUploadUrlGenerateMutation
  const res: api.graphql.ModuleUploadUrlGenerateMutationSchema = await api.partners.functionProxyRequest(
    options.apiKey,
    query,
    options.token,
  )
  return res.data.moduleUploadUrlGenerate.details
}
