import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const spec = createExtensionSpecification({
  identifier: 'webhooks',
  schema: BaseSchema.extend({
    http: zod.any(),
  }),
  appModuleFeatures: (_) => [],
  deployConfig: async (config) => {
    return {
      http: [],
    }
  },
})

export default spec
