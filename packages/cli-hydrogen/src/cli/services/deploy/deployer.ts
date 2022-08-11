import {ReqDeployConfig, DMSError, UploadDeploymentResponse} from './types.js'
import {
  CreateDeploymentResponse,
  CreateDeploymentQuerySchema,
  CreateDeploymentQuery,
} from './graphql/create_deployment.js'
import buildService from '../build.js'
import {output, api, http} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'
import {createReadStream} from 'node:fs'

export const createDeploymentStep = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  output.info('✨ Creating a deployment... ')

  const url = `https://${config.dmsAddress}/api/graphql/deploy/v1`
  const headers = await api.common.buildHeaders(config.deploymentToken)
  const client = await http.graphqlClient({
    headers,
    service: 'dms',
    url,
  })

  // need to make workflowID optional on DMS so we dont need to generate a random one
  const variables = {
    input: {
      repository: config.repository,
      branch: config.commitRef,
      commitHash: config.commitSha,
      commitAuthor: config.commitAuthor,
      commitMessage: config.commitMessage,
      commitTimestamp: config.timestamp,
      workflowID: `${Math.floor(Math.random() * 100000)}`,
    },
  }

  // need to handle errors
  const response: CreateDeploymentQuerySchema = await client.request(CreateDeploymentQuery, variables)
  return response.createDeployment
}

export const runBuildCommandStep = async (config: ReqDeployConfig, assetBaseURL: string): Promise<DMSError | null> => {
  output.info('✨ Building the applicaton... ')

  // need to measure duration of build
  // make a temp build directory?
  const targets = {
    client: true,
    worker: '@shopify/hydrogen/platforms/worker',
    node: false,
  }
  const options = {
    client: true,
    target: 'worker',
  }

  // note: need to make sure this is being set correctly
  await buildService({...options, directory: config.path, targets, assetBaseURL})

  return null
}

export const uploadDeploymentStep = async (config: ReqDeployConfig, deploymentID: string): Promise<string> => {
  output.info('🚀 Uploading deployment files... ')

  const url = `https://${config.dmsAddress}/api/graphql/deploy/v1`
  let headers = await api.common.buildHeaders(config.deploymentToken)

  // note: may need validation for invalid deploymentID? oxygenctl does it
  // note: we may want to remove the zip that we create in in this step
  const distPath = `${config.path}/dist`
  const distZipPath = `${distPath}/dist.zip`
  await zip(distPath, distZipPath)

  const formData = http.formData()
  formData.append('operations', buildOperationsString(deploymentID))
  formData.append('map', JSON.stringify({'0': ['variables.file']}))
  formData.append('0', createReadStream(distZipPath), {filename: 'upload_dist'})

  delete headers['Content-Type']
  headers = {
    ...headers,
    ...formData.getHeaders(),
  }

  const response = await http.shopifyFetch('dms', url, {
    method: 'POST',
    body: formData,
    headers,
  })

  // note: handle error
  // note: type this better
  const responseData = (await response.json()) as UploadDeploymentResponse
  return responseData.data.uploadDeployment.deployment.previewURL
}

const buildOperationsString = (deploymentID: string): string => {
  return JSON.stringify({
    query:
      'mutation uploadDeployment($file: Upload!, $deploymentID: ID!) {uploadDeployment(file: $file, deploymentID: $deploymentID) {deployment {previewURL}}}',
    variables: {deploymentID, file: null},
  })
}
