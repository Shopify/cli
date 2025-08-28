import ThemeCommand, {RequiredFlags} from './theme-command.js'
import {ensureThemeStore} from './theme-store.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config, Flags} from '@oclif/core'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {renderConcurrent, renderConfirmationPrompt, renderError} from '@shopify/cli-kit/node/ui'
import type {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./theme-store.js')

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

  static multiEnvironmentsFlags: RequiredFlags = ['store']

  commandCalls: {flags: any; session: AdminSession; multiEnvironment?: boolean; context?: any}[] = []

  async command(
    flags: any,
    session: AdminSession,
    multiEnvironment?: boolean,
    context?: {stdout?: Writable; stderr?: Writable},
  ): Promise<void> {
    this.commandCalls.push({flags, session, multiEnvironment, context})

    if (flags.environment && flags.environment[0] === 'command-error') {
      throw new Error('Mocking a command error')
    }
  }
}

class TestThemeCommandWithForce extends TestThemeCommand {
  static flags = {
    ...TestThemeCommand.flags,
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }
}

class TestThemeCommandWithUnionFlags extends TestThemeCommand {
  static multiEnvironmentsFlags: RequiredFlags = ['store', ['live', 'development', 'theme']]

  static flags = {
    ...TestThemeCommand.flags,
    development: Flags.boolean({
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    theme: Flags.string({
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    live: Flags.boolean({
      env: 'SHOPIFY_FLAG_LIVE',
    }),
  }
}

describe('ThemeCommand', () => {
  let mockSession: AdminSession

  beforeEach(() => {
    mockSession = {
      token: 'test-token',
      storeFqdn: 'test-store.myshopify.com',
    }
    vi.mocked(ensureThemeStore).mockReturnValue('test-store.myshopify.com')
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
      const environmentConfig = {store: 'env-store.myshopify.com'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'development'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(loadEnvironment).toHaveBeenCalledWith('development', 'shopify.theme.toml', {from: undefined})
      expect(ensureAuthenticatedThemes).toHaveBeenCalledTimes(1)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(1)
      expect(command.commandCalls[0]).toMatchObject({
        flags: {
          environment: ['development'],
          store: 'env-store.myshopify.com',
        },
        session: mockSession,
        context: undefined,
      })
    })

    test('multiple environments provided - uses renderConcurrent for parallel execution', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(mockSession)

      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'development', '--environment', 'staging'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(loadEnvironment).toHaveBeenCalledWith('development', 'shopify.theme.toml', {from: undefined, silent: true})
      expect(loadEnvironment).toHaveBeenCalledWith('staging', 'shopify.theme.toml', {from: undefined, silent: true})

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

  describe('multi environment', () => {
    test('commands that act on the same store are run in groups to prevent conflicts', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: 'wow a theme'})
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'another theme'})

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithUnionFlags(
        ['--environment', 'store1-theme', '--environment', 'store1-development', '--environment', 'store2-theme'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const runGroupOneProcesses = vi.mocked(renderConcurrent).mock.calls[0]?.[0]?.processes
      expect(runGroupOneProcesses).toHaveLength(2)
      expect(runGroupOneProcesses?.map((process) => process.prefix)).toEqual(['store1-theme', 'store2-theme'])

      const runGroupTwoProcesses = vi.mocked(renderConcurrent).mock.calls[1]?.[0]?.processes
      expect(runGroupTwoProcesses).toHaveLength(1)
      expect(runGroupTwoProcesses?.map((process) => process.prefix)).toEqual(['store1-development'])
    })

    test('commands with --force flag should not prompt for confirmation', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithForce(
        ['--environment', 'development', '--environment', 'staging', '--force'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
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

    test('commands that do not allow --force flag should not prompt for confirmation', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'development', '--environment', 'staging'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(renderConcurrent).toHaveBeenCalledOnce()
    })

    test('commands without --force flag that allow it should prompt for confirmation', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithForce(
        ['--environment', 'development', '--environment', 'staging'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(renderConfirmationPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(Array),
          confirmationMessage: 'Yes, proceed',
          cancellationMessage: 'Cancel',
        }),
      )
      expect(renderConcurrent).toHaveBeenCalledOnce()
    })

    test('should not execute command if confirmation is cancelled', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithForce(
        ['--environment', 'development', '--environment', 'staging'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(renderConcurrent).not.toHaveBeenCalled()
    })

    test('should execute commands in environments with all required flags', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: 'theme1.myshopify.com'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store3.myshopify.com', live: true})

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithUnionFlags(
        ['--environment', 'theme', '--environment', 'development', '--environment', 'live'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const renderConcurrentProcesses = vi.mocked(renderConcurrent).mock.calls[0]?.[0]?.processes
      expect(renderConcurrentProcesses).toHaveLength(3)
      expect(renderConcurrentProcesses?.map((process) => process.prefix)).toEqual(['theme', 'development', 'live'])
    })

    test('should not execute commands in environments that are missing required flags', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com'})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({store: 'store3.myshopify.com'})

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'development', '--environment', 'env-missing-store', '--environment', 'production'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const renderConcurrentProcesses = vi.mocked(renderConcurrent).mock.calls[0]?.[0]?.processes
      expect(renderConcurrentProcesses).toHaveLength(2)
      expect(renderConcurrentProcesses?.map((process) => process.prefix)).toEqual(['development', 'production'])
    })

    test('should not execute commands in environments that are missing required "one of" flags', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: 'theme1.myshopify.com'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com'})
        .mockResolvedValueOnce({store: 'store3.myshopify.com', live: true})

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithUnionFlags(
        ['--environment', 'theme', '--environment', 'missing-theme-live-or-development', '--environment', 'live'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const renderConcurrentProcesses = vi.mocked(renderConcurrent).mock.calls[0]?.[0]?.processes
      expect(renderConcurrentProcesses).toHaveLength(2)
      expect(renderConcurrentProcesses?.map((process) => process.prefix)).toEqual(['theme', 'live'])
    })

    test('commands error gracefully and continue with other environments', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
        .mockResolvedValueOnce({store: 'store3.myshopify.com', live: true})
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'command-error', '--environment', 'development', '--environment', 'production'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const renderConcurrentProcesses = vi.mocked(renderConcurrent).mock.calls[0]?.[0]?.processes
      expect(renderConcurrentProcesses).toHaveLength(3)
      expect(renderConcurrentProcesses?.map((process) => process.prefix)).toEqual([
        'command-error',
        'development',
        'production',
      ])
    })

    test('error messages contain the environment name', async () => {
      // Given
      const environmentConfig = {store: 'store.myshopify.com'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'command-error', '--environment', 'development'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({
          body: ['Environment command-error failed: \n\nMocking a command error'],
        }),
      )
    })
  })
})
