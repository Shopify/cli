const {commandExceptions} = require('./json-output-command-exceptions')

const exemptCommands = new Set(commandExceptions)

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require typed JSON output for new finite commands',
    },
    schema: [],
    messages: {
      missingJsonFlag:
        'New finite commands must include ...jsonFlag in their static flags. See docs/cli/json-output.md.',
      missingJsonOutputSchema:
        'New finite commands must declare a static jsonOutputSchema. See docs/cli/json-output.md.',
    },
  },
  create(context) {
    const commandPath = repositoryPath(context.filename)
    if (!isCommandPath(commandPath) || exemptCommands.has(commandPath)) return {}

    return {
      ExportDefaultDeclaration(node) {
        if (node.declaration.type !== 'ClassDeclaration') return

        const classMembers = node.declaration.body.body

        if (!hasJsonOutputSchema(classMembers)) {
          context.report({node: node.declaration, messageId: 'missingJsonOutputSchema'})
        }
        if (!hasJsonFlag(classMembers)) {
          context.report({node: node.declaration, messageId: 'missingJsonFlag'})
        }
      },
    }
  },
}

function isCommandPath(commandPath) {
  return /\/src\/(?:cli\/)?commands\//.test(commandPath)
}

function repositoryPath(filename) {
  const normalizedFilename = filename.replaceAll('\\', '/')
  const packagesDirectory = normalizedFilename.lastIndexOf('/packages/')
  return packagesDirectory === -1 ? normalizedFilename : normalizedFilename.slice(packagesDirectory + 1)
}

function hasJsonOutputSchema(classMembers) {
  return classMembers.some(
    (member) =>
      member.type === 'MethodDefinition' && member.kind === 'get' && isStaticMemberNamed(member, 'jsonOutputSchema'),
  )
}

function hasJsonFlag(classMembers) {
  const flags = classMembers.find((member) => isStaticMemberNamed(member, 'flags'))
  return flags?.value?.type === 'ObjectExpression' && flags.value.properties.some(isJsonFlagSpread)
}

function isStaticMemberNamed(member, name) {
  return member.static && !member.computed && member.key?.name === name
}

function isJsonFlagSpread(property) {
  return (
    property.type === 'SpreadElement' &&
    property.argument.type === 'Identifier' &&
    property.argument.name === 'jsonFlag'
  )
}
