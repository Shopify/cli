import metadata from '../metadata.js'
import {logAppContextMetadataIfAuthenticated} from '../services/app-context.js'
import {FanoutHookFunction} from '@shopify/cli-kit/node/plugins'
import {cwd} from '@shopify/cli-kit/node/path'

const gatherPublicMetadata: FanoutHookFunction<'public_command_metadata', '@shopify/app'> = async () => {
  // Runs for every CLI command. Best-effort: if the user is logged in and is inside an
  // app project, attach api_key/project_type so commands that don't otherwise load an
  // app (search, fetch-doc, version, …) still report the app context they ran in.
  await logAppContextMetadataIfAuthenticated(cwd())
  return metadata.getAllPublicMetadata()
}

export default gatherPublicMetadata
