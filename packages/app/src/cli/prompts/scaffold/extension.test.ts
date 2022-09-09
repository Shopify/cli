import scaffoldExtensionPrompt, {extensionFlavorQuestion} from './extension.js'
import {extensions, extensionTypesGroups, getExtensionOutputConfig} from '../../constants.js'
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
    default: expect.stringMatching(/^\w+-\w+-ext$/),
  }

  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'ext'}
    const options = {extensionTypesAlreadyAtQuota: [], directory: '/'}

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
    const options = {name: 'my-special-extension', extensionTypesAlreadyAtQuota: [], directory: '/'}

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
    const options = {name: 'my-special-extension', extensionTypesAlreadyAtQuota: ['theme'], directory: '/'}

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
        choices: (await buildChoices()).filter((choice) => choice.name !== 'Theme app extension'),
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
      directory: '/',
    }

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).toHaveBeenNthCalledWith(2, [extensionFlavorQuestion('checkout_post_purchase')])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a theme extension type does not prompt for language/framework preference', async () => {
    const prompt = vi.fn()
    const answers = {}
    const options = {
      name: 'my-special-extension',
      extensionTypesAlreadyAtQuota: [],
      extensionType: 'theme',
      directory: '/',
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

  it('when scaffolding a function extension prompts for the language', async () => {
    const prompt = vi.fn()
    const answers = {extensionLanguage: 'rust'}
    const options = {
      name: 'my-product-discount',
      extensionTypesAlreadyAtQuota: [],
      extensionType: 'product_discounts',
      directory: '/',
    }

    // Given
    prompt.mockResolvedValue(answers)

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).toHaveBeenNthCalledWith(2, [extensionFlavorQuestion('product_discounts')])

    expect(got).toEqual({...options, ...answers})
  })
})

const buildChoices = async (): Promise<
  {
    name: string
    value: string
  }[]
> => {
  return extensions.types
    .map((type) => {
      const choiceWithoutGroup = {
        name: getExtensionOutputConfig(type).humanKey,
        value: type,
      }
      const group = extensionTypesGroups.find((group) => includes(group.extensions, type))
      if (group) {
        return {
          ...choiceWithoutGroup,
          group: {
            name: group.name,
            order: extensionTypesGroups.indexOf(group),
          },
        }
      }
      return choiceWithoutGroup
    })
    .sort((c1, c2) => c1.name.localeCompare(c2.name))
}

function includes<TNarrow extends TWide, TWide>(coll: ReadonlyArray<TNarrow>, el: TWide): el is TNarrow {
  return coll.includes(el as TNarrow)
}
