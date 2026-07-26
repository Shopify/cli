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

// Physical rows the stacked hint (preview line + its gap) reserves out of the list budget. Mirror
// of `STACKED_HINT_RESERVE` in SelectInput.tsx (not exported, kept in sync deliberately).
const STACKED_HINT_RESERVE = 2

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

  // Derive the rendered list height from a stacked-layout frame. The frame lays out as:
  //   [list rows … (sectionHeight)] [gap] [preview line] [gap] [footer]
  // so the list height is the index of the preview line minus the one gap row above it.
  function stackedListHeight(frame: string): number {
    const lines = frame.split('\n')
    const previewIndex = lines.findIndex((line) => line.includes('Long description'))
    if (previewIndex === -1) {
      // Fail loudly instead of returning -1 - 1: a negative height makes every
      // `height + STACKED_HINT_RESERVE <= availableLines` assertion below pass vacuously, so a
      // completely broken stacked layout would look like a green test.
      throw new Error(`No description preview line found in this stacked frame:\n${frame}`)
    }
    return previewIndex - 1
  }

  // A focused row renders as `>` followed by the label, indented by the grouped row margin. Match
  // the whole row so that e.g. `command:1` cannot satisfy an assertion about `command:10`.
  function hasFocusedRow(frame: string, label: string): boolean {
    return frame.split('\n').some((line) => line.trimEnd() === `   >  ${label}`)
  }

  // Regression for R1, NO-OVERFLOW ONLY: in the STACKED description layout a grouped list has
  // `minHeight = 5`, which used to override the reduced list budget so `sectionHeight + gap +
  // preview` overflowed the viewport (reintroducing vertical ghosting). The hard-ceiling clamp
  // guarantees the exact invariant `listHeight + STACKED_HINT_RESERVE <= availableLines`. Pre-fix
  // the list height was pinned at 5, so `5 + 2 = 7` blew both the 3- and 6-row budgets.
  //
  // These two budgets are far below what a grouped row needs (a group title plus its option row is
  // 2 physical rows), so they assert containment and stability ONLY: the block fits the budget and
  // never grows while arrowing. They deliberately assert NOTHING about usability — at both 3 and 6
  // rows the focused option's row is clipped for most or all of the walk. Usability is covered at a
  // realistic budget by 'keeps the focused option visible …', and the clipping itself is pinned by
  // 'clips the focused option at a pathological grouped budget …'.
  for (const availableLines of [3, 6]) {
    test(`keeps a grouped stacked list within the vertical budget — no-overflow only (availableLines=${availableLines})`, async () => {
      const groupedItems = Array.from({length: 8}, (_, index) => ({
        label: `command:${index}`,
        value: `command-${index}`,
        group: index % 2 === 0 ? 'Group A' : 'Group B',
        description: `Long description ${index} ${'word '.repeat(30)}`.trim(),
      }))

      // Width 80 forces the stacked layout; grouped items give `minHeight = 5`, the pre-fix floor.
      const {renderInstance, stdout} = renderWithWidth(
        <SelectInput items={groupedItems} onChange={() => {}} availableLines={availableLines} />,
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

  // The positive counterpart to the no-overflow-only tests above: proof that the R1 clamp leaves the
  // case that actually ships fully usable. `availableLines` is `stdout.rows` minus the prompt and
  // footer areas (see Prompts/PromptLayout.tsx), so 15 is roughly what a standard 24-row terminal
  // leaves, and 12 items against `limit = 8` means the list genuinely scrolls. This walks every item
  // and asserts the focused option is really on screen — its label AND the `>` cursor — while the
  // block stays inside the budget.
  test('keeps the focused option visible while arrowing a grouped stacked list at a realistic budget', async () => {
    const availableLines = 15
    const groupedItems = Array.from({length: 12}, (_, index) => ({
      label: `command:${index}`,
      value: `command-${index}`,
      // Contiguous groups, the way a caller declares them: `sortBy` is stable, so each group costs a
      // single title row. Groups that alternate per item instead cost a title row per item, which
      // `maximumLinesLostToGroups()` does not budget for.
      group: index < 6 ? 'Group A' : 'Group B',
      description: `Long description ${index} ${'word '.repeat(30)}`.trim(),
    }))

    // Width 80 forces the stacked layout, the only one the clamp applies to.
    const {renderInstance, stdout} = renderWithWidth(
      <SelectInput items={groupedItems} onChange={() => {}} availableLines={availableLines} />,
      80,
    )

    await waitForInputsToBeReady()

    const initialFrame = lastUnstyledFrame(stdout)
    expect(hasFocusedRow(initialFrame, 'command:0')).toBe(true)
    expect(stackedListHeight(initialFrame) + STACKED_HINT_RESERVE).toBeLessThanOrEqual(availableLines)

    // Walk to the last item (length - 1 presses; a further down-arrow is a no-op that never yields a
    // new frame). Every frame must show the newly focused option and its description.
    for (let step = 1; step < groupedItems.length; step++) {
      // eslint-disable-next-line no-await-in-loop
      await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))
      const frame = lastUnstyledFrame(stdout)
      expect(hasFocusedRow(frame, `command:${step}`)).toBe(true)
      expect(frame).toContain(`Long description ${step} word`)
      expect(stackedListHeight(frame) + STACKED_HINT_RESERVE).toBeLessThanOrEqual(availableLines)
    }
  })

  // Pins the documented, intentional consequence of the R1 hard-ceiling clamp in SelectInput.tsx:
  // the clamp bounds the list's physical height but not the logical `limit`, so at this pathological
  // budget the list box is a single row, shows only the group title, and `overflowY="hidden"` clips
  // the focused option's row. Real terminals are ≥24 rows and never reach it; clipping a row here
  // was accepted over dropping the clamp, which reintroduced vertical ghosting. If the clamp is ever
  // reworked this test fails, so the behaviour change is a deliberate decision rather than a
  // surprise — update it together with the clamp comment.
  test('clips the focused option at a pathological grouped budget (documented limitation)', async () => {
    const availableLines = 3
    const groupedItems = Array.from({length: 8}, (_, index) => ({
      label: `command:${index}`,
      value: `command-${index}`,
      group: index % 2 === 0 ? 'Group A' : 'Group B',
      description: `Long description ${index} ${'word '.repeat(30)}`.trim(),
    }))

    const {stdout} = renderWithWidth(
      <SelectInput items={groupedItems} onChange={() => {}} availableLines={availableLines} />,
      80,
    )

    await waitForInputsToBeReady()

    // The observed frame is exactly: group title, gap, description preview, gap, footer.
    const frame = lastUnstyledFrame(stdout)
    expect(frame).toContain('Group A')
    expect(frame).toContain('Long description 0 word')
    // The accepted casualty: no option row survives the 1-row list box, so neither the focused
    // label nor its `>` cursor is visible.
    expect(frame).not.toContain('command:')
    expect(hasFocusedRow(frame, 'command:0')).toBe(false)
    // The point of the clamp: the block still fits the budget instead of overflowing it.
    expect(stackedListHeight(frame) + STACKED_HINT_RESERVE).toBeLessThanOrEqual(availableLines)
  })

  // Regression for R2: a WIDTH-only resize that crosses the description-panel breakpoint changes the
  // list's row budget (`limit` / `visibleOptionCount`) without changing the option set. The state
  // hook used to reset to the first option on any `visibleOptionCount` change, jumping the highlight
  // back to item 0 (so a subsequent Enter could confirm the wrong item). It must now preserve the
  // highlight and only re-fit the scroll window.
  test('preserves the highlighted item across a width-only resize (beside↔stacked)', async () => {
    const items = Array.from({length: 8}, (_, index) => ({
      label: `command:${index}`,
      value: `command-${index}`,
      description: `Unique description number ${index} for command ${index}.`,
    }))

    const changes: (string | undefined)[] = []
    // availableLines=6 keeps `limit` below the item count and makes it differ between stacked
    // (4 rows) and beside (6 rows), so crossing the breakpoint genuinely changes visibleOptionCount.
    const stdout = new Stdout({columns: 80, rows: 100})
    const renderInstance = render(
      <SelectInput items={items} availableLines={6} onChange={(item) => changes.push(item?.value)} />,
      {stdout: stdout as unknown as NodeJS.WriteStream},
    )

    await waitForInputsToBeReady()

    // Highlight command-5 (scrolls the window in the narrow/stacked layout).
    for (let step = 0; step < 5; step++) {
      // eslint-disable-next-line no-await-in-loop
      await sendAndWaitForFrameChange(stdout, () => renderInstance.stdin.write(ARROW_DOWN))
    }
    expect(changes[changes.length - 1]).toBe('command-5')
    expect(lastUnstyledFrame(stdout)).toContain('Unique description number 5')

    // Widen past the beside breakpoint: layout flips to the side panel and visibleOptionCount grows.
    await sendAndWaitForFrameChange(stdout, () => {
      stdout.columns = 120
      stdout.emit('resize')
    })

    const afterResize = lastUnstyledFrame(stdout)
    // The highlight (and thus the shown description) must still be command-5, NOT reset to item 0.
    expect(afterResize).toContain('Unique description number 5')
    expect(afterResize).not.toContain('Unique description number 0')
    // The resize must not have fired onChange with a different value (no silent selection jump).
    expect(changes[changes.length - 1]).toBe('command-5')
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
