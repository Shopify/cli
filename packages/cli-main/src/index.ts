import {runCLI} from '@shopify/cli-kit/node/cli'

export {replaceGlobalCLIWithLocal} from '@shopify/cli-kit/node/cli'

async function runShopifyCLI() {
  await runCLI({
    moduleURL: import.meta.url,
  })
}

export default runShopifyCLI
