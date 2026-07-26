import {AutocompleteMultiSelectPrompt} from './AutocompleteMultiSelectPrompt.js'
import {
  getLastFrameAfterUnmount,
  render,
  sendInputAndWaitForChange,
  sendInputAndWaitForContent,
  waitForInputsToBeReady,
} from '../../testing/ui.js'
import {Stdout} from '../../ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import figures from 'figures'

import React from 'react'
import {useStdout} from 'ink'

vi.mock('ink', async () => {
  const original: any = await vi.importActual('ink')
  return {
    ...original,
    useStdout: vi.fn(),
  }
})

const ARROW_DOWN = '\u001B[B'
const ENTER = '\r'
const SPACE = ' '
const DELETE = '\u007F'

const SCOPES = [
  {label: 'read_products', value: 'read_products'},
  {label: 'write_products', value: 'write_products'},
  {label: 'read_orders', value: 'read_orders'},
  {label: 'write_orders', value: 'write_orders'},
  {label: 'read_customers', value: 'read_customers'},
]

beforeEach(() => {
  vi.mocked(useStdout).mockReturnValue({
    stdout: new Stdout({
      columns: 80,
      rows: 80,
    }) as any,
    write: () => {},
  })
})

describe('AutocompleteMultiSelectPrompt', () => {
  // T1: the acceptance criterion for the whole feature. Filter, check, clear, filter again, check
  // again, submit — and get everything that was ever checked, in declared order.
  test('keeps selections across searches', async () => {
    const onSubmit = vi.fn()

    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        onSubmit={onSubmit}
      />,
    )

    await waitForInputsToBeReady()

    // Narrow to the two *_products scopes and check both. Characters are sent one at a time because
    // TextInput inserts a whole input string in one go, which would skip the intermediate filters.
    await sendInputAndWaitForChange(renderInstance, 'p')
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 'o')
    await sendInputAndWaitForChange(renderInstance, 'd')
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, SPACE)

    // Clear the search, then narrow to the *_orders scopes and check the first one.
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, 'o')
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 'd')
    await sendInputAndWaitForChange(renderInstance, 'e')
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 's')
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(['read_products', 'write_products', 'read_orders'])
  })

  // T2: space belongs to the checkbox list, not to the search box.
  test('toggles on space instead of typing it into the search box', async () => {
    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 'e')
    await sendInputAndWaitForChange(renderInstance, 'a')
    await sendInputAndWaitForChange(renderInstance, 'd')
    await sendInputAndWaitForChange(renderInstance, SPACE)

    const frame = unstyled(renderInstance.lastFrame()!)
    // Had the space landed in the search box the term would be "read " and nothing would match.
    expect(frame).not.toContain('No results found.')
    expect(frame).toContain(`${figures.checkboxOn} read_products`)
    expect(frame).toContain(`${figures.checkboxOff} read_orders`)
  })

  // T3: a hidden item is hidden, not forgotten.
  test('hides non-matching choices but keeps them checked', async () => {
    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, SPACE)
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_products`)

    await sendInputAndWaitForChange(renderInstance, 'o')
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 'd')
    await sendInputAndWaitForChange(renderInstance, 'e')
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 's')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('read_products')

    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_products`)
  })

  // T4: pins the submit-guard fix — a term that matches nothing must not trap the user.
  test('submits while the filter matches nothing', async () => {
    const onSubmit = vi.fn()

    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        onSubmit={onSubmit}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForContent(renderInstance, 'No results found.', 'z')

    // The empty list still tells the user their check survived.
    expect(unstyled(renderInstance.lastFrame()!)).toContain('1 selected')

    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(['read_products'])
  })

  // T5: the count is what makes selections-you-can't-see tolerable.
  test('shows how many items are selected', async () => {
    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    expect(unstyled(renderInstance.lastFrame()!)).toContain('0 selected · Press')

    await sendInputAndWaitForContent(renderInstance, '1 selected · Press', SPACE)
  })

  // T6: a pre-checked default is a selection like any other, including across a filter round-trip.
  test('pre-checks defaultValue and keeps it through filtering', async () => {
    const onSubmit = vi.fn()

    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        defaultValue={['read_orders']}
        onSubmit={onSubmit}
      />,
    )

    await waitForInputsToBeReady()
    expect(unstyled(renderInstance.lastFrame()!)).toContain(`${figures.checkboxOn} read_orders`)

    await sendInputAndWaitForChange(renderInstance, 'p')
    await sendInputAndWaitForChange(renderInstance, 'r')
    await sendInputAndWaitForChange(renderInstance, 'o')
    await sendInputAndWaitForChange(renderInstance, 'd')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('read_orders')

    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, DELETE)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(onSubmit).toHaveBeenCalledWith(['read_orders'])
  })

  // T7: disabled choices are visible but inert, exactly as in the plain multi-select.
  test('skips disabled choices when arrowing and refuses to check them', async () => {
    const onSubmit = vi.fn()

    const choices = [
      {label: 'read_products', value: 'read_products'},
      {label: 'read_shipping', value: 'read_shipping', disabled: true},
      {label: 'read_orders', value: 'read_orders'},
    ]

    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={choices}
        onSubmit={onSubmit}
      />,
    )

    await waitForInputsToBeReady()
    // One arrow press jumps straight over the disabled row.
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, SPACE)

    const frame = unstyled(renderInstance.lastFrame()!)
    expect(frame).toContain(`${figures.checkboxOn} read_orders`)
    expect(frame).toContain(`${figures.checkboxOff} read_shipping`)

    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith(['read_orders'])
  })

  // T8: pins the anti-jitter fix — the grouped layout is a property of the choices, not of whatever
  // the current search term happens to leave on screen.
  test('keeps the grouped layout when the filter removes every grouped choice', async () => {
    const choices = [
      {label: 'read_products', value: 'read_products', group: 'Products'},
      {label: 'write_products', value: 'write_products', group: 'Products'},
      {label: 'alpha_thing', value: 'alpha_thing'},
      {label: 'beta_thing', value: 'beta_thing'},
    ]

    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={choices}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 't')
    await sendInputAndWaitForChange(renderInstance, 'h')
    await sendInputAndWaitForChange(renderInstance, 'i')
    await sendInputAndWaitForChange(renderInstance, 'n')
    await sendInputAndWaitForChange(renderInstance, 'g')

    const frame = unstyled(renderInstance.lastFrame()!)
    expect(frame).not.toContain('read_products')
    // The "Other" heading and its 3-column indent survive: without the fix both vanish the moment
    // the last grouped row is filtered out, and every remaining row jumps left.
    expect(frame).toContain('Other')
    expect(frame).toContain(`   >  ${figures.checkboxOff} alpha_thing`)
  })

  // T9: pins the header/search/list/footer composition of the very first frame.
  test('renders the search box, the checkboxes and the footer', async () => {
    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        onSubmit={() => {}}
      />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Add the scopes to grant to your app:   Type to search...

      >  ☐ read_products
         ☐ write_products
         ☐ read_orders
         ☐ write_orders
         ☐ read_customers

         0 selected · Press ↑↓ arrows to select, space to toggle, enter to confirm.
      "
    `)
  })

  test('summarises the submitted answer instead of listing every label', async () => {
    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={SCOPES}
        defaultValue={['read_products', 'write_products', 'read_orders', 'write_orders']}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toContain(
      'read_products, write_products, read_orders and 1 more',
    )
  })

  test("it doesn't render if there are no choices", async () => {
    const choices: any[] = []

    const renderInstance = render(
      <AutocompleteMultiSelectPrompt
        message="Add the scopes to grant to your app"
        choices={choices}
        onSubmit={() => {}}
      />,
    )

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toContain(
      'ERROR  AutocompleteMultiSelectPrompt requires at least one choice',
    )
  })
})
