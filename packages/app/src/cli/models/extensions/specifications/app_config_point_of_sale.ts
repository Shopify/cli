import {createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const PosSpecIdentifier = 'point_of_sale'

const PosConfigurationSchema = BaseSchema.extend({
  name: zod.string().optional().default(PosSpecIdentifier),
  type: zod.string().optional().default(PosSpecIdentifier),
  pos: zod
    .object({
      embedded: zod.boolean({invalid_type_error: 'Value must be Boolean'}),
    })
    .optional(),
})

const appPOSSpec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
})

export default appPOSSpec
