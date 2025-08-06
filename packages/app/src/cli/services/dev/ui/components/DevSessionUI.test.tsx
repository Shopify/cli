import {DevSessionUI} from './DevSessionUI.js'
import {DevSessionStatus, DevSessionStatusManager} from '../../processes/dev-session/dev-session-status-manager.js'
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

const mocks = vi.hoisted(() => {
  return {
    useStdin: vi.fn(() => {
      return {isRawModeSupported: true}
    }),
  }
})

vi.mock('@shopify/cli-kit/node/ink', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ink')
  return {
    ...actual,
    useStdin: mocks.useStdin,
  }
})

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
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )

    await frontendPromise

    // Then - check for key content without exact formatting
    const output = unstyled(renderInstance.lastFrame()!)

    // Process output should be visible
    expect(output).toContain('backend │ first backend message')
    expect(output).toContain('backend │ second backend message')
    expect(output).toContain('backend │ third backend message')
    expect(output).toContain('frontend │ first frontend message')
    expect(output).toContain('frontend │ second frontend message')
    expect(output).toContain('frontend │ third frontend message')

    // Tab interface should be present
    expect(output).toContain('(d) Dev status')
    expect(output).toContain('(a) App info')
    expect(output).toContain('(s) Store info')
    expect(output).toContain('q to quit')

    // Shortcuts and URLs should be visible
    expect(output).toContain('Press g │ open GraphiQL')
    expect(output).toContain('Press p │ preview in your browser')
    expect(output).toContain('Preview URL: https://shopify.com')
    expect(output).toContain('GraphiQL URL: https://graphiql.shopify.com')

    renderInstance.unmount()
  })

  test('opens the previewURL when p is pressed', async () => {
    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
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
        shopFqdn="mystore.myshopify.com"
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
        shopFqdn="mystore.myshopify.com"
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

  test('shows shutting down message when aborted before app preview is ready', async () => {
    // Given
    const abortController = new AbortController()
    devSessionStatusManager.updateStatus({isReady: false})

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )

    abortController.abort()

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toContain('Shutting down dev ...')

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows persistent dev info when aborting and app preview is ready', async () => {
    // Given
    const abortController = new AbortController()

    // When
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )
    await waitForInputsToBeReady()

    const promise = renderInstance.waitUntilExit()

    abortController.abort()

    await promise

    // Then - check final frame for key content without exact formatting
    const finalOutput = unstyled(getLastFrameAfterUnmount(renderInstance)!)

    // Info message should be present
    expect(finalOutput).toContain('A preview of your development changes is still available')
    expect(finalOutput).toContain('mystore.myshopify.com')
    expect(finalOutput).toContain('shopify app dev clean')
    expect(finalOutput).toContain('Learn more about app previews')

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
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort('something went wrong')

    // Then - check for key content without exact formatting
    const output = unstyled(renderInstance.lastFrame()!)

    // Process output should be visible
    expect(output).toContain('backend │ first backend message')
    expect(output).toContain('backend │ second backend message')
    expect(output).toContain('backend │ third backend message')

    // Info message should be present
    expect(output).toContain('A preview of your development changes is still available')
    expect(output).toContain('mystore.myshopify.com')
    expect(output).toContain('shopify app dev clean')
    expect(output).toContain('Learn more about app previews')

    // Tab interface should be present
    expect(output).toContain('(d) Dev status')
    expect(output).toContain('(a) App info')
    expect(output).toContain('(s) Store info')
    expect(output).toContain('q to quit')

    // Shortcuts and URLs should be visible
    expect(output).toContain('Press g │ open GraphiQL')
    expect(output).toContain('Press p │ preview in your browser')
    expect(output).toContain('Preview URL: https://shopify.com')
    expect(output).toContain('GraphiQL URL: https://graphiql.shopify.com')

    // Error message should be shown
    expect(output).toContain('something went wrong')

    await promise

    // Then - check final frame for key content without exact formatting
    const finalOutput = unstyled(getLastFrameAfterUnmount(renderInstance)!)

    // Process output should be visible
    expect(finalOutput).toContain('backend │ first backend message')
    expect(finalOutput).toContain('backend │ second backend message')
    expect(finalOutput).toContain('backend │ third backend message')

    // Info message should be present
    expect(finalOutput).toContain('A preview of your development changes is still available')
    expect(finalOutput).toContain('mystore.myshopify.com')
    expect(finalOutput).toContain('shopify app dev clean')
    expect(finalOutput).toContain('Learn more about app previews')

    // Error message should be shown
    expect(finalOutput).toContain('something went wrong')

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
        shopFqdn="mystore.myshopify.com"
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
        shopFqdn="mystore.myshopify.com"
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
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )

    await expect(renderInstance.waitUntilExit()).rejects.toThrow('Test error')

    // Then
    expect(abort).toHaveBeenCalledWith(new Error('Test error'))

    renderInstance.unmount()
  })

  test('shows app info when a is pressed', async () => {
    // Given
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appURL="https://my-app.ngrok.io"
        appName="My Test App"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // When
    await sendInputAndWait(renderInstance, 100, 'a')

    // Then - info tab should be shown with app data
    const output = renderInstance.lastFrame()!
    expect(output).toContain('My Test App')
    expect(output).toContain('https://my-app.ngrok.io')
    expect(output).not.toContain('mystore.myshopify.com')

    renderInstance.unmount()
  })

  test('shows non-interactive fallback when raw mode is not supported', async () => {
    // Given - mock useStdin to return false for isRawModeSupported
    mocks.useStdin.mockReturnValue({isRawModeSupported: false})

    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appName="Test App"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // Then - should show Dev status tab content without interactive tabs
    const output = renderInstance.lastFrame()!
    expect(output).not.toContain('(d) Dev status')
    expect(output).not.toContain('(a) App info')
    expect(output).not.toContain('(q) Quit')
    expect(output).toContain('Preview URL: https://shopify.com')
    expect(output).toContain('GraphiQL URL: https://graphiql.shopify.com')

    renderInstance.unmount()

    // Restore original mock for other tests
    mocks.useStdin.mockReturnValue({isRawModeSupported: true})
  })
})
