import generateExtensionPrompts, {buildChoices} from './extension.js'
import {testApp, testRemoteExtensionTemplates} from '../../models/app/app.test-data.js'

import {ExtensionTemplate} from '../../models/app/template.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import themeExtension from '../../models/templates/theme-specifications/theme.js'
import {localExtensionTemplates} from '../../services/generate/fetch-template-specifications.js'
import {describe, expect, vi, beforeEach, test} from 'vitest'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => {
  vi.mocked(isShopify).mockResolvedValue(true)
  vi.mocked(isUnitTest).mockResolvedValue(true)
})

describe('extension prompt', async () => {
  const allUITemplates = localExtensionTemplates()
  const allFunctionTemplates = testRemoteExtensionTemplates
  const allTemplates = allFunctionTemplates.concat(allUITemplates)

  const extensionTypeQuestion = {
    message: 'Type of extension?',
    choices: buildChoices(allUITemplates),
  }
  const extensionNameQuestion = {
    message: 'Extension name (internal only)',
    defaultValue: expect.stringMatching(/^\w+-\w+-ext$/),
  }

  test('when name is not passed', async () => {
    const answers = {name: 'ext', extensionType: 'ui_extension'}
    const options = {
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allUITemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('ui_extension', allUITemplates)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)
    vi.mocked(renderTextPrompt).mockResolvedValue(answers.name)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(renderTextPrompt).toHaveBeenCalledWith(extensionNameQuestion)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'ext', flavor: undefined, index: 0}],
    })
  })

  test('when name is passed', async () => {
    const answers = {extensionType: 'ui_extension'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allUITemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('ui_extension', allUITemplates)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'my-special-extension', flavor: undefined, index: 0}],
    })
  })

  test('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const answers = {extensionFlavor: 'react'}
    const options = {
      name: 'my-special-extension',
      templateType: 'post_purchase_ui',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allUITemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('post_purchase_ui', allUITemplates)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionFlavor)
    const expectedFlavors = [
      {label: 'TypeScript', value: 'typescript'},
      {label: 'JavaScript', value: 'vanilla-js'},
      {label: 'TypeScript React', value: 'typescript-react'},
      {label: 'JavaScript React', value: 'react'},
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
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('product_discounts')

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(functionTypes)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: [{name: 'my-product-discount', index: 0, flavor: 'rust'}],
    })
  })
})

function findExtensionTemplate(type: string | undefined, extensionTemplates: ExtensionTemplate[]) {
  return extensionTemplates.find((extension) => extension.identifier === type)
}
