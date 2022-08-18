import {DeployConfig} from './deploy/types.js'
import {getDeployConfig} from './deploy/config.js'
import {createDeploymentStep, runBuildCommandStep, uploadDeploymentStep, healthCheck} from './deploy/deployer.js'
import {output} from '@shopify/cli-kit'

export async function deployToOxygen(_config: DeployConfig) {
  const config = await getDeployConfig(_config)
  // eslint-disable-next-line no-console
  console.log('Deployment Config: ', config)

  const {deploymentID, assetBaseURL, error} = await createDeploymentStep(config)

  output.info(`Deployment ID: ${deploymentID}`)
  output.info(`Base Asset URL: ${assetBaseURL}`)
  output.info(`Error Message: ${error?.debugInfo}`)

  // note: need to handle this error
  const buildResponse = await runBuildCommandStep(config, assetBaseURL)
  const previewURL = await uploadDeploymentStep(config, deploymentID)

  output.info(`Preview URL: ${previewURL}`)

  await healthCheck(previewURL)

  // For scripting purposes, last line is preview URL.
  output.info(previewURL)
}
