import {
  OffsitePaymentsAppExtensionSchema,
  offsitePaymentsAppExtensionDeployConfig,
} from './payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

// NOTE: SamplePaymentsAppExtensionSchema is used since zod doesn't accept a single-element union. It will be removed
// once we add a second schema for another payment app type.
const SamplePaymentsAppExtensionSchema = BaseSchema.extend({
  target: zod.literal('sample'),
})

const PaymentsAppExtensionSchema = zod.union([OffsitePaymentsAppExtensionSchema, SamplePaymentsAppExtensionSchema])

export type PaymentsAppExtensionConfigType = zod.infer<typeof PaymentsAppExtensionSchema>

const spec = createExtensionSpecification({
  identifier: 'payments_extension',
  schema: PaymentsAppExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    if (config.target === 'payments.offsite.render') {
      return offsitePaymentsAppExtensionDeployConfig(config)
    }

    return {}
  },
})

export default spec
