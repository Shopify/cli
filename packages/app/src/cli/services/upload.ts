import {App} from '../models/app/app'
import {api, error, session, http, id} from '@shopify/cli-kit'
import fs from 'fs'

interface UploadOptions {
  app: App
  archivePath: string
  deploymentUUID?: string
  signedURL?: string
}

export async function upload(options: UploadOptions) {
  const apiKey = options.app.configuration.id
  if (!apiKey) {
    throw new error.Abort(
      "The app configuration file doesn't have an id and it's necessary to upload the app",
      'You can set it manually getting the API key of the app in the partners organization or run the dev command.',
    )
  }
  const token = await session.ensureAuthenticatedPartners()
  const deploymentUUID = options.deploymentUUID ?? id.generateRandomUUID()
  const signedURL = options.signedURL ?? (await generateUrl(apiKey, deploymentUUID))

  const formData = http.formData()
  const buffer = fs.readFileSync(options.archivePath)
  formData.append('my_upload', buffer)
  await http.fetch(signedURL, {
    method: 'put',
    body: buffer,
    headers: formData.getHeaders(),
  })

  const variables: api.graphql.CreateDeploymentVariables = {
    apiKey,
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

export async function generateUrl(apiKey: string, deploymentUuid: string) {
  const mutation = api.graphql.GenerateSignedUploadUrl
  const token = await session.ensureAuthenticatedPartners()
  const variables: api.graphql.GenerateSignedUploadUrlVariables = {
    apiKey,
    deploymentUuid,
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
