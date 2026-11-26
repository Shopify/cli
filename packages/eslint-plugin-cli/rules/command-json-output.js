module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require typed JSON output for visible commands',
    },
    schema: [],
    messages: {
      missingJsonFlag: 'Visible commands must include ...jsonFlag in their static flags. See docs/cli/json-output.md.',
      missingJsonOutputSchema: 'Visible commands must declare a static jsonOutputSchema. See docs/cli/json-output.md.',
    },
  },
  create(context) {
    const commandPath = context.filename.replaceAll('\\', '/')
    if (!isCommandPath(commandPath)) return {}

    return {
      ExportDefaultDeclaration(node) {
        if (node.declaration.type !== 'ClassDeclaration') return

        const classMembers = node.declaration.body.body
        if (classMembers.some((member) => isStaticMemberNamed(member, 'hidden') && member.value?.value === true)) return

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

function hasJsonOutputSchema(classMembers) {
  return classMembers.some(
    (member) =>
      isStaticMemberNamed(member, 'jsonOutputSchema') &&
      ((member.type === 'MethodDefinition' && member.kind === 'get') ||
        (member.type === 'PropertyDefinition' && Boolean(member.value))),
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
