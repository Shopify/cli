import {
  CreditCardPaymentsAppExtensionConfigType,
  CreditCardPaymentsAppExtensionSchema,
  MAX_CHECKOUT_PAYMENT_METHOD_FIELDS,
  creditCardPaymentsAppExtensionDeployConfig,
} from './credit_card_payments_app_extension_schema.js'
import {buildCheckoutPaymentMethodFields} from './payments_app_extension_test_helper.js'
import {describe, expect, test} from 'vitest'

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
  supported_buyer_contexts: [{currency: 'USD'}, {currency: 'CAD'}],
  supports_moto: true,
  supports_3ds: false,
  test_mode_available: true,
  supports_deferred_payments: false,
  multiple_capture: false,
  supports_installments: false,
  targeting: [{target: 'payments.credit-card.render'}],
  api_version: '2022-07',
  description: 'my payments app extension',
  metafields: [],
  ui_extension_handle: 'sample-ui-extension',
  encryption_certificate_fingerprint: 'fingerprint',
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
    ).toThrow('payments.credit-card.render')
  })

  test('returns an error if no confirmation_callback_url is provided with supports 3ds', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_3ds: true,
        confirmation_callback_url: undefined,
      }),
    ).toThrow('Property required when supports_3ds is true')
  })

  test('returns an error if encryption certificate fingerprint is blank', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        encryption_certificate_fingerprint: '',
      }),
    ).toThrow("Encryption certificate fingerprint can't be blank")
  })

  test('returns an error if encryption certificate fingerprint is not present', async () => {
    // When/Then
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {encryption_certificate_fingerprint, ...rest} = config
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrow('Required')
  })

  test('returns an error if supports_installments does not match supports_deferred_payments', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_installments: true,
        supports_deferred_payments: false,
      }),
    ).toThrow('supports_installments and supports_deferred_payments must be the same')
  })

  test('returns an error if checkout_payment_method_fields has too many fields', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        checkout_payment_method_fields: buildCheckoutPaymentMethodFields(MAX_CHECKOUT_PAYMENT_METHOD_FIELDS + 1),
      }),
    ).toThrow(`The extension can't have more than ${MAX_CHECKOUT_PAYMENT_METHOD_FIELDS} checkout_payment_method_fields`)
  })

  test('returns an error if supports_moto is not a boolean', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_moto: 'true',
      }),
    ).toThrow('Value must be Boolean')
  })

  test('returns an error if supports_moto is not present', async () => {
    // When/Then
    expect(() =>
      CreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        supports_moto: undefined,
      }),
    ).toThrow('supports_moto is required')
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
      multiple_capture: config.multiple_capture,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      supported_buyer_contexts: config.supported_buyer_contexts,
      test_mode_available: config.test_mode_available,
      supports_moto: config.supports_moto,
      supports_3ds: config.supports_3ds,
      supports_deferred_payments: config.supports_deferred_payments,
      supports_installments: config.supports_installments,
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      ui_extension_handle: config.ui_extension_handle,
      encryption_certificate_fingerprint: config.encryption_certificate_fingerprint,
    })
  })
})
