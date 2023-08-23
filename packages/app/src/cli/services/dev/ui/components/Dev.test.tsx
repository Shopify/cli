import {Dev} from './Dev.js'
import {developerPreviewUpdate, disableDeveloperPreview, enableDeveloperPreview} from '../../../context.js'
import {fetchAppFromApiKey} from '../../fetch.js'
import {
  getLastFrameAfterUnmount,
  render,
  Stdin,
  waitForContent,
  waitForInputsToBeReady,
} from '@shopify/cli-kit/node/testing/ui'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('../../../context.js')
vi.mock('../../fetch.js')

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
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
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

  test('renders a different state if the preview mode is off', async () => {
    // Given
    let backendPromiseResolve: () => void

    const backendPromise = new Promise<void>(function (resolve, _reject) {
      backendPromiseResolve = resolve
    })

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()

        // await promise that never resolves
        await new Promise(() => {})
      },
    }

    // When

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={{
          ...testApp,
          developmentStorePreviewEnabled: false,
        }}
      />,
    )

    await backendPromise

    // Then
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✖ off
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
    expect(unstyled(renderInstance.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
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
    // When
    const renderInstance = render(
      <Dev processes={[]} abortController={new AbortController()} previewUrl="https://shopify.com" app={testApp} />,
    )

    await waitForInputsToBeReady()
    renderInstance.stdin.write('p')
    // Then
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://shopify.com')
  })

  test('quits when q is pressed', async () => {
    // Given
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

    // When
    const renderInstance = render(
      <Dev processes={[]} abortController={abortController} previewUrl="https://shopify.com" app={testApp} />,
    )

    const promise = renderInstance.waitUntilExit()

    await waitForInputsToBeReady()
    renderInstance.stdin.write('q')

    await promise
    // Then
    expect(abort).toHaveBeenCalledOnce()
  })

  test('quits when ctrl+c is pressed', async () => {
    // Given
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

    // When
    const renderInstance = render(
      <Dev processes={[]} abortController={abortController} previewUrl="https://shopify.com" app={testApp} />,
    )

    const promise = renderInstance.waitUntilExit()

    await waitForInputsToBeReady()
    renderInstance.stdin.write('\u0003')

    await promise
    // Then
    expect(abort).toHaveBeenCalledOnce()
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

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Shutting down dev ...
      "
    `)

    await promise

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message
      "
    `)
    expect(vi.mocked(disableDeveloperPreview)).toHaveBeenNthCalledWith(1, {
      apiKey: '123',
      token: '123',
    })
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

    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
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

  test('when a process throws an error it calls abort on the abortController', async () => {
    // Given
    const backendProcess = {
      prefix: 'backend',
      action: async (_stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        throw new Error('something went wrong')
      },
    }

    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

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
    expect(abort).toHaveBeenCalledOnce()
  })

  test("doesn't poll for preview mode when the app does not support it", async () => {
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
        app={{
          ...testApp,
          canEnablePreviewMode: false,
        }}
        pollingTime={200}
      />,
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)

    expect(vi.mocked(fetchAppFromApiKey)).not.toHaveBeenCalled()
    expect(vi.mocked(enableDeveloperPreview)).not.toHaveBeenCalled()

    renderInstance.stdin.write('d')
    expect(vi.mocked(developerPreviewUpdate)).not.toHaveBeenCalled()
  })

  test('shows an error message when polling for preview mode fails', async () => {
    // Given
    vi.mocked(fetchAppFromApiKey).mockRejectedValueOnce(new Error('something went wrong'))

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
        pollingTime={200}
      />,
    )

    await waitForContent(renderInstance, 'Failed to fetch the latest status')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d\d:\d\d:\d\d/g, '00:00:00')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      Failed to fetch the latest status of the development store preview, trying again in 5 seconds.
      "
    `)
  })

  test('enables preview mode when pressing d', async () => {
    // Given
    vi.mocked(developerPreviewUpdate).mockResolvedValueOnce(true)

    const renderInstance = render(
      <Dev processes={[]} abortController={new AbortController()} previewUrl="https://shopify.com" app={testApp} />,
    )

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)

    await waitForInputsToBeReady()
    renderInstance.stdin.write('d')
    expect(vi.mocked(developerPreviewUpdate)).toHaveBeenNthCalledWith(1, {
      apiKey: '123',
      token: '123',
      enabled: false,
    })

    await waitForContent(renderInstance, 'off')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✖ off
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)
  })

  test('shows an error message if enabling preview mode by pressing d fails', async () => {
    // Given
    vi.mocked(developerPreviewUpdate).mockResolvedValueOnce(false)

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')
      },
    }

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
      />,
    )

    await waitForInputsToBeReady()
    renderInstance.stdin.write('d')

    await waitForContent(renderInstance, 'Failed to turn off development store preview.')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      Failed to turn off development store preview.
      "
    `)
  })

  test('polls for preview mode', async () => {
    // Given
    vi.mocked(fetchAppFromApiKey).mockResolvedValueOnce({
      developmentStorePreviewEnabled: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    let backendPromiseResolve: () => void

    const backendPromise = new Promise<void>((resolve) => {
      backendPromiseResolve = resolve
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

    const renderInstance = render(
      <Dev
        processes={[backendProcess]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={testApp}
        pollingTime={200}
      />,
    )

    await backendPromise

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
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

    await waitForContent(renderInstance, 'off')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │ backend │ first backend message
      00:00:00 │ backend │ second backend message
      00:00:00 │ backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✖ off
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)
  })

  test('enables preview mode at startup', async () => {
    // Given
    vi.mocked(enableDeveloperPreview).mockResolvedValueOnce(true)

    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={{
          ...testApp,
          developmentStorePreviewEnabled: false,
        }}
      />,
    )

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✖ off
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)

    await waitForContent(renderInstance, 'on')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)
  })

  test('shows an error message if enabling preview mode at startup fails', async () => {
    // Given
    vi.mocked(enableDeveloperPreview).mockRejectedValueOnce(new Error('something went wrong'))

    const renderInstance = render(
      <Dev
        processes={[]}
        abortController={new AbortController()}
        previewUrl="https://shopify.com"
        app={{
          ...testApp,
          developmentStorePreviewEnabled: false,
        }}
      />,
    )

    await waitForContent(renderInstance, 'Failed to turn on development store preview automatically.')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✖ off
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      Failed to turn on development store preview automatically.
      Try turning it on manually by pressing \`d\`.
      "
    `)
  })

  test('shows an error if handling input throws an error', async () => {
    vi.mocked(developerPreviewUpdate).mockRejectedValueOnce(new Error('something went wrong'))

    const renderInstance = render(
      <Dev processes={[]} abortController={new AbortController()} previewUrl="https://shopify.com" app={testApp} />,
    )

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      "
    `)

    await waitForInputsToBeReady()
    renderInstance.stdin.write('d')

    await waitForContent(renderInstance, 'Failed to handle your input.')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press d │ development store preview: ✔ on
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      Failed to handle your input.
      "
    `)
  })
})
