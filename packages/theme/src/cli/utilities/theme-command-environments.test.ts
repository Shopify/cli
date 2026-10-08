import ThemeCommand from './theme-command.js'
import {Config, Flags} from '@oclif/core'
import {FlagOutput} from '@shopify/cli-kit/node/base-command'
import {jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as pathUtilities from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderConcurrent, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderConfirmationPrompt: vi.fn(),
  renderConcurrent: vi.fn(async ({processes, abortSignal}) => {
    for (const processToRun of processes) {
      // eslint-disable-next-line no-await-in-loop
      await processToRun.action(process.stdout, process.stderr, abortSignal)
    }
  }),
}))

vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  terminalSupportsPrompting: vi.fn(() => false),
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

function environmentCommand(path: string) {
  class EnvironmentCommand extends ThemeCommand {
    static flags = {
      ...jsonFlag,
      environment: Flags.string({char: 'e', multiple: true, env: 'SHOPIFY_FLAG_ENVIRONMENT'}),
      path: Flags.string({default: path, env: 'SHOPIFY_FLAG_PATH'}),
      store: Flags.string({env: 'SHOPIFY_FLAG_STORE'}),
      theme: Flags.string({env: 'SHOPIFY_FLAG_THEME_ID'}),
      live: Flags.boolean({env: 'SHOPIFY_FLAG_LIVE'}),
      'allow-live': Flags.boolean({env: 'SHOPIFY_FLAG_ALLOW_LIVE'}),
    }

    static multiEnvironmentsFlags = ['store', ['theme', 'live']]

    static nonTTYFlagRequirements(flags: FlagOutput) {
      return [{flags: ['theme', 'live']}, ...(flags.live ? [{flags: ['allow-live']}] : [])]
    }

    calls: FlagOutput[] = []

    async command(flags: FlagOutput) {
      this.calls.push(flags)
    }
  }
  return EnvironmentCommand
}

test.each([
  {confirmed: false, force: false, expectedCalls: 0},
  {confirmed: true, force: false, expectedCalls: 1},
  {confirmed: false, force: true, expectedCalls: 1},
])('confirms a single collected environment before execution: %j', async ({confirmed, force, expectedCalls}) => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  await inTemporaryDirectory(async (path) => {
    await writeFile(
      joinPath(path, 'shopify.theme.toml'),
      '[environments.a]\nstore = "a.myshopify.com"\ntheme = "123"\n',
    )
    class CollectedCommand extends environmentCommand(path) {
      static flags = {...super.flags, force: Flags.boolean()}

      protected collectsEnvironmentResults() {
        return true
      }

      protected renderEnvironmentResults() {}
    }
    const config = new Config({root: __dirname})
    await config.load()
    const command = new CollectedCommand(['--environment', 'a', '--json', ...(force ? ['--force'] : [])], config)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)

    await command.run()

    expect(renderConfirmationPrompt).toHaveBeenCalledTimes(force ? 0 : 1)
    expect(command.calls).toHaveLength(expectedCalls)
  })
})

test.each([
  {value: '123', expected: '123'},
  {value: '[123, 456]', expected: ['123', '456']},
])('normalizes numeric environment theme selectors: $value', async ({value, expected}) => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(
      joinPath(path, 'shopify.theme.toml'),
      `[environments.a]\nstore = "a.myshopify.com"\ntheme = ${value}\n`,
    )
    class CollectedCommand extends environmentCommand(path) {
      protected collectsEnvironmentResults() {
        return true
      }

      protected renderEnvironmentResults() {}
    }
    const config = new Config({root: __dirname})
    await config.load()
    const command = new CollectedCommand(['--json', '-e', 'a'], config)

    await command.run()

    expect(command.calls).toEqual([expect.objectContaining({theme: expected})])
  })
})

test('returns environment validation errors without prompting when input is unavailable', async () => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
  const previousExitCode = process.exitCode
  try {
    await inTemporaryDirectory(async (path) => {
      await writeFile(
        joinPath(path, 'shopify.theme.toml'),
        '[environments.a]\nstore = "a.myshopify.com"\ntheme = "123"\n',
      )
      class CollectedCommand extends environmentCommand(path) {
        static flags = {...super.flags, force: requiredIfNonInteractive(Flags.boolean())}

        renderEnvironmentResults = vi.fn()

        protected collectsEnvironmentResults() {
          return true
        }
      }
      const config = new Config({root: __dirname})
      await config.load()
      const command = new CollectedCommand(['--json', '-e', 'a'], config)

      await command.run()

      expect(renderConfirmationPrompt).not.toHaveBeenCalled()
      expect(command.calls).toEqual([])
      expect(command.renderEnvironmentResults).toHaveBeenCalledWith([
        {environment: 'a', error: {type: 'abort', message: expect.stringContaining('--force')}},
      ])
      expect(process.exitCode).toBe(1)
    })
  } finally {
    // eslint-disable-next-line require-atomic-updates
    process.exitCode = previousExitCode
  }
})

test.each([
  {argv: [], collected: false},
  {argv: ['--environment', 'default'], collected: true},
  {argv: ['--environment=default'], collected: true},
  {argv: ['-e', 'default'], collected: true},
  {argv: ['-edefault'], collected: true},
])('only collects explicitly requested environments: %j', async ({argv, collected}) => {
  vi.stubEnv('SHOPIFY_FLAG_ENVIRONMENT', '')
  await inTemporaryDirectory(async (path) => {
    await writeFile(
      joinPath(path, 'shopify.theme.toml'),
      '[environments.default]\nstore = "a.myshopify.com"\ntheme = "123"\n',
    )
    class CollectedCommand extends environmentCommand(path) {
      renderEnvironmentResults = vi.fn()

      protected collectsEnvironmentResults() {
        return true
      }
    }
    const config = new Config({root: __dirname})
    await config.load()
    const command = new CollectedCommand(['--json', ...argv], config)

    await command.run()

    expect(command.calls).toHaveLength(1)
    expect(command.calls[0]?.theme).toBe('123')
    expect(command.renderEnvironmentResults).toHaveBeenCalledTimes(collected ? 1 : 0)
  })
})

