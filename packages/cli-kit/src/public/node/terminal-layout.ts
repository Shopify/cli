const MIN_TERMINAL_WIDTH = 80
const TERMINAL_WIDTH_RATIO = 2 / 3
const TRUNCATION_SUFFIX_LENGTH = 3
const CURSOR_UP_AND_CLEAR = '\x1b[1A\x1b[2K\r'

/**
 * Calculates the length of a string, ignoring ANSI escape codes.
 * (That lets use calculate how much space the string will actually take up when displayed.).
 *
 * @param text - The text to measure.
 * @returns The length of the text without ANSI escape codes.
 */
function getVisualLength(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '').length
}

/**
 * Creates right-aligned text by padding between left and right text.
 *
 * @param leftText - The text to display on the left.
 * @param rightText - The text to display on the right.
 * @param width - The total width for the aligned text.
 * @returns The formatted string with proper alignment.
 */
export function createRightAlignedText(
  leftText: string,
  rightText: string,
  width: number = twoThirdsOfTerminalWidth(),
): string {
  const rightVisualLength = getVisualLength(rightText)
  const leftVisualLength = getVisualLength(leftText)

  const maxLeftWidth = width - rightVisualLength - 1
  let truncatedLeftText = leftText
  if (leftVisualLength > maxLeftWidth) {
    if (maxLeftWidth > TRUNCATION_SUFFIX_LENGTH) {
      truncatedLeftText = `${leftText.slice(0, maxLeftWidth - TRUNCATION_SUFFIX_LENGTH)}...`
    } else {
      truncatedLeftText = ''
    }
  }
  const truncatedLeftVisualLength = getVisualLength(truncatedLeftText)
  const padding = Math.max(0, width - truncatedLeftVisualLength - rightVisualLength)
  return truncatedLeftText + ' '.repeat(padding) + rightText
}

/**
 * Clears the specified number of lines from the terminal by moving cursor up and clearing each line.
 *
 * @param lineCount - The number of lines to clear.
 */
export function clearLines(lineCount: number): void {
  for (let i = 0; i < lineCount; i++) {
    process.stdout.write(CURSOR_UP_AND_CLEAR)
  }
}

/**
 * Calculates an appropriate width to use for terminal content like progress bars.
 * Tries to use two-thirds of the available width, but never less than 20 characters.
 *
 * @returns The calculated terminal width.
 */
export function twoThirdsOfTerminalWidth(): number {
  const fullWidth = process.stdout.columns ?? MIN_TERMINAL_WIDTH
  return Math.max(MIN_TERMINAL_WIDTH, Math.floor(fullWidth * TERMINAL_WIDTH_RATIO))
}
