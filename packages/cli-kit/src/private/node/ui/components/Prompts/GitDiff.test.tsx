import {GitDiff} from './GitDiff.js'
import {render} from '../../../testing/ui.js'
import {unstyled} from '../../../../../public/node/output.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import React from 'react'
import {platformAndArch} from '@shopify/cli-kit/node/os'

afterEach(async () => {
  await vi.unstubAllGlobals()
})

const runningOnWindows = platformAndArch().platform === 'windows'

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
      baselineContent: 'hello\nworld\nfoobar\n',
      updatedContent: 'world\nfoobar\nhello\n',
    }

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "- hello
        world
        foobar
      + hello"
    `)
  })

  test.skipIf(runningOnWindows)('displays color correctly', async () => {
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

  test.skipIf(runningOnWindows)('respects no-color mode', async () => {
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

  test.skipIf(runningOnWindows)('ignores newline changes', async () => {
    const expectedDiff = `
      "- hello
        world
        foobar
      + hello"
    `

    const gitDiff = {
      baselineContent: 'hello\nworld\nfoobar\n',
      updatedContent: 'world\nfoobar\nhello',
    }

    // Removing a newline

    const {lastFrame} = render(<GitDiff gitDiff={gitDiff} />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(expectedDiff)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(expectedDiff)
  })

  test.skipIf(runningOnWindows)('renders correctly when changes exist in multiple areas of a file', async () => {
    const baselineContent = `hello
world
foobar
lorem
ipsum
dolor
sit
amet
foo
bar
`
    const updatedContent = `world
foobar
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
        foobar
      + hello
        lorem

        @@ -9,2 +9,2 @@ amet
        foo
      - bar
      + qux"
    `)
  })
})
