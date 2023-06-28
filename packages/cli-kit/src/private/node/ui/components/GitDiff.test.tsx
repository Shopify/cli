import {GitDiff} from './GitDiff.js'
import {render} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import React from 'react'

afterEach(async () => {
  await vi.unstubAllGlobals()
})

describe('GitDiff', async () => {
  test('renders correctly when no changes exist', async () => {
    const {lastFrame} = render(<GitDiff baselineContent="hello" updatedContent="hello" />)

    expect(lastFrame()).toEqual('No changes.')
  })

  test('renders correctly when changes exist', async () => {
    const {lastFrame} = render(<GitDiff baselineContent="hello\n" updatedContent="world\n" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "  @@ -1 +1 @@
      - hello
      + world"
    `)
  })

  test('renders correctly when changes exist and are several lines long', async () => {
    const {lastFrame} = render(<GitDiff baselineContent="hello\nworld\n" updatedContent="world\nhello\n" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "  @@ -1,2 +1,2 @@
      - hello
        world
      + hello"
    `)
  })

  test('displays color correctly', async () => {
    const {lastFrame} = render(<GitDiff baselineContent="hello\nworld\n" updatedContent="world\nhello\n" />)

    expect(lastFrame()).toMatchInlineSnapshot(`
      "\u001b[36m  @@ -1,2 +1,2 @@\u001b[m
      \u001b[31m- hello\u001b[m
        world\u001b[m
      \u001b[32m+ \u001b[m\u001b[32mhello\u001b[m"
    `)
  })

  test('respects no-color mode', async () => {
    vi.stubGlobal('process', {...process, env: {...process.env, FORCE_COLOR: '0'}})
    const {lastFrame} = render(<GitDiff baselineContent="hello\nworld\n" updatedContent="world\nhello\n" />)

    expect(lastFrame()!).toMatchInlineSnapshot(`
      "  @@ -1,2 +1,2 @@
      - hello
        world
      + hello"
    `)
  })

  test('ignores newline changes', async () => {
    const expectedDiff = `
      "  @@ -1,2 +1,2 @@
      - hello
        world
      + hello"
    `
    // Removing a newline

    const {lastFrame} = render(<GitDiff baselineContent="hello\nworld\n" updatedContent="world\nhello" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(expectedDiff)

    const lastFrame2 = render(<GitDiff baselineContent="hello\nworld\n" updatedContent="world\nhello" />).lastFrame

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(expectedDiff)
  })

  test('renders correctly when changes exist in multiple areas of a file', async () => {
    const baselineContent = `hello
world
lorem
ipsum
dolor
sit
amet
foo
bar
`
    const updatedContent = `world
hello
lorem
ipsum
dolor
sit
amet
foo
qux`
    const {lastFrame} = render(<GitDiff baselineContent={baselineContent} updatedContent={updatedContent} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "  @@ -1,3 +1,3 @@
      - hello
        world
      + hello
        lorem

        @@ -8,2 +8,2 @@ amet
        foo
      - bar
      + qux"`)
  })
})
