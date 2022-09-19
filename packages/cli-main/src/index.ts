import {runCLI, useLocalCLIIfDetected, setupEnvironmentVariables} from '@shopify/cli-kit/node/cli'

interface RunShopifyCLIOptions {
  development: boolean
}

async function runShopifyCLI({development}: RunShopifyCLIOptions) {
  setupEnvironmentVariables({development})

  if (!development) {
    // If we run a local CLI instead, don't run the global one again after!
    const ranLocalInstead = await useLocalCLIIfDetected(import.meta.url)
    if (ranLocalInstead) {
      return
    }
  }

  await runCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runShopifyCLI
