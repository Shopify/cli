import {createConfigurationExtensionSpecification} from '../configurations.js'
import {BaseConfigurationExtensionSchema} from '../schemas.js'
import {schema} from '@shopify/cli-kit/node/schema'

const TaxCalculationSchema = BaseConfigurationExtensionSchema.extend({
  productionBaseApiUrl: schema.string(),
  benchmarkBaseApiUrl: schema.string().optional(),
  calculateTaxesApiEndpoint: schema.string(),
})

const spec = createConfigurationExtensionSpecification({
  identifier: 'tax_calculations',
  surface: 'admin',
  schema: TaxCalculationSchema,
  deployConfig: async (config, _) => {
    return {
      production_base_api_url: config.productionBaseApiUrl,
      benchmark_base_api_url: config.benchmarkBaseApiUrl,
      calculate_taxes_api_endpoint: config.calculateTaxesApiEndpoint,
    }
  },
})

export default spec
