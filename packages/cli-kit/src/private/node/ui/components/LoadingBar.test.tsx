import {LoadingBar} from './LoadingBar.js'
import {Stdout} from '../../ui.js'
import {render} from '../../testing/ui.js'
import {shouldDisplayColors, unstyled} from '../../../../public/node/output.js'
import React, {act} from 'react'

import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../../public/node/output.js', async () => {
  const original: any = await vi.importActual('../../../../public/node/output.js')
  return {
    ...original,
    shouldDisplayColors: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(shouldDisplayColors).mockReturnValue(true)
})

function createTTYStdout() {
  const stdout = new Stdout({columns: 100}) as Stdout & {isTTY: boolean}
  stdout.isTTY = true
  return stdout
}

function renderWithTTY(element: React.ReactElement) {
  const stdout = createTTYStdout()
  const instance = render(element, {stdout})
  return {lastFrame: stdout.lastFrame, unmount: instance.unmount}
}

describe('LoadingBar', () => {
  test('renders the Shopify loading indicator', async () => {
    const {lastFrame, unmount} = renderWithTTY(<LoadingBar title="Loading content" />)
    const frame = lastFrame()!

    expect(unstyled(frame)).toBe('S> Loading content...')
    expect(frame).toContain('\u001B[1m')
    expect(frame).toContain('\u001B[3m')
    expect(frame).toContain('\u001B[38;2;150;191;72m')

    unmount()
  })

  test('blinks the chevron without shifting the title', async () => {
    vi.useFakeTimers()
    const {lastFrame, unmount} = renderWithTTY(<LoadingBar title="Uploading theme" />)

    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(350)
      })

      expect(unstyled(lastFrame()!)).toBe('S  Uploading theme...')
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })

  test('renders the chevron without color when noColor is true', async () => {
    const {lastFrame, unmount} = renderWithTTY(<LoadingBar title="Processing files" noColor />)
    const frame = lastFrame()!

    expect(unstyled(frame)).toBe('S> Processing files...')
    expect(frame).not.toContain('\u001B[38;2;150;191;72m')

    unmount()
  })

  test('renders the chevron without color when colors are disabled', async () => {
    vi.mocked(shouldDisplayColors).mockReturnValue(false)
    const {lastFrame, unmount} = renderWithTTY(<LoadingBar title="Downloading packages" />)
    const frame = lastFrame()!

    expect(unstyled(frame)).toBe('S> Downloading packages...')
    expect(frame).not.toContain('\u001B[38;2;150;191;72m')

    unmount()
  })

  test('renders correctly with an empty title', async () => {
    const {lastFrame, unmount} = renderWithTTY(<LoadingBar title="" />)

    expect(unstyled(lastFrame()!)).toBe('S> ...')

    unmount()
  })

  test('hides the loading indicator when noProgressBar is true', async () => {
    const {lastFrame} = renderWithTTY(<LoadingBar title="task 1" noProgressBar />)

    expect(unstyled(lastFrame()!)).toBe('task 1...')
  })

  test('shows only static title text when output stream is not a TTY', async () => {
    const {lastFrame} = render(<LoadingBar title="Installing dependencies" />)

    expect(unstyled(lastFrame()!)).toBe('Installing dependencies...')
  })
})
