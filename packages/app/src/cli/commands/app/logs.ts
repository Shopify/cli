import Dev from './dev.js'
import Command from '../../utilities/app-command.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {logs} from '../../services/logs.js'
import {appLogPollingEnabled} from '../../services/app-logs/utils.js'
import {Flags} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class Logs extends Command {
  static hidden = true
  static summary = 'Stream detailed logs for your Shopify app.'

  static descriptionWithMarkdown = `
  Opens a real-time stream of detailed log events from the selected app and store.
  Use the \`--source\` argument to limit output to a particular function, such as a specific Shopify Function handle.
  Use the \`--status\` argument to specify the type of status to retrieve, either \`success\` or \`failure\`.
  \`\`\`
  shopify app logs --status=success --source=extension-handle
  \`\`\`
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...Dev.flags,
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
    if (!appLogPollingEnabled()) {
      throw new AbortError(
        'This command is not released yet. You can experiment with it by setting SHOPIFY_CLI_ENABLE_APP_LOG_POLLING=1 in your env.',
      )
    }
    const {flags} = await this.parse(Logs)

    const apiKey = flags['client-id'] || flags['api-key']

    await checkFolderIsValidApp(flags.path)
    const logOptions = {
      apiKey,
      directory: flags.path,
      storeFqdn: flags.store,
      source: flags.source,
      status: flags.status,
      configName: flags.config,
      reset: flags.reset,
      json: flags.json,
    }

    await logs(logOptions)
  }
}
