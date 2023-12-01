import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosConfigurationSchema = zod.object({
  pos: zod
    .object({
      embedded: zod.boolean(),
    })
    .optional(),
})

const spec = createConfigExtensionSpecification({
  identifier: 'pos_configuration',
  schema: PosConfigurationSchema,
})

export default spec
