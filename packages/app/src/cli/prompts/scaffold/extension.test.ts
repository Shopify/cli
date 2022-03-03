import {describe, it, expect, vi} from 'vitest'

import {extensions} from '../../constants'

import scaffoldExtensionPrompt from './extension'

describe('extension prompt', () => {
  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'ext'}
    const options = {}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'name',
        message: "Your extension's working name?",
        default: 'extension',
      },
      {
        type: 'select',
        name: 'extensionType',
        message: 'Type of extension?',
        choices: extensions.types,
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })

  it('when name is passed', async () => {
    const prompt = vi.fn()
    const answers = {}
    const options = {name: 'my-special-extension'}

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
        choices: extensions.types,
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })
})
