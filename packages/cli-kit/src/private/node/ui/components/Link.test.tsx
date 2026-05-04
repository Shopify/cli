import {Link} from './Link.js'
import {LinksContext} from '../contexts/LinksContext.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import supportsHyperlinks from 'supports-hyperlinks'

vi.mock('supports-hyperlinks')

describe('Link', async () => {
  test("renders correctly with a fallback for terminals that don't support hyperlinks", async () => {
    // Given
    supportHyperLinks(false)

    const link = {
      url: 'https://example.com',
      label: 'Example',
    }

    // When
    const {lastFrame} = render(<Link {...link} />)

    // Then
    expect(lastFrame()).toMatchInlineSnapshot('"Example [2m( https://example.com )[22m"')
  })

  test('renders correctly with a fallback for terminals support hyperlinks', async () => {
    // Given
    supportHyperLinks(true)

    const link = {
      url: 'https://example.com',
      label: 'Example',
    }

    // When
    const {lastFrame} = render(<Link {...link} />)

    // Then
    expect(lastFrame()).toMatchInlineSnapshot(`"${asLink('https://example.com', 'Example')}"`)
  })

  test("it doesn't render a fallback if only url is passed and the terminal doesn't support hyperlinks", async () => {
    // Given
    supportHyperLinks(false)

    const link = {
      url: 'https://example.com',
    }

    // When
    const {lastFrame} = render(<Link {...link} />)

    // Then
    expect(lastFrame()).toMatchInlineSnapshot('"https://example.com"')
  })

  test("it doesn't render a fallback if only url is passed and the terminal supports hyperlinks", async () => {
    // Given
    supportHyperLinks(true)

    const link = {
      url: 'https://example.com',
    }

    // When
    const {lastFrame} = render(<Link {...link} />)

    // Then
    expect(lastFrame()).toMatchInlineSnapshot(`"${asLink('https://example.com')}"`)
  })

  test("it renders the link as plain text when the terminal doesn't support hyperlinks and the link URL is the same as the label", async () => {
    // Given
    supportHyperLinks(false)

    const link = {
      url: 'https://example.com',
      label: 'https://example.com',
    }

    // When
    const {lastFrame} = render(<Link {...link} />)

    // Then
    expect(lastFrame()).toMatchInlineSnapshot('"https://example.com"')
  })

  test("it renders the link as plain text when the terminal doesn't support hyperlinks and no label is passed", async () => {
    // Given
    supportHyperLinks(false)

    const link = {
      url: 'https://example.com',
    }

    // When
    const {lastFrame} = render(<Link {...link} />)

    // Then
    expect(lastFrame()).toMatchInlineSnapshot('"https://example.com"')
  })

  test('renders a label-bearing link inside a LinksContext as `label [N]` and registers the URL in the footnote table', async () => {
    // Inside a Banner's LinksContext, the visible label stays compact
    // (`label [1]`) and the URL is captured for rendering outside the
    // bordered box, where it can wrap freely without `│` interleaving.
    supportHyperLinks(false)

    const links: Record<string, {label: string | undefined; url: string}> = {}
    const link = {
      url: 'https://shopify.dev/docs/apps/build/sales-channels/channel-config-extension#specification-properties',
      label: 'docs',
    }

    const {lastFrame} = render(
      <LinksContext.Provider
        value={{
          links: {current: links},
          addLink: (label, url) => {
            const id = (Object.keys(links).length + 1).toString()
            links[id] = {label, url}
            return id
          },
        }}
      >
        <Link {...link} />
      </LinksContext.Provider>,
    )

    expect(lastFrame()).toBe('docs [1]')
    expect(links['1']).toEqual({label: 'docs', url: link.url})
  })

  test('renders a label-less link inside a LinksContext as a bare `[N]` anchor (no inline URL)', async () => {
    // Regression: previously this path rendered `${url} [N]`, putting the
    // long URL inside the bordered box and defeating the footnote
    // mechanism. The footnote alone is now the source of truth for the URL.
    supportHyperLinks(false)

    const links: Record<string, {label: string | undefined; url: string}> = {}
    const link = {
      url: 'https://shopify.dev/docs/apps/build/sales-channels/channel-config-extension#specification-properties',
    }

    const {lastFrame} = render(
      <LinksContext.Provider
        value={{
          links: {current: links},
          addLink: (label, url) => {
            const id = (Object.keys(links).length + 1).toString()
            links[id] = {label, url}
            return id
          },
        }}
      >
        <Link {...link} />
      </LinksContext.Provider>,
    )

    expect(lastFrame()).toBe('[1]')
    expect(lastFrame()).not.toContain(link.url)
    expect(links['1']).toEqual({label: undefined, url: link.url})
  })

  function supportHyperLinks(isSupported: boolean) {
    vi.mocked(supportsHyperlinks).stdout = isSupported
  }

  function asLink(url: string, label?: string) {
    return `\u001b]8;;${url}\u0007${label ?? url}\u001b]8;;\u0007`
  }
})
