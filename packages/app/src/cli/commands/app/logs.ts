import {appFlags} from '../../flags.js'
import Command from '../../utilities/app-command.js'
import {logs} from '../../services/logs.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Logs extends Command {
  static summary = 'Stream detailed logs for your Shopify app.'

  static descriptionWithMarkdown = `
  Opens a real-time stream of detailed log events from the selected app and store. Use the \`--source\` argument to limit output to a particular log source, such as a Shopify Function or webhook topic. Use the \`sources\` subcommand to list available sources.

  The \`--json\` argument can be used to receive log entries as line-delimited JSON (JSONL). By piping the output to tools like \`jq\`, you can filter the output to specific information.

  \`\`\`
  shopify app logs --json
  \`\`\`
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    json: Flags.boolean({
      hidden: false,
      description: 'Print logs in JSON format.',
      env: 'SHOPIFY_FLAG_JSON',
      default: false,
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    source: Flags.string({
      hidden: false,
      description: 'Filters output to the specified log source (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_SOURCE',
    }),
    status: Flags.string({
      hidden: false,
      description: 'Filters output to the specified status (success or failure).',
      env: 'SHOPIFY_FLAG_STATUS',
    }),
    store: Flags.string({
      hidden: false,
      description: 'Filters output to the specified development store URL (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_STORE',
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Logs)

    await addPublicMetadata(() => ({
      cmd_logs_flag_json_used: Boolean(flags.json),
      cmd_app_reset_used: flags.reset,
      cmd_logs_flag_source_filter: flags.source,
      cmd_logs_flag_status_filter: flags.status,
      cmd_logs_flag_store_filter: flags.store,
    }))

    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await checkFolderIsValidApp(flags.path)

    const logOptions = {
      apiKey,
      json: flags.json,
      path: flags.path,
      store: flags.store,
      source: flags.source,
      status: flags.status,
    }

    await logs(logOptions)
  }
}
