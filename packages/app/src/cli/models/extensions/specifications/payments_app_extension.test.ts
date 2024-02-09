import {PaymentsAppExtensionConfigType} from './payments_app_extension.js'
import {OffsitePaymentsAppExtensionConfigType} from './payments_app_extension_schemas/offsite_payments_app_extension_schema.js'
import {testPaymentsAppExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import * as upload from '../../../services/deploy/upload.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

vi.mock('../../../services/deploy/upload.js')

describe('PaymentsAppExtension', () => {
  let extension: ExtensionInstance<PaymentsAppExtensionConfigType>
  const moduleId = 'module_id'
  const apiKey = 'app-key'
  const token = 'app-token'
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
    metafields: [],
  }

  beforeEach(async () => {
    vi.spyOn(upload, 'uploadWasmBlob').mockResolvedValue({
      url: 'http://foo.bar',
      moduleId,
    })

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
      const result = await extension.deployConfig({apiKey, token})
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

  test('returns error if there is no target', async () => {
    // Given
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

    // When/Then
    expect(() =>
      specification.schema.parse({
        ...config,
        targeting: [{target: undefined}],
      }),
    ).toThrowError(zod.ZodError)
  })
})
