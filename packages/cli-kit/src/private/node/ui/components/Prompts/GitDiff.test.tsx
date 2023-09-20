import {GitDiff} from './GitDiff.js'
import {render} from '../../../testing/ui.js'
import {unstyled} from '../../../../../public/node/output.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import React from 'react'

afterEach(async () => {
  await vi.unstubAllGlobals()
})

describe('GitDiff', async () => {
  test('renders correctly when no changes exist', async () => {
    const gitDiff = {
      baselineContent: 'hello',
      updatedContent: 'hello',
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(lastFrame()).toEqual('No changes.')
  })

  test('renders correctly when changes exist', async () => {
    const gitDiff = {
      baselineContent: 'hello\n',
      updatedContent: 'world\n',
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "- hello
      + world"
    `)
  })

  test('renders correctly when changes exist and are several lines long', async () => {
    const gitDiff = {
      baselineContent: 'hello\nworld\n',
      updatedContent: 'world\nhello\n',
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "- hello
        world
      + hello"
    `)
  })

  test('displays color correctly', async () => {
    const gitDiff = {
      baselineContent: 'hello\nworld\n',
      updatedContent: 'world\nhello\n',
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(lastFrame()).toMatchInlineSnapshot(`
      "[31m- hello[m[39m
        world[m
      [32m+ [m[32mhello[m[0m[39m"
    `)
  })

  test('respects no-color mode', async () => {
    vi.stubGlobal('process', {...process, env: {...process.env, FORCE_COLOR: '0'}})
    const gitDiff = {
      baselineContent: 'hello\nworld\n',
      updatedContent: 'world\nhello\n',
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(lastFrame()!).toMatchInlineSnapshot(`
        "- hello
          world
        + hello"
      `)
  })

  test('ignores newline changes', async () => {
    const expectedDiff = `
      "- hello
        world
      + hello"
    `

    const gitDiff = {
      baselineContent: 'hello\nworld\n',
      updatedContent: 'world\nhello',
    }

    // Removing a newline

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(expectedDiff)

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

    const gitDiff = {
      baselineContent,
      updatedContent,
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "- hello
        world
      + hello
        lorem

        @@ -8,2 +8,2 @@ amet
        foo
      - bar
      + qux"
    `)
  })
})
