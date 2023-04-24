import {SelectInput} from './SelectInput.js'
import {sendInputAndWait, sendInputAndWaitForChange, waitForInputsToBeReady, render} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'

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
    expect(onChange).toHaveBeenCalledWith({item: items[2]!, usedShortcut: false})
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
    expect(onChange).toHaveBeenCalledWith({item: items[1]!, usedShortcut: false})
  })

  test('handles single digit numeric shortcuts', async () => {
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
    await sendInputAndWaitForChange(renderInstance, '2')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
    expect(onChange).toHaveBeenCalledWith({item: items[1]!, usedShortcut: true})
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
    expect(onChange).toHaveBeenCalledWith({item: items[2]!, usedShortcut: true})
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
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({item: items[0]!, usedShortcut: false})
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
    expect(onChange).toHaveBeenCalledWith({item: items[2]!, usedShortcut: true})
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
    expect(onChange).toHaveBeenCalledWith({item: items[0]!, usedShortcut: false})
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
    expect(onChange).toHaveBeenCalledWith({item: items[4]!, usedShortcut: true})

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
    expect(onChange).toHaveBeenCalledWith({item: items[6]!, usedShortcut: false})
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
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({item: items[0]!, usedShortcut: false})
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

  test('supports a limit of items to show', async () => {
    const items = [
      {label: 'first', value: 'first', key: 'f'},
      {label: 'second', value: 'second', key: 's'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
      {label: 'fifth', value: 'fifth', group: 'Automations', key: 'a'},
      {label: 'sixth', value: 'sixth', group: 'Automations'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth', group: 'Merchant Admin'},
      {label: 'ninth', value: 'ninth', group: 'Merchant Admin'},
      {label: 'tenth', value: 'tenth'},
    ]

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} limit={5} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
      [36m>[39m  [36m(a) fifth[39m
         (2) sixth

         [1mMerchant Admin[22m
         (3) eighth
         (4) ninth

         [1mOther[22m
         (f) first

         [2mShowing 5 of 10 items.[22m
         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mOther[22m
      [36m>[39m  [36m(10) tenth[39m

         [1mAutomations[22m
         (a) fifth
         (2) sixth

         [1mMerchant Admin[22m
         (3) eighth
         (4) ninth

         [2mShowing 5 of 10 items.[22m
         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)

    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
         (2) sixth

         [1mMerchant Admin[22m
         (3) eighth
         (4) ninth

         [1mOther[22m
         (f) first
      [36m>[39m  [36m(s) second[39m

         [2mShowing 5 of 10 items.[22m
         [2mPress ↑↓ arrows to select, enter to confirm[22m"
    `)
  })
})
