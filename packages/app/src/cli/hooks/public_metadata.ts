import metadata from '../metadata.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins'

const gatherPublicMetadata: FanoutHookFunction<'public_command_metadata', '@shopify/app'> = async () => {
  return metadata.getAllPublic()
}

export default gatherPublicMetadata
