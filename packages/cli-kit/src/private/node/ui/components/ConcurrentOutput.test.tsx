import {ConcurrentOutput} from './ConcurrentOutput.js'
import {getLastFrameAfterUnmount, waitForInputsToBeReady} from '../../testing/ui.js'
import {AbortController, AbortSignal} from '../../../../public/node/abort.js'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'
import {render} from 'ink-testing-library'
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
      },
    }
    // When

    const renderInstance = render(
      <ConcurrentOutput
        processes={[backendProcess, frontendProcess]}
        abortController={new AbortController()}
        footer={{
          title: 'Press `p` to open your browser. Press `q` to quit.',
          subTitle: `Preview URL: https://shopify.com`,
        }}
      />,
    )

    // wait for all output to be rendered
    await frontendPromise

    // Then
    expect(getLastFrameAfterUnmount(renderInstance)!.replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "[00m0000-00-00 00:00:00[00m [0m[00m|[00m[00m [00mbackend[00m  [0m[00m|[00m[00m [00mfirst backend message[00m
      [00m0000-00-00 00:00:00[00m [0m[00m|[00m[00m [00mbackend[00m  [0m[00m|[00m[00m [00msecond backend message[00m
      [00m0000-00-00 00:00:00[00m [0m[00m|[00m[00m [00mbackend[00m  [0m[00m|[00m[00m [00mthird backend message[00m
      [00m0000-00-00 00:00:00[00m [0m[00m|[00m[00m [00mfrontend[00m [0m[00m|[00m[00m [00mfirst frontend message[00m
      [00m0000-00-00 00:00:00[00m [0m[00m|[00m[00m [00mfrontend[00m [0m[00m|[00m[00m [00msecond frontend message[00m
      [00m0000-00-00 00:00:00[00m [0m[00m|[00m[00m [00mfrontend[00m [0m[00m|[00m[00m [00mthird frontend message[00m

      [0m                                                                                                    [00m
      [0m  Press \`p\` to open your browser. Press \`q\` to quit.                                                [00m
      [0m                                                                                                    [00m

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
        abortController={new AbortController()}
        onInput={(input, key) => onInput(input, key)}
      />,
    )

    await waitForInputsToBeReady()
    expect(onInput).toHaveBeenCalledTimes(0)

    renderInstance.stdin.write('a')
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(onInput.mock.calls[0]![0]).toBe('a')
  })
})
