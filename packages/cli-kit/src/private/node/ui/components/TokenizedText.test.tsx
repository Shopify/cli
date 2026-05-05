import {tokenItemToString, TokenizedText} from './TokenizedText.js'
import {LinksContext, Link} from '../contexts/LinksContext.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import supportsHyperlinks from 'supports-hyperlinks'

import React, {FunctionComponent, useRef} from 'react'

vi.mock('supports-hyperlinks')

// Matches the on-the-wire OSC 8 sequence emitted by `ansiEscapes.link`,
// which is what `<Link>` ultimately renders when the terminal supports
// hyperlinks. Format: `ESC ] 8 ; ; URL BEL TEXT ESC ] 8 ; ; BEL`.
function asOsc8Link(url: string, label?: string) {
  return `\u001b]8;;${url}\u0007${label ?? url}\u001b]8;;\u0007`
}

// Mirrors the LinksContext that <Banner> sets up at runtime, without pulling
// the whole Banner border into these tests.
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

  describe('markdown-link parsing in plain strings', async () => {
    test('renders strings without a markdown link unchanged', async () => {
      vi.mocked(supportsHyperlinks).stdout = false

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item="no link here, just text" />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('no link here, just text')
    })

    test('does not linkify a bare URL — callers must opt in via `[label](url)` or `<url>`', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`visit ${url} now`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe(`visit ${url} now`)
      expect(lastFrame()).not.toContain(']8;;')
    })

    test('replaces an opt-in `[label](url)` with the label and a `[N]` footnote anchor when the terminal does not support hyperlinks', async () => {
      vi.mocked(supportsHyperlinks).stdout = false
      const url = 'https://shopify.dev/docs/apps/build/sales-channels/channel-config-extension#specification-properties'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`Reference: [See specification requirements](${url})`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('Reference: See specification requirements [1]')
      expect(lastFrame()).not.toContain(url)
    })

    test('wraps the label of a `[label](url)` in OSC 8 escapes when the terminal supports hyperlinks', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`Reference: [docs page](${url})`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toContain(asOsc8Link(url, 'docs page'))
    })

    test('renders a label-less `<url>` autolink as a `[N]` anchor and registers the URL in the footnote table', async () => {
      vi.mocked(supportsHyperlinks).stdout = false
      const url = 'https://shopify.dev/docs'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`See specification requirements: <${url}>`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('See specification requirements: [1]')
      expect(lastFrame()).not.toContain(url)
    })

    test('parses multiple opt-in links in the same string', async () => {
      vi.mocked(supportsHyperlinks).stdout = false
      const first = 'https://example.com/a'
      const second = 'https://example.com/b'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`see [a](${first}) and <${second}>`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('see a [1] and [2]')
    })

    test('parses back-to-back opt-in links separated only by whitespace', async () => {
      vi.mocked(supportsHyperlinks).stdout = false
      const first = 'https://example.com/a'
      const second = 'https://example.com/b'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`<${first}> <${second}>`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('[1] [2]')
    })

    test('does not parse markdown links that omit the http(s) scheme', async () => {
      vi.mocked(supportsHyperlinks).stdout = true

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item="see [the section](#anchor) for more" />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('see [the section](#anchor) for more')
      expect(lastFrame()).not.toContain(']8;;')
    })

    test('does not parse opt-in markdown when no LinksContext is present (e.g. outside a Banner)', async () => {
      vi.mocked(supportsHyperlinks).stdout = true
      const url = 'https://example.com/docs'

      const {lastFrame} = render(<TokenizedText item={`see [docs](${url}) now`} />)

      expect(lastFrame()).toBe(`see [docs](${url}) now`)
      expect(lastFrame()).not.toContain(']8;;')
    })

    test('echoing back a user-supplied URL inside an error message is left as plain text', async () => {
      // Regression: an earlier auto-detection approach would turn the
      // user's bad `--tunnel-url` value into a clickable OSC-8 link,
      // which is misleading. With opt-in markdown the bare URL stays
      // as-is and only the doc reference — which the server marks up —
      // becomes clickable.
      vi.mocked(supportsHyperlinks).stdout = true
      const tunnelUrl = 'https://wrong'
      const docUrl = 'https://shopify.dev/docs/tunnels'

      const {lastFrame} = render(
        <WithLinksContext>
          <TokenizedText item={`Invalid tunnel URL: ${tunnelUrl}. See [tunnel docs](${docUrl}).`} />
        </WithLinksContext>,
      )

      expect(lastFrame()).toContain(`Invalid tunnel URL: ${tunnelUrl}.`)
      expect(lastFrame()).toContain(asOsc8Link(docUrl, 'tunnel docs'))
      // The user-supplied URL must not be wrapped in an OSC 8 escape.
      expect(lastFrame()).not.toContain(`\u001b]8;;${tunnelUrl}`)
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
