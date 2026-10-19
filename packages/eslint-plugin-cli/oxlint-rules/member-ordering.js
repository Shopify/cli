module.exports = {
  meta: {type: 'suggestion', schema: [{type: 'object'}]},
  create(context) {
    const order = context.options[0]?.default ?? []
    function check(members, signature = false) {
      let previous = -1
      for (const member of members) {
        if (member.value?.type === 'TSEmptyBodyFunctionExpression') continue
        let group
        if (member.kind === 'constructor') group = 'constructor'
        else {
          const accessibility =
            member.accessibility ?? (member.key?.type === 'PrivateIdentifier' ? '#private' : 'public')
          let kind = member.kind ?? 'method'
          if (['PropertyDefinition', 'TSAbstractPropertyDefinition', 'TSPropertySignature'].includes(member.type)) {
            kind = ['FunctionExpression', 'ArrowFunctionExpression'].includes(member.value?.type) ? 'method' : 'field'
          }
          let scope = 'instance'
          if (member.static) scope = 'static'
          else if (member.type.startsWith('TSAbstract')) scope = 'abstract'
          const modifiers = [accessibility, scope, kind]
          group = (signature ? [kind] : [modifiers.join('-'), modifiers.slice(1).join('-'), kind]).find((name) =>
            order.includes(name),
          )
        }
        const rank = order.indexOf(group)
        if (rank < 0) continue
        if (rank < previous) context.report({node: member, message: `Place ${group} before later member groups.`})
        else previous = rank
      }
    }
    return {
      ClassBody(node) {
        check(node.body)
      },
      TSInterfaceBody(node) {
        check(node.body, true)
      },
      TSTypeLiteral(node) {
        check(node.members, true)
      },
    }
  },
}
