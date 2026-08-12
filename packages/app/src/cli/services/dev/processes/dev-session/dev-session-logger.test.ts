import {DevSessionLogger} from './dev-session-logger.js'
import {UserError} from './dev-session.js'
import {AppEvent, EventType} from '../../app-events/app-event-watcher.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import analyticsAppEventsSpec from '../../../../models/extensions/specifications/analytics_app_events.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/ui/components', () => ({
  useConcurrentOutputContext: vi.fn((_, callback: () => void) => callback()),
}))

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

  describe('logExtensionUpdateMessages', () => {
    test('does nothing when no event is provided', async () => {
      await logger.logExtensionUpdateMessages()
      expect(output).toMatchInlineSnapshot(`[]`)
    })

    test('logs messages', async () => {
      const mockExtension = {
        getDevSessionUpdateMessages: vi.fn().mockResolvedValue(['This has been updated.']),
        entrySourceFilePath: '',
        devUUID: '',
        localIdentifier: '',
        idEnvironmentVariableName: '',
        handle: 'test-extension',
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

      await logger.logExtensionUpdateMessages(event)
      expect(output).toMatchInlineSnapshot(`
        [
          "[90m└ [39mThis has been updated.",
        ]
      `)
    })

    test('does not log messages when extension is deleted', async () => {
      const mockExtension = {
        getDevSessionUpdateMessages: vi.fn().mockResolvedValue(['This would be logged if not deleted.']),
        entrySourceFilePath: '',
        devUUID: '',
        localIdentifier: '',
        idEnvironmentVariableName: '',
        handle: 'test-extension',
      } as unknown as ExtensionInstance

      const event: AppEvent = {
        app: {configuration: {}} as any,
        extensionEvents: [
          {
            type: 'deleted' as EventType,
            extension: mockExtension,
          },
        ],
        path: '',
        startTime: [0, 0],
      }

      await logger.logExtensionUpdateMessages(event)
      expect(output).toMatchInlineSnapshot(`[]`)
      expect(mockExtension.getDevSessionUpdateMessages).not.toHaveBeenCalled()
    })

    test('prefixes Analytics App Events messages with the extension handle', async () => {
      // Given
      const analyticsAppEventsExtension = new ExtensionInstance({
        configuration: {},
        configurationPath: '',
        directory: '',
        specification: analyticsAppEventsSpec,
      })
      const event: AppEvent = {
        app: {configuration: {}} as any,
        extensionEvents: [
          {
            type: EventType.Created,
            extension: analyticsAppEventsExtension,
          },
        ],
        path: '',
        startTime: [0, 0],
      }

      // When
      await logger.logExtensionUpdateMessages(event)

      // Then
      expect(output).toMatchInlineSnapshot(`
        [
          "\u001b[90m└ \u001b[39mExtension loaded",
        ]
      `)
      expect(vi.mocked(useConcurrentOutputContext)).toHaveBeenCalledWith(
        {outputPrefix: 'analytics_app_events', stripAnsi: false},
        expect.any(Function),
      )
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
