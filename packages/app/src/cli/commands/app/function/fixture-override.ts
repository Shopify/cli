import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {createFixtureWithOverrides} from '../../../utilities/fixture-override.js'
import {Flags} from '@oclif/core'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import {renderTextPrompt, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import {existsSync, readdirSync} from 'fs'

export default class FunctionFixtureOverride extends AppLinkedCommand {
  static description = 'Create a new fixture by overriding values from an existing one'

  static descriptionWithoutMarkdown(): string | undefined {
    return 'Create a new fixture by overriding values from an existing one'
  }

  static analyticsNameOverride(): string | undefined {
    return 'app function fixture-override'
  }

  static analyticsStopCommand(): string | undefined {
    return undefined
  }

  static flags = {
    help: Flags.help({char: 'h'}),
    path: Flags.string({
      char: 'p',
      description: 'Path to the function extension',
      required: true,
    }),
    source: Flags.string({
      char: 's',
      description: 'Source fixture name (without .json extension)',
    }),
    target: Flags.string({
      char: 't',
      description: 'Target fixture name (without .json extension)',
    }),
    overrides: Flags.string({
      char: 'o',
      description: 'JSON string of overrides (e.g., \'{"input.cart.lines.0.quantity": 5}\')',
    }),
    config: Flags.string({
      char: 'c',
      description: 'Path to JSON config file containing source, target, and overrides',
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Run in interactive mode to build overrides step by step',
      default: false,
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionFixtureOverride)

    // Validate the function extension exists
    const functionPath = flags.path
    if (!existsSync(functionPath)) {
      this.error(`Function path does not exist: ${functionPath}`)
    }

    const testsDir = joinPath(functionPath, 'tests')
    const fixturesDir = joinPath(testsDir, 'fixtures')

    if (!existsSync(testsDir)) {
      this.error(`Tests directory not found. Run 'shopify app function testgen' first to create test fixtures.`)
    }

    if (!existsSync(fixturesDir)) {
      this.error(`Fixtures directory not found. Run 'shopify app function testgen' first to create test fixtures.`)
    }

    // Get available fixtures
    const fixtureFiles = readdirSync(fixturesDir)
      .filter((file: string) => file.endsWith('.json'))
      .map((file: string) => file.replace('.json', ''))

    if (fixtureFiles.length === 0) {
      this.error(`No fixtures found. Run 'shopify app function testgen' first to create test fixtures.`)
    }

    // Load config from file if provided
    let sourceFixture: string | undefined
    let targetFixture: string | undefined
    let overrides: {[key: string]: unknown} = {}

    if (flags.config) {
      try {
        const configContent = await readFile(flags.config, {encoding: 'utf-8'})
        const config = JSON.parse(configContent)

        if (!config.source || !config.target) {
          this.error('Config file must contain "source" and "target" properties')
        }

        sourceFixture = config.source
        targetFixture = config.target
        overrides = config.overrides || {}

        outputInfo(`📁 Loaded config from: ${flags.config}`)
        outputInfo(`Source: ${sourceFixture}`)
        outputInfo(`Target: ${targetFixture}`)
        outputInfo(`Overrides: ${Object.keys(overrides).length} items`)
      } catch (error) {
        this.error(`Failed to load config file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      // Select source fixture
      sourceFixture = flags.source
      if (!sourceFixture) {
        sourceFixture = await renderSelectPrompt({
          message: 'Select the source fixture to override:',
          choices: fixtureFiles.map((name) => ({label: name, value: name})),
        })
      }

      // Get target fixture name
      targetFixture = flags.target
      if (!targetFixture) {
        targetFixture = await renderTextPrompt({
          message: 'What would you like to name the new fixture?',
          defaultValue: `${sourceFixture}_override`,
          validate: (value: string) => {
            if (!value.trim()) return 'Fixture name cannot be empty'
            if (fixtureFiles.includes(value)) return `Fixture '${value}' already exists`
            return undefined
          },
        })
      }

      // Get overrides
      if (flags.overrides) {
        try {
          overrides = JSON.parse(flags.overrides)
        } catch (error) {
          this.error(`Invalid JSON in overrides flag: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      } else if (flags.interactive) {
        overrides = await this.buildOverridesInteractively()
      } else {
        // Show example and ask for overrides
        outputInfo("No overrides provided. Here's an example of how to use this command:")
        outputInfo('')
        outputInfo(
          'shopify app function fixture-override --path ./my-function --overrides \'{"input.cart.lines.0.quantity": 5}\'',
        )
        outputInfo('')
        outputInfo('Or use --config flag with a JSON file:')
        outputInfo('shopify app function fixture-override --path ./my-function --config ./fixture-config.json')
        outputInfo('')
        outputInfo('Or use --interactive flag to build overrides step by step.')
        outputInfo('')
      }
    }

    if (!sourceFixture || !fixtureFiles.includes(sourceFixture)) {
      this.error(`Source fixture '${sourceFixture}' not found. Available fixtures: ${fixtureFiles.join(', ')}`)
    }

    if (!targetFixture) {
      this.error('Target fixture name is required')
    }

    // Create the new fixture
    const sourceFixturePath = joinPath(fixturesDir, `${sourceFixture}.json`)
    const targetFixturePath = joinPath(fixturesDir, `${targetFixture}.json`)

    try {
      await createFixtureWithOverrides(sourceFixturePath, targetFixturePath, overrides, targetFixture)

      outputSuccess(`✅ Created new fixture: ${targetFixture}.json`)
      outputInfo(`Source: ${sourceFixture}.json`)
      outputInfo(`Overrides applied: ${Object.keys(overrides).length}`)

      if (Object.keys(overrides).length > 0) {
        outputInfo('Overrides:')
        for (const [path, value] of Object.entries(overrides)) {
          outputInfo(`  ${path}: ${JSON.stringify(value)}`)
        }
      }
    } catch (error) {
      this.error(`Failed to create fixture: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Return a mock app object since this command doesn't actually need an app
    return {app: {} as unknown}
  }

  private async buildOverridesInteractively(): Promise<{[key: string]: unknown}> {
    const overrides: {[key: string]: unknown} = {}

    outputInfo('Building overrides interactively. Enter the path and value for each override.')
    outputInfo('Use dot notation for nested paths (e.g., input.cart.lines.0.quantity)')
    outputInfo('Press Enter without a path to finish.')
    outputInfo('')

    while (true) {
      const path = await renderTextPrompt({
        message: 'Enter the path to override (or press Enter to finish):',
        validate: (value: string) => {
          if (value.trim() === '') return undefined
          if (!value.includes('.')) return 'Path should use dot notation (e.g., input.cart.lines.0.quantity)'
          return undefined
        },
      })

      if (!path.trim()) {
        break
      }

      const valueStr = await renderTextPrompt({
        message: `Enter the value for ${path}:`,
        validate: (value: string) => {
          if (!value.trim()) return 'Value cannot be empty'
          return undefined
        },
      })

      // Try to parse the value as JSON, fallback to string
      let value: unknown
      try {
        value = JSON.parse(valueStr)
      } catch {
        value = valueStr
      }

      overrides[path] = value
      outputInfo(`✅ Added override: ${path} = ${JSON.stringify(value)}`)
      outputInfo('')
    }

    return overrides
  }
}
