module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Billing must be carried out through the Shopify Billing API. Set up plans here. For more information: https://shopify.dev/docs/api/shopify-app-remix/v2/apis/billing#example-require',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: []
  },
  create: function(context) {
    return {
      CallExpression: function(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'shopifyApp' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'ObjectExpression'
        ) {
          const properties = node.arguments[0].properties;
          const hasBillingKey = properties.some(property => property.key && property.key.name === 'billing');
          if (!hasBillingKey) {
            context.report({
              node: node.arguments[0],
              message: 'Billing must be carried out through the Shopify Billing API. Set up plans here as in the example: https://shopify.dev/docs/api/shopify-app-remix/v2/apis/billing#example-require'
            });
          }
        }
      },
    };
  }
}
