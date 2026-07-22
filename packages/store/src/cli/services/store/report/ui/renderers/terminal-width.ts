const MIN_FULL_WIDTH = 20
const MIN_FRACTION_WIDTH = 80

/**
 * Mirrors cli-kit's `useLayout` two-thirds column calculation (private/node/ui/hooks/use-layout.ts)
 * without importing it, since cli-kit's UI internals are unreachable from `@shopify/store`.
 */
export function twoThirdsWidth(columns: number | undefined): number {
  const fullWidth = columns ?? MIN_FRACTION_WIDTH
  if (fullWidth <= MIN_FULL_WIDTH) return MIN_FULL_WIDTH
  if (fullWidth <= MIN_FRACTION_WIDTH) return fullWidth

  const fractioned = Math.floor((fullWidth * 2) / 3)
  return fractioned < MIN_FRACTION_WIDTH ? MIN_FRACTION_WIDTH : fractioned
}
