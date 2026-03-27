import init, {buildNoneTemplate, InitOptions} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {installGlobalCLIPrompt} from '@shopify/cli-kit/node/is-global'
import {isHostedAppsMode} from '@shopify/cli-kit/node/context/local'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/is-global')
vi.mock('@shopify/cli-kit/node/context/local')

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
        {label: 'Build a React Router app (recommended)', value: 'reactRouter'},
        {label: 'Build an extension-only app', value: 'none'},
      ],
      message: 'Get started building your app:',
      defaultValue: 'reactRouter',
    })
    expect(got).toEqual({...options, ...answers, templateType: 'none', globalCLIResult})
  })

  describe('buildNoneTemplate', () => {
    test('returns hosted app label and URL when HOSTED_APPS is enabled', () => {
      // Given
      vi.mocked(isHostedAppsMode).mockReturnValue(true)

      // When
      const got = buildNoneTemplate()

      // Then
      expect(got.label).toBe('Build an extension-only app (Shopify-hosted Preact app home and extensions, no back-end)')
      expect(got.url).toBe('https://github.com/Shopify/shopify-app-template-extension-only')
    })

    test('returns default label and URL when HOSTED_APPS is not set', () => {
      // Given
      vi.mocked(isHostedAppsMode).mockReturnValue(false)

      // When
      const got = buildNoneTemplate()

      // Then
      expect(got.label).toBe('Build an extension-only app')
      expect(got.url).toBe('https://github.com/Shopify/shopify-app-template-none')
    })
  })

  test('it renders branches for templates that have them', async () => {
    const answers = {
      template: 'https://github.com/Shopify/shopify-app-template-react-router#javascript-cli',
    }
    const options: InitOptions = {}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('reactRouter')
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('javascript-cli')

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'Build a React Router app (recommended)', value: 'reactRouter'},
        {label: 'Build an extension-only app', value: 'none'},
      ],
      message: 'Get started building your app:',
      defaultValue: 'reactRouter',
    })
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'JavaScript', value: 'javascript-cli'},
        {label: 'TypeScript', value: 'main-cli'},
      ],
      message: 'For your React Router template, which language do you want?',
    })
    expect(got).toEqual({...options, ...answers, templateType: 'reactRouter', globalCLIResult})
  })
})
