import {createColoredProgressBar, createIndeterminateProgressBar, createAnimatedDots} from './progress-indicators.js'
import {twoThirdsOfTerminalWidth} from './terminal-layout.js'
import colors from './colors.js'
import {describe, test, expect, vi} from 'vitest'

// full block character used for drawing progress bars (U+2588)
const FULL_BLOCK_CHARACTER = '█'

vi.mock('./terminal-layout.js', () => ({
  twoThirdsOfTerminalWidth: vi.fn(() => 80),
}))

const charWithColor = (char: string, red: number, green: number, blue: number) => {
  return `\u001b[38;2;${red};${green};${blue}m${char}\u001b[39m`
}

vi.mock('gradient-string', () => ({
  default: () => (text: string) => {
    return text
      .split('')
      .map((char, index) => charWithColor(char, index, 0, 0))
      .join('')
  },
}))

describe('progress-indicators utilities', () => {
  describe('createColoredProgressBar', () => {
    const bar = (length: number) => FULL_BLOCK_CHARACTER.repeat(length)

    test('shows all gray blocks at 0% progress', () => {
      const result = createColoredProgressBar(0)
      expect(result).toBe(colors.dim(colors.gray(bar(80))))
    })

    test('shows 20 magenta and 60 gray blocks at 25% progress', () => {
      const result = createColoredProgressBar(25)
      expect(result).toBe(colors.magenta(bar(20)) + colors.dim(colors.gray(bar(60))))
    })

    test('shows full magenta bar at 100% progress', () => {
      const result = createColoredProgressBar(100)
      expect(result).toBe(colors.magenta(bar(80)))
    })

    test('rounds to the nearest segment count when the percentage does not divide evenly', () => {
      const result = createColoredProgressBar(33.333)
      expect(result).toBe(colors.magenta(bar(27)) + colors.dim(colors.gray(bar(53))))
    })
  })

  describe('createIndeterminateProgressBar', () => {
    test('displays a bar composed of full blocks, with a color gradient', async () => {
      const terminalWidth = 5
      vi.mocked(twoThirdsOfTerminalWidth).mockReturnValue(terminalWidth)

      const expectedGradientBar = Array.from({length: terminalWidth}, (_, index) =>
        charWithColor(FULL_BLOCK_CHARACTER, index, 0, 0),
      ).join('')

      expect(createIndeterminateProgressBar(0)).toBe(expectedGradientBar)
    })
  })

  describe('createAnimatedDots', () => {
    test('cycles through dot counts based on counter', () => {
      expect(createAnimatedDots(0)).toBe('')
      expect(createAnimatedDots(1)).toBe('.')
      expect(createAnimatedDots(2)).toBe('..')
      expect(createAnimatedDots(3)).toBe('...')
      expect(createAnimatedDots(4)).toBe('')
      expect(createAnimatedDots(5)).toBe('.')
      expect(createAnimatedDots(6)).toBe('..')
      expect(createAnimatedDots(7)).toBe('...')
      expect(createAnimatedDots(8)).toBe('')
    })
  })
})
