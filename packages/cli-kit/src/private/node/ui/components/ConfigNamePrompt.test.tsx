import {ConfigNamePrompt} from './ConfigNamePrompt.js'
import {getLastFrameAfterUnmount, sendInputAndWaitForChange, waitForInputsToBeReady, render} from '../../testing/ui.js'
import {unstyled} from '../../../../public/node/output.js'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'

const ENTER = '\r'

describe('ConfigNamePrompt', () => {
  test('default state', () => {
    const {lastFrame} = render(<ConfigNamePrompt onSubmit={() => {}} defaultValue="Placeholder" />)

    expect(unstyled(lastFrame()!)).toMatchInlineSnapshot(`
      "?  Configuration file name:
      >  Placeholder
         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔

shopify.app.placeholder.toml will be generated in your root directory
"
    `)
  })

  test('default validation error', async () => {
    const renderInstance = render(<ConfigNamePrompt onSubmit={() => {}} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)
    // testing with styles because the color changes to red
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Configuration file name:
      [31m>[39m  [31m[7m [27m[39m
         [31m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
         [31mType an answer to the prompt.[39m

      shopify.app..toml will be generated in your root directory
      "
    `)
    await sendInputAndWaitForChange(renderInstance, 'A')
    // color changes back to valid color
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Configuration file name:
      [36m>[39m  [36mA[7m [27m[39m
         [36m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m

      shopify.app.[36ma[39m.toml will be generated in your root directory
      "
    `)
  })

  test('custom validation error', async () => {
    const renderInstance = render(
      <ConfigNamePrompt
        onSubmit={() => {}}
        validate={(value) => (value.includes('shopify') ? "App name can't include the word shopify" : undefined)}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'this-test-includes-shopify')
    await sendInputAndWaitForChange(renderInstance, ENTER)
    // testing with styles because the color changes to red
    expect(renderInstance.lastFrame()).toMatchInlineSnapshot(`
      "?  Configuration file name:
      [31m>[39m  [31mthis-test-includes-shopify[7m [27m[39m
         [31m▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔[39m
         [31mApp name can't include the word shopify[39m

      shopify.app.[31mthis-test-includes-shopify[39m.toml will be generated in your root directory
      "
    `)
  })

  test('submitting the value', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(<ConfigNamePrompt onSubmit={onSubmit} />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, 'A')
    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith('a')
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Configuration file name:
      ✔  A

      shopify.app.a.toml created in your root directory
      "
    `)
  })

  test('submitting the default value', async () => {
    const onSubmit = vi.fn()
    const renderInstance = render(<ConfigNamePrompt onSubmit={onSubmit} defaultValue="A" />)

    await waitForInputsToBeReady()
    await sendInputAndWaitForChange(renderInstance, ENTER)
    expect(onSubmit).toHaveBeenCalledWith('a')
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!)).toMatchInlineSnapshot(`
      "?  Configuration file name:
      ✔  A

      shopify.app.a.toml created in your root directory
      "
    `)
  })
})
