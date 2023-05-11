import {ConcurrentOutput} from './ConcurrentOutput.js'
import {getLastFrameAfterUnmount, waitForInputsToBeReady, render, Stdin} from '../../testing/ui.js'
import {AbortController, AbortSignal} from '../../../../public/node/abort.js'
import {unstyled} from '../../../../public/node/output.js'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'
import {Writable} from 'stream'

describe('ConcurrentOutput', () => {
  test('renders a stream of concurrent outputs from sub-processes', async () => {
    // Given
    let backendPromiseResolve: () => void
    let frontendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const frontendPromise = new Promise<void>(function (resolve, _reject) {
      frontendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')

        frontendPromiseResolve()

        // await promise that never resolves
        await new Promise(() => {})
      },
    }
    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess, frontendProcess]}
        abortSignal={new AbortController().signal}
        footer={{
          shortcuts: [
            {
              key: 'p',
              action: 'preview in your browser',
            },
            {
              key: 'q',
              action: 'quit',
            },
          ],
          subTitle: `Preview URL: https://shopify.com`,
        }}
      />,
    )

    await frontendPromise

    // Then
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 │ backend  │ first backend message
      0000-00-00 00:00:00 │ backend  │ second backend message
      0000-00-00 00:00:00 │ backend  │ third backend message
      0000-00-00 00:00:00 │ frontend │ first frontend message
      0000-00-00 00:00:00 │ frontend │ second frontend message
      0000-00-00 00:00:00 │ frontend │ third frontend message

      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)
  })

  test("doesn't render shortcuts if the stdin is not a TTY", async () => {
    // Given
    let backendPromiseResolve: () => void
    let frontendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const frontendPromise = new Promise<void>(function (resolve, _reject) {
      frontendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')

        frontendPromiseResolve()

        // await promise that never resolves
        await new Promise(() => {})
      },
    }
    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess, frontendProcess]}
        abortSignal={new AbortController().signal}
        footer={{
          shortcuts: [
            {
              key: 'p',
              action: 'preview in your browser',
            },
            {
              key: 'q',
              action: 'quit',
            },
          ],
          subTitle: `Preview URL: https://shopify.com`,
        }}
      />,
      {stdin: new Stdin({isTTY: false})},
    )

    await frontendPromise

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 │ backend  │ first backend message
      0000-00-00 00:00:00 │ backend  │ second backend message
      0000-00-00 00:00:00 │ backend  │ third backend message
      0000-00-00 00:00:00 │ frontend │ first frontend message
      0000-00-00 00:00:00 │ frontend │ second frontend message
      0000-00-00 00:00:00 │ frontend │ third frontend message

      Preview URL: https://shopify.com
      "
    `)
  })

  test('accepts a onInput function that fires when a key is pressed', async () => {
    const neverEndingPromise = new Promise<void>(function (_resolve, _reject) {})

    const neverEndingProcess = {
      prefix: 'never-ending-process',
      action: async () => {
        await neverEndingPromise
      },
    }

    const onInput = vi.fn()

    const renderInstance = render(
      <ConcurrentOutput
        processes={[neverEndingProcess]}
        onInput={(input, key) => onInput(input, key)}
        abortSignal={new AbortController().signal}
      />,
    )

    await waitForInputsToBeReady()
    expect(onInput).toHaveBeenCalledTimes(0)

    renderInstance.stdin.write('a')
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(onInput.mock.calls[0]![0]).toBe('a')
  })

  test('abortController can be used to exit from outside and should preserve static output', async () => {
    // Given
    const abortController = new AbortController()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        // await promise that never resolves
        await new Promise(() => {})
      },
    }

    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess]}
        abortSignal={abortController.signal}
        footer={{
          shortcuts: [
            {
              key: 'p',
              action: 'preview in your browser',
            },
            {
              key: 'q',
              action: 'quit',
            },
          ],
          subTitle: `Preview URL: https://shopify.com`,
        }}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 │ backend │ first backend message
      0000-00-00 00:00:00 │ backend │ second backend message
      0000-00-00 00:00:00 │ backend │ third backend message
      "
    `)

    await expect(promise).resolves.toEqual(undefined)
  })

  test('rejects with the error thrown inside one of the processes', async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        throw new Error('something went wrong')
      },
    }

    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess]}
        abortSignal={new AbortController().signal}
        footer={{
          shortcuts: [
            {
              key: 'p',
              action: 'preview in your browser',
            },
            {
              key: 'q',
              action: 'quit',
            },
          ],
          subTitle: `Preview URL: https://shopify.com`,
        }}
      />,
    )

    await expect(renderInstance.waitUntilExit()).rejects.toThrowError('something went wrong')

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 │ backend │ first backend message
      0000-00-00 00:00:00 │ backend │ second backend message
      0000-00-00 00:00:00 │ backend │ third backend message
      "
    `)
  })

  test("doesn't render the footer when the processes resolve", async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess]}
        abortSignal={new AbortController().signal}
        footer={{
          shortcuts: [
            {
              key: 'p',
              action: 'preview in your browser',
            },
            {
              key: 'q',
              action: 'quit',
            },
          ],
          subTitle: `Preview URL: https://shopify.com`,
        }}
      />,
    )

    await renderInstance.waitUntilExit()

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "0000-00-00 00:00:00 │ backend │ first backend message
      0000-00-00 00:00:00 │ backend │ second backend message
      0000-00-00 00:00:00 │ backend │ third backend message
      "
    `)
  })
})
