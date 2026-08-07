import {runGraphqlValidation} from '../../services/validate/graphql.js'
import {GRAPHQL_APIS} from '../../services/validate/engine/apis.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class ValidateGraphql extends Command {
  static summary = 'Validate a GraphQL operation against a bundled Shopify API schema.'

  static descriptionWithMarkdown = `Validates a GraphQL query or mutation against the bundled introspection schema for the selected Shopify API. Runs fully offline — no network access or login required — so results are deterministic.

Pass the operation with \`--code\`, \`--file\`, or pipe it via stdin. On success, the required offline access scopes for the operation are reported. Use \`--json\` for a machine-readable result.

Exits with code 0 when the operation is valid (including when it only uses deprecated fields) and 1 when it is invalid or an error occurs.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    `# validate an Admin API query passed inline
shopify validate graphql --api admin --code "{ shop { name } }"`,
    `# validate a query from a file against a specific version
shopify validate graphql --api admin --file query.graphql --version 2026-04`,
    `# pipe an operation via stdin and get JSON output
echo "{ shop { name } }" | shopify validate graphql --api storefront-graphql --json`,
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    api: Flags.string({
      char: 'a',
      description: `The Shopify API to validate against. One of: ${GRAPHQL_APIS.join(', ')}.`,
      env: 'SHOPIFY_FLAG_API',
      required: true,
    }),
    code: Flags.string({
      char: 'c',
      description: 'The GraphQL operation to validate, as a string.',
      env: 'SHOPIFY_FLAG_CODE',
      exclusive: ['file'],
    }),
    file: Flags.string({
      char: 'f',
      description: 'Path to a file containing the GraphQL operation to validate.',
      env: 'SHOPIFY_FLAG_FILE',
      exclusive: ['code'],
      parse: async (value) => resolvePath(value),
    }),
    version: Flags.string({
      description: 'The API version to validate against. Defaults to the latest stable version.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ValidateGraphql)

    await runGraphqlValidation({
      code: flags.code,
      file: flags.file,
      api: flags.api,
      version: flags.version,
      json: flags.json,
    })
  }
}
