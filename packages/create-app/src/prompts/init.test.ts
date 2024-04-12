import init, {InitOptions} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {renderSelectPrompt, renderText, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {installGlobalCLIIfNeeded} from '@shopify/cli-kit/node/is-global'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/is-global')

describe('init', () => {
  beforeEach(() => {
    vi.mocked(installGlobalCLIIfNeeded).mockResolvedValue(true)
  })
  test('when name is not passed', async () => {
    const answers = {
      name: 'app',
    }
    const options: InitOptions = {template: 'template', directory: '/', packageManager: 'npm'}

    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce(answers.name)

    // When
    const got = await init(options)

    // Then
    expect(renderText).toHaveBeenCalledWith({
      text: '\nWelcome. Let’s get started by naming your app project. You can change it later.',
    })
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Your project name?',
      defaultValue: expect.stringMatching(/^\w+-\w+-app$/),
      validate: expect.any(Function),
    })
    expect(got).toEqual({...options, ...answers, templateType: 'custom', globalCLIInstalled: true})
  })

  test('when name is passed', async () => {
    const answers = {
      template: 'https://github.com/Shopify/shopify-app-template-remix',
    }
    const options: InitOptions = {name: 'app', directory: '/', packageManager: 'npm'}

    // When
    const got = await init(options)

    // Then
    expect(renderText).toHaveBeenCalledWith({
      text: '\nWelcome. Let’s get started by choosing a template for your app project.',
    })
    expect(renderTextPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({...options, ...answers, templateType: 'custom', globalCLIInstalled: true})
  })

  test('it renders the label for the template options', async () => {
    const answers = {
      name: 'app',
      template: 'https://github.com/Shopify/shopify-app-template-none',
    }
    const options: InitOptions = {directory: '/', packageManager: 'npm'}

    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce(answers.name)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('none')

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'Start with Remix (recommended)', value: 'remix'},
        {label: 'Start by adding your first extension', value: 'none'},
      ],
      message: 'Get started building your app:',
      defaultValue: 'remix',
    })
    expect(got).toEqual({...options, ...answers, templateType: 'none', globalCLIInstalled: true})
  })

  test('it renders branches for templates that have them', async () => {
    const answers = {
      name: 'app',
      template: 'https://github.com/Shopify/shopify-app-template-remix#javascript',
    }
    const options: InitOptions = {directory: '/', packageManager: 'npm'}

    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce(answers.name)
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('remix')
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('javascript')

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'Start with Remix (recommended)', value: 'remix'},
        {label: 'Start by adding your first extension', value: 'none'},
      ],
      message: 'Get started building your app:',
      defaultValue: 'remix',
    })
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'JavaScript', value: 'javascript'},
        {label: 'TypeScript', value: 'main'},
      ],
      message: 'For your Remix template, which language do you want?',
    })
    expect(got).toEqual({...options, ...answers, templateType: 'remix', globalCLIInstalled: true})
  })
})
