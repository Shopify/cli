import {
  LinkContentToken,
  RawContentToken,
  CommandContentToken,
  JsonContentToken,
  LinesDiffContentToken,
  ColorContentToken,
  ErrorContentToken,
  PathContentToken,
  HeadingContentToken,
  SubHeadingContentToken,
  ItalicContentToken,
} from './content-tokens.js'
import * as pathModule from '../../public/node/path.js'
import {mockAndCaptureOutput} from '../../public/node/testing/output.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import type {Change} from 'diff'

beforeEach(() => {
  mockAndCaptureOutput().clear()
})

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

describe('RawContentToken', () => {
  test('outputs the raw value', () => {
    // Given
    const value = 'test string'

    // When
    const token = new RawContentToken(value)

    // Then
    expect(token.output()).toEqual(value)
  })
})

describe('CommandContentToken', () => {
  test('formats as a command', () => {
    // Given
    const value = 'npm install'

    // When
    const token = new CommandContentToken(value)

    // Then
    expect(token.output()).toContain('npm install')
    expect(token.output()).toContain('`')
  })
})

describe('JsonContentToken', () => {
  test('returns a string for JSON output', () => {
    // Given
    const value = {key: 'value'}

    // When
    const token = new JsonContentToken(value)

    // Then
    // Just verify output is a string, as we can't easily mock color-json behavior
    expect(typeof token.output()).toBe('string')
  })

  test('falls back to JSON.stringify when color-json fails', () => {
    // Given
    const mockValue = {test: 'value'}
    const jsonPattern = /test.+value/

    // Mock color-json to throw an error
    vi.doMock('color-json', () => {
      return {
        default: vi.fn().mockImplementation(() => {
          throw new Error('Mock color-json error')
        }),
      }
    })

    // When
    const token = new JsonContentToken(mockValue)
    const result = token.output()

    // Then
    expect(result).toMatch(jsonPattern)

    // Restore the original
    vi.doUnmock('color-json')
  })
})

describe('LinesDiffContentToken', () => {
  test('formats added lines with green plus', () => {
    // Given
    const changes: Change[] = [{added: true, removed: undefined, value: 'new line\n'}]

    // When
    const token = new LinesDiffContentToken(changes)
    const output = token.output()

    // Then
    // green color
    expect(output[0]).toContain('+ new line')
    expect(output[0]).toContain('\u001b[32m')
  })

  test('formats removed lines with magenta minus', () => {
    // Given
    const changes: Change[] = [{added: undefined, removed: true, value: 'removed line\n'}]

    // When
    const token = new LinesDiffContentToken(changes)
    const output = token.output()

    // Then
    // magenta color
    expect(output[0]).toContain('- removed line')
    expect(output[0]).toContain('\u001b[35m')
  })

  test('preserves unchanged lines', () => {
    // Given
    const changes: Change[] = [{added: undefined, removed: undefined, value: 'unchanged line\n'}]

    // When
    const token = new LinesDiffContentToken(changes)
    const output = token.output()

    // Then
    expect(output[0]).toBe('unchanged line\n')
  })
})

describe('ColorContentToken', () => {
  test('applies the specified color function', () => {
    // Given
    const value = 'colored text'
    const colorFn = (text: string) => `COLORED(${text})`

    // When
    const token = new ColorContentToken(value, colorFn)

    // Then
    expect(token.output()).toEqual('COLORED(colored text)')
  })
})

describe('ErrorContentToken', () => {
  test('formats as an error', () => {
    // Given
    const value = 'error message'

    // When
    const token = new ErrorContentToken(value)

    // Then
    // bold
    // red bright
    expect(token.output()).toContain('error message')
    expect(token.output()).toContain('\u001b[1m')
    expect(token.output()).toContain('\u001b[91m')
  })
})

describe('PathContentToken', () => {
  test('calls relativizePath with the path', () => {
    // Given
    const path = '/some/path/to/file'
    // Spy on the relativizePath function
    const spy = vi.spyOn(pathModule, 'relativizePath')

    // When
    const token = new PathContentToken(path)
    token.output()

    // Then
    expect(spy).toHaveBeenCalledWith(path)
  })
})

describe('HeadingContentToken', () => {
  test('formats as a heading', () => {
    // Given
    const value = 'Heading'

    // When
    const token = new HeadingContentToken(value)

    // Then
    // bold
    // underline
    expect(token.output()).toContain('Heading')
    expect(token.output()).toContain('\u001b[1m')
    expect(token.output()).toContain('\u001b[4m')
  })
})

describe('SubHeadingContentToken', () => {
  test('formats as a subheading', () => {
    // Given
    const value = 'SubHeading'

    // When
    const token = new SubHeadingContentToken(value)

    // Then
    // underline
    expect(token.output()).toContain('SubHeading')
    expect(token.output()).toContain('\u001b[4m')
  })
})

describe('ItalicContentToken', () => {
  test('formats as italic text', () => {
    // Given
    const value = 'Emphasized'

    // When
    const token = new ItalicContentToken(value)

    // Then
    // italic
    expect(token.output()).toContain('Emphasized')
    expect(token.output()).toContain('\u001b[3m')
  })
})
