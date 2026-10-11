const {RuleTester} = require('eslint')
const typescriptParser = require('@typescript-eslint/parser')

const rule = require('./command-help-verb-form')

const ruleTester = new RuleTester({
  languageOptions: {ecmaVersion: 2022, sourceType: 'module', parser: typescriptParser},
})
const filename = '/repo/packages/app/src/cli/commands/app/widgets/list.ts'
const addedVerbs = [
  'Access',
  'Activate',
  'Apply',
  'Cancel',
  'Clear',
  'Compile',
  'Copy',
  'Discuss',
  'Migrate',
  'Move',
  'Process',
  'Profile',
  'Provide',
  'Query',
  'Refresh',
  'Remove',
  'Retrieve',
  'Return',
  'Schedule',
  'Search',
  'Stream',
  'Surface',
  'Sync',
  'Test',
  'Uninstall',
  'Unschedule',
  'Upload',
  'Use',
  'Watch',
]

ruleTester.run('command-help-verb-form', rule, {
  valid: [
    {name: 'third-person verb', filename, code: 'export default class List { static summary = "Lists widgets." }'},
    {
      name: 'third-person authentication',
      filename,
      code: 'export default class List { static summary = "Authenticates against a store." }',
    },
    {
      name: 'derived description',
      filename,
      code: 'export default class List { static description = this.descriptionForHelp() }',
    },
    {
      name: 'third-person template',
      filename,
      code: `export default class List { static summary = \`Lists \${resource}.\` }`,
    },
    {name: 'instance property', filename, code: 'export default class List { summary = "List widgets." }'},
    {name: 'computed property', filename, code: 'export default class List { static [summary] = "List widgets." }'},
    ...['If', 'Shopify', 'The', 'This'].map((word) => ({
      name: `non-verb start ${word}`,
      filename,
      code: `export default class List { static summary = "${word} widget information." }`,
    })),
    {
      name: 'non-command file',
      filename: '/repo/packages/app/src/cli/services/list.ts',
      code: 'export default class List { static summary = "List widgets." }',
    },
    {
      name: 'known limit: separately exported class',
      filename,
      code: 'class List { static summary = "List widgets." }; export default List',
    },
    {
      name: 'known limit: quoted key',
      filename,
      code: 'export default class List { static "summary" = "List widgets." }',
    },
    {
      name: 'known limit: asserted text',
      filename,
      code: 'export default class List { static summary = "List widgets." as const }',
    },
    {
      name: 'known limit: incomplete first template word',
      filename,
      code: `export default class List { static summary = \`Cre\${suffix} widgets.\` }`,
    },
    {
      name: 'known limit: dynamic first word',
      filename,
      code: `export default class List { static summary = \`\${verb} widgets.\` }`,
    },
    {
      name: 'known limit: hyphenated word',
      filename,
      code: 'export default class List { static summary = "Re-run widgets." }',
    },
  ],
  invalid: [
    ...addedVerbs.map((verb) => ({
      name: `imperative ${verb}`,
      filename,
      code: `export default class List { static summary = "${verb} widgets." }`,
      errors: [{messageId: 'imperative', data: {verb}}],
    })),
    {
      name: 'known imperative',
      filename,
      code: 'export default class List { static summary = "List widgets." }',
      errors: [{messageId: 'imperative', data: {verb: 'List'}}],
    },
    {
      name: 'unknown imperative caught by suffix check',
      filename,
      code: 'export default class List { static summary = "Frobnicate widgets." }',
      errors: [{messageId: 'imperative', data: {verb: 'Frobnicate'}}],
    },
    {
      name: 'constant template',
      filename,
      code: 'export default class List { static description = `Create a widget.` }',
      errors: [{messageId: 'imperative', data: {verb: 'Create'}}],
    },
    {
      name: 'leading newline in markdown',
      filename,
      code: `
      export default class List {
        static descriptionWithMarkdown = \`
          Run a widget. More detail.
        \`
      }
    `,
      errors: [{messageId: 'imperative', data: {verb: 'Run'}}],
    },
    {
      name: 'Windows command path',
      filename: String.raw`C:\repo\packages\app\src\cli\commands\widgets\list.ts`,
      code: 'export default class List { static summary = "Show widgets." }',
      errors: [{messageId: 'imperative'}],
    },
    {
      name: 'src commands path',
      filename: '/repo/packages/plugin-x/src/commands/list.ts',
      code: 'export default class List { static summary = "Show widgets." }',
      errors: [{messageId: 'imperative'}],
    },
    {
      name: 'typed optional property',
      filename,
      code: 'export default class List { static summary?: string | undefined = "Create widgets." }',
      errors: [{messageId: 'imperative'}],
    },
    {
      name: 'hidden command',
      filename,
      code: 'export default class List { static hidden = true; static summary = "Check widgets." }',
      errors: [{messageId: 'imperative'}],
    },
    {
      name: 'complete first template word',
      filename,
      code: `export default class List { static summary = \`Create \${resource}.\` }`,
      errors: [{messageId: 'imperative'}],
    },
    {
      name: 'leading markdown link',
      filename,
      code: 'export default class List { static summary = "[Build](https://example.com) widgets." }',
      errors: [{messageId: 'imperative'}],
    },
  ],
})
