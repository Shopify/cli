declare const shopify: {intercept: (event: string, handler: () => void) => void}
const {intercept} = shopify
intercept('destructured', () => {})
