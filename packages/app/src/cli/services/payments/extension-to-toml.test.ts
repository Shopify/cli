import {buildTomlObject} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

describe('extension-to-toml', () => {
  test('correctly builds a toml string for an offsite app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: 'payments_app',
      draftVersion: {
        config:
          '{"start_payment_session_url":"https://bogus-app/payment-sessions/start","start_refund_session_url":"https://bogus-app/payment-sessions/refund","start_capture_session_url":"https://bogus-app/payment-sessions/capture","start_void_session_url":"https://bogus-app/payment-sessions/void","confirmation_callback_url":null,"supported_payment_methods":["visa","master","american_express","discover","diners_club","jcb"],"supported_countries":["GG","AF","AZ","BH"],"test_mode_available":true,"merchant_label":"Offsite Payments App Extension","default_buyer_label":null,"buyer_label_to_locale":null,"supports_3ds":true,"supports_oversell_protection":false,"api_version":"2023-10","supports_installments":true,"supports_deferred_payments":true,"multiple_capture":false}',
      },
    }

    // When
    const got = await buildTomlObject(extension1)

    // Then
    expect(got).toEqual(`api_version = "2023-10"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"

[[targeting]]
target = "payments.offsite.render"

[[configuration]]
payment_session_url = "https://bogus-app/payment-sessions/start"
refund_session_url = "https://bogus-app/payment-sessions/refund"
capture_session_url = "https://bogus-app/payment-sessions/capture"
void_session_url = "https://bogus-app/payment-sessions/void"
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
`)
  })

  test('correctly builds a toml string for a credit card app', async () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '30366498817',
      uuid: '626ab61a-e494-4e16-b511-e8721ec011a4',
      title: 'Bogus Pay',
      type: 'payments_app',
      draftVersion: {
        config:
          '{"start_payment_session_url":"https://bogus-app/payment-sessions/start","start_refund_session_url":"https://bogus-app/payment-sessions/refund","start_capture_session_url":"https://bogus-app/payment-sessions/capture","start_void_session_url":"https://bogus-app/payment-sessions/void","confirmation_callback_url":null,"supported_payment_methods":["visa","master","american_express","discover","diners_club","jcb"],"supported_countries":["GG","AF","AZ","BH"],"test_mode_available":true,"merchant_label":"Offsite Payments App Extension","default_buyer_label":null,"buyer_label_to_locale":null,"supports_3ds":true,"supports_oversell_protection":false,"api_version":"2023-10","supports_installments":true,"supports_deferred_payments":true,"multiple_capture":false}',
      },
    }

    // When
    const got = await buildTomlObject(extension1)

    // Then
    expect(got).toEqual(`api_version = "2023-10"

[[extensions]]
name = "Bogus Pay"
type = "payments_extension"
handle = "bogus-pay"

[[targeting]]
target = "payments.offsite.render"

[[configuration]]
payment_session_url = "https://bogus-app/payment-sessions/start"
refund_session_url = "https://bogus-app/payment-sessions/refund"
capture_session_url = "https://bogus-app/payment-sessions/capture"
void_session_url = "https://bogus-app/payment-sessions/void"
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
`)
  })
})
