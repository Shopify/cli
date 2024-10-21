import {commands} from '@shopify/app'
import {runCreateCLI} from '@shopify/cli-kit/node/cli'

async function runCreateAppCLI(development: boolean) {
  await runCreateCLI({
    moduleURL: import.meta.url,
    development,
  })
}

export const COMMANDS: unknown = {
  init: commands['app:init'],
}

export default runCreateAppCLI
