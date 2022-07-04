import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateHydrogenCLI() {
  await runCreateCLI({
    moduleURL: import.meta.url,
    logFilename: 'shopify.create-hydrogen.log',
  })
}

export default runCreateHydrogenCLI
