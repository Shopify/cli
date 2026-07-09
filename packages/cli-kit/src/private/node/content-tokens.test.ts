import {LinkContentToken, LinesDiffContentToken} from './content-tokens.js'
import colors from '../../public/node/colors.js'
import {describe, expect, test} from 'vitest'

describe('LinkContentToken', () => {
  test('the link includes spaces between the URL and the parenthesis for command/control click to work', () => {
    // When
    const got = new LinkContentToken('Shopify Web', 'https://shopify.com')

    // Then
    expect(got.output()).toEqual('\u001b[32mShopify Web\u001b[39m ( https://shopify.com )')
  })

  test('uses the explicit fallback when provided and terminal does not support links', () => {
    const fallback = 'foo'

    // When
    const got = new LinkContentToken('Nothing', 'https://doesntmatter.com', fallback)

    // Then
    expect(got.output()).toEqual(fallback)
  })
})

describe('LinesDiffContentToken', () => {
  test('formats added and removed lines correctly', () => {
    // Given
    const changes = [
      {value: 'same\n', count: 1},
      {value: 'removed\n', count: 1, removed: true},
      {value: 'added\n', count: 1, added: true},
    ]
    const token = new LinesDiffContentToken(changes)

    // When
    const output = token.output()

    // Then
    expect(output).toEqual(['same\n', colors.magenta('- removed\n'), colors.green('+ added\n')])
  })

  test('handles multiple lines in a single change part', () => {
    // Given
    const changes = [{value: 'added1\nadded2\n', count: 2, added: true}]
    const token = new LinesDiffContentToken(changes)

    // When
    const output = token.output()

    // Then
    expect(output).toEqual([colors.green('+ added1\n'), colors.green('+ added2\n')])
  })
})
