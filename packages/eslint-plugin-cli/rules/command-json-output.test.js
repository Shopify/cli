const {RuleTester} = require('eslint')
const typescriptParser = require('@typescript-eslint/parser')

const rule = require('./command-json-output')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: typescriptParser,
  },
})

ruleTester.run('command-json-output', rule, {
  valid: [
    {
      name: 'finite query command',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/list.ts',
      code: `
        export default class WidgetList extends Command {
          static flags = {...jsonFlag}
          static get jsonOutputSchema() {
            return widgetListJsonOutputSchema
          }
        }
      `,
    },
    {
      name: 'finite operation command',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/delete.ts',
      code: `
        export default class WidgetDelete extends Command {
          static flags = {...globalFlags, ...jsonFlag}
          static get jsonOutputSchema() {
            return widgetDeleteJsonOutputSchema
          }
        }
      `,
    },
    {
      name: 'allow-listed streaming command',
      filename: '/repo/packages/app/src/cli/commands/app/dev.ts',
      code: 'export default class Dev extends Command {}',
    },
    {
      name: 'legacy command baseline',
      filename: '/repo/packages/app/src/cli/commands/app/build.ts',
      code: 'export default class Build extends Command {}',
    },
    {
      name: 'non-command module',
      filename: '/repo/packages/app/src/cli/services/widgets.ts',
      code: 'export default class WidgetService {}',
    },
  ],
  invalid: [
    {
      name: 'streaming marker without an allow-list entry',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/watch.ts',
      code: `
        export default class WidgetWatch extends Command {
          static jsonOutputSupport = 'streaming' as const
        }
      `,
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'new subcommand of an allow-listed streaming command',
      filename: '/repo/packages/app/src/cli/commands/app/dev/status.ts',
      code: 'export default class DevStatus extends Command {}',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'new command without JSON support',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/create.ts',
      code: 'export default class WidgetCreate extends Command {}',
      errors: [
        {
          message: 'New finite commands must declare a static jsonOutputSchema. See docs/cli/json-output.md.',
        },
        {
          message: 'New finite commands must include ...jsonFlag in their static flags. See docs/cli/json-output.md.',
        },
      ],
    },
    {
      name: 'command missing its schema',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/search.ts',
      code: 'export default class WidgetSearch extends Command { static flags = {...jsonFlag} }',
      errors: [
        {
          message: 'New finite commands must declare a static jsonOutputSchema. See docs/cli/json-output.md.',
        },
      ],
    },
    {
      name: 'command missing its JSON flag',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/update.ts',
      code: `
        export default class WidgetUpdate extends Command {
          static get jsonOutputSchema() {
            return widgetUpdateJsonOutputSchema
          }
        }
      `,
      errors: [
        {
          message: 'New finite commands must include ...jsonFlag in their static flags. See docs/cli/json-output.md.',
        },
      ],
    },
  ],
})
