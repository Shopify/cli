import {createConfigExtensionSpecification, TransformationConfig} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosConfigurationSchema = BaseSchemaWithoutHandle.extend({
  pos: zod
    .object({
      embedded: zod.boolean({invalid_type_error: 'Value must be Boolean'}),
    })
    .optional(),
})

export const PosSpecIdentifier = 'point_of_sale'

const PosTransformConfig: TransformationConfig = {
  embedded: 'pos.embedded',
}

const appPOSSpec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
  transformConfig: PosTransformConfig,
})

export default appPOSSpec
