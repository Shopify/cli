import metadata from '../metadata.js'
import {plugins} from '@shopify/cli-kit'

const gatherPublicMetadata: plugins.FanoutHookFunction<'public_command_metadata', '@shopify/app'> = async () => {
  return metadata.getAllPublic()
}

export default gatherPublicMetadata
