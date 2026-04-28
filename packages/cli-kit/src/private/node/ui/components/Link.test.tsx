import {Link} from './Link.js'
import {LinksContext, Link as LinkEntry} from '../contexts/LinksContext.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React, {FunctionComponent, useRef} from 'react'
import supportsHyperlinks from 'supports-hyperlinks'

vi.mock('supports-hyperlinks')

const WithLinksContext: FunctionComponent<{children: React.ReactNode; addLinkSpy?: (label: string | undefined, url: string) => void}> = ({
  children,
  addLinkSpy,
}) => {
  const links = useRef<Record<string, LinkEntry>>({})
  return (
    <LinksContext.Provider
      value={{
        links,
        addLink: (label, url) => {
          addLinkSpy?.(label, url)
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

  describe('inside a LinksContext (Banner)', async () => {
    test('renders just `[N]` (not `url [N]`) for label-less links when the terminal does not support hyperlinks', async () => {
      supportHyperLinks(false)

      const {lastFrame} = render(
        <WithLinksContext>
          <Link url="https://example.com" />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('[1]')
    })

    test('uses the footnote mechanism for labeled links when the terminal does not support hyperlinks', async () => {
      supportHyperLinks(false)

      const {lastFrame} = render(
        <WithLinksContext>
          <Link url="https://example.com" label="Example" />
        </WithLinksContext>,
      )

      expect(lastFrame()).toBe('Example [1]')
    })

    test('registers label-less links in context so the footnote mechanism is always used', async () => {
      supportHyperLinks(false)
      const addLinkSpy = vi.fn()

      render(
        <WithLinksContext addLinkSpy={addLinkSpy}>
          <Link url="https://example.com" />
        </WithLinksContext>,
      )

      expect(addLinkSpy).toHaveBeenCalledWith(undefined, 'https://example.com')
    })

    test('registers labeled links in context', async () => {
      supportHyperLinks(false)
      const addLinkSpy = vi.fn()

      render(
        <WithLinksContext addLinkSpy={addLinkSpy}>
          <Link url="https://example.com" label="Example" />
        </WithLinksContext>,
      )

      expect(addLinkSpy).toHaveBeenCalledWith('Example', 'https://example.com')
    })
  })

  function supportHyperLinks(isSupported: boolean) {
    vi.mocked(supportsHyperlinks).stdout = isSupported
  }

  function asLink(url: string, label?: string) {
    return `\u001b]8;;${url}\u0007${label ?? url}\u001b]8;;\u0007`
  }
})
