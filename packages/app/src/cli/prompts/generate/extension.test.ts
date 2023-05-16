import generateExtensionPrompts, {buildChoices} from './extension.js'
import {testApp, testRemoteTemplateSpecifications} from '../../models/app/app.test-data.js'

import {TemplateSpecification} from '../../models/app/template.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import themeSpecification from '../../models/templates/theme-specifications/theme.js'
import {localTemplateSpecifications} from '../../services/generate/fetch-template-specifications.js'
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
  const allUISpecs = localTemplateSpecifications()
  const allFunctionSpecs = testRemoteTemplateSpecifications
  const allSpecs = allFunctionSpecs.concat(allUISpecs).concat(themeSpecification)

  const extensionTypeQuestion = {
    message: 'Type of extension?',
    choices: buildChoices(allUISpecs),
  }
  const extensionNameQuestion = {
    message: 'Extension name (internal only)',
    defaultValue: expect.stringMatching(/^\w+-\w+-ext$/),
  }

  test('when name is not passed', async () => {
    const answers = {name: 'ext', extensionType: 'checkout_ui_extension'}
    const options = {
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allUISpecs,
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('checkout_ui_extension', allUISpecs)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)
    vi.mocked(renderTextPrompt).mockResolvedValue(answers.name)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(renderTextPrompt).toHaveBeenCalledWith(extensionNameQuestion)
    expect(got).toEqual({
      templateSpecification: specification,
      extensionContent: [{name: 'ext', flavor: undefined, index: 0}],
    })
  })

  test('when name is passed', async () => {
    const answers = {extensionType: 'checkout_ui_extension'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allUISpecs,
      unavailableExtensions: [],
    }
    const templateSpecification = findExtensionSpecification('checkout_ui_extension', allUISpecs)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(got).toEqual({
      templateSpecification,
      extensionContent: [{name: 'my-special-extension', flavor: undefined, index: 0}],
    })
  })

  test('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const answers = {extensionFlavor: 'react'}
    const options = {
      name: 'my-special-extension',
      templateType: 'checkout_post_purchase',
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allUISpecs,
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('checkout_post_purchase', allUISpecs)

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
      templateSpecification: specification,
      extensionContent: [{name: 'my-special-extension', flavor: 'react', index: 0}],
    })
  })

  test('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const options = {
      name: 'my-special-extension',
      templateType: 'theme',
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allSpecs,
      unavailableExtensions: [],
    }

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({
      templateSpecification: themeSpecification,
      extensionContent: [{name: 'my-special-extension', index: 0, flavor: 'vanilla-js'}],
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
      templateSpecifications: allFunctionSpecs,
      unavailableExtensions: [],
    }
    const templateSpecification = allFunctionSpecs.find((template) => template.identifier === 'product_discounts')

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
      templateSpecification,
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
      templateSpecifications: allSpecs,
      unavailableExtensions: [],
    }
    const templateSpecification = allFunctionSpecs.find((template) => template.identifier === 'product_discounts')

    // only function types should be shown if flavor is rust
    const functionTypes = {
      message: 'Type of extension?',
      choices: buildChoices(allFunctionSpecs),
    }
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('product_discounts')

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(functionTypes)
    expect(got).toEqual({
      templateSpecification,
      extensionContent: [{name: 'my-product-discount', index: 0, flavor: 'rust'}],
    })
  })
})

function findExtensionSpecification(type: string | undefined, specifications: TemplateSpecification[]) {
  return specifications.find((extension) => extension.identifier === type)
}
