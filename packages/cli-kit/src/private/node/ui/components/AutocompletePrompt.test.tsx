import {AutocompletePrompt, SearchResults} from './AutocompletePrompt.js'
import {
  getLastFrameAfterUnmount,
  sendInputAndWait,
  sendInputAndWaitForChange,
  sendInputAndWaitForContent,
  waitForInputsToBeReady,
  render,
} from '../../testing/ui.js'
import {Stdout} from '../../ui.js'
import {AbortController} from '../../../../public/node/abort.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import React from 'react'
import {useStdout} from 'ink'

vi.mock('ink', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original: any = await vi.importActual('ink')
  return {
    ...original,
    useStdout: vi.fn(),
  }
})

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

beforeEach(() => {
  vi.mocked(useStdout).mockReturnValue({
    stdout: new Stdout({
      columns: 80,
      rows: 80,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    write: () => {},
  })
})

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
        search={() =>
          Promise.resolve({
            data: [],
          } as SearchResults<string>)
        }
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
        search={() =>
          Promise.resolve({
            data: [],
          } as SearchResults<string>)
        }
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

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
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoTable={infoTable}
        onSubmit={() => {}}
        search={() => Promise.resolve({data: []} as SearchResults<string>)}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

             Add:     • new-ext

             Remove:  • integrated-demand-ext
                      • order-discount

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)
  })

  test("doesn't submit if there are no choices", async () => {
    const onEnter = vi.fn()
    const searchPromise = Promise.resolve({
      data: [],
    } as SearchResults<string>)
    const search = () => {
      return searchPromise
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={DATABASE}
        onSubmit={onEnter}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'No results found', 'a')
    // prompt doesn't change when enter is pressed
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36ma[7m [27m[39m

         [2mNo results found.[22m
      "
    `)

    expect(onEnter).not.toHaveBeenCalled()
  })

  test('has a loading state', async () => {
    const onEnter = vi.fn()

    const search = () => {
      return new Promise<SearchResults<string>>((resolve) => {
        setTimeout(() => {
          resolve({data: [{label: 'a', value: 'b'}]})
        }, 2000)
      })
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={DATABASE}
        onSubmit={onEnter}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'Loading...', 'a')
    // prompt doesn't change when enter is pressed
    await new Promise((resolve) => setTimeout(resolve, 100))
    await sendInputAndWait(renderInstance, 100, ENTER)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36ma[7m [27m[39m

         [2mLoading...[22m
      "
    `)

    expect(onEnter).not.toHaveBeenCalled()
  })

  test('allows searching with pagination', async () => {
    const onEnter = vi.fn()

    const search = async (term: string) => {
      return {
        data: DATABASE.filter((item) => item.label.includes(term)),
      }
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={DATABASE}
        onSubmit={onEnter}
        search={search}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'th[1mi[22mrty-sixth', 'i')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mi[7m [27m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, DELETE)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)

    await sendInputAndWaitForContent(renderInstance, 'th[1mi[22mrty-sixth', 'i')
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mi[7m [27m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
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

  test('allows selecting the first item after searching', async () => {
    const onEnter = vi.fn()

    const search = async (term: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return {
        data: DATABASE.filter((item) => item.label.includes(term)),
      }
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={DATABASE}
        onSubmit={onEnter}
        search={search}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, '[1mfiftieth[22m', 'fiftieth')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mfiftieth[7m [27m[39m

      [36m>[39m  [36m[1mfiftieth[22m[39m

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?
      [36m✔[39m  [36mfiftieth[39m
      "
    `)

    expect(onEnter).toHaveBeenCalledWith('fiftieth')
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

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mi[7m [27m[39m

         [31mThere has been an error while searching. Please try again later.[39m
      "
    `)
  })

  test('immediately shows the initial items if the search is empty', async () => {
    const search = (term: string) => {
      return Promise.resolve({
        data: DATABASE.filter((item) => item.label.includes(term)),
      })
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
    await sendInputAndWaitForContent(renderInstance, 'th[1mi[22mrty-sixth', 'i')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mi[7m [27m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, DELETE)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)
  })

  test('shows a message that indicates there are more results than shown', async () => {
    const search = (_term: string) => {
      return Promise.resolve({
        data: DATABASE,
        meta: {hasNextPage: true},
      })
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={DATABASE}
        onSubmit={() => {}}
        hasMorePages
        search={search}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

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

         [1m1-25 of many[22m  Find what you're looking for by typing its name.
         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)
  })

  test('adapts to the height of the container', async () => {
    vi.mocked(useStdout).mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stdout: new Stdout({rows: 10}) as any,
      write: () => {},
    })

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
        hasMorePages
        search={() =>
          Promise.resolve({
            data: items,
          } as SearchResults<string>)
        }
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         [1mAutomations[22m
      [36m>[39m  [36mfirst[39m
         second

         [1m1-10 of many[22m  Find what you're looking for by typing its name.
         [2mShowing 2 of 10 items.[22m
         [2mPress ↑↓ arrows to select, enter to confirm[22m
      "
    `)
  })

  test('abortController can be used to exit the prompt from outside', async () => {
    const items = [
      {label: 'a', value: 'a'},
      {label: 'b', value: 'b'},
    ]

    const abortController = new AbortController()

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
        search={() =>
          Promise.resolve({
            data: [],
          } as SearchResults<string>)
        }
        abortSignal={abortController.signal}
      />,
    )
    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    expect(getLastFrameAfterUnmount(renderInstance)).toEqual('')
    await expect(promise).resolves.toEqual(undefined)
  })
})
