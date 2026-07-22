import Wizard, {BROWSE_BY_TOPIC} from './wizard.js'
import {Command, Config} from '@oclif/core'
import {
  renderAutocompletePrompt,
  renderConfirmationPrompt,
  renderMultiSelectPrompt,
  renderSelectPrompt,
  renderTextPrompt,
} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/system')

interface FakeCommandSpec {
  id: string
  summary?: string
  hidden?: boolean
  args?: {[name: string]: unknown}
  flags?: {[name: string]: unknown}
}

function buildConfig(specs: FakeCommandSpec[], topics: {name: string; hidden?: boolean}[] = []) {
  const commands = specs.map((spec) => ({
    id: spec.id,
    summary: spec.summary,
    hidden: spec.hidden ?? false,
    load: async () => ({args: spec.args ?? {}, flags: spec.flags ?? {}}) as unknown as Command.Class,
  }))

  return {
    bin: 'shopify',
    commands,
    topics,
    findCommand: (id: string) => commands.find((command) => command.id === id),
    runCommand: vi.fn(async () => undefined),
    // `this.parse(Wizard)` runs oclif's parse, which fires the `preparse` hook.
    runHook: async () => ({successes: [], failures: []}),
  }
}

function buildWizard(config: ReturnType<typeof buildConfig>): Wizard {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  return new Wizard([], config as unknown as Config)
}

describe('Wizard', () => {
  test('fails fast when the terminal does not support prompting', async () => {
    // Given
    const config = buildConfig([{id: 'version', summary: 'Version'}])
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
    const wizard = new Wizard([], config as unknown as Config)

    // When / Then
    await expect(wizard.run()).rejects.toThrow(/interactive/)
    expect(config.runCommand).not.toHaveBeenCalled()
  })

  test('hands off with the chosen id and no tokens for a parameter-less command', async () => {
    // Given
    const config = buildConfig([{id: 'version', summary: 'Version'}])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('version')
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then
    expect(config.runCommand).toHaveBeenCalledWith('version', [])
  })

  test('collects required and optional flags, then hands off the assembled tokens', async () => {
    // Given
    const config = buildConfig([
      {
        id: 'app:dev',
        summary: 'Run the app',
        flags: {
          store: {type: 'option', required: true, description: 'Store'},
          reset: {type: 'boolean', description: 'Reset'},
          path: {type: 'option', description: 'Path'},
        },
      },
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('app:dev')
    // First text prompt: required `store`; second: optional `path`.
    vi.mocked(renderTextPrompt).mockResolvedValueOnce('my-store').mockResolvedValueOnce('./foo')
    // First confirmation: "set optional flags?"; second: "run this command?".
    vi.mocked(renderConfirmationPrompt).mockResolvedValueOnce(true).mockResolvedValueOnce(true)
    vi.mocked(renderMultiSelectPrompt).mockResolvedValue(['reset', 'path'])
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then
    expect(config.runCommand).toHaveBeenCalledWith('app:dev', ['--store', 'my-store', '--reset', '--path', './foo'])
  })

  test('supports browsing by topic as a fallback to searching', async () => {
    // Given
    const config = buildConfig([{id: 'theme:dev', summary: 'Run the theme'}], [{name: 'theme'}])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(BROWSE_BY_TOPIC)
    // First select: the topic; second select: the command within it.
    vi.mocked(renderSelectPrompt).mockResolvedValueOnce('theme').mockResolvedValueOnce('theme:dev')
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then
    expect(config.runCommand).toHaveBeenCalledWith('theme:dev', [])
  })

  test('uses controlled, generic prompt messages that never echo a command description', async () => {
    // Given: a description with forbidden wording and trailing punctuation.
    const config = buildConfig([
      {
        id: 'app:deploy',
        summary: 'Deploy',
        flags: {target: {type: 'option', required: true, description: 'Select the target environment.'}},
      },
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('app:deploy')
    vi.mocked(renderTextPrompt).mockResolvedValue('production')
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then: the prompt message is generic — no injected description, forbidden
    // word, or trailing period.
    const message = vi.mocked(renderTextPrompt).mock.calls[0]?.[0]?.message
    expect(message).toBe('Value for --target:')
    expect(message).not.toContain('Select')
    expect(message).not.toContain('environment')
  })

  test('fills an exactlyOne group by prompting for exactly one member', async () => {
    // Given
    const config = buildConfig([
      {
        id: 'store:query',
        summary: 'Query the store',
        flags: {
          query: {type: 'option', exactlyOne: ['query', 'query-file'], description: 'Inline query'},
          'query-file': {type: 'option', exactlyOne: ['query', 'query-file'], description: 'Query file'},
        },
      },
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('store:query')
    // The group's "provide one of these" select resolves to `query`.
    vi.mocked(renderSelectPrompt).mockResolvedValue('query')
    vi.mocked(renderTextPrompt).mockResolvedValue('SELECT 1')
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then: exactly one member is emitted; the other is excluded entirely.
    expect(config.runCommand).toHaveBeenCalledWith('store:query', ['--query', 'SELECT 1'])
  })

  test('fills an atLeastOne group with the chosen members', async () => {
    // Given
    const config = buildConfig([
      {
        id: 'store:bulk',
        summary: 'Bulk operation',
        flags: {
          one: {type: 'option', atLeastOne: ['one', 'two'], description: 'First'},
          two: {type: 'option', atLeastOne: ['one', 'two'], description: 'Second'},
        },
      },
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('store:bulk')
    // The group's at-least-one multi-select picks `one`.
    vi.mocked(renderMultiSelectPrompt).mockResolvedValue(['one'])
    vi.mocked(renderTextPrompt).mockResolvedValue('value-one')
    // Decline the optional step (`two` remains legitimately optional), then confirm.
    vi.mocked(renderConfirmationPrompt).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then
    expect(config.runCommand).toHaveBeenCalledWith('store:bulk', ['--one', 'value-one'])
  })

  test('emits the negated form for an optional negatable boolean set to no', async () => {
    // Given: a negatable boolean that defaults to true (eg `--watch`).
    const config = buildConfig([
      {
        id: 'app:function:replay',
        summary: 'Replay',
        flags: {watch: {type: 'boolean', allowNo: true, default: true, description: 'Watch'}},
      },
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('app:function:replay')
    // First confirmation: "set optional flags?" (yes); second: the negatable
    // follow-up "Use --watch?" (no); third: "run this command?" (yes).
    vi.mocked(renderConfirmationPrompt)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    vi.mocked(renderMultiSelectPrompt).mockResolvedValue(['watch'])
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then
    expect(config.runCommand).toHaveBeenCalledWith('app:function:replay', ['--no-watch'])
  })

  test('fails loudly when a required non-negatable boolean is answered no', async () => {
    // Given: a required boolean with no `--no-<name>` form, so "no" is unrepresentable.
    const config = buildConfig([
      {
        id: 'app:confirm',
        summary: 'Confirm',
        flags: {force: {type: 'boolean', required: true, description: 'Force'}},
      },
    ])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('app:confirm')
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const wizard = buildWizard(config)

    // When / Then
    await expect(wizard.run()).rejects.toThrow(/can only be turned on/)
    expect(config.runCommand).not.toHaveBeenCalled()
  })

  test('does not hand off when the user declines the confirmation', async () => {
    // Given
    const config = buildConfig([{id: 'version', summary: 'Version'}])
    vi.mocked(renderAutocompletePrompt).mockResolvedValue('version')
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const wizard = buildWizard(config)

    // When
    await wizard.run()

    // Then
    expect(config.runCommand).not.toHaveBeenCalled()
  })
})
