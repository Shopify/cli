import scaffoldUiExtensionPrompt from './ui-extension'
import {uiExtensions} from '../../constants'
import {describe, it, expect, vi} from 'vitest'

describe('UI extension prompt', () => {
  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'ext'}
    const options = {}

    // Given
    prompt.mockResolvedValue(Promise.resolve(answers))

    // When
    const got = await scaffoldUiExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'name',
        message: "Your UI extension's working name?",
        default: 'extension',
      },
      {
        type: 'select',
        name: 'uiExtensionType',
        message: 'Type of UI extension?',
        choices: uiExtensions.types,
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
    const got = await scaffoldUiExtensionPrompt(options, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'uiExtensionType',
        message: 'Type of UI extension?',
        choices: uiExtensions.types,
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })
})
