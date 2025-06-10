import ThemeCommand from './theme-command.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config, Flags} from '@oclif/core'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})

class TestThemeCommand extends ThemeCommand {
  static flags = {
    environment: Flags.string({
      multiple: true,
      default: [],
      env: 'SHOPIFY_FLAG_ENVIRONMENT',
    }),
    store: Flags.string({
      env: 'SHOPIFY_FLAG_STORE',
    }),
    password: Flags.string({
      env: 'SHOPIFY_FLAG_PASSWORD',
    }),
  }

  static multiEnvironmentsFlags = ['store']

  commandCalls: {flags: any; session: AdminSession; context?: any}[] = []

  async command(flags: any, session: AdminSession, context?: {stdout?: Writable; stderr?: Writable}): Promise<void> {
    this.commandCalls.push({flags, session, context})
  }
}

describe('ThemeCommand', () => {
  let mockSession: AdminSession

  beforeEach(() => {
    mockSession = {
      token: 'test-token',
      storeFqdn: 'test-store.myshopify.com',
    }
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(mockSession)
  })

  describe('run', () => {
    test('no environment provided', async () => {
      // Given
      await CommandConfig.load()
      const command = new TestThemeCommand([], CommandConfig)

      // When
      await command.run()

      // Then
      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      expect(loadEnvironment).not.toHaveBeenCalled()
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(1)
      expect(command.commandCalls[0]).toMatchObject({
        flags: {environment: []},
        session: mockSession,
        context: undefined,
      })
    })

    test('single environment provided', async () => {
      // Given
      const environmentConfig = {store: 'env-store.myshopify.com', theme: '123'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'development'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(loadEnvironment).toHaveBeenCalledWith('development', 'shopify.theme.toml')
      expect(ensureAuthenticatedThemes).toHaveBeenCalledTimes(1)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(1)
      expect(command.commandCalls[0]).toMatchObject({
        flags: {
          environment: ['development'],
          store: 'env-store.myshopify.com',
          theme: '123',
        },
        session: mockSession,
        context: undefined,
      })
    })

    test('multiple environments provided - uses renderConcurrent for parallel execution', async () => {
      // Given
      const environmentConfig = {store: 'store.myshopify.com', theme: '123'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(mockSession)

      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'development', '--environment', 'staging'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(loadEnvironment).toHaveBeenCalledWith('development', 'shopify.theme.toml')
      expect(loadEnvironment).toHaveBeenCalledWith('staging', 'shopify.theme.toml')
      expect(ensureAuthenticatedThemes).toHaveBeenCalledTimes(2)

      expect(renderConcurrent).toHaveBeenCalledOnce()
      expect(renderConcurrent).toHaveBeenCalledWith(
        expect.objectContaining({
          processes: expect.arrayContaining([
            expect.objectContaining({prefix: 'development'}),
            expect.objectContaining({prefix: 'staging'}),
          ]),
          showTimestamps: true,
        }),
      )
    })
  })
})
