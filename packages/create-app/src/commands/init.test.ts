import Init, {InvalidGithubRepository, UnsupportedTemplateAlias} from './init.js'
import initPrompt from '../prompts/init.js'
import initService from '../services/init.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {globalCommandErrorHandler} from '@shopify/cli-kit/node/global-error-handler'

beforeEach(() => {
  vi.mock('../prompts/init')
  vi.mock('../services/init')
  vi.mock('@shopify/cli-kit/node/global-error-handler')

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
    vi.mocked(globalCommandErrorHandler).mockReturnValue(undefined)

    // When
    await Init.run(['--template', 'java'])

    expect(globalCommandErrorHandler).toHaveBeenCalledWith(UnsupportedTemplateAlias())
  })

  it.skip('throw an error when using a non github url repo', async () => {
    // When
    const result = Init.run(['--template', 'http://nongithub.com/myrepo'])

    // Then
    await expect(result).rejects.toThrow(InvalidGithubRepository())
  })
})
