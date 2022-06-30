import {constants} from '@shopify/cli-kit'
import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateHydrogenCLI() {
  await runCreateCLI({
    moduleURL: import.meta.url,
    logFilename: constants.logStreams.createHydrogen,
  })
}

export default runCreateHydrogenCLI
