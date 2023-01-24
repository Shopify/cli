import Init from './init.js'
import initPrompt, {templateURLMap} from '../prompts/init.js'
import initService from '../services/init.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {errorHandler} from '@shopify/cli-kit/node/error-handler'
import {Config} from '@oclif/core'
import * as output from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

beforeEach(() => {
  vi.mock('../prompts/init')
  vi.mock('../services/init')
  vi.mock('@shopify/cli-kit/node/error-handler')

  vi.mocked(initPrompt).mockResolvedValue({name: 'name', template: 'http://test.es'})
})

describe('create app command', () => {
  it('executes correctly when no template flag receivec', async () => {
    // When
    await Init.run()

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  it.each(['node', 'php', 'ruby'])(
    'executes correctly when using %s as a template alias name',
    async (alias: string) => {
      // When
      await Init.run(['--template', alias])

      // Then
      expect(initService).toHaveBeenCalledOnce()
    },
  )

  it('executes correctly when using a github url as a template alias name', async () => {
    // When
    await Init.run(['--template', 'https://github.com/myrepo'])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  it('throw an error when using a non supported template alias name', async () => {
    // Given
    vi.mocked(errorHandler).mockImplementation(async () => {})

    // When
    await Init.run(['--template', 'java'])

    // Then
    const anyConfig = expect.any(Config)
    const expectedError = new AbortError(
      output.outputContent`Only ${Object.keys(templateURLMap)
        .map((alias) => output.outputContent`${output.outputToken.yellow(alias)}`.value)
        .join(', ')} template aliases are supported`,
    )
    expect(errorHandler).toHaveBeenCalledWith(expectedError, anyConfig)
  })

  it('throw an error when using a non github url repo', async () => {
    // When
    await Init.run(['--template', 'http://nongithub.com/myrepo'])

    // Then
    const anyConfig = expect.any(Config)
    const expectedError = new AbortError(
      'Only GitHub repository references are supported, ' +
        'e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]',
    )
    expect(errorHandler).toHaveBeenCalledWith(expectedError, anyConfig)
  })
})
