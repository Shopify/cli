import {themeFlags} from '../../flags.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {ensureReplEnv, initializeRepl} from '../../services/console.js'
import {validateThemePassword} from '../../services/flags-validation.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {InferredFlags} from '@oclif/core/interfaces'

type ConsoleFlags = InferredFlags<typeof Console.flags>

export default class Console extends ThemeCommand {
  static summary = 'Shopify Liquid REPL (read-eval-print loop) tool'

  static usage = ['theme console', 'theme console --url /products/classic-leather-jacket']

  static descriptionWithMarkdown = `Starts the Shopify Liquid REPL (read-eval-print loop) tool. This tool provides an interactive terminal interface for evaluating Liquid code and exploring Liquid objects, filters, and tags using real store data.

  You can also provide context to the console using a URL, as some Liquid objects are context-specific`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
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

  async command(flags: ConsoleFlags, adminSession: AdminSession) {
    const {url, password: themeAccessPassword} = flags

    validateThemePassword(themeAccessPassword)

    const {themeId, storePassword} = await ensureReplEnv(adminSession, flags['store-password'])

    recordEvent('theme-command:console:single-env:authenticated')

    await initializeRepl(adminSession, themeId, url, themeAccessPassword, storePassword)
  }
}
