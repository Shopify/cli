import {ensureReplEnv, evaluateConsoleInputs, initializeRepl} from '../../services/console.js'
import {loadConsoleInputs} from '../../services/console/input.js'
import {themeConsoleJsonOutputSchema} from '../../services/console/types.js'
import {presentValue} from '../../utilities/repl/presenter.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {InferredFlags} from '@oclif/core/interfaces'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError} from '@shopify/cli-kit/node/ui'

type ConsoleFlags = InferredFlags<typeof Console.flags>

export default class Console extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeConsoleJsonOutputSchema
  }

  static summary = 'Shopify Liquid REPL (read-eval-print loop) tool'

  static usage = ['theme console', 'theme console --url /products/classic-leather-jacket']

  static descriptionWithMarkdown = `Starts the Shopify Liquid REPL (read-eval-print loop) tool. This tool provides an interactive terminal interface for evaluating Liquid code and exploring Liquid objects, filters, and tags using real store data.

You can also provide context to the console using a URL, as some Liquid objects are context-specific.

Use repeatable \`--input\` flags or \`--input-file\` to evaluate commands sequentially in one session and exit. Input files contain one console command per line; blank lines are ignored. Stop at the first error and skip remaining commands.

\`--json\` requires \`--input\` or \`--input-file\` and returns one object with ordered results. Use \`--no-input\` as well to prevent authentication and password prompts.`

  static examples = [
    '<%= config.bin %> <%= command.id %> --store example --input "shop.name" --input "shop.currency" --json --no-input',
    '<%= config.bin %> <%= command.id %> --store example --input-file ./commands.txt --json --no-input',
  ]

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
    input: Flags.string({
      description: 'Liquid command to evaluate. Repeat to run commands in order and exit.',
      multiple: true,
      multipleNonGreedy: true,
      exclusive: ['input-file'],
      env: 'SHOPIFY_FLAG_INPUT',
    }),
    'input-file': Flags.string({
      description: 'File containing one Liquid command per line. Evaluates the commands and exits.',
      exclusive: ['input'],
      env: 'SHOPIFY_FLAG_INPUT_FILE',
    }),
    url: Flags.string({
      description: 'The url to be used as context',
      env: 'SHOPIFY_FLAG_URL',
      default: '/',
    }),
    'store-password': Flags.string({
      description: 'The password for storefronts with password protection.',
      env: 'SHOPIFY_FLAG_STORE_PASSWORD',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: ConsoleFlags, adminSession: AdminSession, multiEnvironment = false) {
    const {url, password: themeAccessPassword} = flags
    const inputs = await loadConsoleInputs(flags.input, flags['input-file'])

    const {themeId, storePassword} = await ensureReplEnv(adminSession, flags['store-password'])

    recordEvent('theme-command:console:single-env:authenticated')

    if (inputs === undefined) {
      await initializeRepl(adminSession, themeId, url, themeAccessPassword, storePassword)
      return
    }

    const result = await evaluateConsoleInputs({
      inputs,
      adminSession,
      themeId,
      url,
      themeAccessPassword,
      storefrontPassword: storePassword,
    })
    if (result.status === 'partial') process.exitCode = 1
    if (flags.json && multiEnvironment) return result
    if (flags.json) {
      outputResult(themeConsoleJsonOutputSchema.encode(result))
    } else {
      for (const entry of result.results) {
        if (entry.status === 'success') presentValue(entry.value)
        if (entry.status === 'failed') renderError({body: entry.error.message})
      }
    }
  }

  protected validateCommandFlags(flags: ConsoleFlags): void {
    if (flags.json && !flags.input?.length && !flags['input-file']) {
      throw new AbortError('Use --input or --input-file with --json to supply Liquid commands.')
    }
    if (flags.input?.some((input) => input.trim().length === 0)) {
      throw new AbortError('Each --input must contain a Liquid command.')
    }
  }
}
