import {createExtensionSpecification} from '../specification.js'
import {BaseSchemaWithHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ChannelSpecificationSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('channel_specification'),
  name: zod.string().optional(),
})

const channelSpecificationSpec = createExtensionSpecification({
  identifier: 'channel_specification',
  schema: ChannelSpecificationSchema,
  appModuleFeatures: () => ['bundling'],
  deployConfig: async (config, _directory) => {
    return {
      handle: config.handle,
      name: config.name,
    }
  },
})

export default channelSpecificationSpec
