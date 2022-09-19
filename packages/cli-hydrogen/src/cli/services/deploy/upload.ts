import {ReqDeployConfig, UploadDeploymentResponse} from './types.js'
import {
  CreateDeploymentResponse,
  CreateDeploymentQuerySchema,
  CreateDeploymentQuery,
} from './graphql/create_deployment.js'
import {UploadDeploymentQuery} from './graphql/upload_deployment.js'
import {WebPageNotAvailable} from './error.js'
import {api, http, file} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'

export const createDeployment = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  const headers = await api.buildHeaders(config.deploymentToken)
  const client = await http.graphqlClient({
    headers,
    url: getOxygenAddress(config.oxygenAddress),
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

  const response = await http.shopifyFetch(getOxygenAddress(config.oxygenAddress), {
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
    query: UploadDeploymentQuery,
    variables: {deploymentID, file: null},
  })
}

const getOxygenAddress = (oxygenFqdn: string): string => {
  return `https://${oxygenFqdn}/api/graphql/deploy/v1`
}
