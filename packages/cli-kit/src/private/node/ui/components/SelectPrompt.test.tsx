import {SelectPrompt} from './SelectPrompt.js'
import {getLastFrameAfterUnmount, sendInputAndWaitForChange, waitForInputsToBeReady, render} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {Stdout} from '../../ui.js'
import {AbortController} from '../../../../public/node/abort.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import React from 'react'
import {useStdout} from 'ink'
import {platformAndArch} from '@shopify/cli-kit/node/os'

vi.mock('ink', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original: any = await vi.importActual('ink')
  return {
    ...original,
    useStdout: vi.fn(),
  }
})

const ARROW_DOWN = '\u001B[B'
const ARROW_UP = '\u001B[A'
const ENTER = '\r'

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
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
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

    const infoTable = [
      {
        header: 'Add',
        items: ['new-ext'],
        bullet: '+',
      },
      {
        header: 'Remove',
        items: ['integrated-demand-ext', ['order-discount', {subdued: '(1)'}]],
        bullet: '-',
      },
    ]

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

         ┃  \u001b[1mAdd\u001b[22m
         ┃  + new-ext
         ┃
         ┃  \u001b[1mRemove\u001b[22m
         ┃  - integrated-demand-ext
         ┃  - order-discount [2m(1)[22m

      [36m>[39m  [36mfirst[39m
         second
         third
         fourth

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)
  })

  const runningOnWindows = platformAndArch().platform === 'windows'

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
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        infoMessage={infoMessage}
        onSubmit={() => {}}
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

      >  a


         Press ↑↓ arrows to select, enter to confirm.
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

         a
      >  b

         Press ↑↓ arrows to select, enter to confirm.
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

      >  a
         b

         Press ↑↓ arrows to select, enter to confirm.
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

  test('allow submitting with a shortcut directly', async () => {
    const onEnter = vi.fn()
    const items = [
      {label: 'a', value: 'a', key: 'a'},
      {label: 'b', value: 'b', key: 'b'},
    ]

    const renderInstance = render(<SelectPrompt choices={items} onSubmit={onEnter} message="Test question?" />)

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question?

      >  (a) a
         (b) b

         Press ↑↓ arrows to select, enter or a shortcut to confirm.
      "
    `)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'b')

    expect(getLastFrameAfterUnmount(renderInstance)).toMatchInlineSnapshot(`
      "?  Test question?
      [36m✔[39m  [36mb[39m
      "
    `)
    expect(onEnter).toHaveBeenCalledWith(items[1]!.value)
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
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         [1mAutomations[22m                                                                 [46m [49m
         [36m>[39m  [36mfirst[39m                                                                    [100m [49m
            second                                                                   [100m [49m
                                                                                     [100m [49m
         [1mMerchant Admin[22m                                                              [100m [49m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)
  })

  test('allows passing false as the default value', async () => {
    const items = [
      {label: 'yes', value: true},
      {label: 'no', value: false},
    ]

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
        defaultValue={false}
      />,
    )

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         yes
      [36m>[39m  [36mno[39m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)
  })

  test('allows selecting a different option after having selected an option with a falsy value', async () => {
    const items = [
      {label: 'yes', value: true},
      {label: 'no', value: false},
    ]

    const renderInstance = render(
      <SelectPrompt
        message="Associate your project with the org Castile Ventures?"
        choices={items}
        onSubmit={() => {}}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ARROW_DOWN)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

         yes
      [36m>[39m  [36mno[39m

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, ARROW_UP)

    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Associate your project with the org Castile Ventures?

      [36m>[39m  [36myes[39m
         no

         [2mPress ↑↓ arrows to select, enter to confirm.[22m
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
      <SelectPrompt
        choices={items}
        onSubmit={() => {}}
        message="Test question?"
        abortSignal={abortController.signal}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    expect(unstyled(renderInstance.lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question?

      >  a
         b

         Press ↑↓ arrows to select, enter to confirm.
      "
    `)

    abortController.abort()

    // wait for the onAbort promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getLastFrameAfterUnmount(renderInstance)).toEqual('')
    await expect(promise).resolves.toEqual(undefined)
  })
})
