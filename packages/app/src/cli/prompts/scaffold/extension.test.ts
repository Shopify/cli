import scaffoldExtensionPrompt, {extensionTypeChoiceSorterByGroupAndName} from './extension'
import {extensions, getExtensionOutputConfig} from '../../constants'
import {describe, it, expect, vi} from 'vitest'

describe('extension prompt', () => {
  it('when name is not passed', async () => {
    const prompt = vi.fn()
    const answers = {name: 'ext'}
    const options = {extensionTypesAlreadyAtQuota: []}

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
        choices: buildChoices(),
      },
      {
        type: 'input',
        name: 'name',
        message: "Your extension's working name?",
        default: 'extension',
      },
    ])
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
    expect(prompt).toHaveBeenCalledWith([
      {
        type: 'select',
        name: 'extensionType',
        message: 'Type of extension?',
        choices: buildChoices(),
      },
    ])
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
        choices: buildChoices().filter((choice) => choice.name !== 'theme app extension'),
      },
    ])
    expect(got).toEqual({...options, ...answers})
  })
})

const buildChoices = (): {
  name: string
  value: string
}[] => {
  return extensions.types
    .map((type) => ({
      name: getExtensionOutputConfig(type).humanKey,
      value: type,
    }))
    .sort(extensionTypeChoiceSorterByGroupAndName)
}
