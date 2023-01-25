import {ReqDeployConfig, UploadDeploymentResponse} from './types.js'
import {
  CreateDeploymentResponse,
  CreateDeploymentQuerySchema,
  CreateDeploymentQuery,
} from './graphql/create_deployment.js'
import {UploadDeploymentQuery} from './graphql/upload_deployment.js'
import {zip} from '@shopify/cli-kit/node/archiver'
import {ClientError} from 'graphql-request'
import {uploadOxygenDeploymentFile, oxygenRequest} from '@shopify/cli-kit/node/api/oxygen'
import {inTemporaryDirectory, createFileReadStream} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

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
    const response: CreateDeploymentQuerySchema = await oxygenRequest(
      config.oxygenAddress,
      CreateDeploymentQuery,
      config.deploymentToken,
      variables,
    )

    if (response.createDeployment?.error) {
      if (response.createDeployment.error.unrecoverable) {
        throw new AbortError(`Unrecoverable: ${response.createDeployment.error.debugInfo}`)
      }

      throw new AbortError(`Failed to create deployment. ${response.createDeployment.error.debugInfo}`)
    }

    return response.createDeployment
  } catch (error) {
    if (error instanceof ClientError) {
      if (error.response.status === 429) {
        throw new AbortError("You've made too many requests. Please try again later")
      }
    }

    throw error
  }
}

export const uploadDeployment = async (config: ReqDeployConfig, deploymentID: string): Promise<string> => {
  let deploymentData: UploadDeploymentResponse | undefined

  await inTemporaryDirectory(async (tmpDir) => {
    const distPath = config.pathToBuild ? config.pathToBuild : `${config.path}/dist`
    const distZipPath = `${tmpDir}/dist.zip`
    await zip({
      inputDirectory: distPath,
      outputZipPath: distZipPath,
    })

    const form = formData()
    form.append('operations', buildOperationsString(deploymentID))
    form.append('map', JSON.stringify({'0': ['variables.file']}))
    form.append('0', createFileReadStream(distZipPath), {filename: distZipPath})

    const response = await uploadOxygenDeploymentFile(config.oxygenAddress, config.deploymentToken, form)
    if (!response.ok) {
      if (response.status === 429) {
        throw new AbortError("You've made too many requests. Please try again later")
      }
      if (response.status !== 200 && response.status !== 202) {
        throw new AbortError(`Failed to upload deployment. ${await response.json()}`)
      }
    }

    deploymentData = (await response.json()) as UploadDeploymentResponse
  })

  if (!deploymentData) {
    throw new AbortError('Failed to upload deployment.')
  }
  const deploymentError = deploymentData.data?.uploadDeployment?.error
  if (deploymentError) {
    if (deploymentError.unrecoverable) {
      throw new AbortError(`Unrecoverable: ${deploymentError.debugInfo}`)
    }

    throw new AbortError(`Failed to upload deployment: ${deploymentError.debugInfo}`)
  }

  return deploymentData.data.uploadDeployment.deployment.previewURL
}

export const healthCheck = async (pingUrl: string) => {
  const url = `${pingUrl}/__health`
  const result = await fetch(url, {method: 'GET'})
  if (result.status !== 200) throw new AbortError('Web page not available.')
}

const buildOperationsString = (deploymentID: string): string => {
  return JSON.stringify({
    query: UploadDeploymentQuery,
    variables: {deploymentID, file: null},
  })
}
