import metadata from '../metadata.js'
import {logAppContextMetadataIfAuthenticated} from '../services/app-context.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins'
import {cwd} from '@shopify/cli-kit/node/path'

const gatherPublicMetadata: FanoutHookFunction<'public_command_metadata', '@shopify/app'> = async () => {
  await logAppContextMetadataIfAuthenticated(cwd())
  return metadata.getAllPublicMetadata()
}

export default gatherPublicMetadata
