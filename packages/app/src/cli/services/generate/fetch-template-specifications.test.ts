import {fetchExtensionTemplates} from './fetch-template-specifications.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {describe, expect, test} from 'vitest'

describe('fetchTemplateSpecifications', () => {
  test('returns the remote specs', async () => {
    // Given
    const enabledSpecifications = ['function']

    // When
    const got: ExtensionTemplate[] = await fetchExtensionTemplates(
      testDeveloperPlatformClient(),
      testOrganizationApp(),
      enabledSpecifications,
    )

    // Then
    expect(got.length).toEqual(4)
    const identifiers = got.map((spec) => spec.identifier)
    expect(identifiers).toContain('cart_checkout_validation')
    expect(identifiers).toContain('cart_transform')
    expect(identifiers).toContain('product_discounts')
    expect(identifiers).toContain('order_discounts')

    // Since the ui_extension specification is not enabled, this template should not be included.
    expect(identifiers).not.toContain('ui_extension')
  })
})
