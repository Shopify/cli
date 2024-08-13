import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {Hook} from '@oclif/core'
import {clearCachedCommandInfo} from '@shopify/cli-kit/node/command-cache'

const init: Hook<'init'> = async (_options) => {
  clearCachedCommandInfo()

  // we want our cache to never collide when commands are running in parallel, so we set it on the current process
  process.env.COMMAND_RUN_ID = randomUUID()
}

export default init
