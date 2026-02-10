import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const CartLinePropertySchema = zod.object({
  key: zod.string(),
})

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
  cart_line_properties: zod.array(CartLinePropertySchema).optional(),
})

const spec = createExtensionSpecification({
  identifier: 'tax_calculation',
  schema: TaxCalculationsSchema,
  appModuleFeatures: (_) => [],
  buildConfig: {
    mode: 'tax_calculation',
    steps: [{id: 'create-tax-stub', displayName: 'Create Tax Stub', type: 'create_tax_stub', config: {}}],
    stopOnError: true,
  },
  deployConfig: async (config, _) => {
    return {
      production_api_base_url: config.production_api_base_url,
      benchmark_api_base_url: config.benchmark_api_base_url,
      calculate_taxes_api_endpoint: config.calculate_taxes_api_endpoint,
      metafields: config.metafields,
      cart_line_properties: config.cart_line_properties,
      api_version: config.api_version,
      metafield_identifiers: config.input?.metafield_identifiers,
    }
  },
})

export default spec
