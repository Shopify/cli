import {buildTomlObject, DashboardPaymentExtensionType} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

const SAMPLE_OFFSITE_CONFIG =
  '{"start_payment_session_url":"https://bogus-app/payment-sessions/start","start_refund_session_url":"https://bogus-app/payment-sessions/refund","start_capture_session_url":"https://bogus-app/payment-sessions/capture","start_void_session_url":"https://bogus-app/payment-sessions/void","confirmation_callback_url":"https://bogus-app/payment-sessions/confirm","supported_payment_methods":["visa","master","american_express","discover","diners_club","jcb"],"supported_countries":["GG","AF","AZ","BH"],"test_mode_available":true,"merchant_label":"Offsite Payments App Extension","default_buyer_label":null,"buyer_label_to_locale":null,"supports_3ds":true,"supports_oversell_protection":false,"api_version":"2023-10","supports_installments":true,"supports_deferred_payments":true,"multiple_capture":false}'
const SAMPLE_CREDIT_CARD_CONFIG =
  '{"start_payment_session_url":"https://test-domain.com/authorize","start_refund_session_url":"https://test-domain.com/refund","start_capture_session_url":"https://test-domain.com/capture","start_void_session_url":"https://test-domain.com/void","confirmation_callback_url":"https://test-domain.com/confirm","supported_payment_methods":["master","visa","jcb","american_express","diners_club"],"supported_countries":["JP"],"test_mode_available":true,"merchant_label":"test-label","supports_3ds":true,"encryption_certificate":{"fingerprint": "fingerprint", "certificate": "certificate"},"api_version":"2023-04","ui_extension_registration_uuid":"3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc","supports_installments":false,"supports_deferred_payments":false,"multiple_capture":false}'
const SAMPLE_CUSTOM_CREDIT_CARD_CONFIG =
  '{"start_payment_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/payment_sessions","start_refund_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/refund_sessions","start_capture_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/capture_sessions","start_void_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/void_sessions","checkout_payment_method_fields":[{"key":"payment_plan","type":"string","required":true}],"confirmation_callback_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/confirm","supported_payment_methods":["visa"],"supported_countries":["CA","MX","US"],"test_mode_available":true,"merchant_label":"Bogus Private Card App","default_buyer_label":null,"buyer_label_to_locale":null,"supports_3ds":false,"encryption_certificate":{"fingerprint":"Test Certificate","certificate":"-----BEGIN CERTIFICATE-----\\nTestString=\\n-----END CERTIFICATE-----"},"api_version":"unstable","ui_extension_registration_uuid":"3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc","checkout_hosted_fields":["name","expiry","verification_value"],"multiple_capture":false}'
const SAMPLE_CUSTOM_ONSITE_CONFIG =
  '{"start_payment_session_url":"https://test-domain.com/startsession/bogus-pay","start_refund_session_url":"https://test-domain.com/refund","start_capture_session_url":"https://test-domain.com/capture","start_void_session_url":"https://test-domain.com/void","confirmation_callback_url":null,"checkout_payment_method_fields":[{"key":"bogus_customer_document","type":"string","required":true}],"supported_payment_methods":["bogus-pay"],"supported_countries":["BR"],"test_mode_available":true,"merchant_label":"Test Label","default_buyer_label": "Bogus Pay Buyer Label","buyer_label_to_locale":[],"supports_3ds":false,"supports_oversell_protection":false,"api_version":"unstable","ui_extension_registration_uuid":"3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc","multiple_capture":false,"supports_installments":false,"supports_deferred_payments":false}'
const SAMPLE_REDEEMABLE_CONFIG =
  '{"start_payment_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/payment_sessions","start_refund_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/refund_sessions","start_capture_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/capture_sessions","start_void_session_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/void_sessions","supported_countries":["CA","MX","US"],"test_mode_available":true,"merchant_label":"Bogus Redeemable Payments App","default_buyer_label":null,"buyer_label_to_locale":null,"api_version":"unstable","ui_extension_registration_uuid":"3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc","supported_payment_methods":["gift-card"],"redeemable_type":"gift_card","balance_url":"https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/retrieve_balance","checkout_payment_method_fields":[{"key":"card_number","type":"string","required":true},{"key":"pin","type":"string","required":true}]}'

const translateDeployConfigKeyToCLI = (deployConfigKey: string): string => {
  switch (deployConfigKey) {
    case 'start_payment_session_url':
      return 'payment_session_url'
    case 'start_refund_session_url':
      return 'refund_session_url'
    case 'start_capture_session_url':
      return 'capture_session_url'
    case 'start_void_session_url':
      return 'void_session_url'
    case 'default_buyer_label':
      return 'buyer_label'
    default:
      return deployConfigKey
  }
}

