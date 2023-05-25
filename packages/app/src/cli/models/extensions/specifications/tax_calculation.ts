import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const TaxCalculationsSchema = BaseSchema.extend({
  productionApiBaseUrl: zod.string(),
  benchmarkApiBaseUrl: zod.string().optional(),
  calculateTaxesApiEndpoint: zod.string(),
})

const spec = createExtensionSpecification({
  identifier: 'tax_calculation',
  surface: 'admin',
  schema: TaxCalculationsSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    return {
      production_api_base_url: config.productionApiBaseUrl,
      benchmark_api_base_url: config.benchmarkApiBaseUrl,
      calculate_taxes_api_endpoint: config.calculateTaxesApiEndpoint,
      metafields: config.metafields,
    }
  },
})

export default spec
