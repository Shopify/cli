import generateExtensionPrompt, {buildChoices, extensionFlavorQuestion} from './extension.js'
import {testApp} from '../../models/app/app.test-data.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {environment} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    environment: {
      local: {
        isShopify: vi.fn(),
        isUnitTest: vi.fn(() => true),
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
    choices: buildChoices([]),
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
    const options = {directory: '/', app: testApp(), reset: false}

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
    const answers = {name: 'my-special-extension'}
    const options = {name: 'my-special-extension', directory: '/', app: testApp(), reset: false}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([extensionTypeQuestion])
    expect(got).toEqual({...options, ...answers})
  })

  it('when there is a registration Limit is not empty', async () => {
    const prompt = vi.fn()
    const answers = {name: 'my-special-extension'}
    const options = {name: 'my-special-extension', directory: '/', app: testApp(), reset: false}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'extensionType',
        message: 'Type of extension?',
        choices: (await buildChoices([])).filter((choice) => choice.name !== 'Theme app extension'),
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })

  it('when scaffolding a UI extension type prompts for language/framework preference', async () => {
    const prompt = vi.fn()
    const answers = {extensionFlavor: 'react'}
    const options = {
      name: 'my-special-extension',
      extensionType: 'checkout_post_purchase',
      directory: '/',
      app: testApp(),
      reset: false,
    }

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await generateExtensionPrompt(options, prompt)

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
      extensionType: 'theme',
      directory: '/',
      app: testApp(),
      reset: false,
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
    const options = {
      name: 'my-product-discount',
      extensionType: 'product_discounts',
      directory: '/',
      app: testApp(),
      reset: false,
    }

    // Given
    prompt.mockResolvedValue(answers)

    // When
    const got = await generateExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenNthCalledWith(1, [])
    expect(prompt).toHaveBeenNthCalledWith(2, [extensionFlavorQuestion('product_discounts')])

    expect(got).toEqual({...options, ...answers})
  })
})

function includes<TNarrow extends TWide, TWide>(coll: ReadonlyArray<TNarrow>, el: TWide): el is TNarrow {
  return coll.includes(el as TNarrow)
}
