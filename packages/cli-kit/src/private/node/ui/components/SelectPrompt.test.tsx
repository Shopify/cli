import {SelectPrompt} from './SelectPrompt.js'
import {getLastFrameAfterUnmount, sendInputAndWaitForChange, waitForInputsToBeReady} from '../../testing/ui.js'
import {unstyled} from '../../../../output.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

const ARROW_DOWN = '\u001B[B'
const ENTER = '\r'

describe('SelectPrompt', async () => {
  test('choose an answer', async () => {
    const onEnter = vi.fn()

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const infoTable = {Add: ['new-ext'], Remove: ['integrated-demand-ext', 'order-discount']}

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoTable={infoTable}
        onSubmit={onEnter}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?
      [36m✔[39m  [36msecond[39m
      "
    `)

    expect(onEnter).toHaveBeenCalledWith(items[1]!.value)
  })

  test('renders groups', async () => {
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

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         [1mAutomations[22m
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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)
  })

  test('supports an info table', async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const infoTable = {
      Add: ['new-ext'],
      Remove: ['integrated-demand-ext', 'order-discount'],
    }

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoTable={infoTable}
        onSubmit={() => {}}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

             Add:     • new-ext

             Remove:  • integrated-demand-ext
                      • order-discount

      [36m>[39m  [36m(1) first[39m
         (2) second
         (3) third
         (4) fourth

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)
  })

  test("it doesn't submit if there are no choices", async () => {
    const onEnter = vi.fn()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = []

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={onEnter}
      />,
    )

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toContain(
      'ERROR  SelectPrompt requires at least one choice',
    )
  })

  test("doesn't append a colon to the message if it ends with a question mark", async () => {
    const {lastFrame} = render(
      <SelectPrompt choices={[{label: 'a', value: 'a'}]} onSubmit={() => {}} message="Test question?" />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question?

      >  (1) a

         Press ↑↓ arrows to select, enter to confirm
      "
    `)
  })

  test('accepts a default value', async () => {
    const onEnter = vi.fn()
    const items = [
      {label: 'a', value: 'a'},
      {label: 'b', value: 'b'},
    ]

    const renderInstance = render(
      <SelectPrompt choices={items} onSubmit={onEnter} message="Test question?" defaultValue="b" />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question?

         (1) a
      >  (2) b

         Press ↑↓ arrows to select, enter to confirm
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Test question?
      [36m✔[39m  [36mb[39m
      "
    `)
    expect(onEnter).toHaveBeenCalledWith(items[1]!.value)
  })

  test('can submit the initial value', async () => {
    const onEnter = vi.fn()
    const items = [
      {label: 'a', value: 'a'},
      {label: 'b', value: 'b'},
    ]

    const renderInstance = render(<SelectPrompt choices={items} onSubmit={onEnter} message="Test question?" />)

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question?

      >  (1) a
         (2) b

         Press ↑↓ arrows to select, enter to confirm
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Test question?
      [36m✔[39m  [36ma[39m
      "
    `)
    expect(onEnter).toHaveBeenCalledWith(items[0]!.value)
  })
})
