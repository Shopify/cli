import generateExtensionPrompts, {buildChoices} from './extension.js'
import {testApp, testRemoteExtensionTemplates} from '../../models/app/app.test-data.js'

import {ExtensionTemplate} from '../../models/app/template.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
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
  const allTemplates = testRemoteExtensionTemplates

  const extensionTypeQuestion = {
    message: 'Type of extension?',
    choices: buildChoices(allTemplates),
  }
  const extensionNameQuestion = {
    message: 'Name your extension:',
    defaultValue: expect.stringMatching(/^\w+-\w+(-\w+)?$/),
  }

  test('when name is not passed', async () => {
    const answers = {name: 'ext', extensionType: 'subscription_ui'}
    const options = {
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('subscription_ui', allTemplates)

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
      extensionContent: {name: 'ext', flavor: undefined},
    })
  })

  test('when name is passed', async () => {
    const answers = {extensionType: 'subscription_ui'}
    const options = {
      name: 'my-special-extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('subscription_ui', allTemplates)

    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce(answers.extensionType)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderAutocompletePrompt).toHaveBeenCalledWith(extensionTypeQuestion)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: {name: 'my-special-extension', flavor: undefined},
    })
  })

  test('when scaffolding a UI extension with multiple flavors prompts for language/framework preference', async () => {
    const answers = {extensionFlavor: 'react'}
    const options = {
      name: 'my-special-extension',
      templateType: 'subscription_ui',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('subscription_ui', allTemplates)

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
      extensionContent: {name: 'my-special-extension', flavor: 'react'},
    })
  })

  test('when scaffolding an extension with only 1 flavor does not prompt for language/framework preference', async () => {
    const options = {
      name: 'my-special-extension',
      templateType: 'theme_app_extension',
      directory: '/',
      app: testApp(),
      reset: false,
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = findExtensionTemplate('theme_app_extension', allTemplates)

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: {name: 'my-special-extension', flavor: 'liquid'},
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
      extensionTemplates: allTemplates,
      unavailableExtensions: [],
    }
    const extensionTemplate = allTemplates.find((template) => template.identifier === 'product_discounts')

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
      extensionContent: {name: 'my-product-discount', flavor: 'rust'},
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
    const extensionTemplate = allTemplates.find((template) => template.identifier === 'product_discounts')
    const rustTemplates = allTemplates.filter((template) =>
      template.supportedFlavors.some((flavor) => flavor.value === extensionFlavor),
    )

    // only function types should be shown if flavor is rust
    const functionTypes = {
      message: 'Type of extension?',
      choices: buildChoices(rustTemplates),
    }
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('product_discounts')

    // When
    const got = await generateExtensionPrompts(options)

    // Then
    expect(renderAutocompletePrompt).toHaveBeenCalledWith(functionTypes)
    expect(got).toEqual({
      extensionTemplate,
      extensionContent: {name: 'my-product-discount', flavor: 'rust'},
    })
  })
})

describe('build choices', async () => {
  test('when none of the extensions has sortPriority then choices should be sorted ok', async () => {
    // Given
    const templates = testRemoteExtensionTemplates.map((template) => ({...template, sortPriority: undefined}))
    const sortedTemplateLabels = templates.map((template) => template.name).sort()

    // When
    const got = buildChoices(templates)

    // Then
    expect(got.length).equals(sortedTemplateLabels.length)
    expect(got.map((choice) => choice.label)).toEqual(sortedTemplateLabels)
  })

  test('when some of the extensions have sortPriority then those extensions should be listed first', async () => {
    // Given
    const extensions = [
      {...testRemoteExtensionTemplates[0], name: 'aaaaa', sortPriority: undefined},
      {...testRemoteExtensionTemplates[0], name: 'bbbbb', sortPriority: undefined},
      {...testRemoteExtensionTemplates[0], name: 'ccccc', sortPriority: 1},
      // cast because ... makes TS think each property is "key?: type | undefined" instead of "key?: type"
    ] as ExtensionTemplate[]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(3)
    expect(got[0]?.label).equals('ccccc')
    expect(got[1]?.label).equals('aaaaa')
    expect(got[2]?.label).equals('bbbbb')
  })

  test('when some of the extensions has the same sortPriority then choices should be sorted based on priority followed by alphabetization', async () => {
    // Given
    const extensions = [
      {...testRemoteExtensionTemplates[0], name: 'ddddd', sortPriority: 1},
      {...testRemoteExtensionTemplates[0], name: 'ccccc', sortPriority: 1},
      {...testRemoteExtensionTemplates[0], name: 'bbbbb', sortPriority: undefined},
      {...testRemoteExtensionTemplates[0], name: 'aaaaa', sortPriority: 1},
      // cast because ... makes TS think each property is "key?: type | undefined" instead of "key?: type"
    ] as ExtensionTemplate[]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(4)
    expect(got[0]?.label).equals('aaaaa')
    expect(got[1]?.label).equals('ccccc')
    expect(got[2]?.label).equals('ddddd')
    expect(got[3]?.label).equals('bbbbb')
  })

  test('when all the extensions have different sortPriority then choices should be sorted based on priority only', async () => {
    // Given
    const extensions = [
      {...testRemoteExtensionTemplates[0], name: 'aaaaa', sortPriority: 3},
      {...testRemoteExtensionTemplates[0], name: 'bbbbb', sortPriority: 2},
      {...testRemoteExtensionTemplates[0], name: 'ccccc', sortPriority: 1},
      // cast because ... makes TS think each property is "key?: type | undefined" instead of "key?: type"
    ] as ExtensionTemplate[]

    // When
    const got = buildChoices(extensions)

    // Then
    expect(got.length).equals(3)
    expect(got[0]?.label).equals('ccccc')
    expect(got[1]?.label).equals('bbbbb')
    expect(got[2]?.label).equals('aaaaa')
  })
})

function findExtensionTemplate(type: string | undefined, extensionTemplates: ExtensionTemplate[]) {
  const template = extensionTemplates.find((extension) => extension.identifier === type)
  if (template) {
    return template
  }
  const identifiers = extensionTemplates.map((extension) => extension.identifier).join(', ')
  throw new Error(`Extension template not found for type: ${type}, available identifiers: ${identifiers}`)
}
