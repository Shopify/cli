import ShopifyHelp, {ShopifyCommandHelp} from './help.js'
import {helpService} from './services/commands/help/index.js'
import {CommandHelp, Help} from '@oclif/core'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {afterEach, describe, expect, test, vi} from 'vitest'
import type {Command, Interfaces} from '@oclif/core'

vi.mock('./services/commands/help/index.js')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  terminalSupportsPrompting: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

const stripAnsi = (value: string) => value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '')

function renderFlags(flags: Command.Flag.Any[]): [string, string | undefined][] {
  const help = new ShopifyCommandHelp({} as Command.Loadable, {} as Interfaces.Config, {} as Interfaces.HelpOptions)
  // `flags()` is protected; reach in to exercise the unit directly.
  const rows = (
    help as unknown as {flags: (f: Command.Flag.Any[]) => [string, string | undefined][] | undefined}
  ).flags(flags)
  return (rows ?? []).map(([left, right]) => [stripAnsi(left), right === undefined ? undefined : stripAnsi(right)])
}

function renderDescription(command: Partial<Command.Loadable>, maxWidth = 80): string | undefined {
  const help = new ShopifyCommandHelp(
    command as Command.Loadable,
    {} as Interfaces.Config,
    {maxWidth} as Interfaces.HelpOptions,
  )
  return (help as unknown as {description: () => string | undefined}).description()
}

describe('ShopifyCommandHelp', () => {
  test('wraps prose without changing fenced code', () => {
    const description = renderDescription(
      {
        summary: 'Return a value.',
        description: `The result is represented by the following TypeScript type:

\`\`\`ts
interface Result {
  value: string
}
\`\`\``,
      },
      50,
    )

    expect(description).toBe(`Return a value.

The result is represented by the following
TypeScript type:

\`\`\`ts
interface Result {
  value: string
}
\`\`\``)
  })

  test('uses the default description formatting when there are no code blocks', () => {
    const command = {summary: 'Return a value.', description: 'A regular command description.'}
    const defaultHelp = new CommandHelp(
      command as Command.Loadable,
      {} as Interfaces.Config,
      {maxWidth: 80} as Interfaces.HelpOptions,
    )
    const defaultDescription = (defaultHelp as unknown as {description: () => string | undefined}).description()

    expect(renderDescription(command)).toBe(defaultDescription)
  })

  test('moves the env metadata to the end of a boolean flag description', () => {
    // Given
    const flags = [
      {
        name: 'json',
        char: 'j',
        type: 'boolean',
        env: 'SHOPIFY_FLAG_JSON',
        summary: 'Output the result as JSON.',
      } as Command.Flag.Any,
    ]

    // When
    const right = renderFlags(flags)[0]?.[1]

    // Then
    expect(right).toBe('Output the result as JSON.\n[env: SHOPIFY_FLAG_JSON]')
  })

  test('keeps default at the front and moves env to the end for option flags', () => {
    // Given
    const flags = [
      {
        name: 'name',
        type: 'option',
        env: 'SHOPIFY_FLAG_PREVIEW_STORE_NAME',
        default: 'my-store',
        summary: 'The name of the store.',
      } as Command.Flag.Any,
    ]

    // When
    const right = renderFlags(flags)[0]?.[1]

    // Then
    expect(right).toBe('[default: my-store] The name of the store.\n[env: SHOPIFY_FLAG_PREVIEW_STORE_NAME]')
  })

  test('leaves flags without an env untouched', () => {
    // Given
    const flags = [
      {
        name: 'verbose',
        type: 'boolean',
        summary: 'Increase the verbosity of the output.',
      } as Command.Flag.Any,
    ]

    // When
    const right = renderFlags(flags)[0]?.[1]

    // Then
    expect(right).toBe('Increase the verbosity of the output.')
  })

  test('uses the env label as the description when a flag has no summary', () => {
    // Given
    const flags = [
      {
        name: 'store',
        type: 'option',
        env: 'SHOPIFY_FLAG_STORE',
      } as Command.Flag.Any,
    ]

    // When
    const right = renderFlags(flags)[0]?.[1]

    // Then
    expect(right).toBe('[env: SHOPIFY_FLAG_STORE]')
  })

  test('renders flags with enough width to keep long env labels intact', () => {
    // Given
    const help = new ShopifyCommandHelp(
      {} as Command.Loadable,
      {} as Interfaces.Config,
      {maxWidth: 80} as Interfaces.HelpOptions,
    )
    const rows = [
      [
        '--skip-dependencies-installation',
        'Skips the installation of dependencies. Deprecated, use workspaces instead.\n[env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION]',
      ],
    ] as [string, string | undefined][]

    // When
    const output = stripAnsi(help.section('FLAGS', rows))

    // Then
    expect(output).toContain('[env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION]')
    expect(output).not.toContain('[env:\n')
    expect(output).not.toContain('SHOPIFY_FLAG_SKIP_DEPENDENCIES_INS\n')
  })
})

