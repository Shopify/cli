import {Link} from './Link.js'
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

  function supportHyperLinks(isSupported: boolean) {
    vi.mocked(supportsHyperlinks).stdout = isSupported
  }

  function asLink(url: string, label?: string) {
    return `\u001b]8;;${url}\u0007${label ?? url}\u001b]8;;\u0007`
  }
})
