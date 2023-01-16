import {AutocompletePrompt} from './AutocompletePrompt.js'
import {Item} from './SelectInput.js'
import {
  getLastFrameAfterUnmount,
  sendInputAndWait,
  sendInputAndWaitForChange,
  sendInputAndWaitForContent,
  waitForInputsToBeReady,
} from '../../../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'
import React from 'react'
import {render} from 'ink-testing-library'

const ARROW_DOWN = '\u001B[B'
const ENTER = '\r'
const DELETE = '\u007F'

describe('AutocompletePrompt', async () => {
  test('choose an answer', async () => {
    const onEnter = vi.fn()

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const infoTable = {Add: ['new-ext'], Remove: ['integrated-demand-ext', 'order-discount']}

    const renderInstance = render(
      <AutocompletePrompt
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
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36m[7mT[27m[2mype to search...[22m[39m

         [1mAutomations[22m
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
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoTable={infoTable}
        onSubmit={() => {}}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36m[7mT[27m[2mype to search...[22m[39m

             Add:     • new-ext

             Remove:  • integrated-demand-ext
                      • order-discount

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth

         [2mnavigate with arrows, enter to select[22m
      "
    `)
  })

  test("doesn't submit if there are no choices", async () => {
    const onEnter = vi.fn()
    const searchPromise = Promise.resolve([] as Item<string>[])
    const search = () => {
      return searchPromise
    }

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={onEnter}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'No results found', 'a')
    // prompt doesn't change when enter is pressed
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36ma[7m [27m[39m

         [2mNo results found.[22m
      "
    `)

    expect(onEnter).not.toHaveBeenCalled()
  })

  test('has a loading state', async () => {
    const onEnter = vi.fn()
    const searchPromise = new Promise<Item<string>[]>((resolve) => {
      setTimeout(() => resolve([{label: 'a', value: 'b'}]), 2000)
    })

    const search = () => {
      return searchPromise
    }

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={onEnter}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'Loading...', 'a')
    // prompt doesn't change when enter is pressed
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36ma[7m [27m[39m

         [2mLoading...[22m
      "
    `)

    expect(onEnter).not.toHaveBeenCalled()
  })

  test('highlights the search term', async () => {
    const database = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const items = database.slice(0, 2)

    const search = (term: string) => {
      return Promise.resolve(database.filter((item) => item.label.includes(term)))
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    // there is a debounce of 300ms before the search is triggered
    await sendInputAndWait(renderInstance, 400, 'i')

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36mi[7m [27m[39m

      [36m>[39m  [36mf[1mi[22mrst[39m
         th[1mi[22mrd

         [2mnavigate with arrows, enter to select[22m
      "
    `)
  })

  test('displays an error message if the search fails', async () => {
    const database = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const items = database.slice(0, 2)

    const search = (term: string) => {
      return Promise.reject(new Error('Something went wrong'))
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'There has been an error', 'i')

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36mi[7m [27m[39m

         [31mThere has been an error while searching. Please try again later.[39m
      "
    `)
  })

  test('immediately shows the initial items if the search is empty', async () => {
    const database = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const items = database.slice(0, 2)

    const search = (term: string) => {
      return Promise.resolve(database.filter((item) => item.label.includes(term)))
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
        search={search}
      />,
    )

    await waitForInputsToBeReady()

    // there is a debounce of 300ms before the search is triggered
    await sendInputAndWait(renderInstance, 400, 'i')

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36mi[7m [27m[39m

      [36m>[39m  [36mf[1mi[22mrst[39m
         th[1mi[22mrd

         [2mnavigate with arrows, enter to select[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, DELETE)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36m[7mT[27m[2mype to search...[22m[39m

      [36m>[39m  [36mfirst[39m
         second

         [2mnavigate with arrows, enter to select[22m
      "
    `)
  })
})
