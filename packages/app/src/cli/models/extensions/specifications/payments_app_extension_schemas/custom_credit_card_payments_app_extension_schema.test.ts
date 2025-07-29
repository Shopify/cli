import {
  CustomCreditCardPaymentsAppExtensionConfigType,
  customCreditCardPaymentsAppExtensionDeployConfig,
  CustomCreditCardPaymentsAppExtensionSchema,
  MAX_CHECKOUT_PAYMENT_METHOD_FIELDS,
} from './custom_credit_card_payments_app_extension_schema.js'
import {buildCheckoutPaymentMethodFields} from './payments_app_extension_test_helper.js'
import {describe, expect, test} from 'vitest'

const config: CustomCreditCardPaymentsAppExtensionConfigType = {
  name: 'Custom CreditCard extension',
  type: 'payments_extension',
  targeting: [{target: 'payments.custom-credit-card.render'}],
  payment_session_url: 'http://foo.bar',
  refund_session_url: 'http://foo.bar',
  capture_session_url: 'http://foo.bar',
  void_session_url: 'http://foo.bar',
  confirmation_callback_url: 'http://foo.bar',
  merchant_label: 'some-label',
  supported_countries: ['CA'],
  supported_payment_methods: ['visa'],
  supported_buyer_contexts: [
    {currency: 'CAD', countries: ['CA']},
    {currency: 'EUR', countries: ['DE', 'FR']},
  ],
  supports_3ds: true,
  test_mode_available: true,
  multiple_capture: true,
  encryption_certificate_fingerprint: 'fingerprint',
  api_version: '2022-07',
  checkout_payment_method_fields: [],
  checkout_hosted_fields: ['fields'],
  ui_extension_handle: 'sample-ui-extension',
  description: 'Custom credit card extension',
  input: {
    metafield_identifiers: {
      namespace: 'namespace',
      key: 'key',
    },
  },
}

describe('CustomCreditCardPaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = CustomCreditCardPaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      CustomCreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrow()
  })

  test('returns an error if buyer_label_translations has invalid format', async () => {
    // When/Then
    expect(() =>
      CustomCreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        buyer_label_translations: [{label: 'Translation without locale key'}],
      }),
    ).toThrow()
  })

  test('returns an error if encryption certificate fingerprint is not present', async () => {
    // When/Then
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {encryption_certificate_fingerprint, ...rest} = config
    expect(() =>
      CustomCreditCardPaymentsAppExtensionSchema.parse({
        ...rest,
      }),
    ).toThrow()
  })

  test('returns an error if checkout_payment_method_fields has too many fields', async () => {
    // When/Then
    expect(() =>
      CustomCreditCardPaymentsAppExtensionSchema.parse({
        ...config,
        checkout_payment_method_fields: buildCheckoutPaymentMethodFields(MAX_CHECKOUT_PAYMENT_METHOD_FIELDS + 1),
      }),
    ).toThrow()
  })
})

describe('customCreditCardPaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await customCreditCardPaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toMatchObject({
      api_version: config.api_version,
      start_payment_session_url: config.payment_session_url,
      start_refund_session_url: config.refund_session_url,
      start_capture_session_url: config.capture_session_url,
      start_void_session_url: config.void_session_url,
      confirmation_callback_url: config.confirmation_callback_url,
      merchant_label: config.merchant_label,
      supports_3ds: config.supports_3ds,
      supported_countries: config.supported_countries,
      supported_payment_methods: config.supported_payment_methods,
      supported_buyer_contexts: config.supported_buyer_contexts,
      encryption_certificate_fingerprint: config.encryption_certificate_fingerprint,
      test_mode_available: config.test_mode_available,
      default_buyer_label: config.buyer_label,
      buyer_label_to_locale: config.buyer_label_translations,
      multiple_capture: config.multiple_capture,
      checkout_payment_method_fields: config.checkout_payment_method_fields,
      checkout_hosted_fields: config.checkout_hosted_fields,
      ui_extension_handle: config.ui_extension_handle,
    })
  })
})
