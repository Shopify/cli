import {renderDevSessionUI} from './DevSessionUI.js'
import {DevSessionStatus, DevSessionStatusManager} from '../../processes/dev-session/dev-session-status-manager.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {beforeEach, describe, expect, test, vi} from 'vitest'
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

/** Collects everything written to a writable into a single string. */
function createCapture(): {stream: NodeJS.WritableStream; text: () => string} {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(chunk.toString('utf8'))
      cb()
    },
  }) as unknown as NodeJS.WritableStream

  // Add columns property so the status bar can calculate width
  Object.defineProperty(stream, 'columns', {value: 120})

  return {
    stream,
    text: () => chunks.join(''),
  }
}

/** Strip ANSI escape codes for easier assertions. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\]8;;[^\x07]*\x07/g, '')
}

describe('DevSessionUI', () => {
  beforeEach(() => {
    devSessionStatusManager = new DevSessionStatusManager()
    devSessionStatusManager.reset()
    devSessionStatusManager.updateStatus(initialStatus)
    onAbort.mockReset()
  })

  test('renders process output and status bar with URLs', async () => {
    const capture = createCapture()
    const abortController = new AbortController()

    const backendProcess = {
      prefix: 'backend',
      action: async (stdout: Writable, _stderr: Writable) => {
        stdout.write('first backend message')
        stdout.write('second backend message')
      },
    }

    // Start rendering — it blocks until abort
    const promise = renderDevSessionUI({
      processes: [backendProcess],
      abortController,
      devSessionStatusManager,
      shopFqdn: 'mystore.myshopify.com',
      onAbort,
      // @ts-expect-error - using capture stream
      _testOutput: capture.stream,
    })

    // Give processes time to write
    await new Promise((r) => setTimeout(r, 50))

    abortController.abort()
    await promise

    const output = stripAnsi(capture.text())
    expect(output).toContain('backend')
    expect(output).toContain('first backend message')
    expect(output).toContain('second backend message')
  })

  test('calls onAbort when aborted before dev preview is ready', async () => {
    const abortController = new AbortController()
    devSessionStatusManager.updateStatus({isReady: false})

    const promise = renderDevSessionUI({
      processes: [],
      abortController,
      devSessionStatusManager,
      shopFqdn: 'mystore.myshopify.com',
      onAbort,
    })

    // Give a tick for setup
    await new Promise((r) => setTimeout(r, 10))

    abortController.abort()
    await promise

    expect(onAbort).toHaveBeenCalledOnce()
  })

  test('handles process errors by aborting', async () => {
    const abortController = new AbortController()
    const abort = vi.spyOn(abortController, 'abort')
    const errorProcess = {
      prefix: 'error',
      action: async () => {
        throw new Error('Test error')
      },
    }

    const promise = renderDevSessionUI({
      processes: [errorProcess],
      abortController,
      devSessionStatusManager,
      shopFqdn: 'mystore.myshopify.com',
      onAbort,
    })

    await promise

    expect(abort).toHaveBeenCalledWith(new Error('Test error'))
  })
})
