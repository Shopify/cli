import {
  BasePaymentsAppExtensionSchema,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
  SupportedBuyerContextsSchema,
} from './base_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'

describe('BasePaymentsAppExtensionSchema', () => {
  const config = {
    name: 'test extension',
    type: 'payments_extension',
    payment_session_url: 'http://foo.bar',
    refund_session_url: 'http://foo.bar',
    capture_session_url: 'http://foo.bar',
    void_session_url: 'http://foo.bar',
    merchant_label: 'some-label',
    supported_countries: ['CA'],
    supported_payment_methods: ['PAYMENT_METHOD'],
    supported_buyer_contexts: [
      {currency: 'USD'},
      {currency: 'CAD', countries: ['CA']},
      {currency: 'EUR', countries: ['DE', 'FR']},
    ],
    test_mode_available: true,
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

  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = BasePaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('throws an error if no payment session url is provided', async () => {
    // When/Then
    expect(() =>
      BasePaymentsAppExtensionSchema.parse({
        ...config,
        payment_session_url: undefined,
      }),
    ).toThrow('Required')
  })
})

describe('BuyerLabelSchema', () => {
  const config = {
    buyer_label: 'Sample label',
    buyer_label_translations: [{locale: 'en', label: 'Translated label'}],
  }

  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = BuyerLabelSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('throws an error if buyer_label is not a string', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label: 1,
      }),
    ).toThrow('Expected string, received number')
  })

  test('throws an error if buyer_label is too long', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label: 'a'.repeat(60),
      }),
    ).toThrow('String must contain at most 50 character(s)')
  })

  test('throws an error if buyer_label_translations has an invalid format', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label_translations: [{locale: 'en', text: 'invalid key'}],
      }),
    ).toThrow('Required')
  })
})

describe('DeferredPaymentsSchema', () => {
  const config = {
    supports_installments: true,
    supports_deferred_payments: true,
  }

  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = DeferredPaymentsSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('throws an error if no supports_installments is provided', async () => {
    // When/Then
    expect(() =>
      DeferredPaymentsSchema.parse({
        ...config,
        supports_installments: undefined,
      }),
    ).toThrow('Required')
  })

  test('throws an error if no supports_deferred_payments is provided', async () => {
    // When/Then
    expect(() =>
      DeferredPaymentsSchema.parse({
        ...config,
        supports_deferred_payments: undefined,
      }),
    ).toThrow('Required')
  })
})

describe('ConfirmationSchema', () => {
  const config = {
    confirmation_callback_url: 'https://www.example.com',
    supports_3ds: true,
  }

  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = ConfirmationSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('throws an error if confirmation_callback_url is not a url', async () => {
    // When/Then
    expect(() =>
      ConfirmationSchema.parse({
        ...config,
        confirmation_callback_url: 'not-a-url',
      }),
    ).toThrow('Invalid url')
  })

  test('throws an error if supports_3ds is not provided', async () => {
    // When/Then
    expect(() =>
      ConfirmationSchema.parse({
        ...config,
        supports_3ds: undefined,
      }),
    ).toThrow('Required')
  })
})

describe('SupportedBuyerContextSchema', () => {
  const config = {
    supported_buyer_contexts: [{currency: 'USD'}, {currency: 'CAD'}],
  }

  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = SupportedBuyerContextsSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('throws an error if currency is not provided', async () => {
    // When/Then
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{countries: ['US']}],
      }),
    ).toThrow('Required')
  })

  test('throws an error if countries key provided but its an empty array', async () => {
    // When/Then
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{currency: 'USD', countries: []}],
      }),
    ).toThrow('Array must contain at least 1 element(s)')
  })

  test('throws an error if an unexpected key is present', async () => {
    // When/Then
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{currency: 'USD', random: 123}],
      }),
    ).toThrow("Unrecognized key(s) in object: 'random'")
  })

  test('throws an error if a mixture of currency and currency plus countries provided', async () => {
    // When/Then
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{currency: 'USD'}, {currency: 'EUR', countries: ['DE', 'FR']}],
      }),
    ).toThrow(
      'Must all be defined with only a currency, or must all be defined with a currency plus countries -- a mixture of the two is not allowed',
    )
  })
})
