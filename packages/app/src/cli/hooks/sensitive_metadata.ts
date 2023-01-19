import metadata from '../metadata.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins.js'

const gatherSensitiveMetadata: FanoutHookFunction<'sensitive_command_metadata', '@shopify/app'> = async () => {
  return metadata.getAllSensitive()
}

export default gatherSensitiveMetadata
