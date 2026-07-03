import {ThemeDevUI} from './ThemeDevUI.js'
import {DevSessionOutput} from '../DevSessionOutput.js'
import {render, sendInputAndWait, waitForInputsToBeReady, waitForContent} from '@shopify/cli-kit/node/testing/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {unstyled} from '@shopify/cli-kit/node/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import React from 'react'

const mocks = vi.hoisted(() => ({
  useStdin: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/ink', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ink')
  return {
    ...actual,
    useStdin: mocks.useStdin,
  }
})

const UP = '[A'
const DOWN = '[B'

const urls = {
  local: 'http://127.0.0.1:9292',
  giftCard: 'http://127.0.0.1:9292/gift_cards/[store_id]/preview',
  themeEditor: 'https://my-store.myshopify.com/admin/themes/123/editor?hr=9292',
  preview: 'https://my-store.myshopify.com/?preview_theme_id=123',
}

function renderThemeDevUI(overrides?: {abortController?: AbortController; onOpenURL?: () => void}) {
  const abortController = overrides?.abortController ?? new AbortController()
  const devSessionOutput = new DevSessionOutput()
  const onOpenURL = overrides?.onOpenURL ?? vi.fn()
  const renderInstance = render(
    <ThemeDevUI
      themeName="My Theme"
      urls={urls}
      abortController={abortController}
      devSessionOutput={devSessionOutput}
      onOpenURL={onOpenURL}
    />,
  )
  return {renderInstance, abortController, devSessionOutput, onOpenURL}
}

