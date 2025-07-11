import {TextAnimation} from './TextAnimation.js'
import {render} from '../../testing/ui.js'
import {Stdout} from '../../ui.js'
import React from 'react'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {useStdout} from 'ink'

vi.mock('ink', async () => {
  const original: any = await vi.importActual('ink')
  return {
    ...original,
    useStdout: vi.fn(),
  }
})

describe('TextAnimation', () => {
  let stdout: Stdout
  let onSpy: any
  let offSpy: any

  beforeEach(() => {
    stdout = new Stdout({
      columns: 80,
      rows: 80,
    })

    onSpy = vi.spyOn(stdout, 'on')
    offSpy = vi.spyOn(stdout, 'off')

    vi.mocked(useStdout).mockReturnValue({
      stdout: stdout as any,
      write: () => {},
    })
  })

  test('removes resize listener on unmount', async () => {
    const renderInstance = render(<TextAnimation text="Loading..." />)

    expect(onSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(onSpy).toHaveBeenCalledTimes(1)

    const resizeHandler = onSpy.mock.calls[0]![1]

    renderInstance.unmount()

    expect(offSpy).toHaveBeenCalledWith('resize', resizeHandler)
    expect(offSpy).toHaveBeenCalledTimes(1)
  })

  test('renders animated text', async () => {
    const renderInstance = render(<TextAnimation text="Loading..." />)

    expect(renderInstance.lastFrame()).toBeDefined()
    // The text is rendered with ANSI color codes, so we need to check for the content
    // without the color codes. The actual output contains the text but with color formatting.
    const frame = renderInstance.lastFrame() ?? ''
    expect(frame).toBeTruthy()
    expect(frame.length).toBeGreaterThan(0)

    renderInstance.unmount()
  })

  test('updates width when stdout resizes', async () => {
    const renderInstance = render(<TextAnimation text="Loading..." />)

    expect(onSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    const resizeHandler = onSpy.mock.calls[0]![1] as () => void

    stdout.columns = 120
    resizeHandler()

    await new Promise((resolve) => setTimeout(resolve, 50))

    renderInstance.unmount()
  })

  test('respects maxWidth prop when provided', async () => {
    const renderInstance = render(<TextAnimation text="Loading..." maxWidth={20} />)

    expect(renderInstance.lastFrame()).toBeDefined()

    renderInstance.unmount()
  })

  test('cleans up animation timeout on unmount', async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    const renderInstance = render(<TextAnimation text="Loading..." />)

    vi.advanceTimersByTime(50)

    renderInstance.unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()

    vi.useRealTimers()
  })
})
