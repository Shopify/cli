import {Link} from './Link.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

describe('Link', async () => {
  test("renders correctly with a fallback for terminals that don't support hyperlinks", async () => {
    const link = {
      url: 'https://example.com',
      label: 'Example',
    }

    const {lastFrame} = render(<Link {...link} />)

    expect(lastFrame()).toMatchInlineSnapshot('"Example [2m( https://example.com )[22m"')
  })

  test("it doesn't render a fallback if only url is passed", async () => {
    const link = {
      url: 'https://example.com',
    }

    const {lastFrame} = render(<Link {...link} />)

    expect(lastFrame()).toMatchInlineSnapshot('"https://example.com"')
  })
})
