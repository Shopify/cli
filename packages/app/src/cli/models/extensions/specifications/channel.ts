import {createExtensionSpecification} from '../specification.js'
import {BaseSchemaWithHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'

const ChannelSpecificationSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('channel_config'),
  name: zod.string().optional(),
  channel_requirements: zod.any(),
})

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml']

// Generate glob patterns for all supported file types
const getGlobPatterns = () => FILE_EXTENSIONS.map((ext) => joinPath(SUBDIRECTORY_NAME, '**', `*.${ext}`))

const channelSpecificationSpec = createExtensionSpecification({
  identifier: 'channel_config',
  schema: ChannelSpecificationSchema,
  buildConfig: {mode: 'copy_files', filePatterns: getGlobPatterns()},
  appModuleFeatures: () => [],
  deployConfig: async (config, directory) => {
    return {
      handle: config.handle,
      name: config.name,
      specifications,
      channel_requirements: config.channel_requirements,
    }
  },
})

export default channelSpecificationSpec
