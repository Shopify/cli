import {MultiSelectPrompt} from './MultiSelectPrompt.js'
import {getLastFrameAfterUnmount, sendInputAndWaitForChange, waitForInputsToBeReady, render} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {Stdout} from '../../ui.js'
import {AbortController} from '../../../../public/node/abort.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import React from 'react'
import {useStdout} from 'ink'

vi.mock('ink', async () => {
  const original: any = await vi.importActual('ink')
  return {
    ...original,
    useStdout: vi.fn(),
  }
})

const ARROW_DOWN = '[B'
const ARROW_UP = '[A'
const ENTER = '\r'
const SPACE = ' '

beforeEach(() => {
  vi.mocked(useStdout).mockReturnValue({
    stdout: new Stdout({
      columns: 80,
      rows: 80,
    }) as any,
    write: () => {},
  })
})

describe('MultiSelectPrompt', async () => {
  test('toggles and submits the selected answers', async () => {
    const onEnter = vi.fn()

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const renderInstance = render(
      <MultiSelectPrompt message="Select the extensions you want to add" choices={items} onSubmit={onEnter} />,
    )

    await waitForInputsToBeReady()
    // toggle "first"
    await sendInputAndWaitForChange(renderInstance, SPACE)
    // move down twice and toggle "third"
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    // resolves in declared order, not toggle order
    expect(onEnter).toHaveBeenCalledWith(['first', 'third'])

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Select the extensions you want to add:
      [36m✔[39m  [36mfirst, third[39m
      "
    `)
  })

  test('renders the checkboxes and instructions', async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const renderInstance = render(
      <MultiSelectPrompt message="Select the extensions you want to add" choices={items} onSubmit={() => {}} />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Select the extensions you want to add:

      >  ☐ first
         ☐ second
         ☐ third

         Press ↑↓ arrows to select, space to toggle, enter to confirm.
      "
    `)
  })

  test('resolves to an empty array when nothing is selected', async () => {
    const onEnter = vi.fn()

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const renderInstance = render(
      <MultiSelectPrompt message="Select the extensions you want to add" choices={items} onSubmit={onEnter} />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(onEnter).toHaveBeenCalledWith([])

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Select the extensions you want to add:
      [36m✔[39m  [36mNothing selected[39m
      "
    `)
  })

  test('pre-selects the default values', async () => {
    const onEnter = vi.fn()

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
      {label: 'third', value: 'third'},
    ]

    const renderInstance = render(
      <MultiSelectPrompt
        message="Select the extensions you want to add"
        choices={items}
        onSubmit={onEnter}
        defaultValue={['second']}
      />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Select the extensions you want to add:

      >  ☐ first
         ☒ second
         ☐ third

         Press ↑↓ arrows to select, space to toggle, enter to confirm.
      "
    `)

    await waitForInputsToBeReady()
    // toggle "first" on, so both "first" and "second" are selected
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(onEnter).toHaveBeenCalledWith(['first', 'second'])
  })

  test('can toggle a default value back off', async () => {
    const onEnter = vi.fn()

    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
    ]

    const renderInstance = render(
      <MultiSelectPrompt
        message="Select the extensions you want to add"
        choices={items}
        onSubmit={onEnter}
        defaultValue={['first']}
      />,
    )

    await waitForInputsToBeReady()
    // "first" is focused and pre-selected; space toggles it off
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    expect(onEnter).toHaveBeenCalledWith([])
  })

  test('resolves in declared order even when choices are grouped and reordered for display', async () => {
    const onEnter = vi.fn()

    // Declared order is alpha, beta, gamma, delta. groupOrder puts group "A"
    // (beta, delta) before group "B" (alpha, gamma), so the on-screen order is
    // beta, delta, alpha, gamma — deliberately different from declared order.
    const items = [
      {label: 'alpha', value: 'alpha', group: 'B'},
      {label: 'beta', value: 'beta', group: 'A'},
      {label: 'gamma', value: 'gamma', group: 'B'},
      {label: 'delta', value: 'delta', group: 'A'},
    ]

    const renderInstance = render(
      <MultiSelectPrompt
        message="Select the extensions you want to add"
        choices={items}
        onSubmit={onEnter}
        groupOrder={['A', 'B']}
      />,
    )

    await waitForInputsToBeReady()
    // Focus starts on the first displayed item ("beta"); toggle it on.
    await sendInputAndWaitForChange(renderInstance, SPACE)
    // Move down to "alpha" (third displayed item) and toggle it on.
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)
    await sendInputAndWaitForChange(renderInstance, SPACE)
    await sendInputAndWaitForChange(renderInstance, ENTER)

    // Declared order is alpha (index 0) then beta (index 1), NOT the display
    // order beta, alpha.
    expect(onEnter).toHaveBeenCalledWith(['alpha', 'beta'])
  })

  test('supports an info table', async () => {
    const items = [
      {label: 'first', value: 'first'},
      {label: 'second', value: 'second'},
    ]

    const infoTable = [
      {
        header: 'Add',
        items: ['new-ext'],
        bullet: '+',
      },
    ]

    const renderInstance = render(
      <MultiSelectPrompt
        message="Select the extensions you want to add"
        choices={items}
        infoTable={infoTable}
        onSubmit={() => {}}
      />,
    )

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Select the extensions you want to add:

         ┃  Add
         ┃  + new-ext

      >  ☐ first
         ☐ second

         Press ↑↓ arrows to select, space to toggle, enter to confirm.
      "
    `)
  })

  test("it doesn't submit if there are no choices", async () => {
    const onEnter = vi.fn()

    const items: any[] = []

    const renderInstance = render(
      <MultiSelectPrompt message="Select the extensions you want to add" choices={items} onSubmit={onEnter} />,
    )

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toContain(
      'ERROR  MultiSelectPrompt requires at least one choice',
    )
  })

  test('abortController can be used to exit the prompt from outside', async () => {
    const items = [
      {label: 'a', value: 'a'},
      {label: 'b', value: 'b'},
    ]

    const abortController = new AbortController()

    const renderInstance = render(
      <MultiSelectPrompt
        choices={items}
        onSubmit={() => {}}
        message="Select the extensions you want to add"
        abortSignal={abortController.signal}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Select the extensions you want to add:

      >  ☐ a
         ☐ b

         Press ↑↓ arrows to select, space to toggle, enter to confirm.
      "
    `)

    abortController.abort()

    // wait for the onAbort promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))

    await expect(promise).resolves.toEqual(undefined)
  })
})
