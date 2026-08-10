import {LinkContentToken, LinesDiffContentToken, JsonContentToken} from './content-tokens.js'
import colors from '../../public/node/colors.js'
import {describe, expect, test} from 'vitest'
import stripAnsi from 'strip-ansi'

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

describe('JsonContentToken', () => {
  test('colorizes keys, strings, numbers, booleans and null', () => {
    // Given
    const token = new JsonContentToken({name: 'shopify', port: 8081, beta: true, legacy: false, tunnel: null})

    // When
    const output = token.output()

    // Then
    const expected = colors.yellow(
      `{\n` +
        `  ${colors.white('"name":')} ${colors.green('"shopify"')},\n` +
        `  ${colors.white('"port":')} ${colors.magenta('8081')},\n` +
        `  ${colors.white('"beta":')} ${colors.cyan('true')},\n` +
        `  ${colors.white('"legacy":')} ${colors.cyan('false')},\n` +
        `  ${colors.white('"tunnel":')} ${colors.red('null')}\n` +
        `}`,
    )
    expect(output).toEqual(expected)
  })

  test('the colorized output contains the same JSON as JSON.stringify', () => {
    // Given
    const value = {
      name: 'shopify',
      versions: [1, -2.5, 3e10],
      nested: {escaped: 'quote " and \\ backslash', unicode: 'é', empty: {}},
      list: ['a', true, null],
    }
    const token = new JsonContentToken(value)

    // When
    const output = token.output()

    // Then
    expect(stripAnsi(output)).toEqual(JSON.stringify(value, undefined, 2))
  })

  test('parses and colorizes a JSON string input', () => {
    // Given
    const token = new JsonContentToken('{"ok": true}')

    // When
    const output = token.output()

    // Then
    expect(stripAnsi(output)).toEqual('{\n  "ok": true\n}')
  })

  test('falls back to plain JSON when the input is not valid JSON', () => {
    // Given
    const token = new JsonContentToken('not json')

    // When
    const output = token.output()

    // Then
    expect(output).toEqual('"not json"')
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
