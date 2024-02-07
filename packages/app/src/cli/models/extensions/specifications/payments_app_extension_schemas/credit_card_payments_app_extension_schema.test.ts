import {
  CreditCardPaymentsAppExtensionConfigType,
  CreditCardPaymentsAppExtensionSchema,
  creditCardPaymentsAppExtensionDeployConfig,
} from './credit_card_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: CreditCardPaymentsAppExtensionConfigType = {
  name: 'test extension',
  type: 'payments_extension',
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  verification_session_url: 'http://foo.bar',
  confirmation_callback_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['PAYMENT_METHOD'],
  supports_3ds: false,
  test_mode_available: true,
  supports_deferred_payments: false,
  supports_installments: false,
  targeting: [{target: 'payments.credit-card.render'}],
  api_version: '2022-07',
  description: 'my payments app extension',
  metafields: [],
  ui_extension_handle: 'sample-ui-extension',
  encryption_certificate: {
    fingerprint: 'fingerprint',
    certificate: '-----BEGIN CERTIFICATE-----\nSample certificate\n-----END CERTIFICATE-----',
  },
  checkout_payment_method_fields: [{type: 'string', required: false, key: 'sample_key'}],
  input: {
    metafield_identifiers: {
      namespace: 'namespace',
      key: 'key',
    },
  },
}

describe('CreditCardPaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = CreditCardPaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: 'payments.credit-card.render',
          path: ['targeting', 0, 'target'],
          message: 'Invalid literal value, expected "payments.credit-card.render"',
        },
      ]),
    )
  })

  test('returns an error if no confirmation_callback_url is provided with supports 3ds', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_3ds: true,
        confirmation_callback_url: undefined,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          message: 'Property required when supports_3ds is true',
          path: ['confirmation_callback_url'],
        },
      ]),
    )
  })

  test('returns an error if encryption_certificate has invalid format', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        encryption_certificate: {
          fingerprint: 'fingerprint',
          certificate: 'invalid certificate',
        },
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          validation: 'regex',
          code: zod.ZodIssueCode.invalid_string,
          message: 'Invalid',
          path: ['encryption_certificate', 'certificate'],
        },
      ]),
    )
  })

  test('returns an error if supports_installments does not match supports_deferred_payments', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
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

describe('creditCardPaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await creditCardPaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      start_verification_session_url: config.verification_session_url,
      confirmation_callback_url: config.confirmation_callback_url,
      merchant_label: config.merchant_label,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      test_mode_available: config.test_mode_available,
      supports_3ds: config.supports_3ds,
      supports_deferred_payments: config.supports_deferred_payments,
      supports_installments: config.supports_installments,
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      ui_extension_handle: config.ui_extension_handle,
    })
  })
})
