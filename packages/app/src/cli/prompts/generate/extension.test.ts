import generateExtensionPrompt, {buildChoices} from './extension.js'
import {testApp} from '../../models/app/app.test-data.js'
import {
  loadLocalFunctionSpecifications,
  loadLocalUIExtensionsSpecifications,
  loadLocalExtensionsSpecifications,
} from '../../models/extensions/specifications.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => {
  vi.mocked(isShopify).mockResolvedValue(true)
  vi.mocked(isUnitTest).mockResolvedValue(true)
})

describe('extension prompt', async () => {
  // ALL UI Specs, filter out theme
  const allUISpecs = await loadLocalUIExtensionsSpecifications()
  const allFunctionSpecs = await loadLocalFunctionSpecifications()
  const allSpecs = await loadLocalExtensionsSpecifications()

  const extensionTypeQuestion = {
    message: 'Type of extension?',
    choices: buildChoices(allUISpecs),
  }
  const extensionNameQuestion = {
    message: "Your extension's working name?",
    defaultValue: expect.stringMatching(/^\w+-\w+-ext$/),
  }

  it('when name is not passed', async () => {
    const answers = {name: 'ext', extensionType: 'ui_extension'}
    const options = {directory: '/', app: testApp(), reset: false, extensionSpecifications: allUISpecs}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)
    vi.mocked(renderTextPrompt).mockResolvedValue(answers.name)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(renderTextPrompt).toHaveBeenCalledWith(extensionNameQuestion)
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const answers = {extensionType: 'ui_extension'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionSpecifications: allUISpecs,
    }

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const answers = {extensionFlavor: 'react'}
    const postPurchaseSpec = allUISpecs.find((spec) => spec.identifier === 'checkout_post_purchase')!
    const options = {
      name: 'my-special-extension',
      extensionType: 'checkout_post_purchase',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionSpecifications: allUISpecs,
    }

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionFlavor)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'What would you like to work in?',
      choices: postPurchaseSpec.supportedFlavors.map((flavor) => {
        return {label: flavor.name, value: flavor.value}
      }),
      defaultValue: 'react',
    })
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const options = {
      name: 'my-special-extension',
      extensionType: 'theme',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionSpecifications: allSpecs,
    }

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(got).toEqual(options)
  })

  it('when scaffolding a function extension prompts for the language', async () => {
    const answers = {extensionFlavor: 'rust'}
    const productDiscountsSpec = allFunctionSpecs.find((spec) => spec.identifier === 'product_discounts')!
    const options = {
      name: 'my-product-discount',
      extensionType: 'product_discounts',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionSpecifications: allFunctionSpecs,
    }

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionFlavor)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'What would you like to work in?',
      choices: productDiscountsSpec.supportedFlavors.map((flavor) => {
        return {label: flavor.name, value: flavor.value}
      }),
      defaultValue: 'react',
    })

    expect(got).toEqual({...options, ...answers})
  })

  it('when extensionFlavor is passed, only compatible extensions are shown', async () => {
    // Given
    const answers = {}
    const options = {
      name: 'my-product-discount',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionFlavor: 'rust',
      extensionSpecifications: [...allFunctionSpecs, ...allUISpecs],
    }

    // only function types should be shown if flavor is rust
    const functionTypes = {
      message: 'Type of extension?',
      choices: buildChoices(allFunctionSpecs),
    }

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(functionTypes)
    expect(got).toEqual({...options, ...answers})
  })
})
