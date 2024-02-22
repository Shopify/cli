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
        message={['Associate your project with the org', {userInput: 'Castile Ventures'}, {char: '?'}]}
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
      "?  Associate your project with the org [36mCastile Ventures[39m?
      [36m✔[39m  [36msecond[39m
      "
    `)

    expect(onEnter).toHaveBeenCalledWith(items[1]!.value)
  })

  test('renders groups', async () => {
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
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

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

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
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

         ┃  \u001b[1mAdd\u001b[22m
         ┃  • new-ext
         ┃
         ┃  \u001b[1mRemove\u001b[22m
         ┃  • integrated-demand-ext
         ┃  • order-discount

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)
  })

  test('supports an info message', async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
      {label: 'fourth', value: 'fourth'},
    ]

    const infoMessage = {
      title: {
        color: 'red',
        text: 'Info message title',
      },
      body: 'Info message body',
    }

    const renderInstance = render(
      <AutocompletePrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoMessage={infoMessage}
        onSubmit={() => {}}
        search={() => Promise.resolve({data: []} as SearchResults<string>)}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         ┃  [31mInfo message title[39m
         ┃
         ┃  Info message body

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
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
      "?  Associate your project with the org Castile Ventures?   [36ma[46m█[49m[39m

         [2mNo results found.[22m

























         [2mTry again with a different keyword.[22m
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
      "?  Associate your project with the org Castile Ventures?   [36ma[46m█[49m[39m

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

      [36m>[39m  [36mfirst[39m                                                                       [46m [49m
         second                                                                      [46m [49m
         third                                                                       [46m [49m
         fourth                                                                      [46m [49m
         fifth                                                                       [46m [49m
         sixth                                                                       [46m [49m
         seventh                                                                     [46m [49m
         eighth                                                                      [46m [49m
         ninth                                                                       [46m [49m
         tenth                                                                       [46m [49m
         eleventh                                                                    [46m [49m
         twelfth                                                                     [46m [49m
         thirteenth                                                                  [46m [49m
         fourteenth                                                                  [100m [49m
         fifteenth                                                                   [100m [49m
         sixteenth                                                                   [100m [49m
         seventeenth                                                                 [100m [49m
         eighteenth                                                                  [100m [49m
         nineteenth                                                                  [100m [49m
         twentieth                                                                   [100m [49m
         twenty-first                                                                [100m [49m
         twenty-second                                                               [100m [49m
         twenty-third                                                                [100m [49m
         twenty-fourth                                                               [100m [49m
         twenty-fifth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForContent(renderInstance, 'th[1mi[22mrty-sixth', 'i')

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mi[46m█[49m[39m

      [36m>[39m  [36mf[1mi[22mrst[39m                                                                       [46m [49m
         th[1mi[22mrd                                                                       [46m [49m
         f[1mi[22mfth                                                                       [46m [49m
         s[1mi[22mxth                                                                       [46m [49m
         e[1mi[22mghth                                                                      [46m [49m
         n[1mi[22mnth                                                                       [46m [49m
         th[1mi[22mrteenth                                                                  [46m [49m
         f[1mi[22mfteenth                                                                   [46m [49m
         s[1mi[22mxteenth                                                                   [46m [49m
         e[1mi[22mghteenth                                                                  [46m [49m
         n[1mi[22mneteenth                                                                  [46m [49m
         twent[1mi[22meth                                                                   [46m [49m
         twenty-f[1mi[22mrst                                                                [46m [49m
         twenty-th[1mi[22mrd                                                                [46m [49m
         twenty-f[1mi[22mfth                                                                [46m [49m
         twenty-s[1mi[22mxth                                                                [46m [49m
         twenty-e[1mi[22mghth                                                               [46m [49m
         twenty-n[1mi[22mnth                                                                [46m [49m
         th[1mi[22mrtieth                                                                   [100m [49m
         th[1mi[22mrty-first                                                                [100m [49m
         th[1mi[22mrty-second                                                               [100m [49m
         th[1mi[22mrty-third                                                                [100m [49m
         th[1mi[22mrty-fourth                                                               [100m [49m
         th[1mi[22mrty-fifth                                                                [100m [49m
         th[1mi[22mrty-sixth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, DELETE)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

      [36m>[39m  [36mfirst[39m                                                                       [46m [49m
         second                                                                      [46m [49m
         third                                                                       [46m [49m
         fourth                                                                      [46m [49m
         fifth                                                                       [46m [49m
         sixth                                                                       [46m [49m
         seventh                                                                     [46m [49m
         eighth                                                                      [46m [49m
         ninth                                                                       [46m [49m
         tenth                                                                       [46m [49m
         eleventh                                                                    [46m [49m
         twelfth                                                                     [46m [49m
         thirteenth                                                                  [46m [49m
         fourteenth                                                                  [100m [49m
         fifteenth                                                                   [100m [49m
         sixteenth                                                                   [100m [49m
         seventeenth                                                                 [100m [49m
         eighteenth                                                                  [100m [49m
         nineteenth                                                                  [100m [49m
         twentieth                                                                   [100m [49m
         twenty-first                                                                [100m [49m
         twenty-second                                                               [100m [49m
         twenty-third                                                                [100m [49m
         twenty-fourth                                                               [100m [49m
         twenty-fifth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)

    await sendInputAndWaitForContent(renderInstance, 'th[1mi[22mrty-sixth', 'i')
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36mi[46m█[49m[39m

         f[1mi[22mrst                                                                       [46m [49m
         th[1mi[22mrd                                                                       [46m [49m
      [36m>[39m  [36mf[1mi[22mfth[39m                                                                       [46m [49m
         s[1mi[22mxth                                                                       [46m [49m
         e[1mi[22mghth                                                                      [46m [49m
         n[1mi[22mnth                                                                       [46m [49m
         th[1mi[22mrteenth                                                                  [46m [49m
         f[1mi[22mfteenth                                                                   [46m [49m
         s[1mi[22mxteenth                                                                   [46m [49m
         e[1mi[22mghteenth                                                                  [46m [49m
         n[1mi[22mneteenth                                                                  [46m [49m
         twent[1mi[22meth                                                                   [46m [49m
         twenty-f[1mi[22mrst                                                                [46m [49m
         twenty-th[1mi[22mrd                                                                [46m [49m
         twenty-f[1mi[22mfth                                                                [46m [49m
         twenty-s[1mi[22mxth                                                                [46m [49m
         twenty-e[1mi[22mghth                                                               [46m [49m
         twenty-n[1mi[22mnth                                                                [46m [49m
         th[1mi[22mrtieth                                                                   [100m [49m
         th[1mi[22mrty-first                                                                [100m [49m
         th[1mi[22mrty-second                                                               [100m [49m
         th[1mi[22mrty-third                                                                [100m [49m
         th[1mi[22mrty-fourth                                                               [100m [49m
         th[1mi[22mrty-fifth                                                                [100m [49m
         th[1mi[22mrty-sixth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
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
      "?  Associate your project with the org Castile Ventures?   [36mi[46m█[49m[39m

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
      "?  Associate your project with the org Castile Ventures?   [36mi[46m█[49m[39m

      [36m>[39m  [36mf[1mi[22mrst[39m                                                                       [46m [49m
         th[1mi[22mrd                                                                       [46m [49m
         f[1mi[22mfth                                                                       [46m [49m
         s[1mi[22mxth                                                                       [46m [49m
         e[1mi[22mghth                                                                      [46m [49m
         n[1mi[22mnth                                                                       [46m [49m
         th[1mi[22mrteenth                                                                  [46m [49m
         f[1mi[22mfteenth                                                                   [46m [49m
         s[1mi[22mxteenth                                                                   [46m [49m
         e[1mi[22mghteenth                                                                  [46m [49m
         n[1mi[22mneteenth                                                                  [46m [49m
         twent[1mi[22meth                                                                   [46m [49m
         twenty-f[1mi[22mrst                                                                [46m [49m
         twenty-th[1mi[22mrd                                                                [46m [49m
         twenty-f[1mi[22mfth                                                                [46m [49m
         twenty-s[1mi[22mxth                                                                [46m [49m
         twenty-e[1mi[22mghth                                                               [46m [49m
         twenty-n[1mi[22mnth                                                                [46m [49m
         th[1mi[22mrtieth                                                                   [100m [49m
         th[1mi[22mrty-first                                                                [100m [49m
         th[1mi[22mrty-second                                                               [100m [49m
         th[1mi[22mrty-third                                                                [100m [49m
         th[1mi[22mrty-fourth                                                               [100m [49m
         th[1mi[22mrty-fifth                                                                [100m [49m
         th[1mi[22mrty-sixth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, DELETE)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

      [36m>[39m  [36mfirst[39m                                                                       [46m [49m
         second                                                                      [46m [49m
         third                                                                       [46m [49m
         fourth                                                                      [46m [49m
         fifth                                                                       [46m [49m
         sixth                                                                       [46m [49m
         seventh                                                                     [46m [49m
         eighth                                                                      [46m [49m
         ninth                                                                       [46m [49m
         tenth                                                                       [46m [49m
         eleventh                                                                    [46m [49m
         twelfth                                                                     [46m [49m
         thirteenth                                                                  [46m [49m
         fourteenth                                                                  [100m [49m
         fifteenth                                                                   [100m [49m
         sixteenth                                                                   [100m [49m
         seventeenth                                                                 [100m [49m
         eighteenth                                                                  [100m [49m
         nineteenth                                                                  [100m [49m
         twentieth                                                                   [100m [49m
         twenty-first                                                                [100m [49m
         twenty-second                                                               [100m [49m
         twenty-third                                                                [100m [49m
         twenty-fourth                                                               [100m [49m
         twenty-fifth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
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

      [36m>[39m  [36mfirst[39m                                                                       [46m [49m
         second                                                                      [46m [49m
         third                                                                       [46m [49m
         fourth                                                                      [46m [49m
         fifth                                                                       [46m [49m
         sixth                                                                       [46m [49m
         seventh                                                                     [46m [49m
         eighth                                                                      [46m [49m
         ninth                                                                       [46m [49m
         tenth                                                                       [46m [49m
         eleventh                                                                    [46m [49m
         twelfth                                                                     [46m [49m
         thirteenth                                                                  [46m [49m
         fourteenth                                                                  [100m [49m
         fifteenth                                                                   [100m [49m
         sixteenth                                                                   [100m [49m
         seventeenth                                                                 [100m [49m
         eighteenth                                                                  [100m [49m
         nineteenth                                                                  [100m [49m
         twentieth                                                                   [100m [49m
         twenty-first                                                                [100m [49m
         twenty-second                                                               [100m [49m
         twenty-third                                                                [100m [49m
         twenty-fourth                                                               [100m [49m
         twenty-fifth                                                                [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
         [1m1-50 of many[22m  Find what you're looking for by typing its name.
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
      "?  Associate your project with the org Castile Ventures?   [36m[7mT[27m[2mype to search...[22m[39m

         [1mAutomations[22m                                                                 \u001b[46m \u001b[49m
         [36m>[39m  [36mfirst[39m                                                                    \u001b[100m \u001b[49m
            second                                                                   \u001b[100m \u001b[49m
                                                                                     \u001b[100m \u001b[49m
         [1mMerchant Admin[22m                                                              \u001b[100m \u001b[49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
         [1m1-10 of many[22m  Find what you're looking for by typing its name.
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

    // wait for the onAbort promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getLastFrameAfterUnmount(renderInstance)).toEqual('')
    await expect(promise).resolves.toEqual(undefined)
  })
})
