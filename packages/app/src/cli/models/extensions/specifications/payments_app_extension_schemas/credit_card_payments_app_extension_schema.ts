import {
  BasePaymentsAppExtensionSchema,
  BasePaymentsAppExtensionDeployConfigType,
  ConfirmationSchema,
  DeferredPaymentsSchema,
  MultipleCaptureSchema,
} from './base_payments_app_extension_schema.js'
import {ExtensionRegistration} from '../../../../api/graphql/all_app_extension_registrations.js'
import {extensionUuidToHandle} from '../transform/extension_uuid_to_handle.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type CreditCardPaymentsAppExtensionConfigType = zod.infer<typeof CreditCardPaymentsAppExtensionSchema>

export const CREDIT_CARD_TARGET = 'payments.credit-card.render'

export const CreditCardPaymentsAppExtensionSchema = BasePaymentsAppExtensionSchema.merge(DeferredPaymentsSchema)
  .merge(ConfirmationSchema)
  .merge(MultipleCaptureSchema)
  .required({
    refund_session_url: true,
    capture_session_url: true,
    void_session_url: true,
  })
  .extend({
    targeting: zod.array(zod.object({target: zod.literal(CREDIT_CARD_TARGET)})).length(1),
    verification_session_url: zod.string().url().optional(),
    ui_extension_handle: zod.string().optional(),
    encryption_certificate_fingerprint: zod.string().optional(),
    checkout_payment_method_fields: zod
      .array(
        zod.object({
          type: zod.union([zod.literal('string'), zod.literal('number'), zod.literal('boolean')]),
          required: zod.boolean(),
          key: zod.string(),
        }),
      )
      .optional(),
  })
  .refine((schema) => !schema.supports_3ds || schema.confirmation_callback_url, {
    message: 'Property required when supports_3ds is true',
    path: ['confirmation_callback_url'],
  })
  .refine((schema) => schema.supports_installments === schema.supports_deferred_payments, {
    message: 'supports_installments and supports_deferred_payments must be the same',
  })

export interface CreditCardPaymentsAppExtensionDeployConfigType extends BasePaymentsAppExtensionDeployConfigType {
  // Following are overwritten as they are required for credit card extensions
  start_refund_session_url: string
  start_capture_session_url: string
  start_void_session_url: string

  // MultipleCaptureSchema
  multiple_capture?: boolean

  // DeferredPaymentsSchema
  supports_deferred_payments: boolean
  supports_installments: boolean

  // ConfirmationSchema
  confirmation_callback_url?: string
  supports_3ds: boolean

  // CreditCard-specific fields
  start_verification_session_url?: string
  ui_extension_registration_uuid?: string
  ui_extension_handle?: string
  encryption_certificate?: {
    fingerprint: string
    certificate: string
  }
  checkout_payment_method_fields?: {
    type: 'string' | 'number' | 'boolean'
    required: boolean
    key: string
  }[]
}

export function creditCardDeployConfigToCLIConfig(
  config: CreditCardPaymentsAppExtensionDeployConfigType,
  allExtensions: ExtensionRegistration[],
): Omit<CreditCardPaymentsAppExtensionConfigType, 'name' | 'type' | 'metafields' | 'targeting'> | undefined {
  const uiExtensionHandle = extensionUuidToHandle(config, allExtensions)

  return {
    api_version: config.api_version,
    payment_session_url: config.start_payment_session_url,
    refund_session_url: config.start_refund_session_url,
    capture_session_url: config.start_capture_session_url,
    void_session_url: config.start_void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    multiple_capture: config.multiple_capture,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    supports_installments: config.supports_installments,
    verification_session_url: config.start_verification_session_url,
    encryption_certificate_fingerprint: config.encryption_certificate?.fingerprint,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    ui_extension_handle: uiExtensionHandle,
  }
}

export async function creditCardPaymentsAppExtensionDeployConfig(
  config: CreditCardPaymentsAppExtensionConfigType,
): Promise<{[key: string]: unknown} | undefined> {
  return {
    api_version: config.api_version,
    start_payment_session_url: config.payment_session_url,
    start_refund_session_url: config.refund_session_url,
    start_capture_session_url: config.capture_session_url,
    start_void_session_url: config.void_session_url,
    confirmation_callback_url: config.confirmation_callback_url,
    multiple_capture: config.multiple_capture,
    merchant_label: config.merchant_label,
    supported_countries: config.supported_countries,
    supported_payment_methods: config.supported_payment_methods,
    test_mode_available: config.test_mode_available,
    supports_3ds: config.supports_3ds,
    supports_deferred_payments: config.supports_deferred_payments,
    encryption_certificate_fingerprint: config.encryption_certificate_fingerprint,
    supports_installments: config.supports_installments,
    start_verification_session_url: config.verification_session_url,
    checkout_payment_method_fields: config.checkout_payment_method_fields,
    ui_extension_handle: config.ui_extension_handle,
  }
}
