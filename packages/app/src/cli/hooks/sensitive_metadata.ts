import metadata from '../metadata.js'
import {plugins} from '@shopify/cli-kit'

const gatherSensitiveMetadata: plugins.FanoutHookFunction<'sensitive_command_metadata', '@shopify/app'> = async () => {
  return metadata.getAllSensitive()
}

export default gatherSensitiveMetadata
