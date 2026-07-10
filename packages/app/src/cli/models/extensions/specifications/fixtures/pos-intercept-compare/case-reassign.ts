declare const shopify: {intercept: (event: string, handler: () => void) => void}
let fn: typeof shopify.intercept
fn = shopify.intercept
fn('reassigned', () => {})
