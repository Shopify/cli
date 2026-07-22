import {SelectInput} from './SelectInput.js'
import {render, waitForInputsToBeReady} from '../../testing/ui.js'
import {Stdout} from '../../ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {describe, expect, test} from 'vitest'

import React from 'react'

const ARROW_DOWN = '[B'

// Ink parses CSI Z (ESC [ Z, "back-tab") as Shift+Tab, which TextInput deliberately ignores, so it
// is the free toggle key for the full-description overlay.
const SHIFT_TAB = '[Z'

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
  {label: 'doc:fetch', value: 'fetch', description: 'Fetch a documentation page by URL.'},
  {label: 'doc:search', value: 'search', description: 'Search the docs for a keyword.'},
  {label: 'app:dev', value: 'dev', description: 'Start a local development server.'},
]

describe('SelectInput with descriptions', () => {
  test('shows the highlighted item description in a panel', async () => {
    const {stdout} = renderWithWidth(<SelectInput items={itemsWithDescriptions} onChange={() => {}} />, 120)

    await waitForInputsToBeReady()

    const frame = lastUnstyledFrame(stdout)
    expect(frame).toContain('Fetch a documentation page by URL.')
    // The other items' descriptions are not shown until they become highlighted.
    expect(frame).not.toContain('Search the docs for a keyword.')
  })

  test('updates the shown description when arrowing', async () => {
    const {renderInstance, stdout} = renderWithWidth(
      <SelectInput items={itemsWithDescriptions} onChange={() => {}} />,
      120,
    )

    await waitForInputsToBeReady()
    await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))

    const frame = lastUnstyledFrame(stdout)
    expect(frame).toContain('Search the docs for a keyword.')
    expect(frame).not.toContain('Fetch a documentation page by URL.')
  })

  test('places the panel beside the list on wide terminals and below on narrow ones', async () => {
    const description = 'Fetch a documentation page by URL.'

    const {stdout: wideStdout} = renderWithWidth(<SelectInput items={itemsWithDescriptions} onChange={() => {}} />, 120)
    const {stdout: narrowStdout} = renderWithWidth(
      <SelectInput items={itemsWithDescriptions} onChange={() => {}} />,
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

    // When beside, the highlighted label appears twice on the same physical line: once as the list
    // row and once as the panel title.
    expect(wideLines[wideDescriptionLine - 1]).toContain('doc:fetch')
  })

  test('truncates long labels to a single physical line', async () => {
    const longLabelItems = [
      {
        label: `doc:fetch ${'very-long-suffix '.repeat(20)}`.trim(),
        value: 'fetch',
        description: 'Fetch a documentation page by URL.',
      },
      {label: 'app:dev', value: 'dev', description: 'Start a local development server.'},
    ]

    const {stdout} = renderWithWidth(<SelectInput items={longLabelItems} onChange={() => {}} />, 120)

    await waitForInputsToBeReady()

    const frame = lastUnstyledFrame(stdout)
    // The row is clipped with an ellipsis and the full label never appears in one piece.
    expect(frame).toContain('…')
    expect(frame).not.toContain(longLabelItems[0]!.label)
  })

  test('keeps a stable render height while scrolling through long descriptions (ghosting fix)', async () => {
    const manyLongItems = Array.from({length: 12}, (_, index) => ({
      label: `command:${index}`,
      value: `command-${index}`,
      description: `A very long description for command ${index} that would previously wrap onto ${'multiple '.repeat(
        8,
      )}physical lines and cause ghosting when scrolling.`,
    }))

    const {renderInstance, stdout} = renderWithWidth(
      <SelectInput items={manyLongItems} onChange={() => {}} availableLines={6} />,
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
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const {stdout} = renderWithWidth(<SelectInput items={items} onChange={() => {}} />, 120)

    await waitForInputsToBeReady()

    const frame = lastUnstyledFrame(stdout)
    expect(frame).not.toContain('…')
    expect(frame).toContain('first')
    expect(frame).toContain('second')
    expect(frame).toContain('third')
  })

  test('truncates a long group title to a single physical line', async () => {
    // Long enough to wrap to several rows if it were not truncated. No descriptions here on purpose:
    // group-title truncation is unconditional, not gated on the descriptions feature.
    const longGroupTitle = `Group ${'segment-'.repeat(30)}`.trim()
    const groupedItems = [
      {label: 'alpha', value: 'alpha', group: longGroupTitle},
      {label: 'beta', value: 'beta', group: longGroupTitle},
    ]

    const {stdout} = renderWithWidth(<SelectInput items={groupedItems} onChange={() => {}} />, 80)

    await waitForInputsToBeReady()

    const lines = lastUnstyledFrame(stdout).split('\n')
    // If the title wrapped, more than one physical line would carry a chunk of it.
    const titleLines = lines.filter((line) => line.includes('segment-'))
    expect(titleLines).toHaveLength(1)
    expect(lastUnstyledFrame(stdout)).toContain('…')
    // The option rows below the title are still visible (not clipped by an overflowing title).
    expect(lastUnstyledFrame(stdout)).toContain('alpha')
    expect(lastUnstyledFrame(stdout)).toContain('beta')
  })

  test('keeps the stacked layout within the vertical budget while scrolling', async () => {
    const manyLongItems = Array.from({length: 12}, (_, index) => ({
      label: `command:${index}`,
      value: `command-${index}`,
      description: `Long description ${index} ${'word '.repeat(30)}`.trim(),
    }))

    // Narrow width forces the stacked layout; a small budget is where the old code overflowed.
    const {renderInstance, stdout} = renderWithWidth(
      <SelectInput items={manyLongItems} onChange={() => {}} availableLines={6} />,
      80,
    )

    await waitForInputsToBeReady()
    const initialLineCount = lastUnstyledFrame(stdout).split('\n').length

    // The stacked hint is reserved out of the list budget, so the whole block stays small and, more
    // importantly, its height never grows as focus moves (which is what caused vertical ghosting).
    expect(initialLineCount).toBeLessThanOrEqual(10)
    for (let step = 0; step < 8; step++) {
      // eslint-disable-next-line no-await-in-loop
      await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))
      expect(lastUnstyledFrame(stdout).split('\n').length).toBe(initialLineCount)
    }
  })

  test('Shift+Tab toggles a full-description takeover', async () => {
    // Long enough that the compact preview must truncate before the sentinel token at the end.
    const longDescription =
      'This description begins here and then continues far past a single terminal line so the compact ' +
      'preview has to truncate it, right up to the sentinel token OMEGA_END_TOKEN.'
    const items = [
      {label: 'doc:fetch', value: 'fetch', description: longDescription},
      {label: 'app:dev', value: 'dev', description: 'Start a local development server.'},
    ]

    const {renderInstance, stdout} = renderWithWidth(<SelectInput items={items} onChange={() => {}} />, 80)

    await waitForInputsToBeReady()

    // The footer can wrap on narrow terminals, so normalize whitespace before matching the hint.
    const normalizeWhitespace = (frame: string) => frame.replace(/\s+/g, ' ')

    const before = lastUnstyledFrame(stdout)
    // Compact preview: hint present, sentinel truncated away.
    expect(normalizeWhitespace(before)).toContain('⇧⇥ full description')
    expect(before).not.toContain('OMEGA_END_TOKEN')

    await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(SHIFT_TAB))
    const overlay = lastUnstyledFrame(stdout)
    // Takeover: the full text (including the sentinel) is now shown, with a back hint.
    expect(overlay).toContain('OMEGA_END_TOKEN')
    expect(overlay).toContain('Press ⇧⇥ to go back.')

    await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(SHIFT_TAB))
    const after = lastUnstyledFrame(stdout)
    // Back to the list: sentinel hidden again, discoverability hint restored.
    expect(after).not.toContain('OMEGA_END_TOKEN')
    expect(normalizeWhitespace(after)).toContain('⇧⇥ full description')
  })
})
