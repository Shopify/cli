import {api, error, session, http, id} from '@shopify/cli-kit'

import fs from 'fs'

interface UploadOptions {
  /** The application API key */
  apiKey: string

  /** The path to the bundle file to be uploaded */
  bundlePath: string
}

/**
 * Uploads a bundle.
 * @param options {UploadOptions} The upload options
 */
export async function upload(options: UploadOptions) {
  const token = await session.ensureAuthenticatedPartners()
  const deploymentUUID = id.generateRandomUUID()
  const signedURL = await generateUrl(options.apiKey, deploymentUUID)

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
  }

  const mutation = api.graphql.CreateDeployment
  const result: api.graphql.CreateDeploymentSchema = await api.partners.request(mutation, token, variables)
  if (result.deploymentCreate && result.deploymentCreate.userErrors && result.deploymentCreate.userErrors.length > 0) {
    const errors = result.deploymentCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Fatal(errors)
  }
}

/**
 * It generates a URL to upload an app bundle.
 * @param apiKey {string} The application API key
 * @param deploymentUUID {string} The unique identifier of the deployment.
 * @returns
 */
export async function generateUrl(apiKey: string, deploymentUUID: string) {
  const mutation = api.graphql.GenerateSignedUploadUrl
  const token = await session.ensureAuthenticatedPartners()
  const variables: api.graphql.GenerateSignedUploadUrlVariables = {
    apiKey,
    deploymentUuid: deploymentUUID,
    bundleFormat: 1,
  }

  const result: api.graphql.GenerateSignedUploadUrlSchema = await api.partners.request(mutation, token, variables)
  if (
    result.deploymentGenerateSignedUploadUrl &&
    result.deploymentGenerateSignedUploadUrl.userErrors &&
    result.deploymentGenerateSignedUploadUrl.userErrors.length > 0
  ) {
    const errors = result.deploymentGenerateSignedUploadUrl.userErrors.map((error) => error.message).join(', ')
    throw new error.Fatal(errors)
  }

  return result.deploymentGenerateSignedUploadUrl.signedUploadUrl
}
