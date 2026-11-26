const {Linter, RuleTester} = require('eslint')
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
      name: 'hidden command without JSON support',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/hidden.ts',
      code: 'export default class Hidden extends Command { static hidden = true }',
    },
    {
      name: 'finite query command',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/list.ts',
      code: `
        export default class WidgetList extends Command {
          static flags = {...jsonFlag}
          static jsonOutputSchema = widgetListJsonOutputSchema
        }
      `,
    },
    {
      name: 'finite operation command',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/delete.ts',
      code: `
        export default class WidgetDelete extends Command {
          static flags = {...globalFlags, ...jsonFlag}
          static jsonOutputSchema = widgetDeleteJsonOutputSchema
        }
      `,
    },
    {
      name: 'removed app logs command is hidden',
      filename: '/repo/packages/app/src/cli/commands/app/logs.ts',
      code: `
        export default class Logs extends Command {
          static hidden = true
          static flags = {...globalFlags, ...jsonFlag}
        }
      `,
    },
    {
      name: 'non-command module',
      filename: '/repo/packages/app/src/cli/services/widgets.ts',
      code: 'export default class WidgetService {}',
    },
  ],
  invalid: [
    {
      name: 'explicitly visible command without JSON support',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/visible.ts',
      code: 'export default class Visible extends Command { static hidden = false }',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'instance hidden property does not hide a command',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/visible.ts',
      code: 'export default class Visible extends Command { hidden = true }',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'visible app logs command has no path exemption',
      filename: '/repo/packages/app/src/cli/commands/app/logs.ts',
      code: 'export default class Logs extends Command {}',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'command in another repository without JSON support',
      filename: '/hydrogen/packages/cli/src/commands/hydrogen/dev.ts',
      code: 'export default class Dev extends Command {}',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'Windows command without JSON support',
      filename: String.raw`C:\hydrogen\packages\cli\src\commands\hydrogen\dev.ts`,
      code: 'export default class Dev extends Command {}',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'streaming marker does not exempt a command',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/watch.ts',
      code: `
        export default class WidgetWatch extends Command {
          static jsonOutputSupport = 'streaming' as const
        }
      `,
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'subcommand of a hidden command still requires JSON support',
      filename: '/repo/packages/app/src/cli/commands/app/logs/status.ts',
      code: 'export default class DevStatus extends Command {}',
      errors: [{messageId: 'missingJsonOutputSchema'}, {messageId: 'missingJsonFlag'}],
    },
    {
      name: 'new command without JSON support',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/create.ts',
      code: 'export default class WidgetCreate extends Command {}',
      errors: [
        {
          message: 'Visible commands must declare a static jsonOutputSchema. See docs/cli/json-output.md.',
        },
        {
          message: 'Visible commands must include ...jsonFlag in their static flags. See docs/cli/json-output.md.',
        },
      ],
    },
    {
      name: 'command missing its schema',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/search.ts',
      code: 'export default class WidgetSearch extends Command { static flags = {...jsonFlag} }',
      errors: [
        {
          message: 'Visible commands must declare a static jsonOutputSchema. See docs/cli/json-output.md.',
        },
      ],
    },
    {
      name: 'command missing its JSON flag',
      filename: '/repo/packages/app/src/cli/commands/app/widgets/update.ts',
      code: `
        export default class WidgetUpdate extends Command {
          static jsonOutputSchema = widgetUpdateJsonOutputSchema
        }
      `,
      errors: [
        {
          message: 'Visible commands must include ...jsonFlag in their static flags. See docs/cli/json-output.md.',
        },
      ],
    },
  ],
})

test('rejects path exceptions in the rule configuration', () => {
  const linter = new Linter()

  expect(() =>
    linter.verify('export default class Logs extends Command {}', [
      {
        plugins: {'@shopify/cli': {rules: {'command-json-output': rule}}},
        rules: {
          '@shopify/cli/command-json-output': ['error', {exceptions: ['packages/app/src/cli/commands/app/logs.ts']}],
        },
      },
    ]),
  ).toThrow('should NOT have more than 0 items')
})
