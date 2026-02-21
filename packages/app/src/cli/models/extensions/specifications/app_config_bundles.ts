import {createConfigExtensionSpecification, TransformationConfig} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BundlesConfigurationSchema = BaseSchemaWithoutHandle.extend({
  bundles: zod
    .object({
      purchase_options: zod.boolean({invalid_type_error: 'Value must be Boolean'}),
    })
    .optional(),
})

export const BundlesSpecIdentifier = 'bundles'

const BundlesTransformConfig: TransformationConfig = {
  purchase_options: 'bundles.purchase_options',
}

const appBundlesSpec = createConfigExtensionSpecification({
  identifier: BundlesSpecIdentifier,
  schema: BundlesConfigurationSchema,
  transformConfig: BundlesTransformConfig,
})

export default appBundlesSpec
