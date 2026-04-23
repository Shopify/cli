import {tokenItemToString, TokenizedText} from './TokenizedText.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import supportsHyperlinks from 'supports-hyperlinks'

import React from 'react'

vi.mock('supports-hyperlinks')

describe('TokenizedText', async () => {
  test('renders arrays of items separated by spaces', async () => {
    const item = [
      'Run',
      {
        command: 'cd verification-app',
      },
      {
        link: {
          url: 'https://example.com',
          label: 'Example',
        },
      },
      {
        char: '!',
      },
      {
        userInput: 'my-app',
      },
      {
        subdued: '(my-text)',
      },
      {
        list: {
          items: ['Item 1', 'Item 2', 'Item 3'],
        },
      },
      {
        filePath: 'src/this/is/a/test.js',
      },
      {
        info: 'some info',
      },
      {
        warn: 'some warn',
      },
      {
        error: 'some error',
      },
    ]

    const {lastFrame} = render(<TokenizedText item={item} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "Run \`cd verification-app\` Example ( https://example.com )! my-app (my-text)
        • Item 1
        • Item 2
        • Item 3
      src/this/is/a/test.js some info some warn some error"
    `)
  })

  describe('URL auto-detection in plain strings', async () => {
    test('renders strings without URLs unchanged', async () => {
      vi.mocked(supportsHyperlinks).stdout = false

      const {lastFrame} = render(<TokenizedText item="no link here, just text" />)

      expect(lastFrame()).toBe('no link here, just text')
    })

    test('preserves a URL intact when the terminal does not support hyperlinks', async () => {
      vi.mocked(supportsHyperlinks).stdout = false
      const url = 'https://shopify.dev/docs/apps/build/sales-channels/channel-config-extension#specification-properties'

      const {lastFrame} = render(<TokenizedText item={`See specification requirements: ${url}`} />)

      expect(lastFrame()).toContain(url)
    })

    test('wraps detected URLs in OSC 8 escapes when the terminal supports hyperlinks', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(<TokenizedText item={`visit ${url} now`} />)

      expect(lastFrame()).toContain(`]8;;${url}${url}]8;;`)
    })

    test('detects multiple URLs in the same string', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const first = 'https://example.com/a'
      const second = 'https://example.com/b'

      const {lastFrame} = render(<TokenizedText item={`see ${first} and ${second}`} />)

      expect(lastFrame()).toContain(`]8;;${first}${first}]8;;`)
      expect(lastFrame()).toContain(`]8;;${second}${second}]8;;`)
    })

    test('strips trailing sentence punctuation from detected URLs', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(<TokenizedText item={`see ${url}. Thanks`} />)

      expect(lastFrame()).toContain(`]8;;${url}${url}]8;;`)
      expect(lastFrame()).toContain('. Thanks')
    })
  })

  describe('tokenItemToString', async () => {
    test("doesn't add a space before char", async () => {
      expect(tokenItemToString(['Run', {char: '!'}])).toBe('Run!')
    })

    test('it concatenates list items inline', async () => {
      expect(
        tokenItemToString([
          'Run',
          {
            list: {
              items: ['Item 1', 'Item 2', 'Item 3'],
            },
          },
        ]),
      ).toBe('Run Item 1 Item 2 Item 3')
    })
  })
})
