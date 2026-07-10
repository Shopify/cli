// Module for the `pos.home.tile.render` target. This target does NOT support
// intercepts, so the detector must NOT scan it. If scoping is broken, the event
// below would leak into the derived capabilities.
declare const shopify: {intercept: (event: string, handler: () => void) => void}

export function renderTile() {
  shopify.intercept('shouldnotappear', () => {})
}
