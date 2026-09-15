import {queryAppLogs} from '../../../services/app-logs/query.js'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class Query extends BaseCommand {
  static hidden = true
  static summary = 'Prototype only: query app log summaries through the local Dev Platform API.'

  static flags = {
    ...globalFlags,
    'organization-id': Flags.string({
      required: true,
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
      description: 'Local Business Platform organization ID.',
    }),
    'client-id': Flags.string({required: true, env: 'SHOPIFY_FLAG_CLIENT_ID', description: 'App API key.'}),
    minutes: Flags.integer({
      default: 15,
      min: 1,
      env: 'SHOPIFY_FLAG_MINUTES',
      description: 'Query the last N minutes.',
    }),
    limit: Flags.integer({
      default: 10,
      min: 1,
      env: 'SHOPIFY_FLAG_LIMIT',
      description: 'Maximum summary events to return.',
    }),
    offset: Flags.integer({
      default: 0,
      min: 0,
      env: 'SHOPIFY_FLAG_OFFSET',
      description: 'Number of matching rows to skip. Results are unordered; this is not a reliable export cursor.',
    }),
    type: Flags.string({
      multiple: true,
      env: 'SHOPIFY_FLAG_TYPE',
      options: ['WEBHOOK_DELIVERY', 'GRAPHQL_REQUEST', 'REST_REQUEST', 'FUNCTION_RUN'],
      description: 'Restrict results to these event types.',
    }),
    demo: Flags.boolean({
      default: false,
      env: 'SHOPIFY_FLAG_DEMO',
      description: 'Use the loopback demo with seeded auth, not Identity login.',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Query)
    const result = await queryAppLogs({
      organizationId: flags['organization-id'],
      clientId: flags['client-id'],
      minutes: flags.minutes,
      limit: flags.limit,
      offset: flags.offset,
      types: flags.type,
      demo: flags.demo,
    })
    outputResult(JSON.stringify(result, null, 2))
  }
}
