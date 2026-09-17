import ThemeCommand from './theme-command.js'
import {Config, Flags} from '@oclif/core'
import {FlagOutput} from '@shopify/cli-kit/node/base-command'
import {jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as pathUtilities from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderConcurrent: vi.fn(async ({processes, abortSignal}) => {
    for (const processToRun of processes) {
      // eslint-disable-next-line no-await-in-loop
      await processToRun.action(process.stdout, process.stderr, abortSignal)
    }
  }),
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

function environmentCommand(path: string) {
  class EnvironmentCommand extends ThemeCommand {
    static flags = {
      ...jsonFlag,
      environment: Flags.string({multiple: true, env: 'SHOPIFY_FLAG_ENVIRONMENT'}),
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
