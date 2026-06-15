import {LoadingBar} from './LoadingBar.js'
import {Stdout} from '../../ui.js'
import {render} from '../../testing/ui.js'
import {shouldDisplayColors, unstyled} from '../../../../public/node/output.js'
import useLayout from '../hooks/use-layout.js'
import React from 'react'

import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../hooks/use-layout.js')
vi.mock('../../../../public/node/output.js', async () => {
  const original: any = await vi.importActual('../../../../public/node/output.js')
  return {
    ...original,
    shouldDisplayColors: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(useLayout).mockReturnValue({
    twoThirds: 53,
    oneThird: 27,
    fullWidth: 80,
  })
  vi.mocked(shouldDisplayColors).mockReturnValue(true)
})

/**
 * Creates a Stdout test double simulating a TTY stream.
 * On real Node streams, isTTY is only present as an own property when the
 * stream IS a TTY.
 */
function createTTYStdout(columns = 100) {
  const stdout = new Stdout({columns}) as Stdout & {isTTY: boolean}
  stdout.isTTY = true
  return stdout
}

/**
 * Renders LoadingBar with a TTY stdout so the animated progress bar renders.
 */
function renderWithTTY(element: React.ReactElement) {
  const stdout = createTTYStdout()
  const instance = render(element, {stdout})
  return {lastFrame: stdout.lastFrame, unmount: instance.unmount}
}

describe('LoadingBar', () => {
  test('renders loading bar with default colored characters', async () => {
    const {lastFrame} = renderWithTTY(<LoadingBar title="Loading content" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      Loading content ..."
    `)
  })

  test('renders loading bar with hill pattern when noColor prop is true', async () => {
    const {lastFrame} = renderWithTTY(<LoadingBar title="Processing files" noColor />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅
      Processing files ..."
    `)
  })

  test('renders loading bar with hill pattern when shouldDisplayColors returns false', async () => {
    vi.mocked(shouldDisplayColors).mockReturnValue(false)
    const {lastFrame} = renderWithTTY(<LoadingBar title="Downloading packages" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅
      Downloading packages ..."
    `)
  })

  test('handles narrow terminal width correctly', async () => {
    vi.mocked(useLayout).mockReturnValue({twoThirds: 20, oneThird: 10, fullWidth: 30})
    const {lastFrame} = renderWithTTY(<LoadingBar title="Building app" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      Building app ..."
    `)
  })

  test('handles narrow terminal width correctly in no-color mode', async () => {
    vi.mocked(useLayout).mockReturnValue({twoThirds: 15, oneThird: 8, fullWidth: 23})
    const {lastFrame} = renderWithTTY(<LoadingBar title="Installing" noColor />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇
      Installing ..."
    `)
  })

  test('handles very narrow terminal width in no-color mode', async () => {
    vi.mocked(useLayout).mockReturnValue({twoThirds: 5, oneThird: 3, fullWidth: 8})
    const {lastFrame} = renderWithTTY(<LoadingBar title="Wait" noColor />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂
      Wait ..."
    `)
  })

  test('handles wide terminal width correctly', async () => {
    vi.mocked(useLayout).mockReturnValue({twoThirds: 100, oneThird: 50, fullWidth: 150})
    const {lastFrame} = renderWithTTY(<LoadingBar title="Synchronizing data" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      Synchronizing data ..."
    `)
  })

  test('handles wide terminal width correctly in no-color mode with pattern repetition', async () => {
    vi.mocked(useLayout).mockReturnValue({twoThirds: 90, oneThird: 45, fullWidth: 135})
    const {lastFrame} = renderWithTTY(<LoadingBar title="Analyzing dependencies" noColor />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁
      Analyzing dependencies ..."
    `)
  })

  test('renders correctly with empty title', async () => {
    const {lastFrame} = renderWithTTY(<LoadingBar title="" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
       ..."
    `)
  })

  test('noColor prop overrides shouldDisplayColors when both would show colors', async () => {
    vi.mocked(shouldDisplayColors).mockReturnValue(true)
    const {lastFrame} = renderWithTTY(<LoadingBar title="Testing override" noColor />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅▄▄▃▃▂▂▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇██▇▇▆▆▅▅
      Testing override ..."
    `)
  })

  test('renders consistently with same props', async () => {
    const props = {title: 'Consistent test', noColor: false}
    const {lastFrame: frame1} = renderWithTTY(<LoadingBar {...props} />)
    const {lastFrame: frame2} = renderWithTTY(<LoadingBar {...props} />)

    expect(frame1()).toBe(frame2())
  })

  test('hides progress bar when noProgressBar is true', async () => {
    vi.mocked(shouldDisplayColors).mockReturnValue(true)
    const {lastFrame} = renderWithTTY(<LoadingBar title="task 1" noProgressBar />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`"task 1 ..."`)
  })

  test('shows only static title text when output stream is not a TTY', async () => {
    // Default test Stdout has no isTTY property, simulating a non-TTY stream
    const {lastFrame} = render(<LoadingBar title="Installing dependencies" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`"Installing dependencies ..."`)
  })

  test('shows animated progress bar when output stream is a TTY', async () => {
    const {lastFrame} = renderWithTTY(<LoadingBar title="Uploading theme" />)

    const frame = unstyled(lastFrame()!)
    expect(frame).toContain('▀')
    expect(frame).toContain('Uploading theme ...')
  })
})
