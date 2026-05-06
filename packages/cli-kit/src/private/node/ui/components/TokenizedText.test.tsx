import {tokenItemToString, TokenizedText} from './TokenizedText.js'
import {LinksContext, Link} from '../contexts/LinksContext.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import supportsHyperlinks from 'supports-hyperlinks'

import React, {FunctionComponent, useRef} from 'react'

vi.mock('supports-hyperlinks')

const WithLinksContext: FunctionComponent<{children: React.ReactNode}> = ({children}) => {
  const links = useRef<Record<string, Link>>({})
  return (
    <LinksContext.Provider
      value={{
        links,
        addLink: (label, url) => {
          const newId = (Object.keys(links.current).length + 1).toString()
          links.current = {...links.current, [newId]: {label, url}}
          return newId
        },
      }}
    >
      {children}
    </LinksContext.Provider>
  )
}

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

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item="no link here, just text" />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('no link here, just text')
    })

    test('replaces a URL with a `[N]` footnote anchor in the body when the terminal does not support hyperlinks', async () => {
      vi.mocked(supportsHyperlinks).stdout = false
      const url = 'https://shopify.dev/docs/apps/build/sales-channels/channel-config-extension#specification-properties'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`See specification requirements: ${url}`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('See specification requirements: [1]')
      expect(lastFrame()).not.toContain(url)
    })

    test('wraps detected URLs in OSC 8 escapes when the terminal supports hyperlinks', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`visit ${url} now`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toContain(`]8;;${url}${url}]8;;`)
    })

    test('detects multiple URLs in the same string', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const first = 'https://example.com/a'
      const second = 'https://example.com/b'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`see ${first} and ${second}`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toContain(`]8;;${first}${first}]8;;`)
      expect(lastFrame()).toContain(`]8;;${second}${second}]8;;`)
    })

    test('detects back-to-back URLs separated only by whitespace', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const first = 'https://example.com/a'
      const second = 'https://example.com/b'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`${first} ${second}`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toContain(`]8;;${first}${first}]8;;`)
      expect(lastFrame()).toContain(`]8;;${second}${second}]8;;`)
    })

    test('preserves balanced parentheses inside URLs (e.g. Wikipedia disambiguation links)', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://en.wikipedia.org/wiki/Ruby_(programming_language)'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`see ${url} for details`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toContain(`]8;;${url}${url}]8;;`)
    })

    test('does not auto-linkify URLs outside a LinksContext', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(<TokenizedText item={`visit ${url} now`} />)

      expect(lastFrame()).toBe(`visit ${url} now`)
      expect(lastFrame()).not.toContain(']8;;')
    })

    test('does not linkify https://-prefixed strings whose hostname has no dot (e.g. user typos like https://asda)', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const candidate = 'https://asda'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`Invalid tunnel URL: ${candidate}`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe(`Invalid tunnel URL: ${candidate}`)
      expect(lastFrame()).not.toContain(']8;;')
    })

    test('does not linkify placeholder URLs with non-numeric ports (e.g. https://my-tunnel-url:port)', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const candidate = 'https://my-tunnel-url:port'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`Valid format: "${candidate}"`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe(`Valid format: "${candidate}"`)
      expect(lastFrame()).not.toContain(']8;;')
    })

    test('strips trailing sentence punctuation from detected URLs', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`see ${url}. Thanks`} />
        </WithLinksContext>,
      )

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
