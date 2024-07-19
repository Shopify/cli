import {replLoop} from './repl.js'
import {DevServerSession} from './theme-environment/types.js'
import {evaluate} from './repl/evaluater.js'
import {consoleWarn, outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('./repl/evaluater')

describe('repl', () => {
  const themeSession = {} as DevServerSession
  const themeId = 'themeId'
  const url = 'url'

  test('replLoop should call consoleWarn and return when inputValue has delimiter', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('{{ collections.first }}')
    vi.mocked(evaluate).mockRejectedValueOnce(new Error('Some error'))

    // When
    await expect(replLoop(themeSession, themeId, url)).rejects.toThrowError()

    // Then
    expect(consoleWarn).toHaveBeenCalledWith(
      "Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.\nPlease use 'collections.first' instead of '{{ collections.first }}'.",
    )
  })

  test('replLoop should call shutdownReplSession and throw AbortSilentError on error', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('some value')
    vi.mocked(evaluate).mockRejectedValueOnce(new Error('Some error'))

    // When
    await expect(replLoop(themeSession, themeId, url)).rejects.toThrow(AbortSilentError)

    // Then
    expect(outputInfo).toHaveBeenCalled()
    expect(outputDebug).toHaveBeenCalled()
  })
})
