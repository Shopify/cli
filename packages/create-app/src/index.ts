import {runCreateCLI, setupEnvironmentVariables} from '@shopify/cli-kit/node/cli'

async function runCreateAppCLI(development: boolean) {
  setupEnvironmentVariables({development})
  await runCreateCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runCreateAppCLI
