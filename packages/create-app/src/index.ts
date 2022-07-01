import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateAppCLI() {
  await runCreateCLI('app', {
    moduleURL: import.meta.url,
    logFilename: 'shopify.create-app.log',
  })
}

export default runCreateAppCLI
