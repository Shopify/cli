import colors from './colors.js'
import {twoThirdsOfTerminalWidth} from './terminal-layout.js'
import gradient from 'gradient-string'

const ANIMATION_HUE_SPEED = 5
const GRADIENT_HUE_SPREAD = 60
const MAX_DOTS = 3

// full block character used for drawing progress bars (U+2588)
const FULL_BLOCK_CHARACTER = '█'

/**
 * Creates a colored progress bar showing completion percentage.
 *
 * @param percentage - The completion percentage (0-100).
 * @param width - The width of the progress bar in characters.
 * @returns The colored progress bar string.
 */
export function createColoredProgressBar(percentage: number, width: number = twoThirdsOfTerminalWidth()): string {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))
  const filled = Math.round((clampedPercentage / 100) * width)
  const empty = width - filled

  const filledBar = FULL_BLOCK_CHARACTER.repeat(filled)
  const emptyBar = FULL_BLOCK_CHARACTER.repeat(empty)

  return colors.magenta(filledBar) + colors.dim(colors.gray(emptyBar))
}

/**
 * Creates an animated gradient progress bar for indeterminate operations.
 *
 * @param animationIteration - The animation counter for gradient cycling.
 * @param width - The width of the progress bar in characters.
 * @returns The animated gradient progress bar string.
 */
export function createIndeterminateProgressBar(
  animationIteration: number,
  width: number = twoThirdsOfTerminalWidth(),
): string {
  const bar = FULL_BLOCK_CHARACTER.repeat(width)

  const hue = (animationIteration * ANIMATION_HUE_SPEED) % 360
  const leftColor = `hsv(${hue}, 70%, 90%)`
  const rightColor = `hsv(${(hue + GRADIENT_HUE_SPREAD) % 360}, 70%, 90%)`

  return gradient(leftColor, rightColor)(bar, {interpolation: 'hsv', hsvSpin: 'short'})
}

/**
 * Creates an animated dots string for loading indicators.
 *
 * @param animationIteration - The animation counter that gets incremented over time.
 * @returns A string with 0-3 dots for animation.
 */
export function createAnimatedDots(animationIteration: number): string {
  const dotCount = Math.floor(animationIteration) % (MAX_DOTS + 1)
  return '.'.repeat(dotCount)
}
