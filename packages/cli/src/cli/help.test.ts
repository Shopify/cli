import ShopifyHelp, {ShopifyCommandHelp} from './help.js'
import {CommandHelp, Help} from '@oclif/core'
import {describe, expect, test} from 'vitest'
import type {Command, Interfaces} from '@oclif/core'

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
  test('wraps prose and preserves indentation in fenced code blocks', () => {
    const description = renderDescription(
      {
        summary: 'Return a value.',
        description: `With \`--json\`, the command returns \`Result\`, described by these TypeScript types:

\`\`\`ts
interface Result {
  value: string
}
\`\`\``,
      },
      50,
    )

    expect(description).toBe(`Return a value.

With \`--json\`, the command returns \`Result\`,
described by these TypeScript types:

\`\`\`ts
interface Result {
  value: string
}
\`\`\``)
  })

  test('uses the default description formatting without generated JSON types', () => {
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
  test('is an oclif Help that renders command help with ShopifyCommandHelp', () => {
    // When
    const help = new ShopifyHelp({} as Interfaces.Config)

    // Then
    expect(help).toBeInstanceOf(Help)
    expect((help as unknown as {CommandHelpClass: unknown}).CommandHelpClass).toBe(ShopifyCommandHelp)
    expect(ShopifyCommandHelp.prototype).toBeInstanceOf(CommandHelp)
  })
})