describe('ThemeDevUI', () => {
  beforeEach(() => {
    mocks.useStdin.mockReturnValue({isRawModeSupported: true})
  })

  test('stays mounted and renders the ready panel + shortcut footer', async () => {
    const {renderInstance} = renderThemeDevUI()

    await waitForInputsToBeReady()

    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('My Theme · dev server')
    expect(output).toContain('running')
    expect(output).toContain('Local')
    expect(output).toContain('Editor')
    expect(output).toContain('Preview')
    expect(output).toContain('Gift cards')
    expect(output).toContain('(t) localhost')
    expect(output).toContain('Ctrl-C to stop')

    // Unlike the one-shot Panel, the tree does not unmount after the first frame.
    let exited = false
    const exitPromise = renderInstance.waitUntilExit().then(
      () => {
        exited = true
      },
      () => {
        exited = true
      },
    )
    await waitForInputsToBeReady()
    expect(exited).toBe(false)

    renderInstance.unmount()
    await exitPromise
  })

  test('renders log lines emitted through the DevSessionOutput sink', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    devSessionOutput.log('10:43:12  GET    200 /products/some-product')

    await waitForContent(renderInstance, '/products/some-product')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('10:43:12  GET    200 /products/some-product')

    renderInstance.unmount()
  })

  test('reflects status updates emitted through the sink', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    devSessionOutput.status({message: 'syncing', type: 'loading'})

    await waitForContent(renderInstance, 'syncing')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('syncing')

    renderInstance.unmount()
  })

  test('renders alert events emitted through the sink as a warning line', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    devSessionOutput.alert({headline: 'Failed to render storefront', body: 'boom'})

    await waitForContent(renderInstance, 'Failed to render storefront')
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('⚠')
    expect(output).toContain('Failed to render storefront')
    expect(output).toContain('— boom')

    renderInstance.unmount()
  })

  test('renders error events emitted through the sink', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    devSessionOutput.error('something exploded')

    await waitForContent(renderInstance, 'something exploded')
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('⚠')
    expect(output).toContain('something exploded')

    renderInstance.unmount()
  })

  test('reduces a multi-line error/stack to its first line only', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    const error = new Error('top of the stack')
    error.stack = 'top of the stack\n    at somewhere (file.ts:1:1)\n    at elsewhere (file.ts:2:2)'
    devSessionOutput.error(error)

    await waitForContent(renderInstance, 'top of the stack')
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('top of the stack')
    expect(output).not.toContain('at somewhere')

    renderInstance.unmount()
  })

  test('renders the log panel as its own bounded box with a bold logs title', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    devSessionOutput.log('a log line')

    await waitForContent(renderInstance, 'a log line')
    const output = unstyled(renderInstance.lastFrame()!)
    // The bounded log panel has its own title row.
    expect(output).toContain('logs')
    // There are two rounded-border boxes: the info box and the log panel.
    expect(output.match(/╭/g)?.length ?? 0).toBe(2)

    renderInstance.unmount()
  })

  test('shows a Waiting for activity placeholder before any log arrives', async () => {
    const {renderInstance} = renderThemeDevUI()

    await waitForInputsToBeReady()

    expect(unstyled(renderInstance.lastFrame()!)).toContain('Waiting for activity')

    renderInstance.unmount()
  })

  test('renders the info box above the log panel', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    devSessionOutput.log('a log line')

    await waitForContent(renderInstance, 'a log line')
    const output = unstyled(renderInstance.lastFrame()!)
    // Info box (top) then the bounded log panel (below).
    expect(output.indexOf('My Theme · dev server')).toBeLessThan(output.indexOf('a log line'))

    renderInstance.unmount()
  })

  test('invokes onOpenURL when a shortcut key is pressed', async () => {
    const onOpenURL = vi.fn()
    const {renderInstance} = renderThemeDevUI({onOpenURL})

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 10, 't')

    expect(onOpenURL).toHaveBeenCalledWith('t')

    renderInstance.unmount()
  })

  test('holds the same absolute lines (sticky scroll) when new logs arrive while scrolled up', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    // Push enough lines to enable scrolling past the visible window (cap 40).
    for (let index = 0; index < 60; index++) {
      devSessionOutput.log(`line-${index}`)
    }
    await waitForContent(renderInstance, 'line-59')

    // Scroll up into history.
    for (let press = 0; press < 5; press++) {
      // eslint-disable-next-line no-await-in-loop
      await sendInputAndWait(renderInstance, 10, UP)
    }

    const scrolled = unstyled(renderInstance.lastFrame()!)
    expect(scrolled).toContain('older')
    // Capture the set of visible line tokens while held.
    const visibleBefore = scrolled.match(/line-\d+/g) ?? []
    expect(visibleBefore.length).toBeGreaterThan(0)
    const topLine = visibleBefore[0]!

    // A burst of new logs arrives while held. Sticky scroll must keep the SAME
    // absolute lines on screen (the window must not slide forward by 15).
    for (let index = 60; index < 75; index++) {
      devSessionOutput.log(`line-${index}`)
    }
    await waitForContent(renderInstance, 'older')

    const afterPush = unstyled(renderInstance.lastFrame()!)
    // (a) the same absolute earlier lines are still present; top visible unchanged.
    expect(afterPush).toContain(topLine)
    visibleBefore.forEach((line) => {
      expect(afterPush).toContain(line)
    })
    // (b) the newest streamed line is NOT shown (we are held above the tail).
    expect(afterPush).not.toContain('line-74')
    // (c) indicator still shows the held offset.
    expect(afterPush).toContain('older')

    renderInstance.unmount()
  })

  test('jumps back to the live tail with 0', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    for (let index = 0; index < 60; index++) {
      devSessionOutput.log(`line-${index}`)
    }
    await waitForContent(renderInstance, 'line-59')

    // Scroll up, then jump back to live with `0`.
    await sendInputAndWait(renderInstance, 10, UP)
    await sendInputAndWait(renderInstance, 10, UP)
    expect(unstyled(renderInstance.lastFrame()!)).toContain('older')

    await sendInputAndWait(renderInstance, 10, '0')

    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('live')
    expect(output).toContain('line-59')

    renderInstance.unmount()
  })

  test('clamps the scroll offset at the live tail (down arrow floors at 0)', async () => {
    const {renderInstance, devSessionOutput} = renderThemeDevUI()

    await waitForInputsToBeReady()
    for (let index = 0; index < 60; index++) {
      devSessionOutput.log(`line-${index}`)
    }
    await waitForContent(renderInstance, 'line-59')

    // Already at the live tail; pressing down must not scroll past it.
    await sendInputAndWait(renderInstance, 10, DOWN)
    await sendInputAndWait(renderInstance, 10, DOWN)

    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('live')
    expect(output).toContain('line-59')

    renderInstance.unmount()
  })

  test('scroll keys and 0 do not trigger the shortcut URL opener', async () => {
    const onOpenURL = vi.fn()
    const {renderInstance, devSessionOutput} = renderThemeDevUI({onOpenURL})

    await waitForInputsToBeReady()
    for (let index = 0; index < 60; index++) {
      devSessionOutput.log(`line-${index}`)
    }
    await waitForContent(renderInstance, 'line-59')

    await sendInputAndWait(renderInstance, 10, UP)
    await sendInputAndWait(renderInstance, 10, DOWN)
    await sendInputAndWait(renderInstance, 10, '0')

    expect(onOpenURL).not.toHaveBeenCalled()

    renderInstance.unmount()
  })

  test('aborting the controller triggers a single clean exit', async () => {
    const abortController = new AbortController()
    const {renderInstance} = renderThemeDevUI({abortController})

    await waitForInputsToBeReady()
    abortController.abort()

    await expect(renderInstance.waitUntilExit()).resolves.toBeUndefined()

    renderInstance.unmount()
  })
})
