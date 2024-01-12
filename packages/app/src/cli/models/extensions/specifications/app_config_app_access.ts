import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessSchema = zod.object({
  access: zod
    .object({
      direct_api_offline_access: zod.boolean().optional(),
    })
    .optional(),
})
const AppAccessTransformConfig: TransformationConfig = {
  access: 'access',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_access',
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
})

export default spec
