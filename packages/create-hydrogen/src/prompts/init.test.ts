import init from './init'
import {describe, it, expect, vi} from 'vitest'

describe('init', () => {
  it('uses default name "hydrogen-app" when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'snow-devil'}
    const options = {}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          type: 'input',
          name: 'name',
          message: 'Name your new Hydrogen storefront',
          default: 'hydrogen-app',
        },
      ]),
    )
    expect(got).toEqual({...options, ...answers})
  })

  it('uses the name when passed to the prompt', async () => {
    const prompt = vi.fn()
    const answers = {name: 'snow-devil'}
    const options = {name: 'snow-devil'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({name: 'name'})]))
    expect(got).toEqual({...options, ...answers})
  })

  it('when template is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'snow-devil'}
    const options = {}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          type: 'select',
          name: 'template',
          choices: ['Demo store', 'Hello world'],
          message: 'Choose a template',
          default: 'Demo store',
          result: expect.any(Function),
        },
      ]),
    )
    expect(got).toEqual({...options, ...answers})
  })

  it('when template is passed', async () => {
    const prompt = vi.fn()
    const answers = {template: 'Shopify/hydrogen/templates/demo-store'}
    const options = {template: 'demo-store'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({name: 'template'})]))
    expect(got).toEqual({...options, ...answers})
  })
})
