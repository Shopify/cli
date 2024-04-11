import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {BasePaymentsAppExtensionDeployConfigType} from '../../models/extensions/specifications/payments_app_extension_schemas/base_payments_app_extension_schema.js'
import {
  RedeemablePaymentsAppExtensionDeployConfigType,
  redeemableDeployConfigToCLIConfig,
  REDEEMABLE_TARGET,
} from '../../models/extensions/specifications/payments_app_extension_schemas/redeemable_payments_app_extension_schema.js'
import {
  OffsitePaymentsAppExtensionDeployConfigType,
  offsiteDeployConfigToCLIConfig,
  OFFSITE_TARGET,
} from '../../models/extensions/specifications/payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {
  CustomCreditCardPaymentsAppExtensionDeployConfigType,
  customCreditCardDeployConfigToCLIConfig,
  CUSTOM_CREDIT_CARD_TARGET,
} from '../../models/extensions/specifications/payments_app_extension_schemas/custom_credit_card_payments_app_extension_schema.js'
import {
  CreditCardPaymentsAppExtensionDeployConfigType,
  creditCardDeployConfigToCLIConfig,
  CREDIT_CARD_TARGET,
} from '../../models/extensions/specifications/payments_app_extension_schemas/credit_card_payments_app_extension_schema.js'
import {
  CustomOnsitePaymentsAppExtensionDeployConfigType,
  customOnsiteDeployConfigToCLIConfig,
  CUSTOM_ONSITE_TARGET,
} from '../../models/extensions/specifications/payments_app_extension_schemas/custom_onsite_payments_app_extension_schema.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

function typeToContext(type: string) {
  switch (type) {
    case DashboardPaymentExtensionType.Offsite:
      return OFFSITE_TARGET
    case DashboardPaymentExtensionType.CreditCard:
      return CREDIT_CARD_TARGET
    case DashboardPaymentExtensionType.CustomCreditCard:
      return CUSTOM_CREDIT_CARD_TARGET
    case DashboardPaymentExtensionType.CustomOnsite:
      return CUSTOM_ONSITE_TARGET
    case DashboardPaymentExtensionType.Redeemable:
      return REDEEMABLE_TARGET
  }
}
export enum DashboardPaymentExtensionType {
  Offsite = 'payments_app',
  CreditCard = 'payments_app_credit_card',
  CustomCreditCard = 'payments_app_custom_credit_card',
  CustomOnsite = 'payments_app_custom_onsite',
  Redeemable = 'payments_app_redeemable',
}

export function buildTomlObject(extension: ExtensionRegistration, allExtensions: ExtensionRegistration[]): string {
  const context = extension.activeVersion?.context || extension.draftVersion?.context || typeToContext(extension.type)
  switch (context) {
    case OFFSITE_TARGET:
      return buildPaymentsToml<OffsitePaymentsAppExtensionDeployConfigType>(
        extension,
        allExtensions,
        offsiteDeployConfigToCLIConfig,
      )
    case CREDIT_CARD_TARGET:
      return buildPaymentsToml<CreditCardPaymentsAppExtensionDeployConfigType>(
        extension,
        allExtensions,
        creditCardDeployConfigToCLIConfig,
      )
    case CUSTOM_CREDIT_CARD_TARGET:
      return buildPaymentsToml<CustomCreditCardPaymentsAppExtensionDeployConfigType>(
        extension,
        allExtensions,
        customCreditCardDeployConfigToCLIConfig,
      )
    case CUSTOM_ONSITE_TARGET:
      return buildPaymentsToml<CustomOnsitePaymentsAppExtensionDeployConfigType>(
        extension,
        allExtensions,
        customOnsiteDeployConfigToCLIConfig,
      )
    case REDEEMABLE_TARGET:
      return buildPaymentsToml<RedeemablePaymentsAppExtensionDeployConfigType>(
        extension,
        allExtensions,
        redeemableDeployConfigToCLIConfig,
      )
    default:
      throw new Error(`Unsupported extension: ${context}`)
  }
}
/**
 * Given a dashboard-built payments extension config file, convert it to toml for the CLI extension
 */
function buildPaymentsToml<T extends BasePaymentsAppExtensionDeployConfigType>(
  extension: ExtensionRegistration,
  allExtensions: ExtensionRegistration[],
  serialize: (config: T, allExtensions: ExtensionRegistration[]) => {[key: string]: unknown} | undefined,
) {
  const version = extension.activeVersion ?? extension.draftVersion
  const versionConfig = version?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const dashboardConfig: T = JSON.parse(versionConfig)

  const cliConfig = serialize(dashboardConfig, allExtensions)
  if (cliConfig) delete cliConfig.api_version

  const context = extension.activeVersion?.context || extension.draftVersion?.context || typeToContext(extension.type)

  const localExtensionRepresentation = {
    api_version: dashboardConfig.api_version,
    extensions: [
      {
        name: extension.title,
        type: 'payments_extension',
        handle: slugify(extension.title),
        ...cliConfig,
        targeting: [
          {
            target: `${context}`,
          },
        ],
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
