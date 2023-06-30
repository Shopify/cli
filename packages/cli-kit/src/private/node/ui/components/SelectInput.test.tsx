import {SelectInput} from './SelectInput.js'
import {sendInputAndWait, sendInputAndWaitForChange, waitForInputsToBeReady, render} from '../../testing/ui.js'
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
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

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
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[1])
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

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[1])
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
      "    (1) First
          (2) Second
      [36m>[39m  [36m(10) Tenth[39m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[2])
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
    await sendInputAndWait(renderInstance, 500, '4')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Tenth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
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

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[2])
  })

  const runningOnWindows = platformAndArch().platform === 'windows'

  test.skipIf(runningOnWindows)('support groups', async () => {
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
         [36m>[39m   [36m(f) first[39m
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

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
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
         [36m>[39m   [36m(a) fifth[39m
             (6) sixth
             (7) seventh
             (8) eighth
             (9) ninth
            (10) tenth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[4])

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
         [36m>[39m   [36m(7) seventh[39m
             (8) eighth
             (9) ninth
            (10) tenth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)
    expect(onChange).toHaveBeenLastCalledWith(items[6])
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
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

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
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Third

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
         [1m1-3 of many[22m  Keep scrolling to see more items"
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

    const renderInstance = render(<SelectInput items={items} onChange={() => {}} availableLines={10} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   [1mAutomations[22m
         [36m>[39m   [36m(a) fifth[39m
             (2) sixth

         [1mMerchant Admin[22m
             (3) eighth
             (4) ninth

         [1mOther[22m
             (f) first

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
         [2m10 options available, 5 visible.[22m"
    `)

    await waitForInputsToBeReady()
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
         [36m>[39m   [36m(s) second[39m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
         [2m10 options available, 5 visible.[22m"
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

  test('using a shortcut calls onSubmit if submitWithShortcuts is true', async () => {
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

    const renderInstance = render(
      <SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} submitWithShortcuts />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 500, 's')

    expect(onSubmit).toHaveBeenCalledWith(items[1])
  })

  test('using a shortcut does not call onSubmit if submitWithShortcuts is false', async () => {
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
    await sendInputAndWait(renderInstance, 500, 's')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('supports disabled options', async () => {
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
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (f) First
         [2m(s) Second[22m
      [36m>[39m  [36m(t) Third[39m

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

    const renderInstance = render(
      <SelectInput items={items} onChange={() => {}} onSubmit={onSubmit} defaultValue="second" />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(f) First[39m
         [2m(s) Second[22m
         (t) Third

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

         [2mPress ↑↓ arrows to select, enter to confirm.[22m"
    `)

    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(items[2])
  })
})
