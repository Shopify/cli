import {ReqDeployConfig, DMSError} from './types.js'
import {
  CreateDeploymentResponse,
  CreateDeploymentQuerySchema,
  CreateDeploymentQuery,
} from './graphql/create_deployment.js'
import buildService from '../build.js'
import {output, api, http} from '@shopify/cli-kit'

export const createDeploymentStep = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  output.info('✨ Creating a deployment... ')

  const url = `https://${config.dmsAddress}/api/graphql/deploy/v1`
  const headers = await api.common.buildHeaders(config.deploymentToken)
  // need to create a seperate service for "dms" related calls instead of piggybacking on "shopify"
  const client = await http.graphqlClient({
    headers,
    service: 'shopify',
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
