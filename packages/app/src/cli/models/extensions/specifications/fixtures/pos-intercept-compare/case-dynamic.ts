declare const shopify: {intercept: (event: string, handler: () => void) => void}
const evt = 'dynamic'
shopify.intercept(evt, () => {})