test.each([false, true])(
  'validates configured theme selectors after loading every environment (json: %s)',
  async (json) => {
    vi.stubEnv('CI', '1')
    await inTemporaryDirectory(async (path) => {
      await writeFile(
        joinPath(path, 'shopify.theme.toml'),
        '[environments.a]\nstore = "a.myshopify.com"\ntheme = "123"\n[environments.b]\nstore = "b.myshopify.com"\ntheme = "456"\n',
      )
      const TestCommand = environmentCommand(path)
      const config = new Config({root: __dirname})
      await config.load()
      const command = new TestCommand(['--environment', 'a', '--environment', 'b', ...(json ? ['--json'] : [])], config)

      await command.run()

      expect(command.calls.map((flags) => flags.theme)).toEqual(['123', '456'])
    })
  },
)

test.each([['a'], ['a', 'b']])(
  'requires explicit paths only for multiple environments: %j',
  async (...environments) => {
    const previousExitCode = process.exitCode
    try {
      await inTemporaryDirectory(async (path) => {
        await writeFile(
          joinPath(path, 'shopify.theme.toml'),
          '[environments.a]\nstore = "a.myshopify.com"\ntheme = "123"\n[environments.b]\nstore = "b.myshopify.com"\ntheme = "456"\n',
        )
        class CollectedCommand extends environmentCommand(path) {
          static multiEnvironmentsFlags = [...super.multiEnvironmentsFlags, 'path']

          renderEnvironmentResults = vi.fn()

          protected collectsEnvironmentResults() {
            return true
          }
        }
        const config = new Config({root: __dirname})
        await config.load()
        const command = new CollectedCommand(['--json', ...environments.flatMap((name) => ['-e', name])], config)

        await command.run()

        if (environments.length === 1) {
          expect(command.calls).toEqual([expect.objectContaining({path})])
        } else {
          expect(command.calls).toEqual([])
          expect(command.renderEnvironmentResults).toHaveBeenCalledWith(
            environments.map((environment) => ({environment, error: {type: 'abort', message: 'Missing flags: path'}})),
          )
        }
      })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      process.exitCode = previousExitCode
    }
  },
)

test('loads a named environment for JSON commands without a result schema', async () => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(
      joinPath(path, 'shopify.theme.toml'),
      '[environments.a]\nstore = "a.myshopify.com"\ntheme = "123"\n',
    )
    const TestCommand = environmentCommand(path)
    const config = new Config({root: __dirname})
    await config.load()
    const command = new TestCommand(['--environment', 'a', '--json'], config)

    await command.run()

    expect(command.calls).toEqual([expect.objectContaining({store: 'a.myshopify.com', theme: '123'})])
  })
})

test('checks conditional safety flags in every environment before running any command', async () => {
  vi.stubEnv('CI', '1')
  await inTemporaryDirectory(async (path) => {
    await writeFile(
      joinPath(path, 'shopify.theme.toml'),
      '[environments.a]\nstore = "a.myshopify.com"\ntheme = "123"\n[environments.b]\nstore = "b.myshopify.com"\nlive = true\n',
    )
    const TestCommand = environmentCommand(path)
    const config = new Config({root: __dirname})
    await config.load()
    const command = new TestCommand(['--environment', 'a', '--environment', 'b'], config)

    await expect(command.run()).rejects.toThrow('--allow-live')
    expect(command.calls).toEqual([])
    expect(renderConcurrent).not.toHaveBeenCalled()
  })
})

test('keeps noninteractive validation for commands that parse flags in their own runner', async () => {
  vi.stubEnv('CI', '1')
  class CommandWithOwnRunner extends ThemeCommand {
    static flags = {
      environment: Flags.string({multiple: true, env: 'SHOPIFY_FLAG_ENVIRONMENT'}),
      theme: requiredIfNonInteractive(Flags.string({env: 'SHOPIFY_FLAG_THEME_ID'})),
    }

    async run() {
      await this.parse(CommandWithOwnRunner)
    }
  }
  const config = new Config({root: __dirname})
  await config.load()
  const command = new CommandWithOwnRunner(['--environment', 'a', '--environment', 'b'], config)

  await expect(command.run()).rejects.toThrow('--theme')
})

test.each([false, true])(
  'rejects global --path with recovery advice when the config file exists: %s',
  async (configExists) => {
    await inTemporaryDirectory(async (path) => {
      if (configExists) {
        await writeFile(joinPath(path, 'shopify.theme.toml'), '')
      }
      const cwdSpy = vi.spyOn(pathUtilities, 'cwd').mockReturnValue(path)
      try {
        const TestCommand = environmentCommand(path)
        const config = new Config({root: __dirname})
        await config.load()
        const command = new TestCommand(['--environment', 'a', '--environment', 'b', '--path', path], config)

        const runningCommand = command.run()
        await expect(runningCommand).rejects.toBeInstanceOf(AbortError)
        await expect(runningCommand).rejects.toMatchObject({
          message: "Can't use `--path` flag with multiple environments.",
          tryMessage: configExists
            ? "Configure each environment's theme path in your shopify.theme.toml file instead."
            : 'Run this command from the directory containing shopify.theme.toml. No shopify.theme.toml found in current directory.',
        })
      } finally {
        cwdSpy.mockRestore()
      }
    })
  },
)
