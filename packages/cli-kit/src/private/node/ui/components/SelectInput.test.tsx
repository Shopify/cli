import {SelectInput} from './SelectInput.js'
import {
  sendInputAndWait,
  sendInputAndWaitForChange,
  waitForInputsToBeReady,
  render,
  getLastFrameAfterUnmount,
} from '../../testing/ui.js'
import {platformAndArch} from '../../../../public/node/os.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'

const ARROW_UP = '\u001B[A'
const ARROW_DOWN = '\u001B[B'
const ENTER = '\r'

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
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   First
      [36m>[39m  [36mSecond[39m
         Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenLastCalledWith(items[1])
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
      "   First
      [36m>[39m  [36mSecond[39m
         Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[1])
  })

  test('throws an error if a key has more than 1 character', async () => {
    const onChange = vi.fn()

    const items = [
      {
        label: 'First',
        value: 'first',
        key: 'a',
      },
      {
        label: 'Second',
        value: 'second',
        key: 'b',
      },
      {
        label: 'Third',
        value: 'third',
        key: 'ab',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)
    expect(getLastFrameAfterUnmount(renderInstance)).toMatch('SelectInput: Keys must be a single character')
  })

  test("throws an error if an item has key but others don't", async () => {
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
        key: 'a',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)
    expect(getLastFrameAfterUnmount(renderInstance)).toMatch('SelectInput: All items must have keys if one does')
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
      "[36m>[39m  [36mFirst[39m
         Second
         Tenth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).not.toHaveBeenCalled()
  })

  const runningOnWindows = platformAndArch().platform === 'windows'

  test.skipIf(runningOnWindows)('support groups', async () => {
    const onChange = vi.fn()

    const items = [
      {label: 'first', value: 'first', group: 'Automations'},
      {label: 'second', value: 'second', group: 'Automations'},
      {label: 'third', value: 'third', group: 'Merchant Admin'},
      {label: 'fourth', value: 'fourth', group: 'Merchant Admin'},
      {label: 'fifth', value: 'fifth'},
      {label: 'sixth', value: 'sixth'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth'},
      {label: 'ninth', value: 'ninth'},
      {label: 'tenth', value: 'tenth'},
    ]

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
         [36m>[39m  [36mfirst[39m
            second

         [1mMerchant Admin[22m
            third
            fourth

         [1mOther[22m
            fifth
            sixth
            seventh
            eighth
            ninth
            tenth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
            first
            second

         [1mMerchant Admin[22m
         [36m>[39m  [36mthird[39m
            fourth

         [1mOther[22m
            fifth
            sixth
            seventh
            eighth
            ninth
            tenth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenLastCalledWith(items[2])
  })

  test.skipIf(runningOnWindows)('respects groupOrder for custom group ordering', async () => {
    const onChange = vi.fn()

    const items = [
      {label: 'first', value: 'first', group: 'GroupA'},
      {label: 'second', value: 'second', group: 'GroupA'},
      {label: 'third', value: 'third', group: 'GroupB'},
      {label: 'fourth', value: 'fourth', group: 'GroupB'},
      {label: 'fifth', value: 'fifth', group: 'GroupC'},
      {label: 'sixth', value: 'sixth', group: 'GroupC'},
    ]

    // Custom order: GroupC first, then GroupB, then GroupA
    const groupOrder = ['GroupC', 'GroupB', 'GroupA']

    const renderInstance = render(<SelectInput items={items} onChange={onChange} groupOrder={groupOrder} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mGroupC[22m
         [36m>[39m  [36mfifth[39m
            sixth

         [1mGroupB[22m
            third
            fourth

         [1mGroupA[22m
            first
            second



         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).not.toHaveBeenCalled()
  })

  test.skipIf(runningOnWindows)('ensures "Other" group always appears last with groupOrder', async () => {
    const onChange = vi.fn()

    const items = [
      {label: 'item1', value: '1', group: 'GroupA'},
      {label: 'item2', value: '2', group: 'GroupC'},
      {label: 'item3', value: '3'}, // no group - should be "Other"
      {label: 'item4', value: '4', group: 'GroupX'}, // not in groupOrder
      {label: 'item5', value: '5'}, // no group - should be "Other"
    ]

    // GroupOrder specifies: GroupC first, then GroupA
    // GroupX is not specified, so should come before "Other" but after specified groups
    const groupOrder = ['GroupC', 'GroupA']

    const renderInstance = render(<SelectInput items={items} onChange={onChange} groupOrder={groupOrder} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mGroupC[22m
         [36m>[39m  [36mitem2[39m

         [1mGroupA[22m
            item1

         [1mGroupX[22m
            item4

         [1mOther[22m
            item3
            item5

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).not.toHaveBeenCalled()
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

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
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

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} defaultValue="second" />)

    await waitForInputsToBeReady()

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   First
      [36m>[39m  [36mSecond[39m
         Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
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
      "[36m>[39m  [36mFirst[39m
         Second
         Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
         [1m1-3 of many[22m  Keep scrolling to see more items"
    `)
  })

  test('supports a limit of items to show', async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
      {label: 'fifth', value: 'fifth', group: 'Automations'},
      {label: 'sixth', value: 'sixth', group: 'Automations'},
      {label: 'seventh', value: 'seventh'},
      {label: 'eighth', value: 'eighth', group: 'Merchant Admin'},
      {label: 'ninth', value: 'ninth', group: 'Merchant Admin'},
      {label: 'tenth', value: 'tenth'},
    ]

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} availableLines={10} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m                                                                 [46m [49m
         [36m>[39m  [36mfifth[39m                                                                    [46m [49m
            sixth                                                                    [46m [49m
                                                                                     [46m [49m
         [1mMerchant Admin[22m                                                              [46m [49m
            eighth                                                                   [100m [49m
            ninth                                                                    [100m [49m
                                                                                     [100m [49m
         [1mOther[22m                                                                       [100m [49m
            first                                                                    [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m                                                                 [100m [49m
            sixth                                                                    [46m [49m
                                                                                     [46m [49m
         [1mMerchant Admin[22m                                                              [46m [49m
            eighth                                                                   [46m [49m
            ninth                                                                    [46m [49m
                                                                                     [100m [49m
         [1mOther[22m                                                                       [100m [49m
            first                                                                    [100m [49m
         [36m>[39m  [36msecond[39m                                                                   [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
  })

  test('pressing enter calls onSubmit on the default option', async () => {
    const onSubmit = vi.fn()
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

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(items[0])
  })

  test('pressing enter calls onSubmit on the selected option', async () => {
    const onSubmit = vi.fn()
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

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, ARROW_DOWN)
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(items[1])
  })

  test('using a shortcut calls onSubmit', async () => {
    const onSubmit = vi.fn()
    const items = [
      {
        label: 'First',
        value: 'first',
        key: 'f',
      },
      {
        label: 'Second',
        value: 'second',
        key: 's',
      },
      {
        label: 'Third',
        value: 'third',
        key: 't',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 's')

    expect(onSubmit).toHaveBeenCalledWith(items[1])
  })

  test('supports disabled options', async () => {
    const onSubmit = vi.fn()
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
        disabled: true,
      },
      {
        label: 'Third',
        value: 'third',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   First
         [2mSecond[22m
      [36m>[39m  [36mThird[39m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)

    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(items[2])
  })

  test('default value will be skipped if the option is disabled', async () => {
    const onSubmit = vi.fn()
    const items = [
      {
        label: 'First',
        value: 'first',
      },
      {
        label: 'Second',
        value: 'second',
        disabled: true,
      },
      {
        label: 'Third',
        value: 'third',
      },
    ]

    const renderInstance = render(
      <SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} defaultValue="second" />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36mFirst[39m
         [2mSecond[22m
         Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(items[0])
  })

  test('selects the next non-disabled option if the first option is disabled', async () => {
    const onSubmit = vi.fn()
    const items = [
      {
        label: 'First',
        value: 'first',
        key: 'f',
        disabled: true,
      },
      {
        label: 'Second',
        value: 'second',
        key: 's',
        disabled: true,
      },
      {
        label: 'Third',
        value: 'third',
        key: 't',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [2m(f) First[22m
         [2m(s) Second[22m
      [36m>[39m  [36m(t) Third[39m

         [2mPress ↑↓ arrows to select, enter or a shortcut to confirm.[22m"
    `)

    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(items[2])
  })

  test("doesn't allow submitting disabled options with shortcuts", async () => {
    const onSubmit = vi.fn()
    const items = [
      {
        label: 'First',
        value: 'first',
        key: 'f',
      },
      {
        label: 'Second',
        value: 'second',
        key: 's',
        disabled: true,
      },
      {
        label: 'Third',
        value: 'third',
        key: 't',
      },
    ]

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 's')

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