const expectIncludesKeys = (got: string, config: string) => {
  const configObj = JSON.parse(config)
  const keys = Object.keys(configObj)
  for (const key of keys) {
    if (configObj[key] === null) continue
    if (key === 'ui_extension_registration_uuid') continue
    if (Array.isArray(configObj[key]) && configObj[key].length === 0) continue
    const translatedKey = translateDeployConfigKeyToCLI(key)
    expect(got).toContain(translatedKey)
  }
}

describe('extension-to-toml', () => {
  test('correctly builds a toml string for a CLI payments extension', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: 'payments_extension',
      draftVersion: {
        context: 'payments.offsite.render',
        config: SAMPLE_OFFSITE_CONFIG,
      },
    }

    // When
    const got = buildTomlObject(extension1, [extension1])

    // Then
    expectIncludesKeys(got, SAMPLE_OFFSITE_CONFIG)
    expect(got).toEqual(`api_version = "2023-10"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"
payment_session_url = "https://bogus-app/payment-sessions/start"
refund_session_url = "https://bogus-app/payment-sessions/refund"
capture_session_url = "https://bogus-app/payment-sessions/capture"
void_session_url = "https://bogus-app/payment-sessions/void"
confirmation_callback_url = "https://bogus-app/payment-sessions/confirm"
multiple_capture = false
merchant_label = "Offsite Payments App Extension"
supported_countries = [ "GG", "AF", "AZ", "BH" ]
supported_payment_methods = [
  "visa",
  "master",
  "american_express",
  "discover",
  "diners_club",
  "jcb"
]
test_mode_available = true
supports_oversell_protection = false
supports_3ds = true
supports_deferred_payments = true
supports_installments = true

  [[extensions.targeting]]
  target = "payments.offsite.render"
`)
  })

  test('correctly builds a toml string for an offsite app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: 'payments_app',
      draftVersion: {
        config: SAMPLE_OFFSITE_CONFIG,
      },
    }

    // When
    const got = buildTomlObject(extension1, [extension1])

    // Then
    expectIncludesKeys(got, SAMPLE_OFFSITE_CONFIG)
    expect(got).toEqual(`api_version = "2023-10"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"
payment_session_url = "https://bogus-app/payment-sessions/start"
refund_session_url = "https://bogus-app/payment-sessions/refund"
capture_session_url = "https://bogus-app/payment-sessions/capture"
void_session_url = "https://bogus-app/payment-sessions/void"
confirmation_callback_url = "https://bogus-app/payment-sessions/confirm"
multiple_capture = false
merchant_label = "Offsite Payments App Extension"
supported_countries = [ "GG", "AF", "AZ", "BH" ]
supported_payment_methods = [
  "visa",
  "master",
  "american_express",
  "discover",
  "diners_club",
  "jcb"
]
test_mode_available = true
supports_oversell_protection = false
supports_3ds = true
supports_deferred_payments = true
supports_installments = true

  [[extensions.targeting]]
  target = "payments.offsite.render"
`)
  })

  test('correctly builds a toml string for a credit card app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: DashboardPaymentExtensionType.CreditCard,
      draftVersion: {
        config: SAMPLE_CREDIT_CARD_CONFIG,
      },
    }
    const extension2: ExtensionRegistration = {
      id: '40366498817',
      uuid: '3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc',
      title: 'Checkout UI Extension',
      type: 'checkout_ui_extension',
    }

    // When
    const got = buildTomlObject(extension1, [extension1, extension2])

    // Then
    expectIncludesKeys(got, SAMPLE_CREDIT_CARD_CONFIG)
    expect(got).toEqual(`api_version = "2023-04"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"
payment_session_url = "https://test-domain.com/authorize"
refund_session_url = "https://test-domain.com/refund"
capture_session_url = "https://test-domain.com/capture"
void_session_url = "https://test-domain.com/void"
confirmation_callback_url = "https://test-domain.com/confirm"
multiple_capture = false
merchant_label = "test-label"
supported_countries = [ "JP" ]
supported_payment_methods = [ "master", "visa", "jcb", "american_express", "diners_club" ]
test_mode_available = true
supports_3ds = true
supports_deferred_payments = false
supports_installments = false
encryption_certificate_fingerprint = "fingerprint"
ui_extension_handle = "checkout-ui-extension"

  [[extensions.targeting]]
  target = "payments.credit-card.render"
`)
  })

  test('correctly builds a toml string for a custom credit card app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: DashboardPaymentExtensionType.CustomCreditCard,
      draftVersion: {
        config: SAMPLE_CUSTOM_CREDIT_CARD_CONFIG,
      },
    }
    const extension2: ExtensionRegistration = {
      id: '40366498817',
      uuid: '3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc',
      title: 'Checkout UI Extension',
      type: 'checkout_ui_extension',
    }

    // When
    const got = buildTomlObject(extension1, [extension1, extension2])

    // Then
    expectIncludesKeys(got, SAMPLE_CUSTOM_CREDIT_CARD_CONFIG)
    expect(got).toEqual(`api_version = "unstable"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"
payment_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/payment_sessions"
refund_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/refund_sessions"
capture_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/capture_sessions"
void_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/void_sessions"
confirmation_callback_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/custom_card/confirm"
merchant_label = "Bogus Private Card App"
supports_3ds = false
supported_countries = [ "CA", "MX", "US" ]
supported_payment_methods = [ "visa" ]
encryption_certificate_fingerprint = "Test Certificate"
test_mode_available = true
multiple_capture = false
checkout_hosted_fields = [ "name", "expiry", "verification_value" ]
ui_extension_handle = "checkout-ui-extension"

  [[extensions.checkout_payment_method_fields]]
  key = "payment_plan"
  type = "string"
  required = true

  [[extensions.targeting]]
  target = "payments.custom-credit-card.render"
`)
  })

  test('correctly builds a toml string for a custom onsite app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: DashboardPaymentExtensionType.CustomOnsite,
      draftVersion: {
        config: SAMPLE_CUSTOM_ONSITE_CONFIG,
      },
    }
    const extension2: ExtensionRegistration = {
      id: '40366498817',
      uuid: '3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc',
      title: 'Checkout UI Extension',
      type: 'checkout_ui_extension',
    }

    // When
    const got = buildTomlObject(extension1, [extension1, extension2])

    // Then
    expectIncludesKeys(got, SAMPLE_CUSTOM_ONSITE_CONFIG)
    expect(got).toEqual(`api_version = "unstable"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"
payment_session_url = "https://test-domain.com/startsession/bogus-pay"
refund_session_url = "https://test-domain.com/refund"
capture_session_url = "https://test-domain.com/capture"
void_session_url = "https://test-domain.com/void"
merchant_label = "Test Label"
supports_oversell_protection = false
supports_3ds = false
supports_installments = false
supports_deferred_payments = false
supported_countries = [ "BR" ]
supported_payment_methods = [ "bogus-pay" ]
test_mode_available = true
multiple_capture = false
buyer_label = "Bogus Pay Buyer Label"
buyer_label_translations = [ ]
ui_extension_handle = "checkout-ui-extension"

  [[extensions.checkout_payment_method_fields]]
  key = "bogus_customer_document"
  type = "string"
  required = true

  [[extensions.targeting]]
  target = "payments.custom-onsite.render"
`)
  })

  test('correctly builds a toml string for a redeemable app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: DashboardPaymentExtensionType.Redeemable,
      draftVersion: {
        config: SAMPLE_REDEEMABLE_CONFIG,
      },
    }
    const extension2: ExtensionRegistration = {
      id: '40366498817',
      uuid: '3f9d1c40-0f7d-48f9-b802-ca7d302ee8bc',
      title: 'Checkout UI Extension',
      type: 'checkout_ui_extension',
    }

    // When
    const got = buildTomlObject(extension1, [extension1, extension2])

    // Then
    expectIncludesKeys(got, SAMPLE_REDEEMABLE_CONFIG)
    expect(got).toEqual(`api_version = "unstable"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"
payment_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/payment_sessions"
refund_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/refund_sessions"
capture_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/capture_sessions"
void_session_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/void_sessions"
merchant_label = "Bogus Redeemable Payments App"
supported_countries = [ "CA", "MX", "US" ]
supported_payment_methods = [ "gift-card" ]
test_mode_available = true
redeemable_type = "gift_card"
balance_url = "https://bogus-payment-sessions.shopifycloud.com/bogus/redeemable/retrieve_balance"
ui_extension_handle = "checkout-ui-extension"

  [[extensions.checkout_payment_method_fields]]
  key = "card_number"
  type = "string"
  required = true

  [[extensions.checkout_payment_method_fields]]
  key = "pin"
  type = "string"
  required = true

  [[extensions.targeting]]
  target = "payments.redeemable.render"
`)
  })
})
