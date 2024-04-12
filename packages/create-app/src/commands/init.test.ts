import Init from './init.js'
import * as initPrompt from '../prompts/init.js'
import initService from '../services/init.js'
import {describe, expect, vi, beforeEach, test} from 'vitest'
import {errorHandler} from '@shopify/cli-kit/node/error-handler'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

vi.mock('../services/init')
vi.mock('@shopify/cli-kit/node/error-handler')
vi.mock('@oclif/core', async () => {
  const actual = (await vi.importActual('@oclif/core')) as any

  return {
    ...actual,
    Errors: {
      handle: vi.fn(),
    },
  }
})

beforeEach(() => {
  vi.spyOn(initPrompt, 'default').mockResolvedValue({
    name: 'name',
    template: 'http://test.es',
    templateType: 'custom',
    globalCLIResult: {install: false, alreadyInstalled: false},
  })
})

describe('create app command', () => {
  test('executes correctly when no template flag receivec', async () => {
    // When
    await Init.run()

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  test.each(['remix'])('executes correctly when using %s as a template alias name', async (alias: string) => {
    // When
    await Init.run(['--template', alias])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  test('executes correctly when using a flavor for the remix template', async () => {
    // When
    await Init.run(['--template', 'remix', '--flavor', 'javascript'])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  test('executes correctly when using a non-visible template alias name', async () => {
    // When
    await Init.run(['--template', 'node'])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  test('executes correctly when using a github url as a template alias name', async () => {
    // When
    await Init.run(['--template', 'https://github.com/myrepo'])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  test('throw an error when using a non supported template alias name', async () => {
    // Given
    vi.mocked(errorHandler).mockImplementation(async () => {})

    // When
    await Init.run(['--template', 'java'])

    // Then
    const anyConfig = expect.any(Config)
    const expectedError = new AbortError(
      outputContent`Only ${initPrompt.visibleTemplates
        .map((alias) => outputContent`${outputToken.yellow(alias)}`.value)
        .join(', ')} template aliases are supported`,
    )
    expect(errorHandler).toHaveBeenCalledWith(expectedError, anyConfig)
  })

  test('throw an error when using a non github url repo', async () => {
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

  test('throw an error when using a flavor for a template that has no branches set up', async () => {
    // When
    await Init.run(['--template', 'node', '--flavor', 'javascript'])

    // Then
    const anyConfig = expect.any(Config)
    const expectedError = new AbortError(
      outputContent`The ${outputToken.yellow('node')} template does not support flavors`,
    )
    expect(errorHandler).toHaveBeenCalledWith(expectedError, anyConfig)
  })
})
