import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateHydrogenCLI(development: boolean) {
  await runCreateCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runCreateHydrogenCLI
