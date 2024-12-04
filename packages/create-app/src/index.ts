import {commands} from '@shopify/app'
import {runCreateCLI} from '@shopify/cli-kit/node/cli'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'

async function runCreateAppCLI(development: boolean) {
  await runCreateCLI(
    {
      moduleURL: import.meta.url,
      development,
    },
    launchCLI,
  )
}

export const COMMANDS: unknown = {
  init: commands['app:init'],
}

export default runCreateAppCLI
