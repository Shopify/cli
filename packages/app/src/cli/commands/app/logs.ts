import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class Logs extends Command {
  static hidden = true

  static strict = false

  static summary = 'App logs were removed in Shopify CLI 5.0.'

  static flags = {...globalFlags, ...jsonFlag}

  async run(): Promise<void> {
    // Skip parsing so legacy flags and the removed sources subcommand receive the migration guidance.
    throw new AbortError(
      '`shopify app logs` and `shopify app logs sources` were removed in Shopify CLI 5.0. ' +
        'To see Function logs, run `shopify app dev`.',
    )
  }
}
