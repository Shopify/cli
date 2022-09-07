import {ReqDeployConfig, UploadDeploymentResponse} from './types.js'
import {
  CreateDeploymentResponse,
  CreateDeploymentQuerySchema,
  CreateDeploymentQuery,
} from './graphql/create_deployment.js'
import {UnrecoverableError, WebPageNotAvailable, TooManyRequestsError} from './error.js'
import {UploadDeploymentQuery} from './graphql/upload_deployment.js'
import {api, http, file} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'
import {ClientError} from 'graphql-request'

export const createDeployment = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  const variables = {
    input: {
      branch: config.commitRef,
      commitHash: config.commitSha,
      commitAuthor: config.commitAuthor,
      commitMessage: config.commitMessage,
      commitTimestamp: config.timestamp,
    },
  }

  try {
    const response: CreateDeploymentQuerySchema = await api.oxygen.request(
      config.oxygenAddress,
      CreateDeploymentQuery,
      config.deploymentToken,
      variables,
    )

    if (response.createDeployment?.error) {
      if (response.createDeployment.error.unrecoverable) {
        throw UnrecoverableError(response.createDeployment.error.debugInfo)
      }

      throw new Error(`Failed to create deployment. ${response.createDeployment.error.debugInfo}`)
    }

    return response.createDeployment
  } catch (error) {
    if (error instanceof ClientError) {
      if (error.response.status === 429) {
        throw TooManyRequestsError()
      }
    }

    throw error
  }
}

export const uploadDeployment = async (config: ReqDeployConfig, deploymentID: string): Promise<string> => {
  let deploymentData: UploadDeploymentResponse | undefined

  await file.inTemporaryDirectory(async (tmpDir) => {
    const distPath = config.pathToBuild ? config.pathToBuild : `${config.path}/dist`
    const distZipPath = `${tmpDir}/dist.zip`
    await zip(distPath, distZipPath)

    const formData = http.formData()
    formData.append('operations', buildOperationsString(deploymentID))
    formData.append('map', JSON.stringify({'0': ['variables.file']}))
    formData.append('0', file.createReadStream(distZipPath), {filename: distZipPath})

    const response = await api.oxygen.uploadDeploymentFile(config.oxygenAddress, config.deploymentToken, formData)
    if (!response.ok) {
      if (response.status === 429) {
        throw TooManyRequestsError()
      }
      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`Failed to upload deployment. ${await response.json()}`)
      }
    }

    deploymentData = (await response.json()) as UploadDeploymentResponse
  })

  if (!deploymentData) {
    throw new Error('Failed to upload deployment.')
  }
  const deploymentError = deploymentData.data?.uploadDeployment?.error
  if (deploymentError) {
    if (deploymentError.unrecoverable) {
      throw UnrecoverableError(deploymentError.debugInfo)
    }

    throw new Error(`Failed to upload deployment: ${deploymentError.debugInfo}`)
  }

  return deploymentData.data.uploadDeployment.deployment.previewURL
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
