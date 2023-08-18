import {Dev} from './Dev.js'
import {getLastFrameAfterUnmount, render, Stdin, waitForInputsToBeReady} from '@shopify/cli-kit/node/testing/ui'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')

const testApp = {
  canEnablePreviewMode: true,
  developmentStorePreviewEnabled: true,
  apiKey: '123',
  token: '123',
}

describe('Dev', () => {
  test('renders a stream of concurrent outputs from sub-processes, shortcuts and a preview url', async () => {
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
      <Dev
        processes={[backendProcess, frontendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
    )

    await frontendPromise

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "00:00:00 │ backend  │ first backend message
      00:00:00 │ backend  │ second backend message
      00:00:00 │ backend  │ third backend message
      00:00:00 │ frontend │ first frontend message
      00:00:00 │ frontend │ second frontend message
      00:00:00 │ frontend │ third frontend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
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
      <Dev
        processes={[backendProcess, frontendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
      {stdin: new Stdin({isTTY: false})},
    )

    await frontendPromise

    // Then
    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "00:00:00 │ backend  │ first backend message
      00:00:00 │ backend  │ second backend message
      00:00:00 │ backend  │ third backend message
      00:00:00 │ frontend │ first frontend message
      00:00:00 │ frontend │ second frontend message
      00:00:00 │ frontend │ third frontend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      Preview URL: https://shopify.com
      "
    `)
  })

  test('opens the previewUrl when p is pressed', async () => {
    const neverEndingPromise = new Promise<void>(function (_resolve, _reject) {})

    const neverEndingProcess = {
      prefix: 'never-ending-process',
      action: async () => {
        await neverEndingPromise
      },
    }

    const renderInstance = render(
      <Dev
        processes={[neverEndingProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
    )

    await waitForInputsToBeReady()
    renderInstance.stdin.write('p')
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://shopify.com')
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
      <Dev
        processes={[backendProcess]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message
      "
    `)

    await expect(promise).resolves.toBeUndefined()
  })

  test('accepts inputs when the processes resolve', async () => {
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
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)

    await waitForInputsToBeReady()
    renderInstance.stdin.write('p')
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://shopify.com')
  })

  test.only('when a process throwns an error it calls abort on the abortController', async () => {
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

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
      <Dev
        processes={[backendProcess]}
        abortController={abortController}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
    )

    await renderInstance.waitUntilExit()

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message
      "
    `)
    expect(abort).toHaveBeenCalledOnce()
  })
})
