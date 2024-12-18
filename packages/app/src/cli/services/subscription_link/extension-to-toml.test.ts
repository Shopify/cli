import {buildTomlObject, SubscriptionLinkDashboardConfig} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

const defaultDashboardConfig: SubscriptionLinkDashboardConfig = {
  pattern: '/subscriptions{?customer_id,shop}&id={contract_id}',
}
describe('extension-to-toml', () => {
  test('converts the dashboard config to the new cli config', () => {
    // Given
    const extension: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'custom subscription link',
      type: 'subscription_link',
      draftVersion: {
        config: JSON.stringify(defaultDashboardConfig),
      },
    }

    // When
    const got = buildTomlObject(extension)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "subscription_link_extension"
name = "custom subscription link"
handle = "custom-subscription-link"
pattern = "/subscriptions{?customer_id,shop}&id={contract_id}"
`)
  })

  test('truncates the handle if the title has >50 characters', () => {
    // Given
    const extension: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'subscription link @ test! 1234555555555444444777777888888812345555555554444447777778888888',
      type: 'subscription_link',
      draftVersion: {
        config: JSON.stringify(defaultDashboardConfig),
      },
    }

    // When
    const got = buildTomlObject(extension)

    // Then
    expect(got).toContain('handle = "subscription-link-test-123455555555544444477777"')
  })
})
