import metadata from '../metadata.js'
import {FanoutHookFunction} from '@shopify/cli-kit/shared/node/plugins'

const gatherPublicMetadata: FanoutHookFunction<'public_command_metadata', '@shopify/app'> = async () => {
  return metadata.getAllPublicMetadata()
}

export default gatherPublicMetadata
