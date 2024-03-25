import {configFromSerializedFields} from '../flow/serialize-partners-fields.js'
import {FlowPartnersExtensionTypes} from '../flow/types.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface PaymentsAppExtensionConfig {
  update_payment_session_url: string
  modal_payment_method_fields: {
    type: string
    required: boolean
    key: string
  }[]

  checkout_hosted_fields: string[]

  balance_url: string
  redeemable_type: string

  merchant_label: string
  start_payment_session_url: string
  start_refund_session_url: string
  start_capture_session_url: string
  start_void_session_url: string
  confirmation_callback_url: string
  supported_countries: string[]
  supported_payment_methods: string[]
  supports_3ds: boolean
  supports_installments: boolean
  supports_deferred_payments: boolean
  supports_oversell_protection: boolean
  buyer_label_to_locale: {
    locale: string
    label: string
  }[]
  start_verification_session_url: string
  test_mode_available: boolean
  api_version: string
  encryption_certificate: {
    filgerprint: string
    certificate: string
  }
  multiple_capture: boolean
  ui_extension_registration_uuid: string
  checkout_payment_method_fields: {
    type: string
    required: boolean
    key: string
  }[]
  default_buyer_label: string
}

/**
 * Given a dashboard-built payments extension config file, convert it to toml for the CLI extension
 * Works for both trigger and action because trigger config is a subset of action config
 */
export function buildTomlObject(extension: ExtensionRegistration) {
  const version = extension.activeVersion ?? extension.draftVersion
  const versionConfig = version?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: PaymentsAppExtensionConfig = JSON.parse(versionConfig)

  const fields = configFromSerializedFields(extension.type as FlowPartnersExtensionTypes, config.fields ?? [])

  const defaultURL = extension.type === 'flow_action_definition' ? 'https://url.com/api/execute' : undefined

  const localExtensionRepresentation = {
    extensions: [
      {
        name: config.title,
        type: 'payments_extension',
        handle: slugify(extension.title),
        context: handle_to_context(extension.handle),
        description: config.description,
        runtime_url: config.url ?? defaultURL,
        config_page_url: config.custom_configuration_page_url,
        config_page_preview_url: config.custom_configuration_page_preview_url,
        validation_url: config.validation_url,
      },
    ],
    settings: (fields?.length ?? 0) > 0 ? {fields} : undefined,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
