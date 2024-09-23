const path = require('path')

/**
 * Every App Command should have a default export that extends `AppCommand`
 *
 * This way we control that all commands are constrained by what's defined in the `AppCommand` abstract class.
 * Such as the return type for the run() function.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that files in app/commands have a default export extending AppCommand',
      category: 'Possible Errors',
      recommended: true,
    },
  },
  create(context) {
    const filename = context.getFilename()

    // Applies to every file with `commands/app` in the path
    const isInAppCommandsFolder = filename.includes(path.join('commands', 'app'))
    if (!isInAppCommandsFolder) {
      return {}
    }

    return {
      Program(node) {
        let hasDefaultExport = false
        let extendsAppCommand = false

        node.body.forEach((statement) => {
          if (statement.type === 'ExportDefaultDeclaration') {
            hasDefaultExport = true
            if (statement.declaration.type === 'ClassDeclaration') {
              const superClass = statement.declaration.superClass
              if (superClass && superClass.type === 'Identifier' && superClass.name === 'AppCommand') {
                extendsAppCommand = true
              }
            }
          }
        })

        if (!hasDefaultExport || !extendsAppCommand) {
          context.report({
            node,
            message: 'Files in commands/app must have a default export that extends AppCommand',
          })
        }
      },
    }
  },
}
