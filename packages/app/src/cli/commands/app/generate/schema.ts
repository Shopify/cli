import FetchSchema from '../function/schema.js'

export default class GenerateSchema extends FetchSchema {
  static hidden = true

  static descriptionWithMarkdown = `[DEPRECATED, use \`app function schema\`] Generates the latest [GraphQL schema](https://shopify.dev/docs/apps/functions/input-output#graphql-schema) for a function in your app. Run this command from the function directory.

  This command uses the API type and version of your function, as defined in your extension TOML file, to generate the latest GraphQL schema. The schema is written to the \`schema.graphql\` file.`

  static description = this.descriptionWithoutMarkdown()
}
