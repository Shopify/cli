declare const shopify: {intercept: (event: string, handler: () => void) => void}
const s = shopify
s.intercept('objectalias', () => {})
