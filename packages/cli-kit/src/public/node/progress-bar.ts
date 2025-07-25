import colors from './colors.js'
import gradient from 'gradient-string'

const MIN_FULL_WIDTH = 20
const MIN_FRACTION_WIDTH = 80

function getProgressBarWidth(): number {
  const fullWidth = process.stdout.columns ?? MIN_FRACTION_WIDTH

  if (fullWidth <= MIN_FULL_WIDTH) {
    return MIN_FULL_WIDTH
  }

  return Math.max(MIN_FRACTION_WIDTH, Math.floor((fullWidth * 2) / 3))
}

function getVisualLength(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '').length
}

/**
 * Creates right-aligned text by padding between left and right text.
 *
 * @param leftText - The text to display on the left.
 * @param rightText - The text to display on the right.
 * @returns The formatted string with proper alignment.
 */
export function createRightAlignedText(leftText: string, rightText: string): string {
  const width = getProgressBarWidth()
  const rightVisualLength = getVisualLength(rightText)
  const leftVisualLength = getVisualLength(leftText)

  const maxLeftWidth = width - rightVisualLength - 1
  const truncatedLeftText = leftVisualLength > maxLeftWidth ? `${leftText.slice(0, maxLeftWidth - 3)}...` : leftText
  const truncatedLeftVisualLength = getVisualLength(truncatedLeftText)
  const padding = Math.max(0, width - truncatedLeftVisualLength - rightVisualLength)
  return truncatedLeftText + ' '.repeat(padding) + rightText
}

/**
 * Creates a colored progress bar showing completion percentage.
 *
 * @param percentage - The completion percentage (0-100).
 * @returns The colored progress bar string.
 */
export function createColoredProgressBar(percentage: number): string {
  const width = getProgressBarWidth()

  const clampedPercentage = Math.min(100, Math.max(0, percentage))
  const filled = Math.round((clampedPercentage / 100) * width)
  const empty = width - filled

  const filledChar = '█'
  const emptyChar = '█'

  const filledBar = filledChar.repeat(filled)
  const emptyBar = emptyChar.repeat(empty)

  return colors.magenta(filledBar) + colors.dim(colors.gray(emptyBar))
}

/**
 * Creates an animated gradient progress bar for indeterminate operations.
 *
 * @param _frame - Animation frame (unused, kept for API compatibility).
 * @returns The animated gradient progress bar string.
 */
export function createIndeterminateProgressBar(_frame = 0): string {
  const width = getProgressBarWidth()
  const filledChar = '█'
  const bar = filledChar.repeat(width)

  const fastFrame = Date.now() / 100
  const hue = (fastFrame * 5) % 360
  const leftColor = `hsv(${hue}, 70%, 90%)`
  const rightColor = `hsv(${(hue + 60) % 360}, 70%, 90%)`

  return gradient(leftColor, rightColor)(bar, {interpolation: 'hsv', hsvSpin: 'short'})
}
