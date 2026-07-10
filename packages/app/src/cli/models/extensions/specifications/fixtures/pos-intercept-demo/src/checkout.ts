// Imported file — its callsites are part of the extension's capability surface.
export function registerCheckoutGuards() {
  const {intercept} = shopify
  intercept('beforecapture', () => {})
}

declare const shopify: {intercept: (event: string, handler: () => void) => void}
