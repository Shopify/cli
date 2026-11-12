import {PaymentsAppExtensionConfigType} from './payments_app_extension.js'
import {OffsitePaymentsAppExtensionConfigType} from './payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {AcceleratedWalletPaymentsAppExtensionConfigType} from './payments_app_extension_schemas/accelerated_wallet_payments_app_extension_schema.js'
import {placeholderAppConfiguration, testPaymentsAppExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {beforeEach, describe, expect, test} from 'vitest'

describe('PaymentsAppExtension', () => {
  let extension: ExtensionInstance<PaymentsAppExtensionConfigType>
  const moduleId = 'module_id'
  const apiKey = 'app-key'
  const inputQuery = 'query { f }'

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
    supports_3ds: false,
    supports_oversell_protection: false,
    test_mode_available: true,
    supports_deferred_payments: false,
    supports_installments: false,
    targeting: [{target: 'payments.offsite.render'}],
    input: {
      metafield_identifiers: {
        namespace: 'namespace',
        key: 'key',
      },
    },
    api_version: '2022-07',
    description: 'my payments app extension',
  }

  const acceleratedWalletConfig: AcceleratedWalletPaymentsAppExtensionConfigType = {
    ...config,
    targeting: [{target: 'payments.accelerated-wallet.render'}],
    buyer_label: 'Example Wallet',
    wallet_session_create_url: 'https://example.com/wallet-sessions',
    wallet_session_verify_url: 'https://example.com/wallet-sessions/verify',
    sheet_origins: ['https://wallet.example.com'],
    button_logo_path: 'assets/logo.png',
    button_logo_path_dark: 'assets/logo-dark.png',
    button_background_color: '#000000',
    button_background_color_dark: '#FFFFFF',
    button_foreground_color: '#F5F5F5',
    button_foreground_color_dark: '#1A1A1A',
  }

  beforeEach(async () => {
    extension = await testPaymentsAppExtension({
      dir: '/payments_app_extensions',
      config,
    })
  })

  test('handles the deploy configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      extension.directory = tmpDir
      await writeFile(extension.inputQueryPath, inputQuery)

      // When
      const result = await extension.deployConfig({
        apiKey,
        appConfiguration: placeholderAppConfiguration,
      })
      const extensionConfiguration = extension.configuration as OffsitePaymentsAppExtensionConfigType

      // Then
      expect(result).toEqual({
        api_version: extensionConfiguration.api_version,
        start_payment_session_url: extensionConfiguration.payment_session_url,
        start_refund_session_url: extensionConfiguration.refund_session_url,
        start_capture_session_url: extensionConfiguration.capture_session_url,
        start_void_session_url: extensionConfiguration.void_session_url,
        confirmation_callback_url: extensionConfiguration.confirmation_callback_url,
        merchant_label: extensionConfiguration.merchant_label,
        supported_countries: extensionConfiguration.supported_countries,
        supported_payment_methods: extensionConfiguration.supported_payment_methods,
        test_mode_available: extensionConfiguration.test_mode_available,
        default_buyer_label: extensionConfiguration.buyer_label,
        buyer_label_to_locale: extensionConfiguration.buyer_label_translations,
        supports_oversell_protection: extensionConfiguration.supports_oversell_protection,
        supports_3ds: extensionConfiguration.supports_3ds,
        supports_deferred_payments: extensionConfiguration.supports_deferred_payments,
        supports_installments: extensionConfiguration.supports_installments,
      })
    })
  })

  test('parses and handles the deploy configuration for an accelerated wallet extension', async () => {
    // Given
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

    // When
    const parsed = specification.parseConfigurationObject(acceleratedWalletConfig)
    if (parsed.state !== 'ok') {
      throw new Error("Couldn't parse configuration")
    }
    const acceleratedWalletExtension = new ExtensionInstance({
      configuration: parsed.data,
      configurationPath: '',
      directory: '/payments_app_extensions',
      specification,
    })
    const result = await acceleratedWalletExtension.deployConfig({
      apiKey,
      appConfiguration: placeholderAppConfiguration,
    })

    // Then
    expect(result).toMatchObject({
      start_payment_session_url: acceleratedWalletConfig.payment_session_url,
      default_buyer_label: acceleratedWalletConfig.buyer_label,
      wallet_session_create_url: acceleratedWalletConfig.wallet_session_create_url,
      wallet_session_verify_url: acceleratedWalletConfig.wallet_session_verify_url,
      sheet_origins: acceleratedWalletConfig.sheet_origins,
      button_logo_path: acceleratedWalletConfig.button_logo_path,
      button_logo_path_dark: acceleratedWalletConfig.button_logo_path_dark,
      button_background_color: acceleratedWalletConfig.button_background_color,
      button_background_color_dark: acceleratedWalletConfig.button_background_color_dark,
      button_foreground_color: acceleratedWalletConfig.button_foreground_color,
      button_foreground_color_dark: acceleratedWalletConfig.button_foreground_color_dark,
    })
  })

  test('returns the field error for an invalid accelerated wallet button color', async () => {
    // Given
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

    // When
    const parsed = specification.parseConfigurationObject({
      ...acceleratedWalletConfig,
      button_background_color: 'black',
    })

    // Then
    expect(parsed.state).toBe('error')
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        path: ['button_background_color'],
        message: 'Must be a 6-digit hex color, like #1A2B3C',
      }),
    ])
  })

  test('returns the field error for an accelerated wallet sheet origin with a path', async () => {
    // Given
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

    // When
    const parsed = specification.parseConfigurationObject({
      ...acceleratedWalletConfig,
      sheet_origins: ['https://wallet.example.com/sheet'],
    })

    // Then
    expect(parsed.state).toBe('error')
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        path: ['sheet_origins', 0],
        message:
          'Must be an HTTPS origin in lower case, with a domain name (not an IP address, localhost or wildcard), an optional port (leave out :443) and no path or trailing slash, like https://example.com or https://example.com:8443',
      }),
    ])
  })

  test('returns error if there is no target', async () => {
    // Given
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

    const parsed = specification.parseConfigurationObject({
      ...config,
      targeting: [{target: undefined}],
    })
    expect(parsed.state).toBe('error')
  })
})
