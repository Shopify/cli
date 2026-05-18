import {queryLogs, queryLogsDirect} from '../../../services/app-logs/query-logs.js'
import {appFlags} from '../../../flags.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class LogsQuery extends AppLinkedCommand {
  static summary = 'Query app logs from Tracify/ClickHouse (all event types).'

  static descriptionWithMarkdown = `
  Queries app runtime logs from the Tracify-backed API. Unlike \`shopify app logs\` (which only supports Functions via polling),
  this command supports all event types: webhooks, functions, GraphQL requests, REST requests, app events, and billing events.

  Fetches logs for a given time range (default: last 1 hour) and outputs them as JSON.

  \`\`\`
  shopify app logs query --type=WEBHOOK_DELIVERY --status=FAILURE --last=2h
  shopify app logs query --type=FUNCTION_RUN --target=run --first=20
  shopify app logs query --api-key=YOUR_APP_KEY --type=WEBHOOK_DELIVERY --last=1h
  \`\`\`
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'api-key': Flags.string({
      description: 'App API key (bypasses app linking — useful for testing).',
      env: 'SHOPIFY_FLAG_API_KEY',
    }),
    type: Flags.string({
      description:
        'Filter by event type (WEBHOOK_DELIVERY, FUNCTION_RUN, GRAPHQL_REQUEST, REST_REQUEST, APP_EVENT, APP_BILLING_EVENT).',
      multiple: true,
      options: [
        'WEBHOOK_DELIVERY',
        'FUNCTION_RUN',
        'GRAPHQL_REQUEST',
        'REST_REQUEST',
        'APP_EVENT',
        'APP_BILLING_EVENT',
      ],
    }),
    status: Flags.string({
      description: 'Filter by status.',
      options: ['SUCCESS', 'FAILURE'],
    }),
    target: Flags.string({
      description: 'Filter by target (e.g., webhook topic like "orders/create").',
    }),
    last: Flags.string({
      description: 'Time range to look back (e.g., "1h", "30m", "2h"). Default: "1h".',
      default: '1h',
    }),
    first: Flags.integer({
      description: 'Number of results to return (max 1000).',
      default: 50,
    }),
    after: Flags.string({
      description: "Cursor for pagination (from previous query's endCursor).",
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(LogsQuery)

    // Direct mode: bypass app linking, just fire the query with an API key
    if (flags['api-key']) {
      await queryLogsDirect({
        apiKey: flags['api-key'],
        types: flags.type,
        status: flags.status,
        target: flags.target,
        last: flags.last,
        first: flags.first,
        after: flags.after,
        json: flags.json,
      })
      return {app: undefined as any}
    }

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await queryLogs({
      ...appContextResult,
      types: flags.type,
      status: flags.status,
      target: flags.target,
      last: flags.last,
      first: flags.first,
      after: flags.after,
      json: flags.json,
    })

    return {app: appContextResult.app}
  }
}
