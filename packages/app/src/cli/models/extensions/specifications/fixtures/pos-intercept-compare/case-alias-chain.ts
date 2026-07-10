// Alias CHAIN: const a = shopify; const b = a. Complex resolves through the
// chain; simple can't read the event but WARNS (never a silent miss).
declare const shopify: {intercept: (event: string, handler: () => void) => void}
const a = shopify
const b = a
b.intercept('aliaschain', () => {})
