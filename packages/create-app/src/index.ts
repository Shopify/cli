import {constants} from '@shopify/cli-kit'
import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateAppCLI() {
  await runCreateCLI({
    moduleURL: import.meta.url,
    logFilename: constants.logStreams.createApp,
  })
}

export default runCreateAppCLI
