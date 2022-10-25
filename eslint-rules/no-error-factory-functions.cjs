// https://eslint.org/docs/developer-guide/working-with-rules
const path = require('pathe')
const file = require('node:fs')
const execa = require('execa')

const errors = ['Abort', 'AbortSilent', 'Bug', 'BugSilent']

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'This rule moves us away from the pattern of wrapping initialization of aborts in factory functions',
    },
    schema: [],
  },
  create(context) {
    return {
      ReturnStatement(node) {
        const calleeName = node.argument?.callee?.name
        const moduleName = node.argument?.callee?.object?.name
        const moduleExport = node.argument?.callee?.property?.name

        const isCLIKitError =
          errors.includes(calleeName) || // When imported from within @shopify/cli-kit
          (moduleName === 'error' && errors.includes(moduleExport)) // When importing from consumer package.

        if (isCLIKitError) {
          const filePath = context.getFilename()
          const relativePath = path.relative(path.resolve(__dirname, '..'), filePath)
          const fileUpdatedAt =
            parseInt(
              execa.sync('git', ['--no-pager', 'log', '-1', '--pretty=%ct', relativePath], {
                cwd: path.join(__dirname, '..'),
              }).stdout,
            ) * 1000
          const shouldFail = !shitlist[relativePath] || shitlist[relativePath] < fileUpdatedAt
          if (shouldFail) {
            context.report(
              node,
              `Factory functions returning instances of abort and bug errors are discouraged. This error arose because either you are not following the pattern in a new module or you touched an existing one that needs migration.`,
            )
          }
        }
      },
    }
  },
}

const shitlist = {
  'packages/cli-kit/src/api/admin.ts': 1663587282910,
  'packages/app/src/cli/commands/app/generate/extension.ts': 1665628286000,
  'packages/cli-hydrogen/src/cli/services/deploy/error.ts': 1665628286000,
  'packages/cli-kit/src/environment/spin.ts': 1665057109000,
  'packages/cli-kit/src/git.ts': 1665628286000,
  'packages/app/src/cli/services/deploy.ts': 1665628286000,
  'packages/app/src/cli/services/dev/fetch.ts': 1665628286000,
  'packages/cli-kit/src/node/checksum.ts': 1665628286000,
  'packages/cli-kit/src/node/dot-env.ts': 1665628286000,
  'packages/app/src/cli/services/dev/select-store.ts': 1665733174000,
  'packages/cli-kit/src/node/node-package-manager.ts': 1665628286000,
  'packages/app/src/cli/services/environment/identifiers.ts': 1663587282903,
  'packages/app/src/cli/services/environment.ts': 1665733174000,
  'packages/cli-kit/src/session/device-authorization.ts': 1665628286000,
  'packages/cli-kit/src/session/exchange.ts': 1665628286000,
  'packages/app/src/cli/utilities/extensions/binary.ts': 1661507113211,
  'packages/app/src/cli/utilities/extensions/cli.ts': 1665628286000,
  'packages/app/src/cli/utilities/extensions/configuration.ts': 1665628286000,
  'packages/app/src/cli/utilities/extensions/fetch-product-variant.ts': 1665628286000,
  'packages/app/src/cli/utilities/extensions/locales-configuration.ts': 1661517194379,
  'packages/app/src/cli/validators/extensions/functions.ts': 1661412160944,
  'packages/app/src/cli/validators/extensions/ui.ts': 1663587282905,
  'packages/cli-kit/src/session.ts': 1665732731000,
  'packages/create-app/src/commands/init.ts': 1661412160964,
  'packages/create-app/src/services/init.ts': 1663852141271,
}
