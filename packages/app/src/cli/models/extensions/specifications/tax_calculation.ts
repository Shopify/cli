import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const TaxCalculationsSchema = BaseSchema.extend({
  production_api_base_url: zod.string(),
  benchmark_api_base_url: zod.string().optional(),
  calculate_taxes_api_endpoint: zod.string(),
  input: zod
    .object({
      metafield_identifiers: zod
        .object({
          namespace: zod.string(),
          key: zod.string(),
        })
        .optional(),
    })
    .optional(),
  metafields: zod.array(MetafieldSchema).optional(),
})

const spec = createExtensionSpecification({
  identifier: 'tax_calculation',
  schema: TaxCalculationsSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    const typedConfig = config as zod.infer<typeof TaxCalculationsSchema>
    return {
      production_api_base_url: typedConfig.production_api_base_url,
      benchmark_api_base_url: typedConfig.benchmark_api_base_url,
      calculate_taxes_api_endpoint: typedConfig.calculate_taxes_api_endpoint,
      metafields: typedConfig.metafields,
      api_version: typedConfig.api_version,
      metafield_identifiers: typedConfig.input?.metafield_identifiers,
    }
  },
})

export default spec
