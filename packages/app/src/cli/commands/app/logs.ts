import Dev from './dev.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {logs, Format} from '../../services/logs.js'
import {appFlags} from '../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class Logs extends AppLinkedCommand {
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
    ...jsonFlag,
    'api-key': Dev.flags['api-key'],
    store: Flags.string({
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      multiple: true,
      parse: async (input) => normalizeStoreFqdn(input),
    }),
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
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Logs)

    const apiKey = flags['client-id'] ?? flags['api-key']

    await checkFolderIsValidApp(flags.path)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: apiKey,
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const primaryStore = await storeContext({
      appContextResult,
      storeFqdn: flags.store?.[0],
      forceReselectStore: flags.reset,
    })

    const logOptions = {
      ...appContextResult,
      primaryStore,
      storeFqdns: flags.store,
      sources: flags.source,
      status: flags.status,
      format: (flags.json ? 'json' : 'text') as Format,
    }

    await logs(logOptions)
    return {app: appContextResult.app}
  }
}
