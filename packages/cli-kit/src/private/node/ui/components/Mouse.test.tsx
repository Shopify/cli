import {MouseProvider, useOnClick, useOnPress} from './Mouse.js'
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

function Draggable({onPress}: {onPress: () => void}) {
  const ref = useRef<DOMElement>(null)
  useOnPress(ref, onPress)
  return (
    <Box ref={ref}>
      <Text>Drag me</Text>
    </Box>
  )
}

function mouseClick(column: number, row: number): [string, string] {
  return [`\u001B[<0;${column};${row}M`, `\u001B[<0;${column};${row}m`]
}

function mouseDrag(startColumn: number, startRow: number, endColumn: number, endRow: number): [string, string, string] {
  return [
    `\u001B[<0;${startColumn};${startRow}M`,
    `\u001B[<32;${endColumn};${endRow}M`,
    `\u001B[<0;${endColumn};${endRow}m`,
  ]
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

  test('handles the press that begins a drag when mouse interactions are enabled', async () => {
    const onPress = vi.fn()
    const renderInstance = render(
      <MouseProvider trackMouseMovement={false}>
        <Draggable onPress={onPress} />
      </MouseProvider>,
      {stdoutIsTTY: true},
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 10, ...mouseDrag(2, 1, 6, 1))

    expect(onPress).toHaveBeenCalledOnce()
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
