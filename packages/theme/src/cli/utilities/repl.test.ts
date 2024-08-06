import {handleInput} from './repl.js'
import {DevServerSession} from './theme-environment/types.js'
import {evaluate} from './repl/evaluater.js'
import {presentValue} from './repl/presenter.js'
import {describe, expect, test, vi} from 'vitest'
import {consoleWarn} from '@shopify/cli-kit/node/output'
import {createInterface} from 'readline'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('./repl/evaluater.js')
vi.mock('./repl/presenter.js')

describe('handleInput', () => {
  const themeSesssion: DevServerSession = {
    storefrontPassword: 'password',
    token: 'token',
    expiresAt: new Date(),
    storeFqdn: 'store.myshopify.com',
    storefrontToken: 'storefrontToken',
  }
  const themeId = '123'
  const url = '/'
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  test('should call consoleWarn and prompt readline if input has delimiter', async () => {
    // Given
    const inputValue = '{{ collections.first }}'

    // When
    await handleInput(inputValue, themeSesssion, themeId, url, rl, [])

    // Then
    expect(consoleWarn).toHaveBeenCalled()
  })

  test('should call evaluate, presentValue, and prompt readline if input is valid', async () => {
    // Given
    const inputValue = 'collections.first'

    // When
    await handleInput(inputValue, themeSesssion, themeId, url, rl, [])

    // Then
    expect(consoleWarn).not.toHaveBeenCalled()
    expect(evaluate).toHaveBeenCalled()
    expect(presentValue).toHaveBeenCalled()
  })
})
