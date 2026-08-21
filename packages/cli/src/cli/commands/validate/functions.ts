import {runFunctionsValidateCommand} from '../../services/validate/functions.js'
import {FUNCTIONS_API_IDS} from '../../services/validate/engine/apis.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class ValidateFunctions extends Command {
  static summary = 'Validate a Shopify Functions input query against a bundled GraphQL schema.'

  static descriptionWithMarkdown = `Validates a GraphQL input-query operation for a Shopify Functions API against the schema bundled with the CLI. Runs fully offline — no network and no login — so results are deterministic.

Provide the operation with \`--code\`, \`--file\`, or by piping it to stdin. \`--api\` is required. When \`--version\` is omitted, the latest stable version for the API is used and noted in the output.

Exits 0 when the operation is valid (including valid-with-deprecation-warnings) and 1 when it is invalid or an error occurs.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    `# validate an inline operation against the latest Discount Function schema
shopify validate functions --api functions_discount --code "query Input { cart { lines { quantity } } }"`,
    `# validate a file against a specific version
shopify validate functions --api functions_cart_transform --file input.graphql --version 2026-04`,
    `# pipe an operation via stdin and get JSON output
echo "query Input { cart { lines { quantity } } }" | shopify validate functions --api functions_discount --json`,
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    api: Flags.string({
      char: 'a',
      description: `The Functions API to validate against. One of: ${FUNCTIONS_API_IDS.join(', ')}.`,
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
      description: 'Read the GraphQL operation from this file.',
      env: 'SHOPIFY_FLAG_FILE',
      exclusive: ['code'],
      parse: async (value) => resolvePath(value),
    }),
    version: Flags.string({
      description:
        "The API version to validate against (e.g. 2026-04, unstable). Defaults to the API's latest stable version.",
      env: 'SHOPIFY_FLAG_VERSION',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ValidateFunctions)

    // The command stays a thin flag parser: reading --file / stdin happens inside
    // the service so that a bad --file or empty stdin produces a structured
    // FAILED result (exit 1) instead of an unhandled oclif crash.
    await runFunctionsValidateCommand({
      code: flags.code,
      file: flags.file,
      api: flags.api,
      requestedVersion: flags.version,
      json: flags.json,
    })
  }
}
