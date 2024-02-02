module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure the first line of the exported function `loader` is `await authenticate.admin(request)` unless it includes `throw redirect`',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: []
  },
  create: function(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          const declaration = node.declaration;
          let functionName = '';

          if (declaration.type === 'FunctionDeclaration') {
            functionName = declaration.id.name;
          } else if (declaration.type === 'VariableDeclaration') {
            const declarator = declaration.declarations.find((declarator) => declarator.id.name === 'loader');
            if (declarator && declarator.init && declarator.init.type === 'ArrowFunctionExpression') {
              functionName = declarator.id.name;
            }
          }

          if (functionName === 'loader') {
            const sourceCode = context.getSourceCode();
            const functionBody = declaration.type === 'FunctionDeclaration' ? declaration.body : declaration.declarations[0].init.body;
            const functionText = sourceCode.getText(functionBody);
            const includesThrowRedirect = functionText.includes('throw redirect');

            const innerBody = functionText.match(/{([\s\S]*)}/)?.[1]?.trim();
            const firstLine = innerBody?.split('\n')[0]?.trim();
            const firstLineIsAuthenticate = firstLine?.startsWith('await authenticate.admin(request)');
            const firstLineIsLogin = firstLine?.includes('login');

            if (!includesThrowRedirect && !firstLineIsAuthenticate && !firstLineIsLogin) {
              context.report({
                node: declaration,
                message: 'The first line of the exported function `loader` should be `await authenticate.admin(request)` or should log in, unless the loader redirects',
              });
            }
          }
        }
      }
    };
  }
}
