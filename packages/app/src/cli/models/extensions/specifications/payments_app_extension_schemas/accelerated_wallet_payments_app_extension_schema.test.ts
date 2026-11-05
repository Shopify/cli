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
  button_logo_path: 'assets/logo.png',
  button_logo_path_dark: 'assets/logo-dark.png',
  button_background_color: '#000000',
  button_background_color_dark: '#FFFFFF',
  button_foreground_color: '#F5F5F5',
  button_foreground_color_dark: '#1A1A1A',
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
    'button_logo_path',
    'button_logo_path_dark',
    'button_background_color',
    'button_background_color_dark',
    'button_foreground_color',
    'button_foreground_color_dark',
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

  describe.each(['button_logo_path', 'button_logo_path_dark'] as const)('%s', (key) => {
    test.each([
      'logo.png',
      'assets/logo.jpg',
      'assets/logo.jpeg',
      'assets/images/logo.gif',
      'assets/logo.webp',
      'assets/logo.avif',
      'assets/favicon.ico',
      './assets/logo.png',
    ])('accepts %s', async (value) => {
      // When
      const {success} = AcceleratedWalletPaymentsAppExtensionSchema.safeParse({...config, [key]: value})

      // Then
      expect(success).toBe(true)
    })

    test.each([
      ['an empty string', ''],
      ['an HTTPS URL', 'https://example.com/logo.png'],
      ['a data URL', 'data:image/logo.png'],
      ['a Windows drive path', 'C:\\assets\\logo.png'],
      ['an absolute path', '/assets/logo.png'],
      ['a protocol-relative URL', '//example.com/logo.png'],
      ['a Windows root path', '\\assets\\logo.png'],
      ['a path that starts with ..', '../logo.png'],
      ['a path with a .. segment', 'assets/../logo.png'],
      ['a Windows path with a .. segment', 'assets\\..\\logo.png'],
      ['an upper-case extension', 'assets/logo.PNG'],
      ['an extension that is not allowed', 'assets/logo.svg'],
      ['a path with no extension', 'assets/logo'],
      ['an extension with no file name', 'assets/.png'],
      ['a folder', 'assets/logo.png/'],
    ])('returns an error for %s', async (_description, value) => {
      // When/Then
      expect(() => AcceleratedWalletPaymentsAppExtensionSchema.parse({...config, [key]: value})).toThrowError(
        new zod.ZodError([
          {
            code: zod.ZodIssueCode.custom,
            message:
              'Must be a relative path inside the extension folder to a .png, .jpg, .jpeg, .gif, .webp, .avif, .ico file, like assets/logo.png',
            path: [key],
          },
        ]),
      )
    })
  })

  test('accepts lowercase hex colors', async () => {
    // When
    const {success} = AcceleratedWalletPaymentsAppExtensionSchema.safeParse({
      ...config,
      button_background_color: '#1a2b3c',
      button_background_color_dark: '#abcdef',
      button_foreground_color: '#ffffff',
      button_foreground_color_dark: '#0f0f0f',
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
        button_background_color_dark: '#GGGGGG',
        button_foreground_color: '#FFF',
        button_foreground_color_dark: '000000',
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
          path: ['button_background_color_dark'],
        },
        {
          validation: 'regex',
          code: zod.ZodIssueCode.invalid_string,
          message: 'Must be a 6-digit hex color, like #1A2B3C',
          path: ['button_foreground_color'],
        },
        {
          validation: 'regex',
          code: zod.ZodIssueCode.invalid_string,
          message: 'Must be a 6-digit hex color, like #1A2B3C',
          path: ['button_foreground_color_dark'],
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
      button_logo_path: config.button_logo_path,
      button_logo_path_dark: config.button_logo_path_dark,
      button_background_color: config.button_background_color,
      button_background_color_dark: config.button_background_color_dark,
      button_foreground_color: config.button_foreground_color,
      button_foreground_color_dark: config.button_foreground_color_dark,
    })
  })
})
