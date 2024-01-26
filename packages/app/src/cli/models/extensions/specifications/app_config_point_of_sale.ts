import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosConfigurationSchema = zod.object({
  pos: zod
    .object({
      embedded: zod.boolean(),
    })
    .optional(),
})

export const PosSpecIdentifier = 'point_of_sale'

const spec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
})

export default spec
