import init from './init'
import {describe, it, expect, vi} from 'vitest'

describe('init', () => {
  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'app'}
    const options = {}

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
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'app'}
    const options = {name: 'app'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await init(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([])
    expect(got).toEqual({...options, ...answers})
  })
})
