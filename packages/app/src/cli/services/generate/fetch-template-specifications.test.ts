import {fetchExtensionTemplates} from './fetch-template-specifications.js'
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

  test('returns only the jsx flavor when REMOTE_DOM_EXPERIMENT is enabled', async () => {
    // Given
    const enabledSpecifications = ['ui_extension']
    const jsxFlavor: ExtensionFlavor = {
      name: 'React',
      value: 'react',
    }
    vi.spyOn(experimentModule, 'isRemoteDomExperimentEnabled').mockReturnValueOnce(true)

    // When
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
              supportedFlavors: [
                {
                  name: 'JavaScript',
                  value: 'vanilla-js',
                },
                {
                  name: 'TypeScript',
                  value: 'typescript',
                },
                jsxFlavor,
              ],
            },
          ]),
      }),
      testOrganizationApp(),
      enabledSpecifications,
    )

    // Then
    expect(templates.length).toEqual(1)
    expect(templates[0]!.supportedFlavors).toEqual([jsxFlavor])
  })
})
