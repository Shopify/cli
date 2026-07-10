declare const shopify: {intercept: (event: string, handler: () => void) => void}
if (Math.random() > 0.5) {
  shopify.intercept('branchif', () => {})
} else {
  shopify.intercept('branchelse', () => {})
}
