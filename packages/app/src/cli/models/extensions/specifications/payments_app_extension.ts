import {
  OffsitePaymentsAppExtensionConfigType,
  OffsitePaymentsAppExtensionSchema,
  offsitePaymentsAppExtensionDeployConfig,
  OFFSITE_TARGET,
} from './payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {
  REDEEMABLE_TARGET,
  RedeemablePaymentsAppExtensionConfigType,
  redeemablePaymentsAppExtensionDeployConfig,
  RedeemablePaymentsAppExtensionSchema,
} from './payments_app_extension_schemas/redeemable_payments_app_extension_schema.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PaymentsAppExtensionSchema = zod.union([OffsitePaymentsAppExtensionSchema, RedeemablePaymentsAppExtensionSchema])

export type PaymentsAppExtensionConfigType = zod.infer<typeof PaymentsAppExtensionSchema>

const spec = createExtensionSpecification({
  identifier: 'payments_extension',
  schema: PaymentsAppExtensionSchema,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    if (config.targeting[0]!.target === OFFSITE_TARGET) {
      return offsitePaymentsAppExtensionDeployConfig(config as OffsitePaymentsAppExtensionConfigType)
    } else if (config.targeting[0]!.target === REDEEMABLE_TARGET) {
      return redeemablePaymentsAppExtensionDeployConfig(config as RedeemablePaymentsAppExtensionConfigType)
    }

    return {}
  },
})

export default spec
