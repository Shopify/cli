// https://eslint.org/docs/developer-guide/working-with-rules
const path = require('pathe')
const file = require('fs')

const errors = ['AbortError', 'AbortSilentError', 'BugError', 'BugSilentError']

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
          context.report(
            node,
            `Factory functions returning instances of abort and bug errors are discouraged. This error arose because either you are not following the pattern in a new module or you touched an existing one that needs migration.`,
          )
        }
      },
    }
  },
}
