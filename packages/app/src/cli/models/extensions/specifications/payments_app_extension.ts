import {
  OFFSITE_TARGET,
  OffsitePaymentsAppExtensionConfigType,
  OffsitePaymentsAppExtensionSchema,
  offsitePaymentsAppExtensionDeployConfig,
} from './payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {
  REDEEMABLE_TARGET,
  RedeemablePaymentsAppExtensionConfigType,
  redeemablePaymentsAppExtensionDeployConfig,
  RedeemablePaymentsAppExtensionSchema,
} from './payments_app_extension_schemas/redeemable_payments_app_extension_schema.js'
import {
  CUSTOM_ONSITE_TARGET,
  CustomOnsitePaymentsAppExtensionConfigType,
  customOnsitePaymentsAppExtensionDeployConfig,
  CustomOnsitePaymentsAppExtensionSchema,
} from './payments_app_extension_schemas/custom_onsite_payments_app_extension_schema.js'
import {
  CUSTOM_CREDIT_CARD_TARGET,
  CustomCreditCardPaymentsAppExtensionConfigType,
  customCreditCardPaymentsAppExtensionDeployConfig,
  CustomCreditCardPaymentsAppExtensionSchema,
} from './payments_app_extension_schemas/custom_credit_card_payments_app_extension_schema.js'
import {
  CREDIT_CARD_TARGET,
  CreditCardPaymentsAppExtensionConfigType,
  CreditCardPaymentsAppExtensionSchema,
  creditCardPaymentsAppExtensionDeployConfig,
} from './payments_app_extension_schemas/credit_card_payments_app_extension_schema.js'
import {
  CARD_PRESENT_TARGET,
  CardPresentPaymentsAppExtensionConfigType,
  CardPresentPaymentsAppExtensionSchema,
  cardPresentPaymentsAppExtensionDeployConfig,
} from './payments_app_extension_schemas/card_present_payments_app_extension_schema.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PaymentsAppExtensionSchema = zod.union([
  OffsitePaymentsAppExtensionSchema,
  RedeemablePaymentsAppExtensionSchema,
  CustomOnsitePaymentsAppExtensionSchema,
  CustomCreditCardPaymentsAppExtensionSchema,
  CreditCardPaymentsAppExtensionSchema,
  CardPresentPaymentsAppExtensionSchema,
])

export type PaymentsAppExtensionConfigType = zod.infer<typeof PaymentsAppExtensionSchema>

const paymentExtensionSpec = createExtensionSpecification({
  identifier: 'payments_extension',
  schema: PaymentsAppExtensionSchema,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    const typedConfig = config as PaymentsAppExtensionConfigType
    const target = typedConfig.targeting[0]?.target
    switch (target) {
      case OFFSITE_TARGET:
        return offsitePaymentsAppExtensionDeployConfig(typedConfig as OffsitePaymentsAppExtensionConfigType)
      case REDEEMABLE_TARGET:
        return redeemablePaymentsAppExtensionDeployConfig(typedConfig as RedeemablePaymentsAppExtensionConfigType)
      case CREDIT_CARD_TARGET:
        return creditCardPaymentsAppExtensionDeployConfig(typedConfig as CreditCardPaymentsAppExtensionConfigType)
      case CUSTOM_ONSITE_TARGET:
        return customOnsitePaymentsAppExtensionDeployConfig(typedConfig as CustomOnsitePaymentsAppExtensionConfigType)
      case CUSTOM_CREDIT_CARD_TARGET:
        return customCreditCardPaymentsAppExtensionDeployConfig(
          typedConfig as CustomCreditCardPaymentsAppExtensionConfigType,
        )
      case CARD_PRESENT_TARGET:
        return cardPresentPaymentsAppExtensionDeployConfig(typedConfig as CardPresentPaymentsAppExtensionConfigType)
      default:
        return {}
    }
  },
})

export default paymentExtensionSpec
