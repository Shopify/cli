import {
  BasePaymentsAppExtensionSchema,
  BuyerLabelSchema,
  ConfirmationSchema,
  DeferredPaymentsSchema,
} from './base_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

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
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: ['payment_session_url'],
          message: 'Required',
        },
      ]),
    )
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
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['buyer_label'],
          message: 'Expected string, received number',
        },
      ]),
    )
  })

  test('throws an error if buyer_label is too long', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label: 'a'.repeat(60),
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.too_big,
          maximum: 50,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'String must contain at most 50 character(s)',
          path: ['buyer_label'],
        },
      ]),
    )
  })

  test('throws an error if buyer_label_translations has an invalid format', async () => {
    // When/Then
    expect(() =>
      BuyerLabelSchema.parse({
        ...config,
        buyer_label_translations: [{locale: 'en', text: 'invalid key'}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: ['buyer_label_translations', 0, 'label'],
          message: 'Required',
        },
      ]),
    )
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
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'boolean',
          received: 'undefined',
          path: ['supports_installments'],
          message: 'Required',
        },
      ]),
    )
  })

  test('throws an error if no supports_deferred_payments is provided', async () => {
    // When/Then
    expect(() =>
      DeferredPaymentsSchema.parse({
        ...config,
        supports_deferred_payments: undefined,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'boolean',
          received: 'undefined',
          path: ['supports_deferred_payments'],
          message: 'Required',
        },
      ]),
    )
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
    ).toThrowError(
      new zod.ZodError([
        {
          validation: 'url',
          code: zod.ZodIssueCode.invalid_string,
          message: 'Invalid url',
          path: ['confirmation_callback_url'],
        },
      ]),
    )
  })

  test('throws an error if supports_3ds is not provided', async () => {
    // When/Then
    expect(() =>
      ConfirmationSchema.parse({
        ...config,
        supports_3ds: undefined,
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'boolean',
          received: 'undefined',
          path: ['supports_3ds'],
          message: 'Required',
        },
      ]),
    )
  })
})
