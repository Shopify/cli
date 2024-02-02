module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Checks for usage of popular third-party billing APIs',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },
  create: function (context) {
    return {
      Identifier: function (node) {
        if (node.name === 'paypal') {
          context.report({node: node, message: 'Paypal: Shopify apps can only use the Shopify Billing API.'})
        }
        if (node.name === 'Stripe') {
          context.report({node: node, message: 'Stripe: Shopify apps can only use the Shopify Billing API.'})
        }
      },
      MemberExpression(node) {
        const isSquarePayments =
          (node.object.name === 'Square' && node.property.name === 'payments') ||
          (node.object.object &&
            node.object.object.name === 'window' &&
            node.object.property.name === 'Square' &&
            node.property.name === 'payments')

        if (isSquarePayments) {
          context.report({node: node, message: 'Square: Shopify apps can only use the Shopify Billing API.'})
        }
      },
    }
  },
}
