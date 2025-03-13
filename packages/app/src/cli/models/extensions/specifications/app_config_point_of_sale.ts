import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const PosSpecIdentifier = 'point_of_sale'

// name & type are not required for point of sale
// They are added just to conform to the BaseConfigType interface and have strongly typed functions.
// They are ignored when deploying by the `transformConfig` function.
const PosConfigurationSchema = zod.object({
  name: zod.string().optional().default(PosSpecIdentifier),
  type: zod.string().optional().default(PosSpecIdentifier),
  pos: zod
    .object({
      embedded: zod.boolean({invalid_type_error: 'Value must be Boolean'}),
    })
    .optional(),
})

const PosTransformConfig: TransformationConfig = {
  embedded: 'pos.embedded',
}

const appPOSSpec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
  transformConfig: PosTransformConfig,
})

export default appPOSSpec
