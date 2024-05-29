import {
  RedeemablePaymentsAppExtensionConfigType,
  RedeemablePaymentsAppExtensionSchema,
  redeemablePaymentsAppExtensionDeployConfig,
} from './redeemable_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: RedeemablePaymentsAppExtensionConfigType = {
  name: 'Redeemable extension',
  type: 'payments_extension',
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  balance_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['gift-card'],
  supported_buyer_contexts: [
    {currency: 'USD'},
    {currency: 'CAD', countries: ['CA']},
    {currency: 'EUR', countries: ['DE', 'FR']},
  ],
  test_mode_available: true,
  ui_extension_handle: 'sample-ui-extension',
  targeting: [{target: 'payments.redeemable.render'}],
  api_version: '2022-07',
  description: 'my payments app extension',
  metafields: [],
  input: {
    metafield_identifiers: {
      namespace: 'namespace',
      key: 'key',
    },
  },
}

describe('RedeemablePaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = RedeemablePaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      RedeemablePaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: 'payments.redeemable.render',
          path: ['targeting', 0, 'target'],
          message: 'Invalid literal value, expected "payments.redeemable.render"',
        },
      ]),
    )
  })

  test('returns an error if buyer_label_translations has invalid format', async () => {
    // When/Then
    expect(() =>
      RedeemablePaymentsAppExtensionSchema.parse({
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

describe('redeemablePaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await redeemablePaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      balance_url: config.balance_url,
      merchant_label: config.merchant_label,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      supported_buyer_contexts: config.supported_buyer_contexts,
      test_mode_available: config.test_mode_available,
      redeemable_type: 'gift_card',
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      default_buyer_label: config.buyer_label,
      buyer_label_to_locale: config.buyer_label_translations,
      ui_extension_handle: config.ui_extension_handle,
    })
  })

  test('maps deploy configuration from extension configuration without payment method', async () => {
    // When
    config.supported_payment_methods = []
    const result = await redeemablePaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      balance_url: config.balance_url,
      merchant_label: config.merchant_label,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      test_mode_available: config.test_mode_available,
      redeemable_type: null,
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      default_buyer_label: config.buyer_label,
      buyer_label_to_locale: config.buyer_label_translations,
      ui_extension_handle: config.ui_extension_handle,
    })
  })
})
