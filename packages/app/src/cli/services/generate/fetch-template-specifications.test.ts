import {fetchExtensionTemplates} from './fetch-template-specifications.js'
import {ExtensionFlavorValue} from './extension.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {ExtensionTemplate, ExtensionFlavor} from '../../models/app/template.js'
import {describe, expect, test, vi} from 'vitest'
import * as experimentModule from '@shopify/cli-kit/node/is-remote-dom-experiment-enabled'

vi.mock('@shopify/cli-kit/node/is-remote-dom-experiment-enabled', () => ({
  isRemoteDomExperimentEnabled: vi.fn().mockReturnValue(false),
}))

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

  describe('ui_extension', () => {
    const preactFlavor: ExtensionFlavor = {
      name: 'Preact',
      value: 'preact' as ExtensionFlavorValue,
    }

    const oldFlavors = [
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
    ]
    const allFlavors = [...oldFlavors, preactFlavor]

    async function getTemplates() {
      const templates: ExtensionTemplate[] = await fetchExtensionTemplates(
        testDeveloperPlatformClient({
          templateSpecifications: () =>
            Promise.resolve([
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
            ]),
        }),
        testOrganizationApp(),
        ['ui_extension'],
      )
      return templates
    }

    test('returns only the preact flavor when REMOTE_DOM_EXPERIMENT is enabled', async () => {
      // Given
      vi.spyOn(experimentModule, 'isRemoteDomExperimentEnabled').mockReturnValueOnce(true)

      // When
      const templates = await getTemplates()

      // Then
      expect(templates[0]!.supportedFlavors).toEqual([preactFlavor])
    })

    test('excludes the preact flavor by default', async () => {
      // When
      const templates = await getTemplates()

      // Then
      expect(templates[0]!.supportedFlavors).toEqual(oldFlavors)
    })
  })
})
