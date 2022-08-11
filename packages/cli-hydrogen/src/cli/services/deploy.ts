import {DeployConfig} from './deploy/types.js'
import {getDeployConfig} from './deploy/config.js'
import {createDeploymentStep, runBuildCommandStep} from './deploy/deployer.js'
import {output} from '@shopify/cli-kit'

export async function deployToOxygen(_config: DeployConfig) {
  const config = await getDeployConfig(_config)
  // eslint-disable-next-line no-console
  console.log('Deployment Config: ', config)

  const {deploymentID, assetBaseURL, error} = await createDeploymentStep(config)

  output.info(`Deployment ID: ${deploymentID}`)
  output.info(`Base Asset URL: ${assetBaseURL}`)
  output.info(`Error Message: ${error?.debugInfo}`)

  await runBuildCommandStep(config, assetBaseURL)

  output.success('Deployment created!')
}
