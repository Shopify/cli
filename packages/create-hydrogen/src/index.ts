import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateHydrogenCLI() {
  await runCreateCLI({
    moduleURL: import.meta.url,
  })
}

export default runCreateHydrogenCLI
