import init, {InitOptions} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {installGlobalCLIPrompt} from '@shopify/cli-kit/node/is-global'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/is-global')

const globalCLIResult = {install: true, alreadyInstalled: false}

describe('init', () => {
  beforeEach(() => {
    vi.mocked(installGlobalCLIPrompt).mockResolvedValue(globalCLIResult)
  })

  test('it renders the label for the template options', async () => {
    const answers = {
      template: 'https://github.com/Shopify/shopify-app-template-none',
    }
    const options: InitOptions = {}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('none')

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'Build a Remix app (recommended)', value: 'remix'},
        {label: 'Build an extension-only app', value: 'none'},
      ],
      message: 'Get started building your app:',
      defaultValue: 'remix',
    })
    expect(got).toEqual({...options, ...answers, templateType: 'none', globalCLIResult})
  })

  test('it renders branches for templates that have them', async () => {
    const answers = {
      template: 'https://github.com/Shopify/shopify-app-template-remix#javascript',
    }
    const options: InitOptions = {}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('remix')
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('javascript')

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'Build a Remix app (recommended)', value: 'remix'},
        {label: 'Build an extension-only app', value: 'none'},
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
    expect(got).toEqual({...options, ...answers, templateType: 'remix', globalCLIResult})
  })
})
