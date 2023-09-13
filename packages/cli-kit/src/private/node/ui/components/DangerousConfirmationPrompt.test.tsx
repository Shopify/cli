import {DangerousConfirmationPrompt} from './DangerousConfirmationPrompt.js'
import {getLastFrameAfterUnmount, sendInputAndWaitForChange, waitForInputsToBeReady, render} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'

const ENTER = '\r'
const ESC = '\x1b'

describe('DangerousConfirmationPrompt', () => {
  test('default state', () => {
    const {lastFrame} = render(
      <DangerousConfirmationPrompt onSubmit={() => {}} message="Test question" confirmation="yes" />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question:

         Type yes to confirm, or press Escape to cancel.
      >  █
         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
      "
    `)
  })

  test('default validation error', async () => {
    const renderInstance = render(
      <DangerousConfirmationPrompt onSubmit={() => {}} message="Test question" confirmation="yes" />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)
    // testing with styles because the color changes to red
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:

         Type [36myes[39m to confirm, or press Escape to cancel.
      [31m>[39m  [31m[41m█[49m[39m
         [31m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
         [31mValue must be exactly [36myes[39m
      "
    `)
    await sendInputAndWaitForChange(renderInstance, 'A')
    // color changes back to valid color
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:

         Type [36myes[39m to confirm, or press Escape to cancel.
      [36m>[39m  [36mA[46m█[49m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })

  test('submitting the value', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(
      <DangerousConfirmationPrompt onSubmit={onSubmit} message="Test question" confirmation="yes" />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'yes')
    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith(true)
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Test question:
      ✔  Confirmed
      "
    `)
  })

  test('text wrapping', async () => {
    // component width is 80 characters wide in tests but because of the question mark and
    // spaces before the question, we only have 77 characters to work with
    const renderInstance = render(
      <DangerousConfirmationPrompt onSubmit={() => {}} message="Test question" confirmation="yes" />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'A'.repeat(77))
    await sendInputAndWaitForChange(renderInstance, 'B'.repeat(6))
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question:

         Type [36myes[39m to confirm, or press Escape to cancel.
      [36m>[39m  [36mAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[39m
         [36mBBBBBB[46m█[49m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })

  test("doesn't append a colon to the message if it ends with a question mark", async () => {
    const {lastFrame} = render(
      <DangerousConfirmationPrompt onSubmit={() => {}} message="Test question?" confirmation="yes" />,
    )

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question?

         Type yes to confirm, or press Escape to cancel.
      >  █
         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
      "
    `)
  })

  test('can use Escape key to exit the prompt gracefully', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(
      <DangerousConfirmationPrompt onSubmit={onSubmit} message="Test question" confirmation="yes" />,
    )
    await waitForInputsToBeReady()
    const promise = renderInstance.waitUntilExit()
    await sendInputAndWaitForChange(renderInstance, ESC)

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Test question:
      ✘  Cancelled
      "
    `)
    await expect(promise).resolves.toEqual(undefined)
    expect(onSubmit).toHaveBeenCalledWith(false)
  })
})
