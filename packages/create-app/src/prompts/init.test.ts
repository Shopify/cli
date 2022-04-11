import init from './init'
import {describe, it, expect, vi} from 'vitest'

describe('init', () => {
  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {
      name: 'app',
      template: 'https://github.com/Shopify/shopify-app-node#richard/frontend-via-submodules',
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
        message: "Your app's working name?",
        default: 'app',
        validate: expect.any(Function),
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const prompt = vi.fn()
    const answers = {
      name: 'app',
      template: 'https://github.com/Shopify/shopify-app-node#richard/frontend-via-submodules',
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
