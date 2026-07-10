declare const shopify: {intercept: (event: string, handler: () => void) => void}
shopify.intercept('beforecheckout', () => {})
