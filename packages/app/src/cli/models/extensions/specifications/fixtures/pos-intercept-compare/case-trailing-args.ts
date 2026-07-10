// Extra trailing args beyond ('event', callback) are tolerated — the event
// still resolves from the first arg with a callback present.
declare const shopify: {intercept: (event: string, handler: () => void, ...rest: unknown[]) => void}
shopify.intercept('trailing', () => {}, 'extra')
