import {SelectPrompt} from './SelectPrompt.js'
import {getLastFrameAfterUnmount, sendInput, waitForInputsToBeReady} from '../../../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

const ARROW_DOWN = '\u001B[B'
const ENTER = '\r'

describe('Prompt', async () => {
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
    await sendInput(renderInstance, ARROW_DOWN)
    await sendInput(renderInstance, ENTER)

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

         [2mnavigate with arrows, enter to select[22m
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

         [2mnavigate with arrows, enter to select[22m
      "
    `)
  })
})
