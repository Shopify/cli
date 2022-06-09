import init from './init'
import {describe, it, expect, vi} from 'vitest'

describe('init', () => {
  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {
      name: 'app',
      template: 'https://github.com/Shopify/shopify-app-template-node#add-shopify-home-toml',
    }
    const options = {template: 'template'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'name',
        preface: 'Welcome. Let’s get started by naming your app. You can change it later.',
        message: "Your app's name?",
        default: expect.stringMatching(/^\w+-\w+-app-\d+$/),
        validate: expect.any(Function),
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const prompt = vi.fn()
    const answers = {
      name: 'app',
      template: 'https://github.com/Shopify/shopify-app-template-node#add-shopify-home-toml',
    }
    const options = {name: 'app', template: 'template'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([])
    expect(got).toEqual({...options, ...answers})
  })
})
