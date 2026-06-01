import {validateGraphQL} from '../../services/validation/graphql.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

export default class ValidateGraphQL extends Command {
  static summary = 'Validate a GraphQL query or mutation.'

  static descriptionWithMarkdown = `Validates a GraphQL document for agent and automation workflows.

By default this command checks GraphQL syntax, confirms there is exactly one operation, and validates variable JSON. Pass \`--schema-file\` to also validate fields, arguments, and variable values against a GraphQL schema. Schema files can be SDL (\`.graphql\`) or introspection JSON.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --query "query { shop { name } }" --json',
    '<%= config.bin %> <%= command.id %> --query-file ./operation.graphql --schema-file ./schema.graphql --json',
    `<%= config.bin %> <%= command.id %> --query 'query Product($id: ID!) { product(id: $id) { title } }' --variables '{"id":"gid://shopify/Product/1"}' --schema-file ./schema.graphql --json`,
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    query: Flags.string({
      char: 'q',
      description: 'The GraphQL query or mutation to validate.',
      env: 'SHOPIFY_FLAG_QUERY',
      exactlyOne: ['query', 'query-file'],
    }),
    'query-file': Flags.string({
      description: "Path to a file containing the GraphQL query or mutation. Can't be used with --query.",
      env: 'SHOPIFY_FLAG_QUERY_FILE',
      parse: async (input) => resolvePath(input),
      exactlyOne: ['query', 'query-file'],
    }),
    variables: Flags.string({
      char: 'v',
      description: 'The values for any GraphQL variables in your query or mutation, in JSON format.',
      env: 'SHOPIFY_FLAG_VARIABLES',
      exclusive: ['variable-file'],
    }),
    'variable-file': Flags.string({
      description: "Path to a file containing GraphQL variables in JSON format. Can't be used with --variables.",
      env: 'SHOPIFY_FLAG_VARIABLE_FILE',
      parse: async (input) => resolvePath(input),
      exclusive: ['variables'],
    }),
    'schema-file': Flags.string({
      description: 'Path to a GraphQL schema file, as SDL or introspection JSON. Enables schema validation.',
      env: 'SHOPIFY_FLAG_SCHEMA_FILE',
      parse: async (input) => resolvePath(input),
    }),
    surface: Flags.string({
      description: 'Shopify API surface to validate against. Prototype only; pass --schema-file for schema validation.',
      env: 'SHOPIFY_FLAG_SURFACE',
      options: ['admin'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ValidateGraphQL)
    const result = await validateGraphQL({
      query: flags.query,
      queryFile: flags['query-file'],
      variables: flags.variables,
      variablesFile: flags['variable-file'],
      schemaFile: flags['schema-file'],
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
    } else if (result.valid) {
      const schemaStatus = result.schema?.validation === 'checked' ? 'schema checked' : 'syntax checked'
      outputInfo(`GraphQL document is valid (${schemaStatus}).`)
    } else {
      outputInfo(formatIssues(result.issues))
    }

    if (!result.valid) {
      throw new AbortSilentError()
    }
  }
}

function formatIssues(issues: {message: string; stage: string}[]): string {
  return ['GraphQL document is invalid:', ...issues.map((issue) => `  • [${issue.stage}] ${issue.message}`)].join('\n')
}
