import {runCLI} from '@shopify/cli-kit/node/cli'

export {useLocalCLIIfDetected} from '@shopify/cli-kit/node/cli'

async function runShopifyCLI(development: boolean) {
  await runCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runShopifyCLI
