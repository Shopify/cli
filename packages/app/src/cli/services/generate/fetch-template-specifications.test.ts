import {fetchExtensionTemplates} from './fetch-template-specifications.js'
import {ExtensionFlavorValue} from './extension.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('fetchTemplateSpecifications', () => {
  test('returns the remote specs', async () => {
    // Given
    const enabledSpecifications = ['function']

    // When
    const {templates: got} = await fetchExtensionTemplates(
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

  describe('ui_extension', () => {
    const allFlavors = [
      {
        name: 'JavaScript React',
        value: 'react' as ExtensionFlavorValue,
        path: 'admin-action',
      },
      {
        name: 'JavaScript',
        value: 'vanilla-js' as ExtensionFlavorValue,
        path: 'admin-action',
      },
      {
        name: 'TypeScript React',
        value: 'typescript-react' as ExtensionFlavorValue,
        path: 'admin-action',
      },
      {
        name: 'TypeScript',
        value: 'typescript' as ExtensionFlavorValue,
        path: 'admin-action',
      },
      {
        name: 'Preact',
        value: 'preact' as ExtensionFlavorValue,
      },
    ]

    async function getTemplates() {
      const {templates} = await fetchExtensionTemplates(
        testDeveloperPlatformClient({
          templateSpecifications: () =>
            Promise.resolve({
              templates: [
                {
                  identifier: 'ui_extension',
                  name: 'UI Extension',
                  defaultName: 'ui-extension',
                  group: 'Merchant Admin',
                  supportLinks: [],
                  type: 'ui_extension',
                  url: 'https://github.com/Shopify/extensions-templates',
                  extensionPoints: [],
                  supportedFlavors: allFlavors,
                },
              ],
              groupOrder: [],
            }),
        }),
        testOrganizationApp(),
        ['ui_extension'],
      )
      return templates
    }

    test('includes all flavors', async () => {
      // When
      const templates = await getTemplates()

      // Then
      expect(templates[0]!.supportedFlavors).toEqual(allFlavors)
    })
  })
})
