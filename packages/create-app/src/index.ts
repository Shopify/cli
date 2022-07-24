import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateAppCLI() {
  await runCreateCLI({
    moduleURL: import.meta.url,
  })
}

export default runCreateAppCLI
