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

  test('it defaults to reactRouter template and prompts for language', async () => {
    const answers = {
      template: 'https://github.com/shopify-playground/shopify-hosted-app-explorations/shopify-app#auto-inferred-deploy',
    }
    const options: InitOptions = {}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('javascript')

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledTimes(1)
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      choices: [
        {label: 'JavaScript', value: 'javascript'},
        {label: 'TypeScript', value: 'typescript'},
      ],
      message: 'For your React Router template, which language do you want?',
    })
    expect(got).toEqual({...options, ...answers, templateType: 'reactRouter', globalCLIResult})
  })

  test('it uses provided template without prompting for template', async () => {
    const answers = {
      template: 'https://github.com/Shopify/shopify-app-template-none',
    }
    const options: InitOptions = {template: 'none'}

    // When
    const got = await init(options)

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({...options, ...answers, templateType: 'none', globalCLIResult})
  })
})
