// https://eslint.org/docs/developer-guide/working-with-rules
const path = require('pathe')
const file = require('node:fs')

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
          if (!shitlist.includes(relativePath)) {
            context.report(
              node,
              `Factory functions returning instances of abort and bug errors are discouraged.
Create the instance right in the throw line.`,
            )
          }
        }
      },
    }
  },
}

const shitlist = [
  'packages/cli-kit/src/api/admin.ts',
  'packages/app/src/cli/commands/app/generate/extension.ts',
  'packages/cli-hydrogen/src/cli/services/deploy/error.ts',
  'packages/cli-kit/src/environment/spin.ts',
  'packages/cli-kit/src/git.ts',
  'packages/app/src/cli/services/deploy.ts',
  'packages/app/src/cli/services/dev/fetch.ts',
  'packages/cli-kit/src/node/checksum.ts',
  'packages/app/src/cli/services/dev/select-store.ts',
  'packages/cli-kit/src/node/dot-env.ts',
  'packages/cli-kit/src/node/node-package-manager.ts',
  'packages/app/src/cli/services/environment/identifiers.ts',
  'packages/app/src/cli/services/environment.ts',
  'packages/cli-kit/src/session/device-authorization.ts',
  'packages/cli-kit/src/session/exchange.ts',
  'packages/app/src/cli/utilities/extensions/binary.ts',
  'packages/app/src/cli/utilities/extensions/cli.ts',
  'packages/app/src/cli/utilities/extensions/configuration.ts',
  'packages/app/src/cli/utilities/extensions/fetch-product-variant.ts',
  'packages/app/src/cli/utilities/extensions/locales-configuration.ts',
  'packages/app/src/cli/validators/extensions/functions.ts',
  'packages/app/src/cli/validators/extensions/ui.ts',
  'packages/cli-kit/src/session.ts',
  'packages/create-app/src/commands/init.ts',
  'packages/create-app/src/services/init.ts',
]
