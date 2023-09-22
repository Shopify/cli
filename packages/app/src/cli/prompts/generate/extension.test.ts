import generateExtensionPrompts, {buildChoices} from './extension.js'
import {testApp, testLocalExtensionTemplates, testRemoteExtensionTemplates} from '../../models/app/app.test-data.js'

import {ExtensionTemplate} from '../../models/app/template.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import themeExtension from '../../models/templates/theme-specifications/theme.js'
import productSubscriptionUIExtension from '../../models/templates/ui-specifications/product_subscription.js'
import webPixelUIExtension from '../../models/templates/ui-specifications/web_pixel_extension.js'
import {describe, expect, vi, beforeEach, test} from 'vitest'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {renderAutocompletePrompt, renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => {
  vi.mocked(isShopify).mockResolvedValue(true)
  vi.mocked(isUnitTest).mockResolvedValue(true)
})

describe('extension prompt', async () => {
  const allUITemplates = testLocalExtensionTemplates
  const allFunctionTemplates = testRemoteExtensionTemplates
  const allTemplates = allFunctionTemplates.concat(allUITemplates)

  const extensionTypeQuestion = {
    message: 'Type of extension?',
    choices: buildChoices(allUITemplates),
  }
  const extensionNameQuestion = {
    message: 'Name your extension:',
    defaultValue: expect.stringMatching(/^\w+-\w+$/),
  }

  test('when name is not passed', async () => {
    const answers = {name: 'ext', extensionType: 'subscription_ui'}
    const options = {
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allUITemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('subscription_ui', allUITemplates)

    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce(answers.extensionType)
    vi.mocked(renderTextPrompt).mockResolvedValue(answers.name)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderAutocompletePrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(renderTextPrompt).toHaveBeenCalledWith(extensionNameQuestion)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'ext', flavor: undefined, index: 0}],
    })
  })

  test('when name is passed', async () => {
    const answers = {extensionType: 'subscription_ui'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allUITemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('subscription_ui', allUITemplates)

    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce(answers.extensionType)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderAutocompletePrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'my-special-extension', flavor: undefined, index: 0}],
    })
  })

  test('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const answers = {extensionFlavor: 'react'}
    const options = {
      name: 'my-special-extension',
      templateType: 'subscription_ui',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allUITemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('subscription_ui', allUITemplates)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionFlavor)
    const expectedFlavors = [
      {label: 'JavaScript React', value: 'react'},
      {label: 'JavaScript', value: 'vanilla-js'},
      {label: 'TypeScript React', value: 'typescript-react'},
      {label: 'TypeScript', value: 'typescript'},
    ]

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'What would you like to work in?',
      choices: expectedFlavors,
      defaultValue: 'react',
    })
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'my-special-extension', flavor: 'react', index: 0}],
    })
  })

  test('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const options = {
      name: 'my-special-extension',
      templateType: 'theme_app_extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({
      extensionTemplate: themeExtension,
      extensionContent: [{name: 'my-special-extension', index: 0, flavor: 'liquid'}],
    })
  })

  test('when scaffolding a function extension prompts for the language', async () => {
    const answers = {extensionFlavor: 'rust'}
    const expectedFlavors = [
      {label: 'Wasm', value: 'wasm'},
      {label: 'Rust', value: 'rust'},
    ]
    const options = {
      name: 'my-product-discount',
      templateType: 'product_discounts',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allFunctionTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = allFunctionTemplates.find((template) => template.identifier === 'product_discounts')

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionFlavor)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'What would you like to work in?',
      choices: expectedFlavors,
      defaultValue: 'react',
    })

    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'my-product-discount', flavor: 'rust', index: 0}],
    })
  })

  test('when extensionFlavor is passed, only compatible extensions are shown', async () => {
    // Given
    const extensionFlavor: ExtensionFlavorValue = 'rust'
    const options = {
      name: 'my-product-discount',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionFlavor,
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = allFunctionTemplates.find((template) => template.identifier === 'product_discounts')

    // only function types should be shown if flavor is rust
    const functionTypes = {
      message: 'Type of extension?',
      choices: buildChoices(allFunctionTemplates),
    }
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('product_discounts')

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderAutocompletePrompt).toHaveBeenCalledWith(functionTypes)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'my-product-discount', index: 0, flavor: 'rust'}],
    })
  })
})

describe('build choices', async () => {
  test('when none of the extensions has sortPriority then choices should be sorted ok', async () => {
    // Given
    const theme = {...themeExtension, sortPriority: undefined}
    const productSubscription = {...productSubscriptionUIExtension, sortPriority: undefined}
    const webPixel = {...webPixelUIExtension, sortPriority: undefined}
    const extensions = [theme, productSubscription, webPixel]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(3)
    expect(got[0]?.label).equals(productSubscription.name)
    expect(got[1]?.label).equals(themeExtension.name)
    expect(got[2]?.label).equals(webPixel.name)
  })

  test('when some of the extensions has sortPriority then choices should be sorted ok', async () => {
    // Given
    const theme = {...themeExtension, sortPriority: undefined}
    const productSubscription = {...productSubscriptionUIExtension, sortPriority: undefined}
    const webPixel = {...webPixelUIExtension, sortPriority: 1}
    const extensions = [theme, productSubscription, webPixel]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(3)
    expect(got[0]?.label).equals(webPixel.name)
    expect(got[1]?.label).equals(productSubscription.name)
    expect(got[2]?.label).equals(theme.name)
  })

  test('when some of the extensions has the same sortPriority then choices should be sorted ok', async () => {
    // Given
    const theme = {...themeExtension, sortPriority: undefined}
    const productSubscription = {...productSubscriptionUIExtension, sortPriority: 1}
    const webPixel = {...webPixelUIExtension, sortPriority: 1}
    const extensions = [theme, productSubscription, webPixel]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(3)
    expect(got[0]?.label).equals(productSubscription.name)
    expect(got[1]?.label).equals(webPixel.name)
    expect(got[2]?.label).equals(theme.name)
  })

  test('when all the extensions has different sortPriority then choices should be sorted ok', async () => {
    // Given
    const theme = {...themeExtension, sortPriority: 3}
    const productSubscription = {...productSubscriptionUIExtension, sortPriority: 2}
    const webPixel = {...webPixelUIExtension, sortPriority: 1}
    const extensions = [theme, productSubscription, webPixel]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(3)
    expect(got[0]?.label).equals(webPixel.name)
    expect(got[1]?.label).equals(productSubscription.name)
    expect(got[2]?.label).equals(theme.name)
  })
})

function findExtensionTemplate(type: string | undefined, extensionTemplates: ExtensionTemplate[]) {
  return extensionTemplates.find((extension) => extension.identifier === type)
}
