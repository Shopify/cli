// https://eslint.org/docs/developer-guide/working-with-rules
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'limit how many named export statements a module can have',
    },
    schema: [],
  },
  create(context) {
    let exportsCount = 0;
    return {
      ExportNamedDeclaration(node) {
        exportsCount += node.specifiers.length
      },
      onCodePathEnd: function(codePath, node) {
        if exportsCount > 3 {
          context.report({
            node: ast,
            message: 'Module should not export more than three items.',
          });
        }
      }
    }
  },
}
