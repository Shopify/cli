import {Panel} from './Panel.js'
import {unstyled} from '@shopify/cli-kit/node/output'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {Text} from '@shopify/cli-kit/node/ink'
import {describe, expect, test} from 'vitest'
import React from 'react'

describe('Panel', () => {
  test('renders a rounded border with a bold title and children', async () => {
    const {lastFrame} = render(
      <Panel title="my-shop theme library">
        <Text>hello</Text>
      </Panel>,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                                  │
      │  my-shop theme library                                                                           │
      │  hello                                                                                           │
      │                                                                                                  │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders without a title when none is provided', async () => {
    const {lastFrame} = render(
      <Panel>
        <Text>hello</Text>
      </Panel>,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                                  │
      │  hello                                                                                           │
      │                                                                                                  │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders a subdued footer below the children', async () => {
    const {lastFrame} = render(
      <Panel title="my-shop theme library" footer="2 themes">
        <Text>hello</Text>
      </Panel>,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                                  │
      │  my-shop theme library                                                                           │
      │  hello                                                                                           │
      │                                                                                                  │
      │  2 themes                                                                                        │
      │                                                                                                  │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })
})
