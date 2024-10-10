import Dev from './dev.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {logs, Format} from '../../services/logs.js'
import {appFlags} from '../../flags.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Logs extends AppCommand {
  static summary = 'Stream detailed logs for your Shopify app.'

  static descriptionWithMarkdown = `
  Opens a real-time stream of detailed app logs from the selected app and store.
  Use the \`--source\` argument to limit output to a particular log source, such as a specific Shopify Function handle. Use the \`shopify app logs sources\` command to view a list of sources.
  Use the \`--status\` argument to filter on status, either \`success\` or \`failure\`.
  \`\`\`
  shopify app logs --status=success --source=extension.discount-function
  \`\`\`
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Dev.flags['api-key'],
    'client-id': Dev.flags['client-id'],
    store: Flags.string({
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      multiple: true,
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    reset: Dev.flags.reset,
    source: Flags.string({
      description: 'Filters output to the specified log source.',
      env: 'SHOPIFY_FLAG_SOURCE',
      multiple: true,
    }),
    status: Flags.string({
      description: 'Filters output to the specified status (success or failure).',
      options: ['success', 'failure'],
      env: 'SHOPIFY_FLAG_STATUS',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Log the run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Logs)

    const apiKey = flags['client-id'] || flags['api-key']

    await checkFolderIsValidApp(flags.path)
    const logOptions = {
      apiKey,
      directory: flags.path,
      storeFqdns: flags.store,
      sources: flags.source,
      status: flags.status,
      configName: flags.config,
      reset: flags.reset,
      format: (flags.json ? 'json' : 'text') as Format,
    }

    const app = await logs(logOptions)
    return {app}
  }
}
