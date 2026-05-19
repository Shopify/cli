import {executePreviewStoreCommand} from '../../services/commands/preview/execute.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class PreviewStoreExecute extends Command {
  static summary = 'Run an Admin GraphQL operation against a Preview Store using its shop-scoped token.'

  static description = `Reads the shop domain and admin API token straight from \`preview create --json\` output (or accepts them as flags). For local preview stores, the human-facing \`*.my.shop.dev\` domain is accepted and routed to the Admin API host automatically. Mutations are blocked unless --allow-mutations is set.`

  static examples = [
    '<%= config.bin %> <%= command.id %> --from-file /tmp/preview.json --query "{ shop { name } }"',
    '<%= config.bin %> <%= command.id %> --from-file /tmp/preview.json --query-file ./query.graphql',
    '<%= config.bin %> <%= command.id %> --domain preview-123.my.shop.dev --token shpat_... --query "..."',
    '<%= config.bin %> <%= command.id %> --from-file /tmp/preview.json --allow-mutations --query-file ./mutation.graphql',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'from-file': Flags.string({
      description: 'Path to JSON produced by `preview create --json`. Provides domain + admin token.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_FROM_FILE',
      required: false,
      exclusive: ['domain', 'token'],
    }),
    domain: Flags.string({
      description: 'Shop domain to use for Admin API requests. For local preview stores, the permanent *.my.shop.dev domain is accepted and routed automatically. Required if --from-file is omitted.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_DOMAIN',
      required: false,
      dependsOn: ['token'],
    }),
    token: Flags.string({
      description: 'Admin API token (shpat_...). Required if --from-file is omitted.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_TOKEN',
      required: false,
      dependsOn: ['domain'],
    }),
    query: Flags.string({
      char: 'q',
      description: 'GraphQL query or mutation as a string.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_QUERY',
      required: false,
      exclusive: ['query-file'],
    }),
    'query-file': Flags.string({
      description: 'Path to a file containing a GraphQL query or mutation.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_QUERY_FILE',
      required: false,
      exclusive: ['query'],
    }),
    variables: Flags.string({
      description: 'GraphQL variables as a JSON string.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_VARIABLES',
      required: false,
      exclusive: ['variable-file'],
    }),
    'variable-file': Flags.string({
      description: 'Path to a JSON file containing GraphQL variables.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_VARIABLE_FILE',
      required: false,
      exclusive: ['variables'],
    }),
    'api-version': Flags.string({
      description: 'Admin API version. Defaults to "unstable".',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_API_VERSION',
      required: false,
      default: 'unstable',
    }),
    'allow-mutations': Flags.boolean({
      description: 'Allow mutation operations. Required for any GraphQL document with `mutation`.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_ALLOW_MUTATIONS',
      required: false,
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(PreviewStoreExecute)

    await executePreviewStoreCommand({
      fromFile: flags['from-file'],
      domain: flags.domain,
      token: flags.token,
      query: flags.query,
      queryFile: flags['query-file'],
      variables: flags.variables,
      variableFile: flags['variable-file'],
      apiVersion: flags['api-version'],
      allowMutations: flags['allow-mutations'],
      json: Boolean(flags.json),
    })
  }
}
