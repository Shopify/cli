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
      › Press i │ display app information
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

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "
      ╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  A preview of your development changes is still available on                 │
      │  mystore.myshopify.com.                                                      │
      │                                                                              │
      │  Run \`shopify app dev clean\` to restore the latest released version of your  │
      │   app.                                                                       │
      │                                                                              │
      │  Learn more about app previews [0]                                           │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [0] https://shopify.dev/beta/developer-dashboard/shopify-app-dev
      "
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
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )

    const promise = renderInstance.waitUntilExit()

    abortController.abort('something went wrong')

    expect(unstyled(renderInstance.lastFrame()!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │                   backend │ first backend message
      00:00:00 │                   backend │ second backend message
      00:00:00 │                   backend │ third backend message

      ╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  A preview of your development changes is still available on                 │
      │  mystore.myshopify.com.                                                      │
      │                                                                              │
      │  Run \`shopify app dev clean\` to restore the latest released version of your  │
      │   app.                                                                       │
      │                                                                              │
      │  Learn more about app previews [0]                                           │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [0] https://shopify.dev/beta/developer-dashboard/shopify-app-dev


      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Press g │ open GraphiQL (Admin API) in your browser
      › Press i │ display app information
      › Press p │ preview in your browser
      › Press q │ quit

      Preview URL: https://shopify.com
      GraphiQL URL: https://graphiql.shopify.com


      something went wrong"
    `)

    await promise

    expect(unstyled(getLastFrameAfterUnmount(renderInstance)!).replace(/\d/g, '0')).toMatchInlineSnapshot(`
      "00:00:00 │                   backend │ first backend message
      00:00:00 │                   backend │ second backend message
      00:00:00 │                   backend │ third backend message

      ╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  A preview of your development changes is still available on                 │
      │  mystore.myshopify.com.                                                      │
      │                                                                              │
      │  Run \`shopify app dev clean\` to restore the latest released version of your  │
      │   app.                                                                       │
      │                                                                              │
      │  Learn more about app previews [0]                                           │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [0] https://shopify.dev/beta/developer-dashboard/shopify-app-dev


      something went wrong"
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

  test('shows app info modal when i is pressed', async () => {
    // Given - setup with a status message to verify it gets replaced
    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'https://shopify.com',
      graphiqlURL: 'https://graphiql.shopify.com',
      statusMessage: {
        type: 'success',
        message: 'App is ready for development',
      },
    })

    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appURL="https://my-app.ngrok.io"
        appName="My Test App"
        organizationName="My Organization"
        configPath="/path/to/shopify.app.toml"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // Initially should show status message
    expect(renderInstance.lastFrame()!).toContain('App is ready for development')

    // When
    await sendInputAndWait(renderInstance, 100, 'i')

    // Then - modal should be shown and replace status indicator
    const output = renderInstance.lastFrame()!
    expect(output).toContain('App Information')
    expect(output).toContain('My Test App')
    expect(output).toContain('https://my-app.ngrok.io')
    expect(output).toContain('shopify.app.toml')
    expect(output).toContain('mystore.myshopify.com')
    expect(output).toContain('My Organization')
    expect(output).toContain('to close')
    // Status indicator should be replaced
    expect(output).not.toContain('App is ready for development')

    renderInstance.unmount()
  })

  test('hides app info modal when escape is pressed', async () => {
    // Given
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appURL="https://my-app.ngrok.io"
        appName="My Test App"
        organizationName="My Organization"
        configPath="/path/to/shopify.app.toml"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // Show modal first
    await sendInputAndWait(renderInstance, 100, 'i')
    expect(renderInstance.lastFrame()!).toContain('App Information')

    // When - send escape key
    renderInstance.stdin.write('\u001b')
    await waitForInputsToBeReady()

    // Then
    const output = renderInstance.lastFrame()!
    expect(output).not.toContain('App Information')
    expect(output).toContain('Preview URL: https://shopify.com')

    renderInstance.unmount()
  })

  test('toggles app info modal when i is pressed multiple times', async () => {
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

    // When - press i to show modal
    await sendInputAndWait(renderInstance, 100, 'i')
    expect(renderInstance.lastFrame()!).toContain('App Information')

    // When - press i again to hide modal
    await sendInputAndWait(renderInstance, 100, 'i')
    expect(renderInstance.lastFrame()!).not.toContain('App Information')

    // When - press i again to show modal again
    await sendInputAndWait(renderInstance, 100, 'i')
    expect(renderInstance.lastFrame()!).toContain('App Information')

    renderInstance.unmount()
  })

  test('hides preview and graphiql URLs when app info modal is shown', async () => {
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

    // Initially URLs should be visible
    expect(renderInstance.lastFrame()!).toContain('Preview URL: https://shopify.com')
    expect(renderInstance.lastFrame()!).toContain('GraphiQL URL: https://graphiql.shopify.com')

    // When - show modal
    await sendInputAndWait(renderInstance, 100, 'i')

    // Then - URLs should be hidden
    const output = renderInstance.lastFrame()!
    expect(output).toContain('App Information')
    expect(output).not.toContain('Preview URL: https://shopify.com')
    expect(output).not.toContain('GraphiQL URL: https://graphiql.shopify.com')

    renderInstance.unmount()
  })

  test('only shows app info option when app is ready', async () => {
    // Given - app not ready
    devSessionStatusManager.updateStatus({isReady: false})

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

    // Then - should not show app info option
    expect(renderInstance.lastFrame()!).not.toContain('display app information')

    // When - app becomes ready
    devSessionStatusManager.updateStatus({isReady: true})
    await waitForInputsToBeReady()

    // Then - should show app info option
    expect(renderInstance.lastFrame()!).toContain('display app information')

    renderInstance.unmount()
  })

  test('shows minimal app info when only required fields are provided', async () => {
    // Given - provide at least one optional field so modal appears
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appName="Basic App"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // When
    await sendInputAndWait(renderInstance, 100, 'i')

    // Then
    const output = renderInstance.lastFrame()!
    expect(output).toContain('App Information')
    expect(output).toContain('mystore.myshopify.com')
    expect(output).toContain('Basic App')
    expect(output).toContain('to close')

    renderInstance.unmount()
  })
})
