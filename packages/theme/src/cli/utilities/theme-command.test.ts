import ThemeCommand, {RequiredFlags} from './theme-command.js'
import {ensureThemeStore} from './theme-store.js'
import {loadThemeProjectTrust} from './theme-airlock/config.js'
import {bootstrapThemeAirlock, interactiveBootstrapUI} from './theme-airlock/bootstrap.js'
import {ThemeAirlockError} from './theme-airlock/types.js'
import {getThemeStore} from '../services/local-storage.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config, Flags} from '@oclif/core'
import {AdminSession, ensureAuthenticatedThemes, setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {
  getCurrentStoredStoreAppSession,
  listCurrentStoredStoreAppSessions,
} from '@shopify/cli-kit/node/store-auth-session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {
  renderConcurrent,
  renderConfirmationPrompt,
  renderError,
  renderInfo,
  renderWarning,
} from '@shopify/cli-kit/node/ui'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'

import type {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/store-auth-session')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/metadata', () => ({
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))
vi.mock('./theme-store.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('./theme-airlock/config.js')
vi.mock('./theme-airlock/bootstrap.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../services/local-storage.js', async () => {
  const actual = await vi.importActual<typeof import('../services/local-storage.js')>('../services/local-storage.js')
  return {...actual, getThemeStore: vi.fn()}
})

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

  commandCalls: {flags: any; session: AdminSession; multiEnvironment: boolean; args: any; context?: any}[] = []

  async command(
    flags: any,
    session: AdminSession,
    multiEnvironment = false,
    args?: any,
    context?: {stdout?: Writable; stderr?: Writable},
  ): Promise<void> {
    this.commandCalls.push({flags, session, multiEnvironment, args, context})

    if (flags.environment && flags.environment[0] === 'command-error') {
      throw new Error('Mocking a command error')
    }
  }
}

class TestScopedThemeCommand extends TestThemeCommand {
  protected storeAuthScopes(): string[] {
    return ['read_themes']
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

  commandCalls: {flags: any; session: AdminSession; multiEnvironment?: boolean; args?: any; context?: any}[] = []

  async command(
    flags: any,
    session: AdminSession,
    multiEnvironment?: boolean,
    args?: any,
    context?: {stdout?: Writable; stderr?: Writable},
  ): Promise<void> {
    this.commandCalls.push({flags, session, multiEnvironment, args, context})
  }
}

class TestNoMultiEnvThemeCommand extends TestThemeCommand {
  static multiEnvironmentsFlags: RequiredFlags = null
}

class TestProtectedThemeCommand extends TestThemeCommand {
  preflightTargets: any[] = []

  protected airlockPolicy(): 'upload' {
    return 'upload'
  }

  protected airlockPreflight(targets: any[]): void {
    this.preflightTargets = targets
  }
}

class TestDefaultProtectedThemeCommand extends TestThemeCommand {
  events: string[] = []

  async command(...args: Parameters<TestThemeCommand['command']>): Promise<void> {
    this.events.push('command')
    await super.command(...args)
  }

  protected airlockPolicy(): 'upload' {
    return 'upload'
  }
}

class TestProtectedThemeCommandWithForce extends TestProtectedThemeCommand {
  static multiEnvironmentsFlags: RequiredFlags = ['store', 'password']

  static flags = {
    ...TestProtectedThemeCommand.flags,
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }
}

class TestThemeCommandWithoutStoreRequired extends ThemeCommand {
  static flags = {
    environment: Flags.string({
      multiple: true,
      default: [],
      env: 'SHOPIFY_FLAG_ENVIRONMENT',
    }),
    path: Flags.string({
      env: 'SHOPIFY_FLAG_PATH',
      default: 'current/working/directory',
    }),
    store: Flags.string({
      env: 'SHOPIFY_FLAG_STORE',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = ['path']

  commandCalls: {
    flags: any
    session: AdminSession | undefined
    multiEnvironment?: boolean
    args?: any
    context?: any
  }[] = []

  async command(
    flags: any,
    session: AdminSession | undefined,
    multiEnvironment?: boolean,
    args?: any,
    context?: {stdout?: Writable; stderr?: Writable},
  ): Promise<void> {
    this.commandCalls.push({flags, session, multiEnvironment, args, context})
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
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)
    vi.mocked(listCurrentStoredStoreAppSessions).mockReturnValue([])
    vi.mocked(fileExistsSync).mockReturnValue(true)
  })

  describe('run', () => {
    test.each([
      {
        name: 'an empty environment selector',
        argv: ['--environment', 'first', '--environment', ''],
        message: 'Invalid batch environment selection: empty environment selector at position 2.',
      },
      {
        name: 'a repeated environment selector',
        argv: ['--environment', 'first', '--environment', 'first'],
        message: 'Invalid batch environment selection: environment "first" was selected more than once.',
      },
    ])('protected batch rejects $name before any lifecycle work', async ({argv, message}) => {
      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(argv, CommandConfig)

      await expect(command.run()).rejects.toMatchObject({reason: 'invalid-batch', message})
      expect(loadEnvironment).not.toHaveBeenCalled()
      expect(loadThemeProjectTrust).not.toHaveBeenCalled()
      expect(getCurrentStoredStoreAppSession).not.toHaveBeenCalled()
      expect(listCurrentStoredStoreAppSessions).not.toHaveBeenCalled()
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected batch rejects conflicting CLI and environment-variable stores before loading environments', async () => {
      vi.stubEnv('SHOPIFY_FLAG_STORE', 'environment-store')

      try {
        await CommandConfig.load()
        const command = new TestProtectedThemeCommandWithForce(
          ['--environment', 'first', '--environment', 'second', '--store', 'cli-store', '--force'],
          CommandConfig,
        )

        await expect(command.run()).rejects.toMatchObject({
          reason: 'conflicting-selection',
          message:
            'Store selections conflict: --store selects cli-store.myshopify.com, while SHOPIFY_FLAG_STORE selects environment-store.myshopify.com.',
        })
        expect(loadEnvironment).not.toHaveBeenCalled()
        expect(loadThemeProjectTrust).not.toHaveBeenCalled()
        expect(listCurrentStoredStoreAppSessions).not.toHaveBeenCalled()
        expect(ensureThemeStore).not.toHaveBeenCalled()
        expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
        expect(command.preflightTargets).toHaveLength(0)
        expect(renderConcurrent).not.toHaveBeenCalled()
        expect(command.commandCalls).toHaveLength(0)
      } finally {
        vi.unstubAllEnvs()
      }
    })

    test('protected batch accepts matching normalized CLI and environment-variable stores', async () => {
      vi.stubEnv('SHOPIFY_FLAG_STORE', 'trusted-store')
      vi.mocked(loadEnvironment).mockResolvedValue({store: 'trusted-store.myshopify.com'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [
          {name: 'first', store: 'trusted-store.myshopify.com'},
          {name: 'second', store: 'trusted-store'},
        ],
      })
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      try {
        await CommandConfig.load()
        const command = new TestProtectedThemeCommand(
          [
            '--environment',
            'first',
            '--environment',
            'second',
            '--store',
            'https://TRUSTED-STORE.myshopify.com/admin/',
          ],
          CommandConfig,
        )

        await command.run()

        expect(loadEnvironment).toHaveBeenCalledTimes(2)
        expect(command.preflightTargets).toHaveLength(2)
        expect(renderConcurrent).toHaveBeenCalledTimes(2)
      } finally {
        vi.unstubAllEnvs()
      }
    })

    test('protected malformed batch store rejects as invalid-batch before authentication or command work', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'trusted.myshopify.com'})
        .mockResolvedValueOnce({store: 'invalid/store'})

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'trusted', '--environment', 'malformed'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toMatchObject({
        reason: 'invalid-batch',
        message: expect.stringContaining('malformed'),
      })
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected malformed effective batch store rejects as invalid-batch before authentication or command work', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'trusted-a.myshopify.com'})
        .mockResolvedValueOnce({store: 'trusted-b.myshopify.com'})

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'trusted-a', '--environment', 'trusted-b', '--store', 'invalid/store'],
        CommandConfig,
      )

      const error = await command.run().catch((error) => error)
      expect(error).toMatchObject({
        reason: 'invalid-store',
        message: 'Invalid store value for --store: invalid/store.',
      })
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('unprotected malformed batch store retains the generic normalization error', async () => {
      vi.mocked(loadEnvironment).mockResolvedValue({store: 'invalid/store'})

      await CommandConfig.load()
      const command = new TestThemeCommand(
        ['--environment', 'malformed-a', '--environment', 'malformed-b'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toBeInstanceOf(AbortError)
      expect(loadThemeProjectTrust).not.toHaveBeenCalled()
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected unknown store rejects before authentication or command work', async () => {
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'default', store: 'trusted.myshopify.com'}],
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(['--store', 'unknown.myshopify.com'], CommandConfig)

      await expect(command.run()).rejects.toMatchObject({reason: 'unknown-store'})
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected trusted target authenticates without remembering the store', async () => {
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'default', store: 'test-store.myshopify.com'}],
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand([], CommandConfig)

      await command.run()

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      expect(ensureThemeStore).toHaveBeenCalledTimes(1)
      expect(ensureThemeStore).toHaveBeenCalledWith({store: 'test-store.myshopify.com', remember: false})
      expect(command.preflightTargets).toEqual([
        expect.objectContaining({store: 'test-store.myshopify.com', source: 'default'}),
      ])
      expect(command.commandCalls[0]).toMatchObject({flags: {store: 'test-store.myshopify.com'}})
    })

    test('protected trusted target renders the default preflight between authentication and command', async () => {
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'default', store: 'test-store.myshopify.com'}],
      })
      await CommandConfig.load()
      const command = new TestDefaultProtectedThemeCommand([], CommandConfig)
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async () => {
        command.events.push('authentication')
        return mockSession
      })
      vi.mocked(renderInfo).mockImplementation(() => {
        command.events.push('preflight')
        return undefined
      })

      await command.run()

      expect(command.events).toEqual(['authentication', 'preflight', 'command'])
      expect(renderInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: 'Theme Airlock',
          customSections: expect.arrayContaining([
            expect.objectContaining({
              body: expect.objectContaining({
                tabularData: expect.arrayContaining([['Operation', 'theme testdefaultprotectedthemecommand']]),
              }),
            }),
          ]),
        }),
      )
    })

    test('malformed project trust rejects before shared lifecycle work', async () => {
      vi.mocked(loadThemeProjectTrust).mockRejectedValue(
        new ThemeAirlockError('Malformed theme trust', 'malformed-configuration'),
      )

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand([], CommandConfig)

      await expect(command.run()).rejects.toMatchObject({reason: 'malformed-configuration'})
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('ambiguous project trust rejects before shared lifecycle work', async () => {
      vi.mocked(loadThemeProjectTrust).mockRejectedValue(
        new ThemeAirlockError('Ambiguous theme trust', 'ambiguous-configuration'),
      )

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand([], CommandConfig)

      await expect(command.run()).rejects.toMatchObject({reason: 'ambiguous-configuration'})
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('interactive bootstrap cancellation rejects before shared lifecycle work or store mutation', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      vi.mocked(getThemeStore).mockReturnValue('remembered.myshopify.com')
      vi.mocked(interactiveBootstrapUI).mockReturnValue({
        confirmStore: vi.fn(),
        promptStore: vi.fn(),
        promptEnvironment: vi.fn(),
      })
      vi.mocked(bootstrapThemeAirlock).mockRejectedValue(
        new ThemeAirlockError('Theme bootstrap was cancelled', 'bootstrap-cancelled'),
      )
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'unconfigured',
        themePath: 'current/working/directory',
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand([], CommandConfig)

      await expect(command.run()).rejects.toMatchObject({reason: 'bootstrap-cancelled'})
      expect(bootstrapThemeAirlock).toHaveBeenCalledOnce()
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('interactive bootstrap authenticates with the supplied password and reuses its session', async () => {
      const resolvedStore = 'resolved.myshopify.com'
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      vi.mocked(interactiveBootstrapUI).mockReturnValue({
        confirmStore: vi.fn(),
        promptStore: vi.fn(),
        promptEnvironment: vi.fn(),
      })
      vi.mocked(bootstrapThemeAirlock).mockImplementation(async (options) => {
        const session = await options.authenticate(resolvedStore)
        return {
          target: {environment: 'default', store: resolvedStore, source: 'bootstrap', implicit: false},
          session,
          configurationPath: 'shopify.theme.toml',
        }
      })
      vi.mocked(ensureThemeStore).mockImplementation(({store}) => store ?? '')
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'unconfigured',
        themePath: 'current/working/directory',
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(['--password', 'supplied-password'], CommandConfig)

      await command.run()

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(resolvedStore, 'supplied-password')
      expect(ensureThemeStore).toHaveBeenCalledOnce()
      expect(ensureThemeStore).toHaveBeenCalledWith({store: resolvedStore, remember: false})
      expect(command.commandCalls).toHaveLength(1)
      expect(command.commandCalls[0]).toMatchObject({
        flags: {password: 'supplied-password', store: resolvedStore},
        session: mockSession,
      })
    })

    test('noninteractive unconfigured resolution rejects before bootstrap or shared lifecycle work', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'unconfigured',
        themePath: 'current/working/directory',
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand([], CommandConfig)

      await expect(command.run()).rejects.toMatchObject({reason: 'unconfigured-project'})
      expect(bootstrapThemeAirlock).not.toHaveBeenCalled()
      expect(getThemeStore).not.toHaveBeenCalled()
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected batch with an invalid trust target rejects before shared lifecycle work', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'first.myshopify.com'})
        .mockResolvedValueOnce({store: 'second.myshopify.com'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'first', store: 'first.myshopify.com'}],
      })
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'second', store: 'other.myshopify.com'}],
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'first', '--environment', 'second'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toMatchObject({reason: 'invalid-batch'})
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected batch validates every trust target before projecting cached sessions', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'first.myshopify.com'})
        .mockResolvedValueOnce({store: 'second.myshopify.com'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'first', store: 'first.myshopify.com'}],
      })
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'second', store: 'other.myshopify.com'}],
      })
      vi.mocked(listCurrentStoredStoreAppSessions).mockReturnValue([
        {
          store: 'first.myshopify.com',
          clientId: 'store-auth-client-id',
          userId: 'preview:123',
          accessToken: 'shpat_preview_token',
          scopes: [],
          acquiredAt: '2026-06-08T11:00:00.000Z',
        },
      ])

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'first', '--environment', 'second'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toMatchObject({reason: 'invalid-batch'})
      expect(listCurrentStoredStoreAppSessions).not.toHaveBeenCalled()
      expect(setLastSeenUserId).not.toHaveBeenCalled()
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    })

    test('protected batch reuses a newly authenticated session for the same normalized store and password', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'STORE.myshopify.com', password: 'same-password'})
        .mockResolvedValueOnce({store: 'store.myshopify.com', password: 'same-password'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [
          {name: 'first', store: 'store.myshopify.com'},
          {name: 'second', store: 'store.myshopify.com'},
        ],
      })
      vi.mocked(ensureThemeStore).mockImplementation((options: any) => options.store)
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store, password) => ({
        token: password ?? '',
        storeFqdn: store,
      }))
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommandWithForce(
        ['--environment', 'first', '--environment', 'second', '--force'],
        CommandConfig,
      )

      await command.run()

      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('store.myshopify.com', 'same-password')
      expect(command.commandCalls).toHaveLength(2)
      expect(command.commandCalls[0]?.session).toBe(command.commandCalls[1]?.session)
    })

    test('protected batch authenticates separately for distinct passwords on the same store', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store.myshopify.com', password: 'first-password'})
        .mockResolvedValueOnce({store: 'STORE.myshopify.com', password: 'second-password'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [
          {name: 'first', store: 'store.myshopify.com'},
          {name: 'second', store: 'store.myshopify.com'},
        ],
      })
      vi.mocked(ensureThemeStore).mockImplementation((options: any) => options.store)
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store, password) => ({
        token: password ?? '',
        storeFqdn: store,
      }))
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommandWithForce(
        ['--environment', 'first', '--environment', 'second', '--force'],
        CommandConfig,
      )

      await command.run()

      expect(ensureAuthenticatedThemes).toHaveBeenCalledTimes(2)
      expect(ensureAuthenticatedThemes).toHaveBeenNthCalledWith(1, 'store.myshopify.com', 'first-password')
      expect(ensureAuthenticatedThemes).toHaveBeenNthCalledWith(2, 'store.myshopify.com', 'second-password')
      expect(command.commandCalls[0]?.session).not.toBe(command.commandCalls[1]?.session)
    })

    test('protected batch throws the first command error after all concurrent groups finish', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store.myshopify.com'})
        .mockResolvedValueOnce({store: 'store.myshopify.com'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValue({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [
          {name: 'command-error', store: 'store.myshopify.com'},
          {name: 'development', store: 'store.myshopify.com'},
        ],
      })
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'command-error', '--environment', 'development'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toThrow('Environment command-error failed')
      expect(renderConcurrent).toHaveBeenCalledTimes(2)
      expect(command.commandCalls).toHaveLength(2)
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({body: ['Environment command-error failed: \n\nMocking a command error']}),
      )
      expect(addPublicMetadata).toHaveBeenCalled()
      expect(addSensitiveMetadata).toHaveBeenCalled()
    })

    test('protected batch with invalid required configuration rejects before confirmation even with force', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'first.myshopify.com', password: 'first-password'})
        .mockResolvedValueOnce({store: 'second.myshopify.com'})
      vi.mocked(loadThemeProjectTrust)
        .mockResolvedValueOnce({
          state: 'configured',
          themePath: 'current/working/directory',
          path: 'shopify.theme.toml',
          environments: [{name: 'first', store: 'first.myshopify.com'}],
        })
        .mockResolvedValueOnce({
          state: 'configured',
          themePath: 'current/working/directory',
          path: 'shopify.theme.toml',
          environments: [{name: 'missing', store: 'second.myshopify.com'}],
        })

      await CommandConfig.load()
      const command = new TestProtectedThemeCommandWithForce(
        ['--environment', 'first', '--environment', 'missing', '--force'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toMatchObject({reason: 'invalid-batch'})
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(ensureThemeStore).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected batch authentication failure starts no commands and skips preflight and rendering', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'first.myshopify.com'})
        .mockResolvedValueOnce({store: 'second.myshopify.com'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'first', store: 'first.myshopify.com'}],
      })
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'second', store: 'second.myshopify.com'}],
      })
      vi.mocked(ensureAuthenticatedThemes).mockRejectedValueOnce(new Error('authentication failed'))

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'first', '--environment', 'second'],
        CommandConfig,
      )

      await expect(command.run()).rejects.toThrow('authentication failed')
      expect(ensureThemeStore).toHaveBeenCalledTimes(1)
      expect(ensureThemeStore).toHaveBeenCalledWith({store: 'first.myshopify.com', remember: false})
      expect(ensureAuthenticatedThemes).toHaveBeenCalledOnce()
      expect(command.preflightTargets).toHaveLength(0)
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(0)
    })

    test('protected batch authentication does not remember stores', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'first.myshopify.com'})
        .mockResolvedValueOnce({store: 'second.myshopify.com'})
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'first', store: 'first.myshopify.com'}],
      })
      vi.mocked(loadThemeProjectTrust).mockResolvedValueOnce({
        state: 'configured',
        themePath: 'current/working/directory',
        path: 'shopify.theme.toml',
        environments: [{name: 'second', store: 'second.myshopify.com'}],
      })
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestProtectedThemeCommand(
        ['--environment', 'first', '--environment', 'second'],
        CommandConfig,
      )

      await command.run()

      expect(ensureThemeStore).toHaveBeenCalledTimes(2)
      expect(ensureThemeStore).toHaveBeenNthCalledWith(1, {store: 'first.myshopify.com', remember: false})
      expect(ensureThemeStore).toHaveBeenNthCalledWith(2, {store: 'second.myshopify.com', remember: false})
    })

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
        multiEnvironment: false,
        args: {},
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
        multiEnvironment: false,
        args: {},
        context: undefined,
      })
      const publicMetadata = vi.mocked(addPublicMetadata).mock.calls.map(([getMetadata]) => getMetadata())
      expect(publicMetadata).toContainEqual(
        expect.objectContaining({
          store_fqdn_hash: hashString(mockSession.storeFqdn),
          store_domain: mockSession.storeFqdn,
        }),
      )
      const sensitiveMetadata = vi.mocked(addSensitiveMetadata).mock.calls.map(([getMetadata]) => getMetadata())
      expect(sensitiveMetadata).toContainEqual({store_fqdn: mockSession.storeFqdn})
    })

    test('uses a matching store auth cache session when no password is provided', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: [],
        acquiredAt: '2026-06-08T11:00:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestThemeCommand([], CommandConfig)

      await command.run()

      expect(getCurrentStoredStoreAppSession).toHaveBeenCalledWith('test-store.myshopify.com')
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.commandCalls[0]).toMatchObject({
        session: {token: 'shpat_preview_token', storeFqdn: 'test-store.myshopify.com'},
      })
    })

    test('uses the password flag instead of a matching store auth cache session', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: [],
        acquiredAt: '2026-06-08T11:00:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestThemeCommand(['--password', 'shptka_password'], CommandConfig)

      await command.run()

      expect(getCurrentStoredStoreAppSession).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('test-store.myshopify.com', 'shptka_password')
      expect(command.commandCalls[0]).toMatchObject({session: mockSession})
    })

    test('falls back to theme authentication when no matching store auth cache session exists', async () => {
      await CommandConfig.load()
      const command = new TestThemeCommand([], CommandConfig)

      await command.run()

      expect(getCurrentStoredStoreAppSession).toHaveBeenCalledWith('test-store.myshopify.com')
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('test-store.myshopify.com', undefined)
      expect(command.commandCalls[0]).toMatchObject({session: mockSession})
    })

    test('checks required scopes from the stored session before using a matching store auth cache session', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: ['read_themes'],
        acquiredAt: '2026-06-08T11:00:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestScopedThemeCommand([], CommandConfig)

      await command.run()

      expect(getCurrentStoredStoreAppSession).toHaveBeenCalledWith('test-store.myshopify.com')
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.commandCalls[0]).toMatchObject({
        session: {token: 'shpat_preview_token', storeFqdn: 'test-store.myshopify.com'},
      })
    })

    test('treats a matching write scope in the stored session as satisfying a required read scope', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: ['write_themes'],
        acquiredAt: '2026-06-08T11:00:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestScopedThemeCommand([], CommandConfig)

      await command.run()

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.commandCalls[0]).toMatchObject({
        session: {token: 'shpat_preview_token', storeFqdn: 'test-store.myshopify.com'},
      })
    })

    test('uses a matching store auth cache session when stored scopes are empty', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: [],
        acquiredAt: '2026-06-08T11:00:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestScopedThemeCommand([], CommandConfig)

      await command.run()

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.commandCalls[0]).toMatchObject({
        session: {token: 'shpat_preview_token', storeFqdn: 'test-store.myshopify.com'},
      })
    })

    test('falls back to theme authentication when matching store auth session lacks required scopes', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: ['read_products'],
        acquiredAt: '2026-06-08T11:00:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestScopedThemeCommand([], CommandConfig)

      await command.run()

      expect(getCurrentStoredStoreAppSession).toHaveBeenCalledWith('test-store.myshopify.com')
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('test-store.myshopify.com', undefined)
      expect(command.commandCalls[0]).toMatchObject({session: mockSession})
    })

    test('does not check stored store auth cache session expiry', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue({
        store: 'test-store.myshopify.com',
        clientId: 'store-auth-client-id',
        userId: 'preview:123',
        accessToken: 'shpat_preview_token',
        scopes: ['read_themes'],
        acquiredAt: '2026-06-08T11:00:00.000Z',
        expiresAt: '2026-06-08T11:30:00.000Z',
      })

      await CommandConfig.load()
      const command = new TestScopedThemeCommand([], CommandConfig)

      await command.run()

      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.commandCalls[0]).toMatchObject({
        session: {token: 'shpat_preview_token', storeFqdn: 'test-store.myshopify.com'},
      })
    })

    test('rethrows unexpected store auth cache errors', async () => {
      vi.mocked(getCurrentStoredStoreAppSession).mockImplementationOnce(() => {
        throw new Error('cache read failed')
      })

      await CommandConfig.load()
      const command = new TestThemeCommand([], CommandConfig)

      await expect(command.run()).rejects.toThrow('cache read failed')
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    })

    test('single environment provided but not found in TOML - throws AbortError', async () => {
      // Given
      vi.mocked(loadEnvironment).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'notreal'], CommandConfig)

      // When/Then
      await expect(command.run()).rejects.toThrow('Please provide a valid environment.')
    })

    test('single environment provided without store - does not throw when store is not required', async () => {
      // Given
      const environmentConfig = {path: '/some/path'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)

      await CommandConfig.load()
      const command = new TestThemeCommandWithoutStoreRequired(['--environment', 'development'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(command.commandCalls).toHaveLength(1)
      expect(command.commandCalls[0]).toMatchObject({
        flags: {
          environment: ['development'],
          path: '/some/path',
        },
        session: undefined,
        multiEnvironment: false,
      })
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    })

    test('single environment provided with store - does not create session when command does not require auth', async () => {
      // Given
      const environmentConfig = {path: '/some/path', store: 'store.myshopify.com'}
      vi.mocked(loadEnvironment).mockResolvedValue(environmentConfig)

      await CommandConfig.load()
      const command = new TestThemeCommandWithoutStoreRequired(['--environment', 'development'], CommandConfig)

      // When
      await command.run()

      // Then
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(command.commandCalls).toHaveLength(1)
      expect(command.commandCalls[0]?.session).toBeUndefined()
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

    test('multiple environments provided - logs metadata for each authenticated session', async () => {
      // Given
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', development: true})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', theme: 'staging'})
      vi.mocked(ensureThemeStore).mockImplementation((options: any) => options.store)
      vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (store) => ({
        token: 'test-token',
        storeFqdn: store,
      }))
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })

      await CommandConfig.load()
      const command = new TestThemeCommand(['--environment', 'development', '--environment', 'staging'], CommandConfig)

      // When
      await command.run()

      // Then
      const publicMetadata = vi.mocked(addPublicMetadata).mock.calls.map(([getMetadata]) => getMetadata())
      expect(publicMetadata).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            store_fqdn_hash: hashString('store1.myshopify.com'),
            store_domain: 'store1.myshopify.com',
          }),
          expect.objectContaining({
            store_fqdn_hash: hashString('store2.myshopify.com'),
            store_domain: 'store2.myshopify.com',
          }),
        ]),
      )
      const sensitiveMetadata = vi.mocked(addSensitiveMetadata).mock.calls.map(([getMetadata]) => getMetadata())
      expect(sensitiveMetadata).toEqual(
        expect.arrayContaining([{store_fqdn: 'store1.myshopify.com'}, {store_fqdn: 'store2.myshopify.com'}]),
      )
    })

    test("throws an AbortError if the path doesn't exist", async () => {
      await CommandConfig.load()
      const command = new TestThemeCommand([], CommandConfig)

      vi.mocked(fileExistsSync).mockReturnValue(false)

      await expect(command.run()).rejects.toThrow('Path does not exist: current/working/directory')
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

    test('multiple environment commands accept missing password when a store auth cache session exists', async () => {
      const storeAuthSession = {token: 'shpat_preview_token', storeFqdn: 'store1.myshopify.com'}
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', path: '/home/path/to/theme1'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', password: 'password2', path: '/home/path/to/theme2'})
      vi.mocked(listCurrentStoredStoreAppSessions).mockReturnValue([
        {
          store: 'store1.myshopify.com',
          clientId: 'store-auth-client-id',
          userId: 'preview:123',
          accessToken: 'shpat_preview_token',
          scopes: [],
          acquiredAt: '2026-06-08T11:00:00.000Z',
        },
      ])
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
      vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
        for (const process of processes) {
          // eslint-disable-next-line no-await-in-loop
          await process.action({} as Writable, {} as Writable, {} as any)
        }
      })
      vi.mocked(ensureThemeStore).mockImplementation((options: any) => options.store)

      await CommandConfig.load()
      const command = new TestThemeCommandWithPathFlag(
        ['--environment', 'preview', '--environment', 'another-preview'],
        CommandConfig,
      )

      await command.run()

      expect(renderWarning).not.toHaveBeenCalled()
      expect(listCurrentStoredStoreAppSessions).toHaveBeenCalledOnce()
      expect(getCurrentStoredStoreAppSession).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).toHaveBeenCalledWith('store2.myshopify.com', 'password2')
      expect(command.commandCalls).toEqual(
        expect.arrayContaining([expect.objectContaining({session: storeAuthSession})]),
      )
    })

    test('multiple environment commands still require password when no store auth cache session exists', async () => {
      vi.mocked(loadEnvironment)
        .mockResolvedValueOnce({store: 'store1.myshopify.com', path: '/home/path/to/theme1'})
        .mockResolvedValueOnce({store: 'store2.myshopify.com', password: 'password2', path: '/home/path/to/theme2'})
      vi.mocked(renderConcurrent).mockResolvedValue(undefined)

      await CommandConfig.load()
      const command = new TestThemeCommandWithPathFlag(
        ['--environment', 'preview', '--environment', 'another-preview'],
        CommandConfig,
      )

      await command.run()

      expect(renderWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          body: ['Missing required flags in environment configuration for preview:', {list: {items: ['password']}}],
        }),
      )
      expect(renderConcurrent).not.toHaveBeenCalled()
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
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
