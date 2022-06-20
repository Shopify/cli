import Init from './init'
import initPrompt from '../prompts/init'
import initService from '../services/init'
import {describe, it, expect, vi, beforeEach} from 'vitest'

beforeEach(() => {
  vi.mock('../prompts/init')
  vi.mock('../services/init')

  vi.mocked(initPrompt).mockResolvedValue({name: 'name', template: 'http://test.es'})
})

describe('create app command', () => {
  it('executes correctly when no template flag receivec', async () => {
    // When
    await Init.run()

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  it.each(['node', 'php', 'ruby'])('executes correctly when using %s as a template alias name', async (alias: string) => {
    // When
    await Init.run(['--template', alias])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  it('executes correctly when using a github url as a template alias name', async () => {
    // When
    await Init.run(['--template', 'https://github.com/myrepo'])

    // Then
    expect(initService).toHaveBeenCalledOnce()
  })

  it('throw an error when using a non supported template alias name', async () => {
    // When
    const result = Init.run(['--template', 'java'])

    // Then
    await expect(result).rejects.toThrow('Only \u001b[33mnode, php, ruby\u001b[39m template alias are supported')
  })

  it('throw an error when using a non github url repo', async () => {
    // When
    const result = Init.run(['--template', 'http://nongithub.com/myrepo'])

    // Then
    await expect(result).rejects.toThrow(
      'Only GitHub repository references are supported. eg: https://github.com/Shopify/<repository>/[subpath]#[branch]',
    )
  })
})
