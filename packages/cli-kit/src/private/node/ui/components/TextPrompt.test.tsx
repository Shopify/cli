import {TextPrompt} from './TextPrompt.js'
import {getLastFrameAfterUnmount, sendInputAndWaitForChange, waitForInputsToBeReady} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import {render} from 'ink-testing-library'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'

const ENTER = '\r'

describe('TextPrompt', () => {
  test('default state', () => {
    const {lastFrame} = render(<TextPrompt onSubmit={() => {}} message="Test question" defaultValue="Placeholder" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question:
      >  Placeholder
         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
      "
    `)
  })

  test('default validation error', async () => {
    const renderInstance = render(<TextPrompt onSubmit={() => {}} message="Test question" />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)
    // testing with styles because the color changes to red
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:
      [31m>[39m  [31m[7m [27m[39m
         [31m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
         [31mType an answer to the prompt.[39m
      "
    `)
    await sendInputAndWaitForChange(renderInstance, 'A')
    // color changes back to valid color
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:
      [36m>[39m  [36mA[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })

  test('custom validation error', async () => {
    const renderInstance = render(
      <TextPrompt
        onSubmit={() => {}}
        message="Test question"
        validate={(value) => (value.includes('shopify') ? "App Name can't include the word shopify" : undefined)}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'this-test-includes-shopify')
    await sendInputAndWaitForChange(renderInstance, ENTER)
    // testing with styles because the color changes to red
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:
      [31m>[39m  [31mthis-test-includes-shopify[7m [27m[39m
         [31m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
         [31mApp Name can't include the word shopify[39m
      "
    `)
  })

  test('submitting the value', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(<TextPrompt onSubmit={onSubmit} message="Test question" />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'A')
    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith('A')
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Test question:
      ✔  A
      "
    `)
  })

  test('submitting the default value', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(<TextPrompt onSubmit={onSubmit} message="Test question" defaultValue="A" />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith('A')
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Test question:
      ✔  A
      "
    `)
  })

  test('text wrapping', async () => {
    // component width is 80 characters wide in tests but because of the question mark and
    // spaces before the question, we only have 77 characters to work with
    const renderInstance = render(<TextPrompt onSubmit={() => {}} message="Test question" />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'A'.repeat(77))
    await sendInputAndWaitForChange(renderInstance, 'B'.repeat(6))
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:
      [36m>[39m  [36mAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[39m
         [36mBBBBBB[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })

  test("masking the input if it's a password", async () => {
    const renderInstance = render(<TextPrompt onSubmit={() => {}} message="Test question" password />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'ABC')
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:
      [36m>[39m  [36m***[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)

    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Test question:
      ✔  ***
      "
    `)
  })

  test("doesn't append a colon to the message if it ends with a question mark", async () => {
    const {lastFrame} = render(<TextPrompt onSubmit={() => {}} message="Test question?" />)

    expect(lastFrame()!).toMatchInlineSnapshot(`
      "?  Test question?
      [36m>[39m  [36m[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })

  test("doesn't allow to pass defaultValue and password at the same time", async () => {
    const renderInstance = render(<TextPrompt onSubmit={() => {}} message="Test question" password defaultValue="A" />)

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toContain("ERROR  Can't use defaultValue with password")
  })
})
