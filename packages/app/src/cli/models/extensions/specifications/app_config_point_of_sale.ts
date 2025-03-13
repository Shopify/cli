import {BaseSchemaForConfig} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const PosSpecIdentifier = 'point_of_sale'

const PosConfigurationSchema = BaseSchemaForConfig.extend({
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
