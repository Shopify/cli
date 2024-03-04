import {
  CustomOnsitePaymentsAppExtensionConfigType,
  CustomOnsitePaymentsAppExtensionSchema,
  customOnsitePaymentsAppExtensionDeployConfig,
} from './custom_onsite_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: CustomOnsitePaymentsAppExtensionConfigType = {
  name: 'CustomOnsite extension',
  type: 'payments_extension',
  targeting: [{target: 'payments.custom-onsite.render'}],
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  confirmation_callback_url: 'http://foo.bar',
  update_payment_session_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['visa'],
  supports_oversell_protection: true,
  supports_3ds: true,
  supports_installments: true,
  supports_deferred_payments: true,
  test_mode_available: true,
  multiple_capture: true,
  api_version: '2022-07',
  checkout_payment_method_fields: [],
  modal_payment_method_fields: [],
  description: 'Custom onsite extension',
  ui_extension_handle: 'sample-ui-extension',
  metafields: [],
  input: {
    metafield_identifiers: {
      namespace: 'namespace',
      key: 'key',
    },
  },
}

describe('CustomOnsitePaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = CustomOnsitePaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      CustomOnsitePaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: 'payments.custom-onsite.render',
          path: ['targeting', 0, 'target'],
          message: 'Invalid literal value, expected "payments.custom-onsite.render"',
        },
      ]),
    )
  })

  test('returns an error if buyer_label_translations has invalid format', async () => {
    // When/Then
    expect(() =>
      CustomOnsitePaymentsAppExtensionSchema.parse({
        ...config,
        buyer_label_translations: [{label: 'Translation without locale key'}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: ['buyer_label_translations', 0, 'locale'],
          message: 'Required',
        },
      ]),
    )
  })
})

describe('customOnsitePaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await customOnsitePaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      confirmation_callback_url: config.confirmation_callback_url,
      update_payment_session_url: config.update_payment_session_url,
      merchant_label: config.merchant_label,
      supports_oversell_protection: config.supports_oversell_protection,
      supports_3ds: config.supports_3ds,
      supports_installments: config.supports_installments,
      supports_deferred_payments: config.supports_deferred_payments,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      test_mode_available: config.test_mode_available,
      multiple_capture: config.multiple_capture,
      default_buyer_label: config.buyer_label,
      buyer_label_to_locale: config.buyer_label_translations,
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      modal_payment_method_fields: config.modal_payment_method_fields,
      ui_extension_handle: config.ui_extension_handle,
    })
  })
})
