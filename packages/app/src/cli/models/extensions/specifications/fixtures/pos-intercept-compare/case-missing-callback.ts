// Literal event but NO callback second arg. The real API requires a callback,
// so this is a suspected MALFORMED registration: surfaced (complex: unresolved,
// simple: missing-callback warning), never silently counted as an event.
declare const shopify: {intercept: (event: string, handler?: () => void) => void}
shopify.intercept('missingcb')
