import {MultiSelectInput} from './MultiSelectInput.js'
import {render, waitForInputsToBeReady} from '../../testing/ui.js'
import {Stdout} from '../../ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {describe, expect, test} from 'vitest'

import React from 'react'

const ARROW_DOWN = '[B'

// The default testing `render` helper hard-codes an 80/100-column stdout and reads frames from an
// internal stdout instance. To exercise the responsive description panel we need to control the
// terminal width and read frames from the same stdout that drives `useLayout`, so we pass our own
// width-controlled Stdout and read its frames directly.
function renderWithWidth(tree: React.ReactElement, columns: number) {
  const stdout = new Stdout({columns, rows: 100})
  const renderInstance = render(tree, {stdout: stdout as unknown as NodeJS.WriteStream})
  return {renderInstance, stdout}
}

function lastUnstyledFrame(stdout: Stdout): string {
  return unstyled(stdout.lastFrame() ?? '')
}

// Waits until the width-controlled stdout produces a frame different from the current one after
// running `action`, then yields once more so React's scheduler can flush follow-up effects.
async function sendAndWaitForFrameChange(stdout: Stdout, action: () => void) {
  const initialFrame = stdout.lastFrame()
  action()
  while (stdout.lastFrame() === initialFrame) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setImmediate(() => setTimeout(resolve, 0)))
  }
  await new Promise((resolve) => setImmediate(() => setTimeout(resolve, 0)))
}

const itemsWithDescriptions = [
  {label: 'read_products', value: 'read_products', description: 'Read-only access to products.'},
  {label: 'read_orders', value: 'read_orders', description: 'Read-only access to orders.'},
  {label: 'read_customers', value: 'read_customers', description: 'Read-only access to customers.'},
]

describe('MultiSelectInput with descriptions', () => {
  test('shows the focused item description in a panel', async () => {
    const {stdout} = renderWithWidth(<MultiSelectInput items={itemsWithDescriptions} onSubmit={() => {}} />, 120)

    await waitForInputsToBeReady()

    const frame = lastUnstyledFrame(stdout)
    expect(frame).toContain('Read-only access to products.')
    // The other items' descriptions are not shown until they become focused.
    expect(frame).not.toContain('Read-only access to orders.')
  })

  test('updates the shown description when arrowing focus', async () => {
    const {renderInstance, stdout} = renderWithWidth(
      <MultiSelectInput items={itemsWithDescriptions} onSubmit={() => {}} />,
      120,
    )

    await waitForInputsToBeReady()
    await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))

    const frame = lastUnstyledFrame(stdout)
    expect(frame).toContain('Read-only access to orders.')
    expect(frame).not.toContain('Read-only access to products.')
  })

  test('places the panel beside the list on wide terminals and below on narrow ones', async () => {
    const description = 'Read-only access to products.'

    const {stdout: wideStdout} = renderWithWidth(
      <MultiSelectInput items={itemsWithDescriptions} onSubmit={() => {}} />,
      120,
    )
    const {stdout: narrowStdout} = renderWithWidth(
      <MultiSelectInput items={itemsWithDescriptions} onSubmit={() => {}} />,
      80,
    )

    await waitForInputsToBeReady()

    const wideLines = lastUnstyledFrame(wideStdout).split('\n')
    const narrowLines = lastUnstyledFrame(narrowStdout).split('\n')

    const wideDescriptionLine = wideLines.findIndex((line) => line.includes(description))
    const narrowDescriptionLine = narrowLines.findIndex((line) => line.includes(description))

    // Side-by-side: the description sits on one of the first rows, aligned with the list.
    // Stacked: the description appears only after all three list rows.
    expect(wideDescriptionLine).toBeLessThan(3)
    expect(narrowDescriptionLine).toBeGreaterThanOrEqual(3)

    // When beside, the focused label appears twice on the same physical line: once as the list row
    // and once as the panel title.
    expect(wideLines[wideDescriptionLine - 1]).toContain('read_products')
  })

  test('truncates long labels to a single physical line', async () => {
    const longLabelItems = [
      {
        label: `read_products ${'very-long-suffix '.repeat(20)}`.trim(),
        value: 'read_products',
        description: 'Read-only access to products.',
      },
      {label: 'read_orders', value: 'read_orders', description: 'Read-only access to orders.'},
    ]

    const {stdout} = renderWithWidth(<MultiSelectInput items={longLabelItems} onSubmit={() => {}} />, 120)

    await waitForInputsToBeReady()

    const frame = lastUnstyledFrame(stdout)
    // The row is clipped with an ellipsis and the full label never appears in one piece.
    expect(frame).toContain('…')
    expect(frame).not.toContain(longLabelItems[0]!.label)
  })

  test('keeps a stable render height while scrolling through long descriptions (ghosting fix)', async () => {
    const manyLongItems = Array.from({length: 12}, (_, index) => ({
      label: `scope:${index}`,
      value: `scope-${index}`,
      description: `A very long description for scope ${index} that would previously wrap onto ${'multiple '.repeat(
        8,
      )}physical lines and cause ghosting when scrolling.`,
    }))

    const {renderInstance, stdout} = renderWithWidth(
      <MultiSelectInput items={manyLongItems} onSubmit={() => {}} availableLines={6} />,
      120,
    )

    await waitForInputsToBeReady()
    const initialLineCount = lastUnstyledFrame(stdout).split('\n').length

    // Arrowing down repeatedly must not grow the rendered block: single-line rows keep the true
    // height equal to the option count, so nothing overflows the viewport and prior frames are
    // fully erased.
    for (let step = 0; step < 8; step++) {
      // eslint-disable-next-line no-await-in-loop
      await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))
      expect(lastUnstyledFrame(stdout).split('\n').length).toBe(initialLineCount)
    }
  })

  test('renders no panel and no truncation when no item has a description', async () => {
    const items = [
      {label: 'read_products', value: 'read_products'},
      {label: 'read_orders', value: 'read_orders'},
      {label: 'read_customers', value: 'read_customers'},
    ]

    const {stdout} = renderWithWidth(<MultiSelectInput items={items} onSubmit={() => {}} />, 120)

    await waitForInputsToBeReady()

    const frame = lastUnstyledFrame(stdout)
    expect(frame).not.toContain('…')
    expect(frame).toContain('read_products')
    expect(frame).toContain('read_orders')
    expect(frame).toContain('read_customers')
  })
})
