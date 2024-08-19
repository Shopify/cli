import Dev from './dev.js'
import Command from '../../utilities/app-command.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {logs, Format} from '../../services/logs.js'
import {appFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Logs extends Command {
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
    store: Dev.flags.store,
    reset: Dev.flags.reset,
    'no-tunnel': Dev.flags['no-tunnel'],
    'graphiql-port': Dev.flags['graphiql-port'],
    'graphiql-key': Dev.flags['graphiql-key'],
    'dev-preview': Dev.flags['dev-preview'],
    source: Flags.string({
      description: 'Filters output to the specified log source.',
      env: 'SHOPIFY_FLAG_SOURCE',
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

  public async run(): Promise<void> {
    const {flags} = await this.parse(Logs)

    const apiKey = flags['client-id'] || flags['api-key']

    const sources = flags.source?.split(',')

    await checkFolderIsValidApp(flags.path)
    const logOptions = {
      apiKey,
      directory: flags.path,
      storeFqdn: flags.store,
      sources,
      status: flags.status,
      configName: flags.config,
      reset: flags.reset,
      format: (flags.json ? 'json' : 'text') as Format,
    }

    await logs(logOptions)
  }
}
