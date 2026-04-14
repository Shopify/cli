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
  // Default terminal width
  vi.mocked(useLayout).mockReturnValue({
    twoThirds: 53,
    oneThird: 27,
    fullWidth: 80,
  })
  vi.mocked(shouldDisplayColors).mockReturnValue(true)
})

/**
 * Creates a Stdout test double simulating a TTY stream (the default for
 * interactive terminals). On real Node streams, `isTTY` is only defined
 * as an own property when the stream IS a TTY — it's absent otherwise.
 */
function createTTYStdout(columns = 100) {
  const stdout = new Stdout({columns}) as Stdout & {isTTY: boolean}
  stdout.isTTY = true
  return stdout
}

/**
 * Creates a Stdout test double simulating a non-TTY environment
 * (piped output, CI without a pseudo-TTY, AI coding agents).
 */
function createNonTTYStdout(columns = 100) {
  const stdout = new Stdout({columns}) as Stdout & {isTTY: boolean}
  stdout.isTTY = false
  return stdout
}

/**
 * Renders LoadingBar with a TTY stdout and returns the last frame.
 * Most tests need a TTY to verify the animated progress bar renders.
 */
function renderWithTTY(element: React.ReactElement) {
  const stdout = createTTYStdout()
  const instance = render(element, {stdout})
  return {lastFrame: stdout.lastFrame, unmount: instance.unmount, stdout}
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

  test('renders only title text without animated progress bar in non-TTY environments', async () => {
    const stdout = createNonTTYStdout()

    const renderInstance = render(<LoadingBar title="Installing dependencies" />, {stdout})

    expect(unstyled(stdout.lastFrame()!)).toMatchInlineSnapshot(`"Installing dependencies ..."`)
    renderInstance.unmount()
  })

  test('renders only title text in non-TTY even when noColor and noProgressBar are not set', async () => {
    const stdout = createNonTTYStdout()
    vi.mocked(shouldDisplayColors).mockReturnValue(true)

    const renderInstance = render(<LoadingBar title="Generating extension" />, {stdout})

    expect(unstyled(stdout.lastFrame()!)).toMatchInlineSnapshot(`"Generating extension ..."`)
    renderInstance.unmount()
  })

  test('keeps animated progress bar when Ink renders to a TTY stream (e.g. renderTasksToStdErr)', async () => {
    // renderTasksToStdErr passes process.stderr as Ink's stdout option.
    // useStdout() returns that stream, so the TTY check uses the correct stream.
    const ttyStream = createTTYStdout()

    const renderInstance = render(<LoadingBar title="Uploading theme" />, {stdout: ttyStream})

    const frame = unstyled(ttyStream.lastFrame()!)
    expect(frame).toContain('▀')
    expect(frame).toContain('Uploading theme ...')
    renderInstance.unmount()
  })
})
