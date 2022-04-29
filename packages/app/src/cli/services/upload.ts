// import fs from 'fs'

// import AppInfo from 'cli/commands/app/info'
// import {build} from 'esbuild'
// import {http,output} from '@shopify/cli-kit'
import {api, error, output, session, http} from '@shopify/cli-kit'
import fs from 'fs'

// import {load as loadApp, App} from '../app/app'

/*
Upload command:
-----
const app = loadApp()
upload(app)
Deploy command
-----
const app = loadApp()
const session = ensureAuthenticated()
validateBeforeUpload(app)
const zipFilePath = build(app)
upload(app, zipFilePath, session) {
  multiPart(zipFilePath, headers)
}
*/

export async function upload(apiKey: string | undefined, deploymentUuid: string, file: string, signedUrl: string) {
  if (!apiKey) {
    output.info('apiKey is undefined...')
    throw new error.Fatal('apiKey undefined...')
  }

  const token = await session.ensureAuthenticatedPartners()

  const formData = http.formData()
  const buffer = fs.readFileSync(file)
  formData.append('my_upload', buffer)
  await http.fetch(signedUrl, {
    method: 'put',
    body: buffer,
    headers: formData.getHeaders(),
  })

  const variables: api.graphql.CreateDeploymentVariables = {
    apiKey,
    uuid: deploymentUuid,
    bundleUrl: signedUrl,
  }

  const mutation = api.graphql.CreateDeployment
  const result: api.graphql.CreateDeploymentSchema = await api.partners.request(mutation, token, variables)
  if (result.deploymentCreate && result.deploymentCreate.userErrors && result.deploymentCreate.userErrors.length > 0) {
    const errors = result.deploymentCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Fatal(errors)
  }
}

export async function generateUrl(apiKey: string | undefined, deploymentUuid: string, uploadUrlOverride?: string) {
  if (uploadUrlOverride) {
    return uploadUrlOverride
  }

  if (!apiKey) {
    output.info('apiKey is undefined...')
    throw new error.Fatal('apiKey undefined...')
  }

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
