import {DevSessionLogger} from './dev-session-logger.js'
import {AppEvent, EventType} from '../../app-events/app-event-watcher.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {UserError} from '../dev-session.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {Writable} from 'stream'

describe('DevSessionLogger', () => {
  let output: string[]
  let stdout: Writable
  let logger: DevSessionLogger

  beforeEach(() => {
    output = []
    stdout = {
      write: (message: string) => {
        output.push(message)
        return true
      },
    } as unknown as Writable
    logger = new DevSessionLogger(stdout)
  })

  describe('basic logging methods', () => {
    test('info logs message', async () => {
      await logger.info('test message')

      expect(output).toMatchInlineSnapshot(`
        [
          "test message",
        ]
      `)
    })

    test('warning logs message', async () => {
      await logger.warning('test warning')
      // expect(contextSpy).toHaveBeenCalledWith({outputPrefix: 'dev-session', stripAnsi: false}, expect.anything())
      expect(output).toMatchInlineSnapshot(`
        [
          "[33mtest warning[39m",
        ]
      `)
    })

    test('success logs message', async () => {
      await logger.success('test success')
      expect(output).toMatchInlineSnapshot(`
        [
          "[32mtest success[39m",
        ]
      `)
    })

    test('error logs message', async () => {
      await logger.error('test error')
      expect(output).toMatchInlineSnapshot(`
        [
          "[1m[91m❌ Error[39m[22m",
          "[1m[91m└  test error[39m[22m",
        ]
      `)
    })
  })

  describe('logUserErrors', () => {
    test('handles string error', async () => {
      await logger.logUserErrors('test error', [])
      expect(output).toMatchInlineSnapshot(`
        [
          "[1m[91m❌ Error[39m[22m",
          "[1m[91m└  test error[39m[22m",
        ]
      `)
    })

    test('handles Error instance', async () => {
      await logger.logUserErrors(new Error('test error'), [])
      expect(output).toMatchInlineSnapshot(`
        [
          "[1m[91m❌ Error[39m[22m",
          "[1m[91m└  test error[39m[22m",
        ]
      `)
    })

    test('handles UserError array with extension mapping', async () => {
      const extensions = [{uid: 'test-id', handle: 'test-extension'}] as ExtensionInstance[]
      const errors = [
        {
          message: 'test error',
          category: 'test',
          on: {user_identifier: 'test-id'} as JsonMapType,
        },
      ] as UserError[]
      await logger.logUserErrors(errors, extensions)
      expect(output).toMatchInlineSnapshot(`
        [
          "[1m[91m❌ Error[39m[22m",
          "[1m[91m└  test error[39m[22m",
        ]
      `)
    })
  })

  describe('logExtensionEvents', () => {
    test('logs app config events', async () => {
      const mockExtension = {
        isAppConfigExtension: true,
        handle: 'app-config',
        entrySourceFilePath: '',
        devUUID: '',
        localIdentifier: '',
        idEnvironmentVariableName: '',
      } as ExtensionInstance

      const event: AppEvent = {
        app: {} as any,
        extensionEvents: [
          {
            type: 'updated' as EventType,
            extension: mockExtension,
          },
        ],
        path: '',
        startTime: [0, 0],
      }

      await logger.logExtensionEvents(event)
      expect(output).toMatchInlineSnapshot(`
        [
          "App config updated",
        ]
      `)
    })

    test('logs non-app config events', async () => {
      const mockExtension = {
        isAppConfigExtension: false,
        handle: 'test-extension',
        entrySourceFilePath: '',
        devUUID: '',
        localIdentifier: '',
        idEnvironmentVariableName: '',
      } as ExtensionInstance

      const event: AppEvent = {
        app: {} as any,
        extensionEvents: [
          {
            type: 'updated' as EventType,
            extension: mockExtension,
          },
        ],
        path: '',
        startTime: [0, 0],
      }

      await logger.logExtensionEvents(event)
      expect(output).toMatchInlineSnapshot(`
        [
          "Extension updated",
        ]
      `)
    })
  })

  describe('logActionRequiredMessages', () => {
    test('does nothing when no event is provided', async () => {
      await logger.logActionRequiredMessages('test.myshopify.com')
      expect(output).toMatchInlineSnapshot(`[]`)
    })

    test('logs warning messages when actions are required', async () => {
      const mockExtension = {
        getDevSessionActionUpdateMessage: vi.fn().mockResolvedValue('Action required message'),
        entrySourceFilePath: '',
        devUUID: '',
        localIdentifier: '',
        idEnvironmentVariableName: '',
      } as unknown as ExtensionInstance

      const event: AppEvent = {
        app: {configuration: {}} as any,
        extensionEvents: [
          {
            type: 'updated' as EventType,
            extension: mockExtension,
          },
        ],
        path: '',
        startTime: [0, 0],
      }

      await logger.logActionRequiredMessages('test.myshopify.com', event)
      expect(output).toMatchInlineSnapshot(`
        [
          "[33m🔄 Action required[39m",
          "[33m└ Action required message[39m",
        ]
      `)
    })
  })

  describe('logMultipleErrors', () => {
    test('logs multiple errors', async () => {
      const errors = [
        {error: 'error 1', prefix: 'prefix-1'},
        {error: 'error 2', prefix: 'prefix-2'},
      ]

      await logger.logMultipleErrors(errors)
      expect(output).toMatchInlineSnapshot(`
        [
          "[1m[91m❌ Error[39m[22m",
          "[1m[91m└  error 1[39m[22m",
          "[1m[91m└  error 2[39m[22m",
        ]
      `)
    })
  })
})
