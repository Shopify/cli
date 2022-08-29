import {ReqDeployConfig, UploadDeploymentResponse} from './types.js'
import {
  CreateDeploymentResponse,
  CreateDeploymentQuerySchema,
  CreateDeploymentQuery,
} from './graphql/create_deployment.js'
import {WebPageNotAvailable} from './error.js'
import {api, http, file} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'

export const createDeployment = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  const headers = await api.buildHeaders(config.deploymentToken)
  const client = await http.graphqlClient({
    headers,
    service: 'dms',
    url: getDmsAddress(config.dmsAddress),
  })

  const variables = {
    input: {
      branch: config.commitRef,
      commitHash: config.commitSha,
      commitAuthor: config.commitAuthor,
      commitMessage: config.commitMessage,
      commitTimestamp: config.timestamp,
    },
  }

  const response: CreateDeploymentQuerySchema = await client.request(CreateDeploymentQuery, variables)
  return response.createDeployment
}

export const uploadDeployment = async (config: ReqDeployConfig, deploymentID: string): Promise<string> => {
  let headers = await api.buildHeaders(config.deploymentToken)

  // note: may need validation for invalid deploymentID? oxygenctl does it
  // note: we may want to remove the zip that we create in in this step
  const distPath = `${config.path}/dist`
  const distZipPath = `${distPath}/dist.zip`
  await zip(distPath, distZipPath)

  const formData = http.formData()
  formData.append('operations', buildOperationsString(deploymentID))
  formData.append('map', JSON.stringify({'0': ['variables.file']}))
  formData.append('0', file.createReadStream(distZipPath), {filename: 'upload_dist'})

  delete headers['Content-Type']
  headers = {
    ...headers,
    ...formData.getHeaders(),
  }

  const response = await http.shopifyFetch('dms', getDmsAddress(config.dmsAddress), {
    method: 'POST',
    body: formData,
    headers,
  })

  const responseData = (await response.json()) as UploadDeploymentResponse
  return responseData.data.uploadDeployment.deployment.previewURL
}

export const healthCheck = async (pingUrl: string) => {
  const url = `${pingUrl}/__health`
  const result = await http.fetch(url, {method: 'GET'})
  if (result.status !== 200) throw WebPageNotAvailable()
}

const buildOperationsString = (deploymentID: string): string => {
  return JSON.stringify({
    query:
      'mutation uploadDeployment($file: Upload!, $deploymentID: ID!) {uploadDeployment(file: $file, deploymentID: $deploymentID) {deployment {previewURL}}}',
    variables: {deploymentID, file: null},
  })
}

const getDmsAddress = (dmsHost: string): string => {
  return `https://${dmsHost}/api/graphql/deploy/v1`
}
