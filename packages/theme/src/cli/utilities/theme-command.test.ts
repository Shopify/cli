import ThemeCommand, {RequiredFlags} from './theme-command.js'
import {ensureThemeStore} from './theme-store.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config, Flags} from '@oclif/core'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {renderConcurrent, renderConfirmationPrompt, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import type {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('./theme-store.js')
vi.mock('@shopify/cli-kit/node/fs')

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
    path: Flags.string({
      env: 'SHOPIFY_FLAG_PATH',
      default: 'current/working/directory',
    }),
    'no-color': Flags.boolean({
      env: 'SHOPIFY_FLAG_NO_COLOR',
      default: false,
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

class TestThemeCommandWithPathFlag extends TestThemeCommandWithForce {
  static multiEnvironmentsFlags: RequiredFlags = ['store', 'password', 'path']
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
class TestThemeCommandWithPath extends TestThemeCommand {
  static multiEnvironmentsFlags: RequiredFlags = ['store', 'path']
}

class TestUnauthenticatedThemeCommand extends ThemeCommand {
  static flags = {
    environment: Flags.string({
      multiple: true,
      default: [],
      env: 'SHOPIFY_FLAG_ENVIRONMENT',
    }),
    store: Flags.string({
      env: 'SHOPIFY_FLAG_STORE',
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
  }
}

class TestNoMultiEnvThemeCommand extends TestThemeCommand {
  static multiEnvironmentsFlags: RequiredFlags = null
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
    vi.mocked(fileExistsSync).mockReturnValue(true)
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
      expect(loadEnvironment).toHaveBeenCalledWith('development', 'shopify.theme.toml', {
        from: 'current/working/directory',
      })
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
      expect(loadEnvironment).toHaveBeenCalledWith('development', 'shopify.theme.toml', {
        from: 'current/working/directory',
        silent: true,
      })
      expect(loadEnvironment).toHaveBeenCalledWith('staging', 'shopify.theme.toml', {
        from: 'current/working/directory',
        silent: true,
      })

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

    test("throws an AbortError if the path doesn't exist", async () => {
      await CommandConfig.load()
      const command = new TestThemeCommand([], CommandConfig)

      vi.mocked(fileExistsSync).mockReturnValue(false)

      await expect(command.run()).rejects.toThrow(AbortError)
      expect(fileExistsSync).toHaveBeenCalledWith('current/working/directory')
    })

    test('multiple environments provided - displays warning if not allowed', async () => {
      // Given
      const environmentConfig = {store: 'store.myshopify.com'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(mockSession)

      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestNoMultiEnvThemeCommand(
        ['--environment', 'development', '--environment', 'staging'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'This command does not support multiple environments.',
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

    test('confirmation prompts should display correctly formatted flag values', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', password: 'password1', path: '/home/path/to/theme1'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', password: 'password2', path: '/home/path/to/theme2'})

      await CommandConfig.load()
      const command = new TestThemeCommandWithPathFlag(
        ['--environment', 'development', '--environment', 'staging'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderConfirmationPrompt).toHaveBeenCalledOnce()
      expect(renderConfirmationPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ['Run testthemecommandwithpathflag in the following environments?'],
          infoTable: {
            Environment: [
              ['development', {subdued: 'store: store1.myshopify.com, password, path: /home/.../theme1'}],
              ['staging', {subdued: 'store: store2.myshopify.com, password, path: /home/.../theme2'}],
            ],
          },
          confirmationMessage: 'Yes, proceed',
          cancellationMessage: 'Cancel',
        }),
      )
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

    test('should not execute commands in environments that are missing required flags even if they have a default value', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', path: '/a/path'})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({store: 'store3.myshopify.com'})

      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithPath(
        ['--environment', 'development', '--environment', 'env-missing-store', '--environment', 'path-defaults-to-cwd'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const renderConcurrentProcesses = vi.mocked(renderConcurrent).mock.calls[0]?.[0]?.processes
      expect(renderConcurrentProcesses).toHaveLength(1)
      expect(renderConcurrentProcesses?.map((process) => process.prefix)).toEqual(['development'])
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

    test('commands should display an error if the --path flag is used', async () => {
      // Given
      const environmentConfig = {store: 'store.myshopify.com'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'command-error', '--environment', 'development', '--path', 'path'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({
          body: [
            "Can't use `--path` flag with multiple environments.",
            "Configure each environment's theme path in your shopify.theme.toml file instead.",
          ],
        }),
      )
    })

    test('commands should display an error if the --path flag is used and no shopify.theme.toml is found', async () => {
      // Given
      const environmentConfig = {store: 'store.myshopify.com'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(fileExistsSync).mockReturnValue(false)

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'command-error', '--environment', 'development', '--path', 'path'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({
          body: [
            "Can't use `--path` flag with multiple environments.",
            'Run this command from the directory containing shopify.theme.toml.',
            'No shopify.theme.toml found in current directory.',
          ],
        }),
      )
    })

    test('CLI and shopify.theme.toml flag values take precedence over defaults', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', theme: 'theme1.myshopify.com', path: 'theme/path'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', development: true, path: 'development/path'})
        .mockResolvedValueOnce({store: 'store3.myshopify.com', live: true, 'no-color': false})

      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'theme', '--environment', 'development', '--environment', 'live', '--no-color'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      const commandCalls = command.commandCalls
      expect(commandCalls).toHaveLength(3)

      const themeEnvFlags = commandCalls[0]?.flags
      expect(themeEnvFlags?.path).toEqual(resolvePath('theme/path'))
      expect(themeEnvFlags?.store).toEqual('store1.myshopify.com')
      expect(themeEnvFlags?.theme).toEqual('theme1.myshopify.com')
      expect(themeEnvFlags?.['no-color']).toEqual(true)

      const developmentEnvFlags = commandCalls[1]?.flags
      expect(developmentEnvFlags?.path).toEqual(resolvePath('development/path'))
      expect(developmentEnvFlags?.store).toEqual('store2.myshopify.com')
      expect(developmentEnvFlags?.development).toEqual(true)
      expect(developmentEnvFlags?.['no-color']).toEqual(true)

      const liveEnvFlags = commandCalls[2]?.flags
      expect(liveEnvFlags?.path).toEqual('current/working/directory')
      expect(liveEnvFlags?.store).toEqual('store3.myshopify.com')
      expect(liveEnvFlags?.live).toEqual(true)
      expect(liveEnvFlags?.['no-color']).toEqual(true)
    })

    test('commands will only create a session object if the password flag is supported', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com'})

      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestUnauthenticatedThemeCommand(
        ['--environment', 'store1', '--environment', 'store2'],
        CommandConfig,
      )

      // When
      await command.run()

      // Then
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    })
  })
})