describe('ShopifyHelp', () => {
  class CapturingHelp extends ShopifyHelp {
    output = ''

    // Oclif's README generator calls this protected method from JavaScript.
    formatCommand(command: Command.Loadable): string {
      return super.formatCommand(command)
    }

    protected log(...args: string[]): void {
      this.output += `${args.join(' ')}\n`
    }
  }

  function commandWithSchema(): Command.Loadable {
    class ExampleCommand extends BaseCommand {
      static descriptionWithMarkdown = 'Return a value.\n\n```json\n{"example": true}\n```'

      static get jsonOutputSchema() {
        return defineJsonOutputSchema({name: 'ExampleResult', schema: zod.object({value: zod.string()})})
      }

      async run(): Promise<void> {}
    }

    return {
      id: 'example',
      aliases: [],
      args: {},
      flags: {},
      description: ExampleCommand.descriptionForHelp(),
    } as unknown as Command.Loadable
  }

  function helpForCommand(command: Command.Loadable): CapturingHelp {
    return new CapturingHelp(
      {
        bin: 'shopify',
        topicSeparator: ':',
        commands: [command],
        topics: [],
        plugins: new Map(),
      } as unknown as Interfaces.Config,
      {maxWidth: 120, stripAnsi: true},
    )
  }

  test.each([true, false])(
    'shows the inline schema only in non-interactive help (interactive: %s)',
    async (interactive) => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(interactive)
      const command = commandWithSchema()
      const originalDescription = command.description
      const help = helpForCommand(command)

      await help.showCommandHelp(command)

      expect(help.output).toContain('Use `--json-schema` to print the result, error, and event schemas.')
      expect(help.output.includes('Output from `--json` conforms to the `ExampleResult` schema.')).toBe(!interactive)
      expect(help.output).toContain('{"example": true}')
      expect(help.output.includes('"title": "ExampleResult"')).toBe(!interactive)
      expect(command.description).toBe(originalDescription)
    },
  )

  test('keeps schemas in generated documentation even after displaying interactive help', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    const command = commandWithSchema()
    const help = helpForCommand(command)

    await help.showCommandHelp(command)
    const documentation = help.formatCommand(command)

    expect(documentation).toContain(
      'Use `--json-schema` to print the result, error, and event schemas.\n\n' +
        '  Output from `--json` conforms to the `ExampleResult` schema.',
    )
    expect(documentation).toContain('"title": "ExampleResult"')
  })

  test('preserves interactive help for commands without schemas', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    const command = {...commandWithSchema(), description: 'Return a value.\n\n```json\n{"example": true}\n```'}
    const help = helpForCommand(command)

    await help.showCommandHelp(command)

    expect(help.output).toContain('{"example": true}')
  })

  test.each([
    {argv: ['version', '--help', '--json'], environment: ''},
    {argv: ['--json', 'version', '--help'], environment: ''},
    {argv: ['version', '--help', '-j'], environment: ''},
    {argv: ['version', '--help'], environment: '1'},
  ])('uses the JSON presenter for %j', async ({argv, environment}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', environment)
    vi.mocked(helpService).mockResolvedValue({kind: 'root', commands: [], topics: []})
    const output = mockAndCaptureOutput()
    const config = {} as Interfaces.Config
    const help = new ShopifyHelp(config, {all: true})

    await help.showHelp(argv)

    expect(helpService).toHaveBeenCalledWith(config, ['version', '--help'], true)
    expect(JSON.parse(output.output())).toEqual({kind: 'root', commands: [], topics: []})
    expect(output.warn()).toBe('')
  })

  test.each([
    ['version', '--help'],
    ['version', '--help', '--', '--json'],
  ])('preserves text help for %j', async (...argv) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '')
    const showHelp = vi.spyOn(Help.prototype, 'showHelp').mockResolvedValue()
    const help = new ShopifyHelp({} as Interfaces.Config)

    await help.showHelp(argv)

    expect(showHelp).toHaveBeenCalledWith(argv)
    expect(helpService).not.toHaveBeenCalled()
  })

  test('is an oclif Help that renders command help with ShopifyCommandHelp', () => {
    // When
    const help = new ShopifyHelp({} as Interfaces.Config)

    // Then
    expect(help).toBeInstanceOf(Help)
    expect((help as unknown as {CommandHelpClass: unknown}).CommandHelpClass).toBe(ShopifyCommandHelp)
    expect(ShopifyCommandHelp.prototype).toBeInstanceOf(CommandHelp)
  })
})
