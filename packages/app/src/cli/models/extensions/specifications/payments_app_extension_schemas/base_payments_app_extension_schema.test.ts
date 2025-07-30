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
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "string",
          "code": "invalid_type",
          "path": [
            "payment_session_url"
          ],
          "message": "Invalid input: expected string, received undefined"
        }
      ]]
    `)
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
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "string",
          "code": "invalid_type",
          "path": [
            "buyer_label"
          ],
          "message": "Invalid input: expected string, received number"
        }
      ]]
    `)
  })

  test('throws an error if buyer_label is too long', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label: 'a'.repeat(60),
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "origin": "string",
          "code": "too_big",
          "maximum": 50,
          "inclusive": true,
          "path": [
            "buyer_label"
          ],
          "message": "Too big: expected string to have <=50 characters"
        }
      ]]
    `)
  })

  test('throws an error if buyer_label_translations has an invalid format', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label_translations: [{locale: 'en', text: 'invalid key'}],
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "string",
          "code": "invalid_type",
          "path": [
            "buyer_label_translations",
            0,
            "label"
          ],
          "message": "Invalid input: expected string, received undefined"
        }
      ]]
    `)
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
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "boolean",
          "code": "invalid_type",
          "path": [
            "supports_installments"
          ],
          "message": "Invalid input: expected boolean, received undefined"
        }
      ]]
    `)
  })

  test('throws an error if no supports_deferred_payments is provided', async () => {
    // When/Then
    expect(() =>
      DeferredPaymentsSchema.parse({
        ...config,
        supports_deferred_payments: undefined,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "boolean",
          "code": "invalid_type",
          "path": [
            "supports_deferred_payments"
          ],
          "message": "Invalid input: expected boolean, received undefined"
        }
      ]]
    `)
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
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "code": "invalid_format",
          "format": "url",
          "path": [
            "confirmation_callback_url"
          ],
          "message": "Invalid URL"
        }
      ]]
    `)
  })

  test('throws an error if supports_3ds is not provided', async () => {
    // When/Then
    expect(() =>
      ConfirmationSchema.parse({
        ...config,
        supports_3ds: undefined,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "boolean",
          "code": "invalid_type",
          "path": [
            "supports_3ds"
          ],
          "message": "Invalid input: expected boolean, received undefined"
        }
      ]]
    `)
  })
})

describe('SupportedBuyerContextSchema', async () => {
  test('throws an error if currency is not provided', async () => {
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{countries: ['US']}],
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "expected": "string",
          "code": "invalid_type",
          "path": [
            "supported_buyer_contexts",
            0,
            "currency"
          ],
          "message": "Invalid input: expected string, received undefined"
        }
      ]]
    `)
  })

  test('throws an error if countries key provided but its an empty array', async () => {
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{currency: 'USD', countries: []}],
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "origin": "array",
          "code": "too_small",
          "minimum": 1,
          "inclusive": true,
          "path": [
            "supported_buyer_contexts",
            0,
            "countries"
          ],
          "message": "Too small: expected array to have >=1 items"
        }
      ]]
    `)
  })

  test('throws an error if an unexpected key is present', async () => {
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{currency: 'USD', random: 123}],
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "code": "unrecognized_keys",
          "keys": [
            "random"
          ],
          "path": [
            "supported_buyer_contexts",
            0
          ],
          "message": "Unrecognized key: \\"random\\""
        }
      ]]
    `)
  })

  test('throws an error if a mixture of currency and currency plus countries provided', async () => {
    expect(() =>
      SupportedBuyerContextsSchema.parse({
        supported_buyer_contexts: [{currency: 'USD'}, {currency: 'EUR', countries: ['DE']}],
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "code": "custom",
          "path": [
            "supported_buyer_contexts"
          ],
          "message": "Must all be defined with only a currency, or must all be defined with a currency plus countries -- a mixture of the two is not allowed"
        }
      ]]
    `)
  })

  test('is valid if countries are not provided', async () => {
    const {success} = SupportedBuyerContextsSchema.safeParse({
      supported_buyer_contexts: [{currency: 'USD'}, {currency: 'CAD'}],
    })

    expect(success).toBe(true)
  })

  test('is valid if currrency and countries are provided', async () => {
    const {success} = SupportedBuyerContextsSchema.safeParse({
      supported_buyer_contexts: [
        {currency: 'USD', countries: ['US']},
        {currency: 'EUR', countries: ['FR', 'DE']},
      ],
    })

    expect(success).toBe(true)
  })

  test('is valid supported buyer context omitted', async () => {
    const {success} = SupportedBuyerContextsSchema.safeParse({})

    expect(success).toBe(true)
  })
})
