import {TextPrompt} from './TextPrompt.js'
import {getLastFrameAfterUnmount, sendInput, waitForInputsToBeReady} from '../../../../testing/ui.js'
import {unstyled} from '../../../../output.js'
import {render} from 'ink-testing-library'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'

const ENTER = '\r'

describe('TextPrompt', () => {
  test('default state', () => {
    const {lastFrame} = render(<TextPrompt onSubmit={() => {}} message="Test question" placeholder="Placeholder" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "?  Test question
      >  Placeholder
         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
      "
    `)
  })

  test('validation error', async () => {
    const renderInstance = render(<TextPrompt onSubmit={() => {}} message="Test question" />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, ENTER)
    // testing with styles because the color changes to red
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question
      [31m>[39m  [31m[7m [27m[39m
         [31m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
         [31mPlease enter a value[39m
      "
    `)
    await sendInput(renderInstance, 'A')
    // color changes back to valid color
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question
      [36m>[39m  [36mA[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })

  test('submitting the value', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(<TextPrompt onSubmit={onSubmit} message="Test question" />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 'A')
    await sendInput(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith('A')
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Test question
      ✔  A
      "
    `)
  })

  test('text wrapping', async () => {
    // component width is 80 characters wide in tests but because of the question mark and
    // spaces before the question, we only have 77 characters to work with
    const renderInstance = render(<TextPrompt onSubmit={() => {}} message="Test question" />)

    await waitForInputsToBeReady()
    await sendInput(renderInstance, 'A'.repeat(77))
    await sendInput(renderInstance, 'B'.repeat(6))
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Test question
      [36m>[39m  [36mAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[39m
         [36mBBBBBB[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
      "
    `)
  })
})
