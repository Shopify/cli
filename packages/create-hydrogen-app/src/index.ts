import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateHydrogenAppCLI() {
  await runCreateCLI({
    moduleURL: import.meta.url,
    logFilename: 'shopify.create-hydrogen-app.log',
  })
}

export default runCreateHydrogenAppCLI
