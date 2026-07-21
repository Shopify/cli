import {runComponentsValidateCommand, type ValidationLanguage} from '../../services/validate/components.js'
import {COMPONENT_API_NAMES} from '../../services/validate/engine/apis.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class ValidateComponents extends Command {
  static summary = 'Validate UI component code against a Shopify API.'

  static descriptionWithMarkdown = `Type-checks a UI-framework component code block (Polaris web components, UI extensions, Hydrogen) against the bundled type definitions for a Shopify API and reports invalid components, unknown props, and disallowed elements.

Provide the code inline with \`--code\` or from a file with \`--file\`. Extension-surface APIs also require a \`--target\`. With \`--json\`, emits \`{ success, responses, resolvedVersion }\` for machine consumers.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    code: Flags.string({
      char: 'c',
      description: 'The component code to validate.',
      env: 'SHOPIFY_FLAG_CODE',
    }),
    file: Flags.string({
      char: 'f',
      description: 'Path to a file whose contents will be validated.',
      env: 'SHOPIFY_FLAG_FILE',
    }),
    api: Flags.string({
      char: 'a',
      required: true,
      options: COMPONENT_API_NAMES,
      description: 'The Shopify API to validate the components against.',
      env: 'SHOPIFY_FLAG_API',
    }),
    target: Flags.string({
      char: 't',
      description: 'The extension target (required for extension-surface APIs).',
      env: 'SHOPIFY_FLAG_TARGET',
    }),
    version: Flags.string({
      description: 'The API version to validate against. Defaults to the latest version for the API.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    language: Flags.string({
      options: ['html', 'tsx', 'jsx'],
      description: "The code block's language. Use 'html' only for raw HTML in polaris-app-home.",
      env: 'SHOPIFY_FLAG_LANGUAGE',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ValidateComponents)

    // File reads are intentionally deferred to the service so a bad `--file`
    // path yields a structured FAILED result (in --json mode) rather than an
    // oclif crash. The command stays thin: parse flags, delegate, done.
    await runComponentsValidateCommand({
      api: flags.api,
      code: flags.code,
      file: flags.file,
      target: flags.target,
      version: flags.version,
      language: flags.language as ValidationLanguage | undefined,
      json: flags.json,
    })
  }
}
