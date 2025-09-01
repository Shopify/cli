import {createExtensionSpecification} from '../specification.js'
import {BaseSchemaWithHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'

const ChannelSpecificationSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('channel_specification'),
  name: zod.string().optional(),
})

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml', 'svg']

// Generate glob patterns for all supported file types
const getGlobPatterns = () => FILE_EXTENSIONS.map((ext) => joinPath(SUBDIRECTORY_NAME, '**', `*.${ext}`))

const channelSpecificationSpec = createExtensionSpecification({
  identifier: 'channel_specification',
  schema: ChannelSpecificationSchema,
  buildConfig: {mode: 'copy_files', filePatterns: getGlobPatterns()},
  appModuleFeatures: () => [],
  deployConfig: async (config, _directory) => {
    return {
      handle: config.handle,
      name: config.name,
      channel_requirements: config.channel_requirements,
    }
  },
})

export default channelSpecificationSpec
