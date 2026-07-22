import {useSelectState} from './use-select-state.js'
import {Item} from '../components/SelectInput.js'
import {render, waitForInputsToBeReady} from '../../testing/ui.js'
import {describe, expect, test} from 'vitest'

import React from 'react'

// The exported `SelectState` type declares `visibleOptionCount`, but the hook's actual return omits
// it, so we type against the real return shape rather than the (broader) declared type.
type HookReturn = ReturnType<typeof useSelectState<string>>

// `setImmediate` is NOT faked by the vitest config (only setTimeout/setInterval/Date are), so it is
// a reliable way to let React's scheduler commit dispatches triggered outside an event handler.
// Poll rather than assume a single tick is enough: the first commit after mount can take an extra
// tick to flush.
async function waitFor(predicate: () => boolean, {tries = 50} = {}) {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (predicate()) return
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setImmediate(resolve))
  }
  throw new Error('waitFor: condition not met in time')
}

const windowSize = (state: HookReturn) => state.visibleToIndex - state.visibleFromIndex + 1

const options: Item<string>[] = Array.from({length: 10}, (_, index) => ({
  label: `item ${index}`,
  value: `v${index}`,
}))

// Captures the latest hook return so the test can drive it (selectNextOption) and read the resulting
// state after each render. A tiny harness is the standard way to exercise a hook in isolation.
let latest: HookReturn

function Harness({visibleOptionCount}: {visibleOptionCount: number}) {
  latest = useSelectState<string>({visibleOptionCount, options})
  return null
}

describe('useSelectState', () => {
  test('preserves value and keeps it visible when visibleOptionCount changes (options unchanged)', async () => {
    const {rerender} = render(<Harness visibleOptionCount={4} />)
    await waitForInputsToBeReady()

    // Navigate down until the highlight is well past the initial window, forcing it to scroll.
    latest.selectNextOption()
    latest.selectNextOption()
    latest.selectNextOption()
    latest.selectNextOption()
    latest.selectNextOption()
    latest.selectNextOption()
    await waitFor(() => latest.value === 'v6')

    // The highlight is inside the current (scrolled) window.
    expect(latest.visibleFromIndex).toBeLessThanOrEqual(6)
    expect(latest.visibleToIndex).toBeGreaterThanOrEqual(6)
    expect(windowSize(latest)).toBe(4)

    // Simulate a resize that only changes the visible-row budget (e.g. crossing the description
    // panel breakpoint). The option set is identical, so the highlight must be preserved.
    rerender(<Harness visibleOptionCount={7} />)
    await waitFor(() => windowSize(latest) === 7)

    // Highlight preserved (NOT reset to the first option) and still on screen.
    expect(latest.value).toBe('v6')
    expect(latest.visibleFromIndex).toBeLessThanOrEqual(6)
    expect(latest.visibleToIndex).toBeGreaterThanOrEqual(6)
  })

  test('resets to the first option when the option set itself changes', async () => {
    // A separate harness whose options can change identity, to prove the options-changed reset path
    // is untouched: new options (e.g. fresh autocomplete results) SHOULD snap focus back to the top.
    let current: HookReturn
    const firstOptions: Item<string>[] = [
      {label: 'a', value: 'a'},
      {label: 'b', value: 'b'},
      {label: 'c', value: 'c'},
    ]
    const secondOptions: Item<string>[] = [
      {label: 'x', value: 'x'},
      {label: 'y', value: 'y'},
      {label: 'z', value: 'z'},
    ]

    function OptionsHarness({items}: {items: Item<string>[]}) {
      current = useSelectState<string>({visibleOptionCount: 3, options: items})
      return null
    }

    const {rerender} = render(<OptionsHarness items={firstOptions} />)
    await waitForInputsToBeReady()

    current!.selectNextOption()
    await waitFor(() => current!.value === 'b')

    rerender(<OptionsHarness items={secondOptions} />)
    // New option set ⇒ focus resets to the first item of the new set.
    await waitFor(() => current!.value === 'x')
    expect(current!.value).toBe('x')
  })
})
