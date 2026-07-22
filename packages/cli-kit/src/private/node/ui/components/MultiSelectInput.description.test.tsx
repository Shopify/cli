import {MultiSelectInput} from './MultiSelectInput.js'
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

// Physical rows the stacked hint (preview line + its gap) reserves out of the list budget. Mirror
// of `STACKED_HINT_RESERVE` in MultiSelectInput.tsx (not exported, kept in sync deliberately).
const STACKED_HINT_RESERVE = 2

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

  test('truncates a long group title to a single physical line', async () => {
    // Long enough to wrap to several rows if it were not truncated. No descriptions here on purpose:
    // group-title truncation is unconditional, not gated on the descriptions feature.
    const longGroupTitle = `Group ${'segment-'.repeat(30)}`.trim()
    const groupedItems = [
      {label: 'alpha', value: 'alpha', group: longGroupTitle},
      {label: 'beta', value: 'beta', group: longGroupTitle},
    ]

    const {stdout} = renderWithWidth(<MultiSelectInput items={groupedItems} onSubmit={() => {}} />, 80)

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
      label: `scope:${index}`,
      value: `scope-${index}`,
      description: `Long description ${index} ${'word '.repeat(30)}`.trim(),
    }))

    // Narrow width forces the stacked layout; a small budget is where the old code overflowed.
    const {renderInstance, stdout} = renderWithWidth(
      <MultiSelectInput items={manyLongItems} onSubmit={() => {}} availableLines={6} />,
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

  // Derive the rendered list height from a stacked-layout frame. The frame lays out as:
  //   [list rows … (sectionHeight)] [gap] [preview line] [gap] [footer]
  // so the list height is the index of the preview line minus the one gap row above it.
  function stackedListHeight(frame: string): number {
    const lines = frame.split('\n')
    const previewIndex = lines.findIndex((line) => line.includes('Long description'))
    return previewIndex - 1
  }

  // Regression for R1: in the STACKED description layout a grouped list has `minHeight = 5`, which
  // used to override the reduced list budget so `sectionHeight + gap + preview` overflowed the
  // viewport (reintroducing vertical ghosting). The hard-ceiling clamp guarantees the exact
  // invariant `listHeight + STACKED_HINT_RESERVE <= availableLines`. Pre-fix the list height was
  // pinned at 5, so `5 + 2 = 7` blew both the 3- and 6-row budgets.
  for (const availableLines of [3, 6]) {
    test(`keeps a grouped stacked list within the vertical budget (availableLines=${availableLines})`, async () => {
      const groupedItems = Array.from({length: 8}, (_, index) => ({
        label: `scope:${index}`,
        value: `scope-${index}`,
        group: index % 2 === 0 ? 'Group A' : 'Group B',
        description: `Long description ${index} ${'word '.repeat(30)}`.trim(),
      }))

      // Width 80 forces the stacked layout; grouped items give `minHeight = 5`, the pre-fix floor.
      const {renderInstance, stdout} = renderWithWidth(
        <MultiSelectInput items={groupedItems} onSubmit={() => {}} availableLines={availableLines} />,
        80,
      )

      await waitForInputsToBeReady()

      expect(stackedListHeight(lastUnstyledFrame(stdout)) + STACKED_HINT_RESERVE).toBeLessThanOrEqual(availableLines)

      // Arrow down to the last item (length - 1 presses); a further down-arrow at the end is a
      // no-op that would never produce a new frame. On every frame the budget invariant must hold
      // and the block height must never grow (no ghosting).
      const initialLineCount = lastUnstyledFrame(stdout).split('\n').length
      for (let step = 0; step < groupedItems.length - 1; step++) {
        // eslint-disable-next-line no-await-in-loop
        await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))
        expect(stackedListHeight(lastUnstyledFrame(stdout)) + STACKED_HINT_RESERVE).toBeLessThanOrEqual(availableLines)
        expect(lastUnstyledFrame(stdout).split('\n').length).toBe(initialLineCount)
      }
    })
  }

  // Regression for R2 (shared `useSelectState`): a WIDTH-only resize that crosses the panel
  // breakpoint changes `visibleOptionCount` without changing the option set. The hook must preserve
  // the focused item instead of resetting focus to the first item.
  test('preserves the focused item across a width-only resize (beside↔stacked)', async () => {
    const items = Array.from({length: 8}, (_, index) => ({
      label: `scope:${index}`,
      value: `scope-${index}`,
      description: `Unique description number ${index} for scope ${index}.`,
    }))

    // availableLines=6 keeps `limit` below the item count and makes it differ between stacked (4
    // rows) and beside (6 rows), so crossing the breakpoint genuinely changes visibleOptionCount.
    const stdout = new Stdout({columns: 80, rows: 100})
    const renderInstance = render(<MultiSelectInput items={items} availableLines={6} onSubmit={() => {}} />, {
      stdout: stdout as unknown as NodeJS.WriteStream,
    })

    await waitForInputsToBeReady()

    // Focus scope-5 (scrolls the window in the narrow/stacked layout).
    for (let step = 0; step < 5; step++) {
      // eslint-disable-next-line no-await-in-loop
      await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))
    }
    expect(lastUnstyledFrame(stdout)).toContain('Unique description number 5')

    // Widen past the beside breakpoint: layout flips to the side panel and visibleOptionCount grows.
    await sendAndWaitForFrameChange(stdout, () => {
      stdout.columns = 120
      stdout.emit('resize')
    })

    const afterResize = lastUnstyledFrame(stdout)
    // Focus (and thus the shown description) must still be scope-5, NOT reset to item 0.
    expect(afterResize).toContain('Unique description number 5')
    expect(afterResize).not.toContain('Unique description number 0')
  })

  test('Shift+Tab toggles a full-description takeover', async () => {
    // Long enough that the compact preview must truncate before the sentinel token at the end.
    const longDescription =
      'This description begins here and then continues far past a single terminal line so the compact ' +
      'preview has to truncate it, right up to the sentinel token OMEGA_END_TOKEN.'
    const items = [
      {label: 'read_products', value: 'read_products', description: longDescription},
      {label: 'read_orders', value: 'read_orders', description: 'Read-only access to orders.'},
    ]

    const {renderInstance, stdout} = renderWithWidth(<MultiSelectInput items={items} onSubmit={() => {}} />, 80)

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
