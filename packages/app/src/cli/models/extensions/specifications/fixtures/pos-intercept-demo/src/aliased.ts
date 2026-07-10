// The intercept reference is aliased AND re-exported from here. The detector
// must resolve `block` (imported elsewhere) back to shopify.intercept.
declare const shopify: {intercept: (event: string, handler: () => void) => void}

export const block = shopify.intercept
