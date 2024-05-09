import {
  OffsitePaymentsAppExtensionConfigType,
  OffsitePaymentsAppExtensionSchema,
  offsitePaymentsAppExtensionDeployConfig,
} from './offsite_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: OffsitePaymentsAppExtensionConfigType = {
  name: 'test extension',
  type: 'payments_extension',
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  confirmation_callback_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['PAYMENT_METHOD'],
  supported_buyer_contexts: [
    {currency: 'USD'},
    {currency: 'CAD', countries: ['CA']},
    {currency: 'EUR', countries: ['DE', 'FR']},
  ],
  supports_3ds: false,
  supports_oversell_protection: false,
  test_mode_available: true,
  supports_deferred_payments: false,
  supports_installments: false,
  targeting: [{target: 'payments.offsite.render'}],
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

describe('OffsitePaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = OffsitePaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      OffsitePaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: 'payments.offsite.render',
          path: ['targeting', 0, 'target'],
          message: 'Invalid literal value, expected "payments.offsite.render"',
        },
      ]),
    )
  })

  test('returns an error if no confirmation_callback_url is provided with supports oversell protection', async () => {
    // When/Then
    expect(() =>
      OffsitePaymentsAppExtensionSchema.parse({
        ...config,
        supports_oversell_protection: true,
        confirmation_callback_url: undefined,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          message: 'Property required when supports_oversell_protection is true',
          path: ['confirmation_callback_url'],
        },
      ]),
    )
  })

  test('returns an error if buyer_label_translations has invalid format', async () => {
    // When/Then
    expect(() =>
      OffsitePaymentsAppExtensionSchema.parse({
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

  test('returns an error if supports_installments does not match supports_deferred_payments', async () => {
    // When/Then
    expect(() =>
      OffsitePaymentsAppExtensionSchema.parse({
        ...config,
        supports_installments: true,
        supports_deferred_payments: false,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          message: 'supports_installments and supports_deferred_payments must be the same',
          path: [],
        },
      ]),
    )
  })
})

describe('offsitePaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await offsitePaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      confirmation_callback_url: config.confirmation_callback_url,
      merchant_label: config.merchant_label,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      supported_buyer_contexts: config.supported_buyer_contexts,
      test_mode_available: config.test_mode_available,
      default_buyer_label: config.buyer_label,
      buyer_label_to_locale: config.buyer_label_translations,
      supports_oversell_protection: config.supports_oversell_protection,
      supports_3ds: config.supports_3ds,
      supports_deferred_payments: config.supports_deferred_payments,
      supports_installments: config.supports_installments,
    })
  })
})
