import {runThemeValidation} from '../../services/validate/theme.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {resolvePath} from '@shopify/cli-kit/node/path'

export default class ValidateTheme extends Command {
  static summary = 'Validate Liquid/theme code offline.'

  static descriptionWithMarkdown = `Validates Liquid and theme code with [Theme Check](https://shopify.dev/docs/themes/tools/theme-check) — fully offline, with no login required.

Runs in one of two modes:

- **Full app:** pass \`--theme-path\` and \`--files\` to validate specific files inside an on-disk theme.
- **Codeblock:** pass \`--filename\` (and \`--code\` or \`--file\`) to validate a single stateless snippet, e.g. a codeblock produced by an agent.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    `# validate a single section codeblock
shopify validate theme --filename hero.liquid --code "{{ section.settings.title }}"`,
    `# validate a theme app extension app block
shopify validate theme --context app --filetype blocks --filename rating.liquid --file ./rating.liquid`,
    `# validate specific files inside an on-disk theme
shopify validate theme --theme-path ./my-theme --files sections/hero.liquid,snippets/card.liquid`,
    `# machine-readable output for agents and eval harnesses
shopify validate theme --filename hero.liquid --code "{{ x }}" --json`,
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'theme-path': Flags.string({
      description: 'Absolute or relative path to the theme directory (full app mode).',
      env: 'SHOPIFY_FLAG_THEME_PATH',
      parse: async (value) => resolvePath(value),
    }),
    files: Flags.string({
      description: 'Comma-separated list of theme-relative file paths to validate (full app mode).',
      env: 'SHOPIFY_FLAG_FILES',
    }),
    filename: Flags.string({
      description: 'File name for the codeblock being validated (stateless mode).',
      env: 'SHOPIFY_FLAG_FILENAME',
    }),
    // `filetype`/`context` intentionally do NOT declare oclif `options:`. Invalid
    // values are validated inside the service so they surface as a structured
    // FAILED validation response, rather than an oclif usage error that would
    // bypass the `--json` contract that agents and eval harnesses depend on.
    filetype: Flags.string({
      description:
        'Theme file type of the codeblock: assets, blocks, config, layout, locales, sections, snippets, or templates. Defaults to "sections".',
      env: 'SHOPIFY_FLAG_FILETYPE',
    }),
    context: Flags.string({
      description: 'Validation context for the codeblock: theme or app. Defaults to "theme".',
      env: 'SHOPIFY_FLAG_CONTEXT',
    }),
    code: Flags.string({
      char: 'c',
      description: 'The codeblock content to validate (stateless mode).',
      env: 'SHOPIFY_FLAG_CODE',
    }),
    file: Flags.string({
      char: 'f',
      description: 'Path to a file whose content is validated as a codeblock (stateless mode).',
      env: 'SHOPIFY_FLAG_FILE',
      parse: async (value) => resolvePath(value),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ValidateTheme)

    // The command only parses flags. Reading `--file` and validating
    // `--filetype`/`--context` happen inside the service so that any failure
    // becomes a structured FAILED response instead of an oclif crash.
    await runThemeValidation({
      themePath: flags['theme-path'],
      files: flags.files,
      filename: flags.filename,
      filetype: flags.filetype,
      context: flags.context,
      code: flags.code,
      filePath: flags.file,
      json: flags.json,
    })
  }
}
