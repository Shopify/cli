import {DELIMITER_WARNING as DELIMITER_WARNING_MESSAGE, handleInput} from './repl.js'
import {evaluate} from './evaluator.js'
import {presentValue} from './presenter.js'
import {DevServerSession} from '../theme-environment/types.js'
import {describe, expect, test, vi} from 'vitest'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {createInterface} from 'readline'

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
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

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
