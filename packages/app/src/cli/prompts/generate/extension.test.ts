import generateExtensionPrompt, {buildChoices} from './extension.js'
import {testApp} from '../../models/app/app.test-data.js'
import {
  loadLocalFunctionSpecifications,
  loadLocalUIExtensionsSpecifications,
  loadLocalExtensionsSpecifications,
} from '../../models/extensions/specifications.js'
import {convertSpecificationsToTemplate, TemplateSpecification} from '../../models/app/template.js'
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
  const allUISpecs = convertSpecificationsToTemplate(await loadLocalUIExtensionsSpecifications())
  const allFunctionSpecs = convertSpecificationsToTemplate(await loadLocalFunctionSpecifications())
  const allSpecs = convertSpecificationsToTemplate(await loadLocalExtensionsSpecifications())

  const extensionTypeQuestion = {
    message: 'Type of extension?',
    choices: buildChoices(allUISpecs),
  }
  const extensionNameQuestion = {
    message: 'Extension name (internal only)',
    defaultValue: expect.stringMatching(/^\w+-\w+-ext$/),
  }

  it('when name is not passed', async () => {
    const answers = {name: 'ext', extensionType: 'ui_extension'}
    const options = {
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allUISpecs,
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('ui_extension', allUISpecs)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)
    vi.mocked(renderTextPrompt).mockResolvedValue(answers.name)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(renderTextPrompt).toHaveBeenCalledWith(extensionNameQuestion)
    expect(got).toEqual({
      name: specification?.externalName,
      extensionContent: [{name: 'ext', specification}],
    })
  })

  it('when name is passed', async () => {
    const answers = {extensionType: 'ui_extension'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allUISpecs,
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('ui_extension', allUISpecs)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionType)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(got).toEqual({
      name: specification?.externalName,
      extensionContent: [{name: 'my-special-extension', specification}],
    })
  })

  it('when scaffolding a UI extension type prompts for language/framework preference', async () => {
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

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'What would you like to work in?',
      choices: specification?.supportedFlavors.map((flavor) => {
        return {label: flavor.name, value: flavor.value}
      }),
      defaultValue: 'react',
    })
    expect(got).toEqual({
      name: specification?.externalName,
      extensionContent: [{name: 'my-special-extension', specification, extensionFlavor: answers.extensionFlavor}],
    })
  })

  it('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const options = {
      name: 'my-special-extension',
      templateType: 'theme',
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allSpecs,
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('theme', allSpecs)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({
      name: specification?.externalName,
      extensionContent: [{name: 'my-special-extension', specification}],
    })
  })

  it('when scaffolding a function extension prompts for the language', async () => {
    const answers = {extensionFlavor: 'rust'}
    const options = {
      name: 'my-product-discount',
      templateType: 'product_discounts',
      directory: '/',
      app: testApp(),
      reset: false,
      templateSpecifications: allFunctionSpecs,
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('product_discounts', allFunctionSpecs)

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce(answers.extensionFlavor)

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'What would you like to work in?',
      choices: specification!.supportedFlavors.map((flavor) => {
        return {label: flavor.name, value: flavor.value}
      }),
      defaultValue: 'react',
    })

    expect(got).toEqual({
      name: specification?.externalName,
      extensionContent: [{name: 'my-product-discount', specification, extensionFlavor: answers.extensionFlavor}],
    })
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
      templateSpecifications: [...allFunctionSpecs, ...allUISpecs],
      unavailableExtensions: [],
    }
    const specification = findExtensionSpecification('product_discounts', allFunctionSpecs)

    // only function types should be shown if flavor is rust
    const functionTypes = {
      message: 'Type of extension?',
      choices: buildChoices(allFunctionSpecs),
    }
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('product_discounts')

    // When
    const got = await generateExtensionPrompt(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith(functionTypes)
    expect(got).toEqual({
      name: specification?.externalName,
      extensionContent: [{name: 'my-product-discount', specification, extensionFlavor: 'rust'}],
    })
  })
})

function findExtensionSpecification(type: string | undefined, specifications: TemplateSpecification[]) {
  // To support legacy extensions specs, we need to check both the identifier and the external identifier
  return specifications
    .flatMap((spec) => spec.types)
    .find((extension) => extension.identifier === type || extension.externalIdentifier === type)
}
