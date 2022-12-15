import SelectPrompt from './SelectPrompt.js'
import {getLastFrame, sendInput, waitForInputsToBeReady} from '../../../../testing/ui.js'
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
        onChoose={onEnter}
      />,
    )

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ARROW_DOWN)
    await sendInput(renderInstance, ENTER)

    expect(getLastFrame(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?
      [36m✔[39m  [36msecond[39m
      "
    `)

    expect(onEnter).toHaveBeenCalledWith(items[1]!.value)
  })

  test('supports an info table', async () => {
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

    const infoTable = {
      Add: ['new-ext'],
      Remove: ['integrated-demand-ext', 'order-discount'],
    }

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoTable={infoTable}
        onChoose={() => {}}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

             Add:     • new-ext
             Remove:  • integrated-demand-ext
                      • order-discount

      [36m>[39m  [36m(f) first[39m
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

         [2mnavigate with arrows, enter to select[22m
      "
    `)
  })
})
