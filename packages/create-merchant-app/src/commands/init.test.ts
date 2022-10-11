import Init, {InvalidGithubRepository, UnsupportedTemplateAlias} from './init.js'
import initPrompt from '../prompts/init.js'
import initService from '../services/init.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {errorHandler} from '@shopify/cli-kit/node/error-handler'
import {Config} from '@oclif/core'

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
    vi.mocked(errorHandler).mockReturnValue(undefined)

    // When
    await Init.run(['--template', 'java'])

    const anyConfig = expect.any(Config)
    expect(errorHandler).toHaveBeenCalledWith(UnsupportedTemplateAlias(), anyConfig)
  })

  it('throw an error when using a non github url repo', async () => {
    // When
    await Init.run(['--template', 'http://nongithub.com/myrepo'])

    // Then
    const anyConfig = expect.any(Config)
    expect(errorHandler).toHaveBeenCalledWith(InvalidGithubRepository(), anyConfig)
  })
})
