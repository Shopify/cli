import metadata from '../metadata.js'
import {FanoutHookFunction} from '@shopify/cli-kit/shared/node/plugins'

const gatherSensitiveMetadata: FanoutHookFunction<'sensitive_command_metadata', '@shopify/app'> = async () => {
  return metadata.getAllSensitiveMetadata()
}

export default gatherSensitiveMetadata
