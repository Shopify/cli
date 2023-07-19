import {clearCachedCommandInfo} from '../services/local-storage.js'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {Hook} from '@oclif/core'

const init: Hook<'init'> = async (options) => {
  clearCachedCommandInfo()
  process.env.COMMAND_RUN_ID = randomUUID()
}

export default init
