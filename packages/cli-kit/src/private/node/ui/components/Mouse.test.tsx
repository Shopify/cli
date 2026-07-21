import {MouseProvider, useOnClick} from './Mouse.js'
import {render, sendInputAndWait, waitForInputsToBeReady} from '../../testing/ui.js'
import React, {useRef} from 'react'
import {Box, DOMElement, Text} from 'ink'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  getMouseEnabled: vi.fn(() => true),
}))

vi.mock('../../conf-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conf-store.js')>()
  return {...actual, getMouseEnabled: mocks.getMouseEnabled}
})

function Clickable({onClick}: {onClick: () => void}) {
  const ref = useRef<DOMElement>(null)
  useOnClick(ref, onClick)
  return (
    <Box ref={ref}>
      <Text>Click me</Text>
    </Box>
  )
}

function mouseClick(column: number, row: number): [string, string] {
  return [`\u001B[<0;${column};${row}M`, `\u001B[<0;${column};${row}m`]
}

describe('MouseProvider', () => {
  beforeEach(() => {
    mocks.getMouseEnabled.mockReturnValue(true)
  })

  test('handles clicks when mouse interactions are enabled', async () => {
    const onClick = vi.fn()
    const renderInstance = render(
      <MouseProvider>
        <Clickable onClick={onClick} />
      </MouseProvider>,
      {stdoutIsTTY: true},
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 10, ...mouseClick(2, 1))

    expect(onClick).toHaveBeenCalledOnce()
    renderInstance.unmount()
  })

  test('ignores clicks when mouse interactions are disabled', async () => {
    mocks.getMouseEnabled.mockReturnValue(false)
    const onClick = vi.fn()
    const renderInstance = render(
      <MouseProvider>
        <Clickable onClick={onClick} />
      </MouseProvider>,
      {stdoutIsTTY: true},
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 10, ...mouseClick(2, 1))

    expect(onClick).not.toHaveBeenCalled()
    renderInstance.unmount()
  })

  test('stops handling clicks when mouse interactions become inactive', async () => {
    const onClick = vi.fn()
    const renderInstance = render(
      <MouseProvider>
        <Clickable onClick={onClick} />
      </MouseProvider>,
      {stdoutIsTTY: true},
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 10, ...mouseClick(2, 1))
    expect(onClick).toHaveBeenCalledOnce()

    renderInstance.rerender(
      <MouseProvider isActive={false}>
        <Clickable onClick={onClick} />
      </MouseProvider>,
    )
    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 10, ...mouseClick(2, 1))

    expect(onClick).toHaveBeenCalledOnce()
    renderInstance.unmount()
  })
})
