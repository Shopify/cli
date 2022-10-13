import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateAppCLI(development: boolean) {
  await runCreateCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export default runCreateAppCLI
