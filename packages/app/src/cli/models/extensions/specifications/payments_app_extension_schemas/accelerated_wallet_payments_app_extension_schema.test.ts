import {
  ACCELERATED_WALLET_TARGET,
  AcceleratedWalletPaymentsAppExtensionConfigType,
  AcceleratedWalletPaymentsAppExtensionSchema,
  acceleratedWalletPaymentsAppExtensionDeployConfig,
} from './accelerated_wallet_payments_app_extension_schema.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

const config: AcceleratedWalletPaymentsAppExtensionConfigType = {
  name: 'test extension',
  type: 'payments_extension',
  payment_session_url: 'https://example.com/payment-sessions',
  refund_session_url: 'https://example.com/refund-sessions',
  capture_session_url: 'https://example.com/capture-sessions',
  void_session_url: 'https://example.com/void-sessions',
  confirmation_callback_url: 'https://example.com/confirm',
  wallet_session_create_url: 'https://example.com/wallet-sessions',
  wallet_session_verify_url: 'https://example.com/wallet-sessions/verify',
  button_logo_url: 'https://example.com/logo.svg',
  button_background_color: '#000000',
  button_foreground_color: '#FFFFFF',
  merchant_label: 'some-label',
  buyer_label: 'Example Wallet',
  buyer_label_translations: [{locale: 'fr', label: 'Portefeuille exemple'}],
  multiple_capture: false,
  supported_countries: ['CA'],
  supported_payment_methods: ['PAYMENT_METHOD'],
  supported_buyer_contexts: [{currency: 'USD'}],
  supports_3ds: false,
  supports_oversell_protection: false,
  test_mode_available: true,
  supports_deferred_payments: false,
  supports_installments: false,
  targeting: [{target: 'payments.accelerated-wallet.render'}],
  api_version: '2022-07',
  description: 'my payments app extension',
}

describe('AcceleratedWalletPaymentsAppExtensionSchema', () => {
  test('validates a configuration with valid fields', async () => {
    // When
    const {success} = AcceleratedWalletPaymentsAppExtensionSchema.safeParse(config)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if no target is provided', async () => {
    // When/Then
    expect(() =>
      AcceleratedWalletPaymentsAppExtensionSchema.parse({
        ...config,
        targeting: [{...config.targeting[0]!, target: null}],
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          received: null,
          code: zod.ZodIssueCode.invalid_literal,
          expected: ACCELERATED_WALLET_TARGET,
          path: ['targeting', 0, 'target'],
          message: `Invalid literal value, expected "${ACCELERATED_WALLET_TARGET}"`,
        },
      ]),
    )
  })

  test.each([
    'wallet_session_create_url',
    'wallet_session_verify_url',
    'button_logo_url',
    'button_background_color',
    'button_foreground_color',
  ] as const)('returns an error if %s is not provided', async (key) => {
    // When/Then
    expect(() => AcceleratedWalletPaymentsAppExtensionSchema.parse({...config, [key]: undefined})).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'undefined',
          path: [key],
          message: 'Required',
        },
      ]),
    )
  })

  test.each(['wallet_session_create_url', 'wallet_session_verify_url'] as const)(
    'returns an error if %s is not a valid URL',
    async (key) => {
      // When/Then
      expect(() => AcceleratedWalletPaymentsAppExtensionSchema.parse({...config, [key]: 'not-a-url'})).toThrowError(
        new zod.ZodError([
          {
            validation: 'url',
            code: zod.ZodIssueCode.invalid_string,
            message: 'Invalid url',
            path: [key],
          },
        ]),
      )
    },
  )

  test.each(['http://example.com/logo.svg', 'not-a-url'])(
    'returns an error if button_logo_url is %s',
    async (value) => {
      // When/Then
      expect(() => AcceleratedWalletPaymentsAppExtensionSchema.parse({...config, button_logo_url: value})).toThrowError(
        new zod.ZodError([
          {
            code: zod.ZodIssueCode.custom,
            message: 'Must be an HTTPS URL',
            path: ['button_logo_url'],
          },
        ]),
      )
    },
  )

  test('accepts lowercase hex colors', async () => {
    // When
    const {success} = AcceleratedWalletPaymentsAppExtensionSchema.safeParse({
      ...config,
      button_background_color: '#1a2b3c',
      button_foreground_color: '#ffffff',
    })

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if the button colors are not 6-digit hex colors', async () => {
    // When/Then
    expect(() =>
      AcceleratedWalletPaymentsAppExtensionSchema.parse({
        ...config,
        button_background_color: 'black',
        button_foreground_color: '#FFF',
      }),
    ).toThrowError(
      new zod.ZodError([
        {
          validation: 'regex',
          code: zod.ZodIssueCode.invalid_string,
          message: 'Must be a 6-digit hex color, like #1A2B3C',
          path: ['button_background_color'],
        },
        {
          validation: 'regex',
          code: zod.ZodIssueCode.invalid_string,
          message: 'Must be a 6-digit hex color, like #1A2B3C',
          path: ['button_foreground_color'],
        },
      ]),
    )
  })

  test('returns an error if no confirmation_callback_url is provided with supports oversell protection', async () => {
    // When/Then
    expect(() =>
      AcceleratedWalletPaymentsAppExtensionSchema.parse({
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

  test('parses successfully when optional fields are omitted', async () => {
    // Given
    const configWithoutOptionalFields = {...config}
    delete configWithoutOptionalFields.buyer_label
    delete configWithoutOptionalFields.buyer_label_translations
    delete configWithoutOptionalFields.multiple_capture
    delete configWithoutOptionalFields.supports_installments
    delete configWithoutOptionalFields.supports_deferred_payments
    delete configWithoutOptionalFields.supports_3ds

    // When
    const {success} = AcceleratedWalletPaymentsAppExtensionSchema.safeParse(configWithoutOptionalFields)

    // Then
    expect(success).toBe(true)
  })

  test('returns an error if supports_installments does not match supports_deferred_payments', async () => {
    // When/Then
    expect(() =>
      AcceleratedWalletPaymentsAppExtensionSchema.parse({
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

describe('acceleratedWalletPaymentsAppExtensionDeployConfig', () => {
  test('maps deploy configuration from extension configuration', async () => {
    // When
    const result = await acceleratedWalletPaymentsAppExtensionDeployConfig(config)

    // Then
    expect(result).toEqual({
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
      supported_buyer_contexts: config.supported_buyer_contexts,
      test_mode_available: config.test_mode_available,
      default_buyer_label: config.buyer_label,
      buyer_label_to_locale: config.buyer_label_translations,
      supports_oversell_protection: config.supports_oversell_protection,
      supports_3ds: config.supports_3ds,
      supports_deferred_payments: config.supports_deferred_payments,
      supports_installments: config.supports_installments,
      wallet_session_create_url: config.wallet_session_create_url,
      wallet_session_verify_url: config.wallet_session_verify_url,
      button_logo_url: config.button_logo_url,
      button_background_color: config.button_background_color,
      button_foreground_color: config.button_foreground_color,
    })
  })
})
