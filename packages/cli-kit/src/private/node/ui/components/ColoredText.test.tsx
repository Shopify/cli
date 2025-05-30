import {ColoredText} from './ColoredText.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('ColoredText', async () => {
  test('renders green text correctly', async () => {
    const {lastFrame} = render(<ColoredText text="Success!" color="green" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[32mSuccess![39m"`)
  })

  test('renders yellow text correctly', async () => {
    const {lastFrame} = render(<ColoredText text="Warning!" color="yellow" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[33mWarning![39m"`)
  })

  test('renders cyan text correctly', async () => {
    const {lastFrame} = render(<ColoredText text="Info!" color="cyan" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[36mInfo![39m"`)
  })

  test('renders magenta text correctly', async () => {
    const {lastFrame} = render(<ColoredText text="Highlight!" color="magenta" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[35mHighlight![39m"`)
  })

  test('renders gray text correctly', async () => {
    const {lastFrame} = render(<ColoredText text="Subdued text" color="gray" />)

    expect(lastFrame()).toMatchInlineSnapshot(`"[90mSubdued text[39m"`)
  })
})
