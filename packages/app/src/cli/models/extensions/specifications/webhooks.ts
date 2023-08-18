import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const spec = createExtensionSpecification({
  identifier: 'webhooks',
  schema: BaseSchema.extend({
    http: zod.any(),
    pub_sub: zod.any(),
    event_bridge: zod.any(),
  }),
  appModuleFeatures: (_) => [],
  deployConfig: async (config) => {
    return {
      http: config.http || [],
      pub_sub: config.pub_sub || [],
      event_bridge: config.event_bridge || [],
      handle: config.handle,
    }
  },
})

export default spec
