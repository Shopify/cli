import {Banner} from './Banner.js'
import {render} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'
import React from 'react'
import {Box, Text} from 'ink'
import {unstyled} from '@shopify/cli-kit/node/output'

describe('Banner', async () => {
  test('renders with a border for success with proper wrapping', async () => {
    const {lastFrame} = render(
      <Banner type="success">
        <Box marginLeft={2}>
          <Box width={1}>
            <Text>-</Text>
          </Box>
          <Box marginLeft={1} flexGrow={1}>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat.
            </Text>
          </Box>
        </Box>
      </Banner>,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │    • Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do         │
      │      eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad  │
      │       minim veniam, quis nostrud exercitation ullamco laboris nisi ut        │
      │      aliquip ex ea commodo consequat.                                        │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders with a border for info', async () => {
    const {lastFrame} = render(
      <Banner type="info">
        <Text>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat.
        </Text>
      </Banner>,
    )
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod     │
      │  tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim        │
      │  veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea     │
      │  commodo consequat.                                                          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders with a border for warning', async () => {
    const {lastFrame} = render(
      <Banner type="warning">
        <Text>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat.
        </Text>
      </Banner>,
    )
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod     │
      │  tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim        │
      │  veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea     │
      │  commodo consequat.                                                          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders with a border for error', async () => {
    const {lastFrame} = render(
      <Banner type="error">
        <Text>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat.
        </Text>
      </Banner>,
    )
    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod     │
      │  tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim        │
      │  veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea     │
      │  commodo consequat.                                                          │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('renders with a top and bottom lines only for external errors', async () => {
    const {lastFrame} = render(
      <Banner type="external_error">
        <Text>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat.
        </Text>
      </Banner>,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "── external error ──────────────────────────────────────────────────────────────

      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
      et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
      aliquip ex ea commodo consequat.

      ────────────────────────────────────────────────────────────────────────────────
      "
    `)
  })
})
