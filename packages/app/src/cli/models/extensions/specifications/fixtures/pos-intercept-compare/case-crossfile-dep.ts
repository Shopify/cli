declare const shopify: {intercept: (event: string, handler: () => void) => void}
export const block = shopify.intercept
