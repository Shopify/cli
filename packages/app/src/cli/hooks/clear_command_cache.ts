import {clearCachedCommandInfo} from '../services/local-storage.js'
import {Hook} from '@oclif/core'

const clearCommandCache: Hook<'init'> = async (options) => {
  clearCachedCommandInfo()
}

export default clearCommandCache
