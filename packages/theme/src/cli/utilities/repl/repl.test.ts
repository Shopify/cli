import {DELIMITER_WARNING as DELIMITER_WARNING_MESSAGE, handleInput} from './repl.js'
import {evaluate} from './evaluator.js'
import {presentValue} from './presenter.js'
import {DevServerSession} from '../theme-environment/types.js'
import {describe, expect, test, vi} from 'vitest'
import {outputInfo} from '@shopify/cli-kit/node/output'

import {Interface} from 'readline'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('./evaluator.js')
vi.mock('./presenter.js')

describe('handleInput', () => {
  const themeSesssion: DevServerSession = {
    storefrontPassword: 'password',
    token: 'token',
    storeFqdn: 'store.myshopify.com',
    storefrontToken: 'storefrontToken',
    sessionCookies: {},
  }
  const themeId = '123'
  const url = '/'
  // Use a stub Interface instead of a real readline created from process.stdin.
  // In Node 26, readline.createInterface on a non-TTY stdin that is already
  // at EOF (as in Vitest workers) immediately closes the Interface, and
  // calling `prompt()` on a closed Interface throws `Error: readline was
  // closed` (it was a silent no-op in Node 22/24).
  const rl = {
    prompt: vi.fn(),
    close: vi.fn(),
  } as unknown as Interface

  test('should call outputInfo if input has {{ delimiter', async () => {
    // Given
    const inputValue = '{{ collections.first }}'

    // When
    await handleInput(inputValue, themeSesssion, themeId, url, rl, [])

    // Then
    expect(outputInfo).toHaveBeenCalledWith(DELIMITER_WARNING_MESSAGE)
  })

  test('should call outputInfo if input has {% delimiter', async () => {
    // Given
    const inputValue = '{%'

    // When
    await handleInput(inputValue, themeSesssion, themeId, url, rl, [])

    // Then
    expect(outputInfo).toHaveBeenCalledWith(DELIMITER_WARNING_MESSAGE)
  })

  test('should not call outputInfo if {{ delimiter is wrapped in quotes', async () => {
    // Given
    const inputValue = '"{{ collections.first }}"'

    // When
    await handleInput(inputValue, themeSesssion, themeId, url, rl, [])

    // Then
    expect(outputInfo).not.toHaveBeenCalled()
  })

  test('should call evaluate, presentValue, and prompt readline if input is valid', async () => {
    // Given
    const inputValue = '"test"'

    // When
    await handleInput(inputValue, themeSesssion, themeId, url, rl, [])

    // Then
    expect(outputInfo).not.toHaveBeenCalled()
    expect(evaluate).toHaveBeenCalled()
    expect(presentValue).toHaveBeenCalled()
  })
})
