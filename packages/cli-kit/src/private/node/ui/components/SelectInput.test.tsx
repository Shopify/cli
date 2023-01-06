import SelectInput from './SelectInput.js'
import {waitForInputsToBeReady, sendInput} from '../../../../testing/ui.js'
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
    await sendInput(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(3) Third[39m

         [2mnavigate with arrows, enter to select[22m"
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
    await sendInput(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
      [36m>[39m  [36m(2) Second[39m
         (3) Third

         [2mnavigate with arrows, enter to select[22m"
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
    await sendInput(renderInstance, '1', '0')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(10) Tenth[39m

         [2mnavigate with arrows, enter to select[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[2]!)
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
    await sendInput(renderInstance, 't')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (1) First
         (2) Second
      [36m>[39m  [36m(t) Third[39m

         [2mnavigate with arrows, enter to select[22m"
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
    await sendInput(renderInstance, ARROW_DOWN)
    await sendInput(renderInstance, ARROW_DOWN)
    await sendInput(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(1) First[39m
         (2) Second
         (3) Third

         [2mnavigate with arrows, enter to select[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[0]!)
  })

  test('support groups', async () => {
    const onChange = vi.fn()

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

    const renderInstance = render(<SelectInput items={items} onChange={onChange} />)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "[36m>[39m  [36m(f) first[39m
         (s) second
         (3) third
         (4) fourth
         (5) seventh
         (6) tenth

         [1mAutomations[22m
         (a) fifth
         (8) sixth

         [1mMerchant Admin[22m
         (9) eighth
         (10) ninth

         [2mnavigate with arrows, enter to select[22m"
    `)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 'a')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (f) first
         (s) second
         (3) third
         (4) fourth
         (5) seventh
         (6) tenth

         [1mAutomations[22m
      [36m>[39m  [36m(a) fifth[39m
         (8) sixth

         [1mMerchant Admin[22m
         (9) eighth
         (10) ninth

         [2mnavigate with arrows, enter to select[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[4]!)

    await sendInput(renderInstance, ARROW_UP)
    await sendInput(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "   (f) first
         (s) second
         (3) third
         (4) fourth
      [36m>[39m  [36m(5) seventh[39m
         (6) tenth

         [1mAutomations[22m
         (a) fifth
         (8) sixth

         [1mMerchant Admin[22m
         (9) eighth
         (10) ninth

         [2mnavigate with arrows, enter to select[22m"
    `)
    expect(onChange).toHaveBeenCalledWith(items[6]!)
  })
})
