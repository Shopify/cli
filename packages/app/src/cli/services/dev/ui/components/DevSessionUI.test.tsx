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
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/system')
  return {
    ...actual,
    openURL: vi.fn(),
    terminalSupportsHyperlinks: mocks.terminalSupportsHyperlinks,
  }
})
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/tree-kill')
vi.mock('@shopify/cli-kit/node/hooks/postrun', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/hooks/postrun')
  return {
    ...actual,
    waitForPostRunHookAndExit: vi.fn(),
  }
})

const mocks = vi.hoisted(() => {
  return {
    useStdin: vi.fn(() => {
      return {isRawModeSupported: true}
    }),
    terminalSupportsHyperlinks: vi.fn(() => false),
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
  appEmbedded: false,
  hasExtensions: true,
}

const onAbort = vi.fn()

function mouseWheelDown(column: number, row: number): string {
  return `\u001B[<65;${column};${row}M`
}

function mouseClick(column: number, row: number): [string, string] {
  return [`\u001B[<0;${column};${row}M`, `\u001B[<0;${column};${row}m`]
}

function mouseClickOn(frame: string, text: string): [string, string] {
  const lines = unstyled(frame).split('\n')
  const rowIndex = lines.findIndex((line) => line.includes(text))
  const columnIndex = lines[rowIndex]?.indexOf(text) ?? -1
  if (rowIndex === -1 || columnIndex === -1) throw new Error(`Could not find ${text} in the rendered output`)
  return mouseClick(columnIndex + 1, rowIndex + 1)
}

describe('DevSessionUI', () => {
  beforeEach(() => {
    mocks.terminalSupportsHyperlinks.mockReturnValue(false)
    mocks.useStdin.mockReturnValue({isRawModeSupported: true})
    devSessionStatusManager = new DevSessionStatusManager()
    devSessionStatusManager.reset()
    devSessionStatusManager.updateStatus(initialStatus)
  })

  test('renders the branded loading indicator for loading status messages', async () => {
    devSessionStatusManager.updateStatus({
      statusMessage: {message: 'Preparing dev preview', type: 'loading'},
    })

    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )

    await waitForContent(renderInstance, 'Preparing dev preview')

    expect(unstyled(renderInstance.lastFrame()!)).toMatch(/S[> ] Preparing dev preview\.\.\./)

    renderInstance.unmount()
  })

  test('renders configuration and GraphiQL port notices as initial app-preview logs', async () => {
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        configPath="/app/shopify.app.toml"
        usingLocalhost
        unavailableGraphiqlPort={4000}
        localhostPortUnavailable={8081}
        onAbort={onAbort}
      />,
    )

    await waitForContent(renderInstance, 'Using shopify.app.toml')
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('app-preview │ Using shopify.app.toml for default values.')
    expect(output).toContain('app-preview │ ⚠️ `--use-localhost` is not compatible')
    expect(output).toContain('app-preview │ ⚠️ A random port will be used for GraphiQL because 4000')
    expect(output).toContain('app-preview │ ⚠️ A random port will be used for localhost because 8081')

    renderInstance.unmount()
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
    // Wait for React 19 to render the process output
    await waitForContent(renderInstance, 'third frontend message')

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
    expect(output).toContain('(q) Quit')

    // Shortcuts and URLs should be visible
    expect(output).toContain('(g) Open GraphiQL (Admin API)')
    expect(output).toContain('(p) Open app preview')
    expect(output).toContain('(c) Open Dev Console for extension previews')
    expect(output).toContain('Open app preview: https://shopify.com')
    expect(output).toContain('Open GraphiQL (Admin API): https://graphi')
    expect(output).toContain('Open Dev Console for extension previews:')
    expect(output).toContain('S> Shopify CLI')

    renderInstance.unmount()
  })

  test('cycles through log prefixes and only renders output for the selected prefix', async () => {
    let processesStartedResolve: () => void
    const processesStarted = new Promise<void>((resolve) => {
      processesStartedResolve = resolve
    })
    let releaseProcesses = () => {}
    const processesReleased = new Promise<void>((resolve) => {
      releaseProcesses = resolve
    })
    let startedProcessCount = 0
    const processStarted = () => {
      startedProcessCount++
      if (startedProcessCount === 3) processesStartedResolve()
    }
    let writeAppPreview = (_message: string) => {}
    let writeAppHome = (_message: string) => {}
    let writeWeb = (_message: string) => {}
    let writeGraphiql = (_message: string) => {}
    const appPreviewProcess = {
      prefix: 'app-preview',
      action: async (stdout: Writable) => {
        writeAppPreview = (message) => stdout.write(message)
        writeAppHome = (message) => useConcurrentOutputContext({outputPrefix: 'app_home'}, () => stdout.write(message))
        writeAppPreview('app preview message')
        writeAppHome('app home message')
        processStarted()
        await processesReleased
      },
    }
    const webProcess = {
      prefix: 'React Router',
      action: async (stdout: Writable) => {
        writeWeb = (message) => stdout.write(message)
        writeWeb('react router message')
        processStarted()
        await processesReleased
      },
    }
    const graphiqlProcess = {
      prefix: 'graphiql',
      action: async (stdout: Writable) => {
        writeGraphiql = (message) => stdout.write(message)
        writeGraphiql('graphiql message')
        processStarted()
        await processesReleased
      },
    }

    const renderInstance = render(
      <DevSessionUI
        processes={[appPreviewProcess, webProcess, graphiqlProcess]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        onAbort={onAbort}
      />,
    )
    await processesStarted
    await waitForContent(renderInstance, 'app home message')

    let output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('(f) Filter logs: all')
    const actionsRow = output.split('\n').find((line) => line.includes('(f) Filter logs: all'))!
    expect(actionsRow.indexOf('(f) Filter logs: all')).toBeLessThan(actionsRow.indexOf('(q) Quit'))
    expect(output).toContain('app preview message')
    expect(output).toContain('react router message')
    expect(output).toContain('app home message')
    expect(output).toContain('graphiql message')

    await sendInputAndWait(renderInstance, 10, 'f')
    writeAppHome('filtered app home message')
    writeWeb('filtered react router message')
    writeGraphiql('filtered graphiql message')
    writeAppPreview('filtered app preview message')
    await waitForContent(renderInstance, 'filtered app preview message')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('(f) Filter logs: app-previ')
    expect(output).toContain('filtered app preview message')
    expect(output).not.toContain('filtered react router message')
    expect(output).not.toContain('filtered app home message')
    expect(output).not.toContain('filtered graphiql message')

    await sendInputAndWait(renderInstance, 10, 'f', 'f', 'f')
    writeAppPreview('app preview while filtering app home')
    writeWeb('react router while filtering app home')
    writeGraphiql('graphiql while filtering app home')
    writeAppHome('app home while filtering app home')
    await waitForContent(renderInstance, 'app home while filtering app home')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('(f) Filter logs: app_home')
    expect(output).not.toContain('app preview while filtering app home')
    expect(output).not.toContain('react router while filtering app home')
    expect(output).toContain('app home while filtering app home')
    expect(output).not.toContain('graphiql while filtering app home')

    await sendInputAndWait(renderInstance, 10, 'f')
    writeAppPreview('app preview after resetting filter')
    writeWeb('react router after resetting filter')
    writeAppHome('app home after resetting filter')
    writeGraphiql('graphiql after resetting filter')
    await waitForContent(renderInstance, 'graphiql after resetting filter')
    output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('(f) Filter logs: all')
    expect(output).toContain('app preview after resetting filter')
    expect(output).toContain('react router after resetting filter')
    expect(output).toContain('app home after resetting filter')
    expect(output).toContain('graphiql after resetting filter')

    releaseProcesses()
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
    await sendInputAndWait(renderInstance, 10, 'p')

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
    await sendInputAndWait(renderInstance, 10, 'g')

    // Then
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://graphiql.shopify.com')

    renderInstance.unmount()
  })

  test('opens the dev console URL when c is pressed for non-embedded apps', async () => {
    // Given
    devSessionStatusManager.updateStatus({appEmbedded: false})

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
    await sendInputAndWait(renderInstance, 10, 'c')

    // Then
    expect(vi.mocked(openURL)).toHaveBeenNthCalledWith(1, 'https://mystore.myshopify.com/admin?dev-console=show')

    renderInstance.unmount()
  })

  test('does not show dev console shortcut when app is embedded', async () => {
    // Given
    devSessionStatusManager.updateStatus({appEmbedded: true})

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

    // Then
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).not.toContain('(c) Open Dev Console')
    expect(output).not.toContain('Dev Console URL')

    renderInstance.unmount()
  })

  test('does not show dev console shortcut when app has no extensions', async () => {
    // Given
    devSessionStatusManager.updateStatus({hasExtensions: false})

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

    // Then
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).not.toContain('(c) Open Dev Console')
    expect(output).not.toContain('Dev Console URL')

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

  test('calls onAbort when aborted before dev preview is ready', async () => {
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

    const promise = renderInstance.waitUntilExit()
    await promise

    expect(onAbort).toHaveBeenCalledOnce()

    // unmount so that polling is cleared after every test
    renderInstance.unmount()
  })

  test('shows persistent dev info when aborting and dev preview is ready', async () => {
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
    expect(finalOutput).toContain('Learn more about dev previews')

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
    await waitForContent(renderInstance, 'third backend message')

    const promise = renderInstance.waitUntilExit()

    abortController.abort('something went wrong')
    // Wait for React 19 to render the abort state
    await waitForContent(renderInstance, 'something went wrong')

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
    expect(output).toContain('Learn more about dev previews')

    // Tab interface is hidden after abort (React 19 batches setIsAborted with other state updates)
    expect(output).not.toContain('(d) Dev status')

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
    expect(finalOutput).toContain('Learn more about dev previews')

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
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('Open app preview')

    // When status updates
    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'https://new-preview-url.shopify.com',
      graphiqlURL: 'https://new-graphiql.shopify.com',
    })

    await waitForContent(renderInstance, 'Open app preview')

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Open app preview: https://new-preview-url')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Open GraphiQL (Admin API): https://new-')
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
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('(p)')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('(g)')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('Preview URL')
    expect(unstyled(renderInstance.lastFrame()!)).not.toContain('GraphiQL URL')

    // When
    devSessionStatusManager.updateStatus({isReady: true})

    await waitForInputsToBeReady()

    // Then
    expect(unstyled(renderInstance.lastFrame()!)).toContain('(p)')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('(g)')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Open app preview: https://shopify.com')
    expect(unstyled(renderInstance.lastFrame()!)).toContain('Open GraphiQL (Admin API): https://graphi')
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
    await sendInputAndWait(renderInstance, 10, 'a')

    // Then - info tab should be shown with app data
    const output = renderInstance.lastFrame()!
    expect(output).toContain('My Test App')
    expect(output).toContain('https://my-app.ngrok.io')
    expect(output).not.toContain('mystore.myshopify.com')

    renderInstance.unmount()
  })

  test('keeps the full-screen layout, mouse scrolling, and clicks working after filtering', async () => {
    let outputReadyResolve = () => {}
    const outputReady = new Promise<void>((resolve) => {
      outputReadyResolve = resolve
    })
    const process = {
      prefix: 'backend',
      action: async (stdout: Writable) => {
        stdout.write(Array.from({length: 100}, (_, index) => `[${String(index + 1).padStart(3, '0')}]`).join('\n'))
        outputReadyResolve()
        await new Promise<void>(() => {})
      },
    }
    devSessionStatusManager.updateStatus({
      statusMessage: {message: 'Ready, watching for changes in your app', type: 'success'},
    })
    const renderInstance = render(
      <DevSessionUI
        processes={[process]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appName="My Test App"
        onAbort={onAbort}
      />,
      {stdoutIsTTY: true},
    )

    await outputReady
    await waitForContent(renderInstance, '[100]')
    const initialFrame = unstyled(renderInstance.lastFrame()!)
    const initialLines = initialFrame.split('\n')
    const initialMenuRow = initialLines.findIndex((line) => line.includes('(d) Dev status'))
    const statusMessageRow = initialLines.findIndex((line) => line.includes('Ready, watching'))
    const firstShortcutRow = initialLines.findIndex((line) => line.includes('(p) Open app preview'))
    const quitMenuRow = initialLines.findIndex((line) => line.includes('(q) Quit'))
    const logBoxTopRow = initialLines.findIndex((line) => line.startsWith('╭'))
    const logBoxBottomRow = initialLines.findIndex((line) => line.startsWith('╰'))
    const contentPanelTopRow = initialMenuRow + 1
    const footerBottomRow = initialLines.length - 1
    const informationPanelLastColumn = initialLines[footerBottomRow]!.indexOf('╯')
    expect(initialLines).toHaveLength(80)
    expect(initialLines[logBoxTopRow]).toHaveLength(100)
    expect(initialLines.length - (logBoxBottomRow + 1)).toBe(9)
    expect(contentPanelTopRow).toBe(initialMenuRow + 1)
    expect(firstShortcutRow - statusMessageRow).toBe(2)
    expect(initialLines[contentPanelTopRow]!.slice(1, 17)).not.toContain('─')
    expect(initialLines[initialMenuRow]?.at(informationPanelLastColumn)).not.toBe('│')
    expect(initialLines[statusMessageRow + 1]?.at(informationPanelLastColumn)).toBe('│')
    expect(initialLines.slice(quitMenuRow - 1, quitMenuRow + 2).map((line) => line.at(-1))).toEqual(['╮', '│', '╯'])
    expect(initialLines[footerBottomRow - 1]).toHaveLength(99)
    expect(initialLines[footerBottomRow - 1]).toContain('S> Shopify CLI')
    initialLines.slice(logBoxTopRow, logBoxBottomRow + 1).forEach((line) => {
      expect(['╮', '│', '╯']).toContain(line.at(-1))
    })
    expect(initialFrame).not.toContain('Using shopify.app.toml')

    await sendInputAndWait(renderInstance, 50, ...mouseClickOn(renderInstance.lastFrame()!, '(f) Filter logs'))
    await waitForContent(renderInstance, '[001]')
    let filteredFrame = unstyled(renderInstance.lastFrame()!)
    expect(filteredFrame).toContain('Filter logs: backend')
    expect(filteredFrame).toContain('[001]')
    expect(filteredFrame.split('\n').findIndex((line) => line.includes('(d) Dev status'))).toBe(initialMenuRow)

    const firstLogRow = filteredFrame.split('\n').findIndex((line) => line.includes('[001]'))
    await sendInputAndWait(renderInstance, 50, mouseWheelDown(2, firstLogRow + 1))
    filteredFrame = unstyled(renderInstance.lastFrame()!)
    expect(filteredFrame).not.toContain('[001]')
    expect(filteredFrame).toContain('[004]')
    expect(filteredFrame.split('\n').findIndex((line) => line.includes('(d) Dev status'))).toBe(initialMenuRow)

    await sendInputAndWait(renderInstance, 50, ...mouseClickOn(renderInstance.lastFrame()!, '(a) App info'))
    const appInfoFrame = unstyled(renderInstance.lastFrame()!)
    expect(appInfoFrame).toContain('My Test App')
    expect(appInfoFrame.split('\n').findIndex((line) => line.includes('(d) Dev status'))).toBe(initialMenuRow)
    renderInstance.unmount()
  })

  test('resizes the layout to fill the terminal', async () => {
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

    renderInstance.stdout.columns = 60
    renderInstance.stdout.rows = 40
    renderInstance.stdout.emit('resize')
    await sendInputAndWait(renderInstance, 20)

    const resizedLines = unstyled(renderInstance.lastFrame()!).split('\n')
    expect(resizedLines).toHaveLength(40)
    expect(resizedLines.find((line) => line.startsWith('╭'))).toHaveLength(60)
    renderInstance.unmount()
  })

  test('hides Local URL in app info when an app URL is available', async () => {
    // Given
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        appURL="https://my-app.ngrok.io"
        localURL="http://localhost:3000"
        appName="My Test App"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // When
    await sendInputAndWait(renderInstance, 10, 'a')

    // Then - only App URL is shown, Local URL is hidden
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('App URL:')
    expect(output).toContain('https://my-app.ngrok.io')
    expect(output).not.toContain('Local URL:')
    expect(output).not.toContain('http://localhost:3000')

    renderInstance.unmount()
  })

  test('shows Local URL in app info when no app URL is available', async () => {
    // Given
    const renderInstance = render(
      <DevSessionUI
        processes={[]}
        abortController={new AbortController()}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn="mystore.myshopify.com"
        localURL="http://localhost:3000"
        appName="My Test App"
        onAbort={onAbort}
      />,
    )

    await waitForInputsToBeReady()

    // When
    await sendInputAndWait(renderInstance, 10, 'a')

    // Then - Local URL is shown in place of App URL
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('Local URL:')
    expect(output).toContain('http://localhost:3000')
    expect(output).not.toContain('App URL:')

    renderInstance.unmount()
  })

  test('hides URL list when terminal supports hyperlinks', async () => {
    // Given
    mocks.terminalSupportsHyperlinks.mockReturnValue(true)

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

    // Then - shortcuts with label text should be present but URL list should be hidden
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('(p) Open app preview')
    expect(output).toContain('(c) Open Dev Console for extension previews')
    expect(output).toContain('(g) Open GraphiQL (Admin API)')
    expect(output).not.toContain('Preview URL:')
    expect(output).not.toContain('Dev Console URL:')
    expect(output).not.toContain('GraphiQL URL:')
    expect(renderInstance.lastFrame()).toContain('https://shopify.dev')

    renderInstance.unmount()
  })

  test('shows URLs inline when terminal does not support hyperlinks', async () => {
    // Given
    mocks.terminalSupportsHyperlinks.mockReturnValue(false)

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

    // Then - each shortcut and its URL share one row so the footer stays compact
    const output = unstyled(renderInstance.lastFrame()!)
    expect(output).toContain('(p) Open app preview')
    expect(output).toContain('(c) Open Dev Console for extension previews')
    expect(output).toContain('(g) Open GraphiQL (Admin API)')
    expect(output).toContain('Open app preview: https://shopify.com')
    expect(output).toContain('Open Dev Console for extension previews:')
    expect(output).toContain('Open GraphiQL (Admin API): https://graphi')

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
  })
})
