import {runCLI} from '@shopify/cli-kit/node/cli'

export {useLocalCLIIfDetected} from '@shopify/cli-kit/node/cli'

interface RunShopifyCLIOptions {
  development: boolean
}

async function runShopifyCLI({development}: RunShopifyCLIOptions) {
  await runCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runShopifyCLI
