import scaffoldExtensionPrompt, {extensionTypeChoiceSorterByGroupAndName} from './extension'
import {extensions, getExtensionOutputConfig} from '../../constants'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {environment} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    environment: {
      local: {
        isShopify: vi.fn(),
      },
    },
  }
})

beforeEach(() => {
  vi.mocked(environment.local.isShopify).mockResolvedValue(true)
})

describe('extension prompt', async () => {
  const extensionTypeQuestion = {
    type: 'select',
    name: 'extensionType',
    message: 'Type of extension?',
    choices: await buildChoices(),
  }
  const extensionNameQuestion = {
    type: 'input',
    name: 'name',
    message: "Your extension's working name?",
    default: expect.stringMatching(/^\w+-\w+-ext-\d+$/),
  }
  const extensionFlavorQuestion = {
    type: 'select',
    name: 'extensionFlavor',
    message: 'Choose a starting template for your extension',
    choices: [
      {name: 'React', value: 'react'},
      {name: 'vanilla JavaScript', value: 'vanilla-js'},
    ],
    default: 'react',
  }

  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'ext'}
    const options = {extensionTypesAlreadyAtQuota: []}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([extensionTypeQuestion, extensionNameQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'my-special-extension'}
    const options = {name: 'my-special-extension', extensionTypesAlreadyAtQuota: []}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([extensionTypeQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when extensionTypesAlreadyAtQuota is not empty', async () => {
    const prompt = vi.fn()
    const answers = {name: 'my-special-extension'}
    const options = {name: 'my-special-extension', extensionTypesAlreadyAtQuota: ['theme']}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'extensionType',
        message: 'Type of extension?',
        choices: (await buildChoices()).filter((choice) => choice.name !== 'theme app extension'),
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const prompt = vi.fn()
    const answers = {extensionFlavor: 'react'}
    const options = {
      name: 'my-special-extension',
      extensionTypesAlreadyAtQuota: [],
      extensionType: 'checkout_post_purchase',
    }

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).toHaveBeenNthCalledWith(2, [extensionFlavorQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const prompt = vi.fn()
    const answers = {}
    const options = {
      name: 'my-special-extension',
      extensionTypesAlreadyAtQuota: [],
      extensionType: 'theme',
    }

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).not.toHaveBeenCalledWith([extensionFlavorQuestion])
    expect(got).toEqual({...options, ...answers})
  })
})

const buildChoices = async (): Promise<
  {
    name: string
    value: string
  }[]
> => {
  const isShopify = await environment.local.isShopify()
  const supportedExtensions = isShopify ? extensions.types : extensions.publicTypes
  return extensions.types
    .map((type) => ({
      name: getExtensionOutputConfig(type).humanKey,
      value: type,
    }))
    .sort(extensionTypeChoiceSorterByGroupAndName)
}
