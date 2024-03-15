import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosConfigurationSchema = zod.object({
  pos: zod
    .object({
      embedded: zod.boolean({invalid_type_error: 'Value must be Boolean'}),
    })
    .optional(),
})

export const PosSpecIdentifier = 'point_of_sale'

const appPOSSpec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
})

export default appPOSSpec
