import SelectInput from './SelectInput.js'
import {sendInputAndWait, sendInputAndWaitForChange, waitForInputsToBeReady} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

const ARROW_UP = '\u001B[A'
const ARROW_DOWN = '\u001B[B'

describe('SelectInput', async () => {
  test('move up with up arrow key', async () => {
    const onChange = vi.fn()

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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(3) Third[39m

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[2]!)
  })

  test('move down with down arrow key', async () => {
    const onChange = vi.fn()

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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[1]!)
  })

  test('handles keys with multiple digits', async () => {
    const onChange = vi.fn()
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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, '1', '0')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(10) Tenth[39m

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[2]!)
  })

  test('handles pressing non existing keys', async () => {
    const onChange = vi.fn()
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
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    await waitForInputsToBeReady()
    // nothing changes when pressing a key that doesn't exist
    await sendInputAndWait(renderInstance, 100, '4')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Tenth

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('handles custom keys', async () => {
    const onChange = vi.fn()
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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 't')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(t) Third[39m

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[2]!)
  })

  test('rotate after reaching the end of the list', async () => {
    const onChange = vi.fn()
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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Third

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[0]!)
  })

  test('support groups', async () => {
    const onChange = vi.fn()

    const items = [
      {label: 'first', value: 'first', group: 'Automations', key: 'f'},
      {label: 'second', value: 'second', group: 'Automations', key: 's'},
      {label: 'third', value: 'third', group: 'Merchant Admin'},
      {label: 'fourth', value: 'fourth', group: 'Merchant Admin'},
      {label: 'fifth', value: 'fifth', key: 'a'},
      {label: 'sixth', value: 'sixth'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth'},
      {label: 'ninth', value: 'ninth'},
      {label: 'tenth', value: 'tenth'},
    ]

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
      [36m>[39m  [36m(f) first[39m
         (s) second

         [1mMerchant Admin[22m
         (3) third
         (4) fourth

         [1mOther[22m
         (a) fifth
         (6) sixth
         (7) seventh
         (8) eighth
         (9) ninth
         (10) tenth

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'a')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
         (f) first
         (s) second

         [1mMerchant Admin[22m
         (3) third
         (4) fourth

         [1mOther[22m
      [36m>[39m  [36m(a) fifth[39m
         (6) sixth
         (7) seventh
         (8) eighth
         (9) ninth
         (10) tenth

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[4]!)

    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
         (f) first
         (s) second

         [1mMerchant Admin[22m
         (3) third
         (4) fourth

         [1mOther[22m
         (a) fifth
         (6) sixth
      [36m>[39m  [36m(7) seventh[39m
         (8) eighth
         (9) ninth
         (10) tenth

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[6]!)
  })

  test('allows disabling shortcuts', async () => {
    const onChange = vi.fn()
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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} enableShortcuts={false} />)

    await waitForInputsToBeReady()
    // input doesn't change on shortcut pressed
    await sendInputAndWait(renderInstance, 100, '2')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36mFirst[39m
         Second
         Third

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('accepts a default value', async () => {
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

    const renderInstance = render(
      <SelectInput items={items} onChange={() => {}} defaultValue={{label: 'Second', value: 'second'}} />,
    )

    await waitForInputsToBeReady()

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
  })

  test('shows if there are more pages', async () => {
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

    const renderInstance = render(
      <SelectInput
        items={items}
        onChange={() => {}}
        morePagesMessage="Keep scrolling to see more items"
        hasMorePages
      />,
    )

    await waitForInputsToBeReady()

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Third

         [1m1-3 of many[22m  Keep scrolling to see more items
         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
  })
})
