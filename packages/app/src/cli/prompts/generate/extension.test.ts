import generateExtensionPrompt, {buildChoices, extensionFlavorQuestion} from './extension.js'
import {testApp} from '../../models/app/app.test-data.js'
import {
  loadLocalFunctionSpecifications,
  loadLocalUIExtensionsSpecifications,
} from '../../models/extensions/specifications.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/context/local'

vi.mock('@shopify/cli-kit/node/context/local')

beforeEach(() => {
  vi.mocked(isShopify).mockResolvedValue(true)
  vi.mocked(isUnitTest).mockResolvedValue(true)
})

describe('extension prompt', async () => {
  // ALL UI Specs, filter out theme
  const allUISpecs = await loadLocalUIExtensionsSpecifications()
  const allFunctionSpecs = await loadLocalFunctionSpecifications()

  const extensionTypeQuestion = {
    type: 'select',
    name: 'extensionType',
    message: 'Type of extension?',
    choices: buildChoices(allUISpecs),
  }
  const extensionNameQuestion = {
    type: 'input',
    name: 'name',
    message: "Your extension's working name?",
    default: expect.stringMatching(/^\w+-\w+-ext$/),
  }

  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'ext', extensionType: 'ui_extension'}
    const options = {directory: '/', app: testApp(), reset: false, extensionSpecifications: allUISpecs}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([extensionTypeQuestion, extensionNameQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const prompt = vi.fn()
    const answers = {extensionType: 'ui_extension'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionSpecifications: allUISpecs,
    }

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([extensionTypeQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const prompt = vi.fn()
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
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).toHaveBeenNthCalledWith(2, [extensionFlavorQuestion(postPurchaseSpec)])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const prompt = vi.fn()
    const answers = {}
    const options = {
      name: 'my-special-extension',
      extensionType: 'ui_extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionSpecifications: allUISpecs,
    }

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).not.toHaveBeenCalledWith([extensionFlavorQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a function extension prompts for the language', async () => {
    const prompt = vi.fn()
    const answers = {extensionLanguage: 'rust'}
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
    prompt.mockResolvedValue(answers)

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).toHaveBeenNthCalledWith(2, [extensionFlavorQuestion(productDiscountsSpec)])

    expect(got).toEqual({...options, ...answers})
  })

  it('when extensionFlavor is passed, only compatible extensions are shown', async () => {
    // Given
    const prompt = vi.fn()
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
      type: 'select',
      name: 'extensionType',
      message: 'Type of extension?',
      choices: buildChoices(allFunctionSpecs),
    }

    prompt.mockResolvedValue(answers)

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([functionTypes])
    expect(got).toEqual({...options, ...answers})
  })
})
