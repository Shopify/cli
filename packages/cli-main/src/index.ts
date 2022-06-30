import {constants} from '@shopify/cli-kit'
import {runCLI} from '@shopify/cli-kit/node/cli'

async function runShopifyCLI() {
  await runCLI({
    moduleURL: import.meta.url,
    logFilename: constants.logStreams.cli,
  })
}

export default runShopifyCLI
