import {DevSessionUI} from './DevSessionUI.js'
import {DevSessionStatus, DevSessionStatusManager} from '../../processes/dev-session-status-manager.js'
import {
  getLastFrameAfterUnmount,
  render,
  sendInputAndWait,
  waitForContent,
  waitForInputsToBeReady,
} from '@shopify/cli-kit/node/testing/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/tree-kill')

let devSessionStatusManager: DevSessionStatusManager

const initialStatus: DevSessionStatus = {
  isReady: true,
  previewURL: 'https://shopify.com',
  graphiqlURL: 'https://graphiql.shopify.com',
}

const onAbort = vi.fn()

describe('DevSessionUI', () => {
  beforeEach(() => {
    devSessionStatusManager = new DevSessionStatusManager()
    devSessionStatusManager.reset()
    devSessionStatusManager.updateStatus(initialStatus)
  })

  test('renders a stream of concurrent outputs from sub-processes, shortcuts and URLs', async () => {
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
      action: async (stdout: Writable, _stderr: Writable) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
        stdout.write('third backend message')

        backendPromiseResolve()
      },
    }

    const frontendProcess = {
      prefix: 'frontend',
      action: async (stdout: Writable, _stderr: Writable) => {
        await backendPromise

        stdout.write('first frontend message')
        stdout.write('second frontend message')
        stdout.write('third frontend message')

        frontendPromiseResolve()
      },
    }

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[backendProcess, frontendProcess]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    await frontendPromise

    // Then
    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │                   backend │ first backend message
      00:00:00 │                   backend │ second backend message
      00:00:00 │                   backend │ third backend message
      00:00:00 │                  frontend │ first frontend message
      00:00:00 │                  frontend │ second frontend message
      00:00:00 │                  frontend │ third frontend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: https://graphiql.shopify.com
      "
    `)

    renderInstance.unmount()
  })

  test('opens the previewURL when p is pressed', async () => {
    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 'p')

    // Then
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://shopify.com')

    renderInstance.unmount()
  })

  test('opens the graphiqlURL when g is pressed', async () => {
    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()
    await sendInputAndWait(renderInstance, 100, 'g')

    // Then
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://graphiql.shopify.com')

    renderInstance.unmount()
  })

  test('quits when q is pressed', async () => {
    // Given
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    await waitForInputsToBeReady()
    renderInstance.stdin.write('q')

    await promise

    // Then
    expect(abort).toHaveBeenCalledOnce()

    renderInstance.unmount()
  })

  test('shows shutting down message when aborted', async () => {
    // Given
    const abortController = new AbortController()

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toContain('Shutting down dev ...')

    await promise

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      ""
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows error shutting down message when aborted with error', async () => {
    // Given
    const abortController = new AbortController()

    const backendProcess: any = {
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
      <DevSessionUI
        processes={[backendProcess]}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort('something went wrong')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │                   backend │ first backend message
      00:00:00 │                   backend │ second backend message
      00:00:00 │                   backend │ third backend message

      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press g │ open GraphiQL (Admin API) in your browser
      › Press p │ preview in your browser
      › Press q │ quit

      Shutting down dev because of an error ...
      "
    `)

    await promise

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │                   backend │ first backend message
      00:00:00 │                   backend │ second backend message
      00:00:00 │                   backend │ third backend message
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('updates UI when status changes through devSessionStatusManager', async () => {
    // Given
    devSessionStatusManager.reset()

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // Initial state
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('preview in your browser')

    // When status updates
    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'https://new-preview-url.shopify.com',
      graphiqlURL: 'https://new-graphiql.shopify.com',
    })

    await waitForContent(renderInstance, 'preview in your browser')

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Preview URL: https://new-preview-url.shopify.com')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('GraphiQL URL: https://new-graphiql.shopify.com')
    renderInstance.unmount()
  })

  test('updates UI when devSessionEnabled changes from false to true', async () => {
    // Given
    devSessionStatusManager.updateStatus({isReady: false})

    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('Press p')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('Press g')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('Preview URL')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('GraphiQL URL')

    // When
    devSessionStatusManager.updateStatus({isReady: true})

    await waitForInputsToBeReady()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Press p')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Press g')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Preview URL: https://shopify.com')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('GraphiQL URL: https://graphiql.shopify.com')
    renderInstance.unmount()
  })

  test('handles process errors by aborting', async () => {
    // Given
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')
    const errorProcess = {
      prefix: 'error',
      action: async () => {
        throw new Error('Test error')
      },
    }

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[errorProcess]}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        onAbort={onAbort}
      />,
    )

    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Test error')

    // Then
    expect(abort).toHaveBeenCalledWith(new Error('Test error'))

    renderInstance.unmount()
  })
})
