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
    const report = function (context, node, name) {
      context.report(node, '{{name}}: Shopify apps can only use the Shopify Billing API.', {name: name})
    }

    return {
      ImportDeclaration: function (node) {
        if (!node || !node.source || !node.source.value) {
          return
        }

        const imports = ['@paypal/paypal-js', '@stripe/stripe-js', 'stripe', 'square', '@square/web-sdk']
        if (imports.includes(node.source.value)) {
          report(context, node, node.source.value)
        }
      },
      Identifier: function (node) {
        const identifiers = ['Stripe', 'paypal']
        if (identifiers.includes(node.name)) {
          report(context, node, node.name)
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
          report(context, node, 'Square')
        }
      },
    }
  },
}
