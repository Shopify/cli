import SelectInput from './SelectInput.js'
import {waitForInputsToBeReady, waitForChange, sendInput} from '../../../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

const ARROW_UP = '\u001B[A'
const ARROW_DOWN = '\u001B[B'
const ENTER = '\r'

describe('SelectInput', async () => {
  test('move up with up arrow key', async () => {
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
      },
      {
        label: 'Third',
        value: 'third',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={() => {}} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(3) Third[39m

         [2mnavigate with arrows, enter to select[22m"
    `)
  })

  test('move down with down arrow key', async () => {
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
      },
      {
        label: 'Third',
        value: 'third',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={() => {}} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

         [2mnavigate with arrows, enter to select[22m"
    `)
  })

  test('select item with enter key', async () => {
    const onEnter = vi.fn()

    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
      },
      {
        label: 'Third',
        value: 'third',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={onEnter} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ARROW_DOWN)
    await waitForChange(
      () => renderInstance.stdin.write(ENTER),
      () => onEnter.mock.calls.length,
    )

    expect(onEnter).toHaveBeenCalledWith(items[1]!.value)
  })

  test('handles keys with multiple digits', async () => {
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
      },
      {
        label: 'Tenth',
        value: 'tenth',
        key: '10',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={() => {}} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, '1', '0')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(10) Tenth[39m

         [2mnavigate with arrows, enter to select[22m"
    `)
  })

  test('handles custom keys', async () => {
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
      },
      {
        label: 'Third',
        value: 'third',
        key: 't',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={() => {}} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 't')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(t) Third[39m

         [2mnavigate with arrows, enter to select[22m"
    `)
  })

  test('rotate after reaching the end of the list', async () => {
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
      },
      {
        label: 'Third',
        value: 'third',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={() => {}} />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ARROW_DOWN)
    await sendInput(renderInstance, ARROW_DOWN)
    await sendInput(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Third

         [2mnavigate with arrows, enter to select[22m"
    `)
  })

  test('support groups', async () => {
    const items = [
      {label: 'first', value: 'first', key: 'f'},
      {label: 'second', value: 'second', key: 's'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
      {label: 'fifth', value: 'fifth', group: 'Automations'},
      {label: 'sixth', value: 'sixth', group: 'Automations'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth', group: 'Merchant Admin'},
      {label: 'ninth', value: 'ninth', group: 'Merchant Admin'},
      {label: 'tenth', value: 'tenth'},
    ]

    const renderInstance = render(<SelectInput items={items} onSelect={() => {}} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(f) first[39m
         (s) second
         (3) third
         (4) fourth
         (5) seventh
         (6) tenth

         [1mAutomations[22m
         (7) fifth
         (8) sixth

         [1mMerchant Admin[22m
         (9) eighth
         (10) ninth

         [2mnavigate with arrows, enter to select[22m"
    `)
  })
})
