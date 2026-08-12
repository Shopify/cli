import {DevEvent, devJsonEventSink, renderDevJson} from './json.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {afterEach, describe, expect, test} from 'vitest'
import {createSyncDiagnosticChannel} from '@shopify/diagnostics'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('renderDevJson', () => {
  test('renders startup, process output, and status updates as NDJSON events', async () => {
    const output = mockAndCaptureOutput()
    const events = createSyncDiagnosticChannel<DevEvent>(devJsonEventSink)
    const devSessionStatusManager = new DevSessionStatusManager()

    await renderDevJson({
      processes: [
        {
          prefix: 'web',
          action: async (stdout, stderr) => {
            stdout.write('\u001B[32mServer ready\u001B[39m\n')
            stderr.write('Dependency warning\n')
            devSessionStatusManager.updateStatus({
              isReady: true,
              statusMessage: {message: 'Ready, watching for changes', type: 'success'},
            })
          },
        },
      ],
      previewUrl: 'https://example.myshopify.com',
      graphiqlUrl: 'http://localhost:3457/graphiql',
      abortController: new AbortController(),
      devSessionStatusManager,
      events,
    })

    const renderedEvents = output
      .output()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(renderedEvents).toEqual([
      {
        type: 'started',
        level: 'info',
        message: 'Dev session started',
        preview_url: 'https://example.myshopify.com',
        graphiql_url: 'http://localhost:3457/graphiql',
      },
      {
        type: 'log',
        level: 'info',
        message: 'Server ready\n',
        source: 'web',
        stream: 'stdout',
      },
      {
        type: 'log',
        level: 'info',
        message: 'Dependency warning\n',
        source: 'web',
        stream: 'stderr',
      },
      {
        type: 'status',
        level: 'info',
        message: 'Ready, watching for changes',
        status: 'success',
        is_ready: true,
      },
    ])
  })
})
