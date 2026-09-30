import {extensionUuidToHandle} from './extension_uuid_to_handle.js'
import {CreditCardPaymentsAppExtensionDeployConfigType} from '../payments_app_extension_schemas/credit_card_payments_app_extension_schema.js'
import {ExtensionRegistration} from '../../../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

function deployConfig(
  overrides: Partial<CreditCardPaymentsAppExtensionDeployConfigType>,
): CreditCardPaymentsAppExtensionDeployConfigType {
  return {
    api_version: '2022-07',
    start_payment_session_url: 'http://foo.bar/payment',
    start_refund_session_url: 'http://foo.bar/refund',
    start_capture_session_url: 'http://foo.bar/capture',
    start_void_session_url: 'http://foo.bar/void',
    merchant_label: 'some-label',
    supported_countries: ['CA'],
    supported_payment_methods: ['visa'],
    test_mode_available: true,
    supports_3ds: false,
    supports_moto: false,
    supports_deferred_payments: false,
    supports_installments: false,
    encryption_certificate: {fingerprint: 'fingerprint', certificate: 'certificate'},
    ...overrides,
  }
}

function registration(overrides: Partial<ExtensionRegistration>): ExtensionRegistration {
  return {
    id: '1',
    uuid: 'some-uuid',
    title: 'Some Extension',
    type: 'ui_extension',
    ...overrides,
  }
}

describe('extensionUuidToHandle', () => {
  test('returns the existing handle without consulting the registrations', () => {
    // Given
    const config = deployConfig({
      ui_extension_handle: 'already-resolved',
      ui_extension_registration_uuid: 'matching-uuid',
    })
    const allExtensions = [registration({uuid: 'matching-uuid', title: 'Checkout UI Extension'})]

    // When
    const got = extensionUuidToHandle(config, allExtensions)

    // Then
    expect(got).toBe('already-resolved')
  })

  test('slugifies the title of the extension matching the registration uuid', () => {
    // Given
    const config = deployConfig({ui_extension_registration_uuid: 'matching-uuid'})
    const allExtensions = [
      registration({uuid: 'other-uuid', title: 'Other Extension'}),
      registration({uuid: 'matching-uuid', title: 'Checkout UI Extension'}),
    ]

    // When
    const got = extensionUuidToHandle(config, allExtensions)

    // Then
    expect(got).toBe('checkout-ui-extension')
  })

  test('returns undefined when no registration matches the uuid', () => {
    // Given
    const config = deployConfig({ui_extension_registration_uuid: 'missing-uuid'})
    const allExtensions = [registration({uuid: 'other-uuid', title: 'Other Extension'})]

    // When
    const got = extensionUuidToHandle(config, allExtensions)

    // Then
    expect(got).toBeUndefined()
  })

  test('returns undefined when the config carries no registration uuid', () => {
    // Given
    const config = deployConfig({})
    const allExtensions = [registration({uuid: 'some-uuid', title: 'Some Extension'})]

    // When
    const got = extensionUuidToHandle(config, allExtensions)

    // Then
    expect(got).toBeUndefined()
  })
})
