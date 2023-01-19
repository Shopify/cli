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

const DATABASE = [
  {label: 'first', value: 'first'},
  {label: 'second', value: 'second'},
  {label: 'third', value: 'third'},
  {label: 'fourth', value: 'fourth'},
  {label: 'fifth', value: 'fifth'},
  {label: 'sixth', value: 'sixth'},
  {label: 'seventh', value: 'seventh'},
  {label: 'eighth', value: 'eighth'},
  {label: 'ninth', value: 'ninth'},
  {label: 'tenth', value: 'tenth'},
  {label: 'eleventh', value: 'eleventh'},
  {label: 'twelfth', value: 'twelfth'},
  {label: 'thirteenth', value: 'thirteenth'},
  {label: 'fourteenth', value: 'fourteenth'},
  {label: 'fifteenth', value: 'fifteenth'},
  {label: 'sixteenth', value: 'sixteenth'},
  {label: 'seventeenth', value: 'seventeenth'},
  {label: 'eighteenth', value: 'eighteenth'},
  {label: 'nineteenth', value: 'nineteenth'},
  {label: 'twentieth', value: 'twentieth'},
  {label: 'twenty-first', value: 'twenty-first'},
  {label: 'twenty-second', value: 'twenty-second'},
  {label: 'twenty-third', value: 'twenty-third'},
  {label: 'twenty-fourth', value: 'twenty-fourth'},
  {label: 'twenty-fifth', value: 'twenty-fifth'},
  {label: 'twenty-sixth', value: 'twenty-sixth'},
  {label: 'twenty-seventh', value: 'twenty-seventh'},
  {label: 'twenty-eighth', value: 'twenty-eighth'},
  {label: 'twenty-ninth', value: 'twenty-ninth'},
  {label: 'thirtieth', value: 'thirtieth'},
  {label: 'thirty-first', value: 'thirty-first'},
  {label: 'thirty-second', value: 'thirty-second'},
  {label: 'thirty-third', value: 'thirty-third'},
  {label: 'thirty-fourth', value: 'thirty-fourth'},
  {label: 'thirty-fifth', value: 'thirty-fifth'},
  {label: 'thirty-sixth', value: 'thirty-sixth'},
  {label: 'thirty-seventh', value: 'thirty-seventh'},
  {label: 'thirty-eighth', value: 'thirty-eighth'},
  {label: 'thirty-ninth', value: 'thirty-ninth'},
  {label: 'fortieth', value: 'fortieth'},
  {label: 'forty-first', value: 'forty-first'},
  {label: 'forty-second', value: 'forty-second'},
  {label: 'forty-third', value: 'forty-third'},
  {label: 'forty-fourth', value: 'forty-fourth'},
  {label: 'forty-fifth', value: 'forty-fifth'},
  {label: 'forty-sixth', value: 'forty-sixth'},
  {label: 'forty-seventh', value: 'forty-seventh'},
  {label: 'forty-eighth', value: 'forty-eighth'},
  {label: 'forty-ninth', value: 'forty-ninth'},
  {label: 'fiftieth', value: 'fiftieth'},
]

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
        search={() => Promise.resolve([] as Item<string>[])}
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
        search={() => Promise.resolve([] as Item<string>[])}
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
        search={() => Promise.resolve([] as Item<string>[])}
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

  test('allows searching with pagination', async () => {
    const onEnter = vi.fn()
    const items = DATABASE.slice(0, 27)

    const search = async (term: string) => {
      return DATABASE.filter((item) => item.label.includes(term))
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={onEnter}
        search={search}
      />,
    )

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36m[7mT[27m[2mype to search...[22m[39m

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth
         fifth
         sixth
         seventh
         eighth
         ninth
         tenth
         eleventh
         twelfth
         thirteenth
         fourteenth
         fifteenth
         sixteenth
         seventeenth
         eighteenth
         nineteenth
         twentieth
         twenty-first
         twenty-second
         twenty-third
         twenty-fourth
         twenty-fifth

         [2mnavigate with arrows, enter to select[22m
      "
    `)

    await waitForInputsToBeReady()
    // there is a debounce of 300ms before the search is triggered
    await sendInputAndWait(renderInstance, 400, 'i')

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36mi[7m [27m[39m

      [36m>[39m  [36mf[1mi[22mrst[39m
         th[1mi[22mrd
         f[1mi[22mfth
         s[1mi[22mxth
         e[1mi[22mghth
         n[1mi[22mnth
         th[1mi[22mrteenth
         f[1mi[22mfteenth
         s[1mi[22mxteenth
         e[1mi[22mghteenth
         n[1mi[22mneteenth
         twent[1mi[22meth
         twenty-f[1mi[22mrst
         twenty-th[1mi[22mrd
         twenty-f[1mi[22mfth
         twenty-s[1mi[22mxth
         twenty-e[1mi[22mghth
         twenty-n[1mi[22mnth
         th[1mi[22mrtieth
         th[1mi[22mrty-first
         th[1mi[22mrty-second
         th[1mi[22mrty-third
         th[1mi[22mrty-fourth
         th[1mi[22mrty-fifth
         th[1mi[22mrty-sixth

         [2mnavigate with arrows, enter to select[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, DELETE)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36m[7mT[27m[2mype to search...[22m[39m

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth
         fifth
         sixth
         seventh
         eighth
         ninth
         tenth
         eleventh
         twelfth
         thirteenth
         fourteenth
         fifteenth
         sixteenth
         seventeenth
         eighteenth
         nineteenth
         twentieth
         twenty-first
         twenty-second
         twenty-third
         twenty-fourth
         twenty-fifth

         [2mnavigate with arrows, enter to select[22m
      "
    `)

    await sendInputAndWait(renderInstance, 400, 'i')
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36mi[7m [27m[39m

         f[1mi[22mrst
         th[1mi[22mrd
      [36m>[39m  [36mf[1mi[22mfth[39m
         s[1mi[22mxth
         e[1mi[22mghth
         n[1mi[22mnth
         th[1mi[22mrteenth
         f[1mi[22mfteenth
         s[1mi[22mxteenth
         e[1mi[22mghteenth
         n[1mi[22mneteenth
         twent[1mi[22meth
         twenty-f[1mi[22mrst
         twenty-th[1mi[22mrd
         twenty-f[1mi[22mfth
         twenty-s[1mi[22mxth
         twenty-e[1mi[22mghth
         twenty-n[1mi[22mnth
         th[1mi[22mrtieth
         th[1mi[22mrty-first
         th[1mi[22mrty-second
         th[1mi[22mrty-third
         th[1mi[22mrty-fourth
         th[1mi[22mrty-fifth
         th[1mi[22mrty-sixth

         [2mnavigate with arrows, enter to select[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?
      [36m✔[39m  [36mfifth[39m
      "
    `)

    expect(onEnter).toHaveBeenCalledWith('fifth')
  })

  test('allows selecting the first item after searching and triggering the loading state', async () => {
    const onEnter = vi.fn()
    const items = DATABASE.slice(0, 27)

    const search = async (term: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return DATABASE.filter((item) => item.label.includes(term))
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={onEnter}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    // there is a debounce of 300ms before the search is triggered + 300ms for the search to complete
    await sendInputAndWait(renderInstance, 700, 'e')

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?: [36me[7m [27m[39m

      [36m>[39m  [36ms[1me[22mcond[39m
         s[1me[22mventh
         [1me[22mighth
         t[1me[22mnth
         [1me[22mleventh
         tw[1me[22mlfth
         thirt[1me[22menth
         fourt[1me[22menth
         fift[1me[22menth
         sixt[1me[22menth
         s[1me[22mventeenth
         [1me[22mighteenth
         nin[1me[22mteenth
         tw[1me[22mntieth
         tw[1me[22mnty-first
         tw[1me[22mnty-second
         tw[1me[22mnty-third
         tw[1me[22mnty-fourth
         tw[1me[22mnty-fifth
         tw[1me[22mnty-sixth
         tw[1me[22mnty-seventh
         tw[1me[22mnty-eighth
         tw[1me[22mnty-ninth
         thirti[1me[22mth
         thirty-s[1me[22mcond

         [2mnavigate with arrows, enter to select[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?
      [36m✔[39m  [36msecond[39m
      "
    `)

    expect(onEnter).toHaveBeenCalledWith('second')
  })

  test('displays an error message if the search fails', async () => {
    const search = (_term: string) => {
      return Promise.reject(new Error('Something went wrong'))
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={DATABASE}
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
