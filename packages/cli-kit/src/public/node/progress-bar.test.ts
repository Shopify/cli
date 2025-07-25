import {createRightAlignedText, createColoredProgressBar, createIndeterminateProgressBar} from './progress-bar.js'
import colors from './colors.js'
import gradient from 'gradient-string'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'

vi.mock('gradient-string')

describe('progress-bar', () => {
  const originalStdoutColumns = process.stdout.columns

  beforeEach(() => {
    // vi.clearAllMocks() - handled automatically by vitest
  })

  afterEach(() => {
    process.stdout.columns = originalStdoutColumns
  })

  describe('createRightAlignedText', () => {
    test('aligns text with proper padding when terminal is wide enough', () => {
      process.stdout.columns = 100

      const result = createRightAlignedText('Importing...', '50 / 100')

      expect(result).toMatch(/^Importing\.\.\.\s+50 \/ 100$/)
      // 2/3 of 100, but min 80
      expect(result.length).toBe(80)
    })

    test('truncates left text with ellipsis when too long', () => {
      // This will use MIN_FULL_WIDTH = 20
      process.stdout.columns = 15

      const result = createRightAlignedText('Very long importing text that should be truncated', '50 / 100')

      // With 15 columns, width is MIN_FULL_WIDTH (20), right text is 8 chars, left max is 20-8-1=11 chars
      // So text gets truncated to 8 chars + '...' = 11 chars total
      expect(result).toContain('Very lon...')
      expect(result).toContain('50 / 100')
      // MIN_FULL_WIDTH
      expect(result.length).toBe(20)
    })

    test('handles empty right text', () => {
      process.stdout.columns = 50

      const result = createRightAlignedText('Exporting...', '')

      expect(result).toMatch(/^Exporting\.\.\.\s*$/)
    })

    test('respects minimum width when terminal is very narrow', () => {
      process.stdout.columns = 10

      const result = createRightAlignedText('Test', '123')

      // MIN_FULL_WIDTH
      expect(result.length).toBe(20)
    })

    test('strips ANSI escape codes when calculating visual length', () => {
      process.stdout.columns = 50
      const coloredText = colors.cyan('Importing...')

      const result = createRightAlignedText(coloredText, '50')

      // Should calculate padding based on visual length (12), not string length (which includes ANSI codes)
      expect(result).toContain('Importing...')
      expect(result).toContain('50')
    })
  })

  describe('createColoredProgressBar', () => {
    test('creates empty bar for 0%', () => {
      process.stdout.columns = 30

      const result = createColoredProgressBar(0)

      // Width will be 80, should be all gray (empty)
      expect(result).toBe(colors.dim(colors.gray('█'.repeat(80))))
    })

    test('creates full bar for 100%', () => {
      process.stdout.columns = 30

      const result = createColoredProgressBar(100)

      // Width will be 80, should be all magenta (filled)
      expect(result).toBe(colors.magenta('█'.repeat(80)))
    })

    test('creates partial bar for 50%', () => {
      process.stdout.columns = 30

      const result = createColoredProgressBar(50)

      // Width will be 80, 50% = 40 filled, 40 empty
      const expected = colors.magenta('█'.repeat(40)) + colors.dim(colors.gray('█'.repeat(40)))
      expect(result).toBe(expected)
    })

    test('rounds percentage correctly', () => {
      process.stdout.columns = 30

      const result = createColoredProgressBar(33)

      // Width will be 80, 33% of 80 = 26.4, should round to 26
      const expected = colors.magenta('█'.repeat(26)) + colors.dim(colors.gray('█'.repeat(54)))
      expect(result).toBe(expected)
    })

    test('handles percentage over 100%', () => {
      process.stdout.columns = 30

      const result = createColoredProgressBar(120)

      // Should clamp to 100%, width will be 80
      expect(result).toBe(colors.magenta('█'.repeat(80)))
    })
  })

  describe('createIndeterminateProgressBar', () => {
    const mockGradientInstance = vi.fn()

    beforeEach(() => {
      vi.mocked(gradient).mockReturnValue(mockGradientInstance as any)
      mockGradientInstance.mockReturnValue('mocked-gradient-result')

      // Mock Date.now to make time-based tests predictable
      vi.spyOn(Date, 'now').mockReturnValue(10000)
    })

    afterEach(() => {
      vi.mocked(Date.now).mockRestore()
    })

    test('creates animated gradient bar', () => {
      process.stdout.columns = 30

      const result = createIndeterminateProgressBar()

      // Date.now() / 100 * 5 % 360 = 10000 / 100 * 5 % 360 = 500 % 360 = 140
      expect(gradient).toHaveBeenCalledWith('hsv(140, 70%, 90%)', 'hsv(200, 70%, 90%)')
      // Width is 80 when columns = 30
      expect(mockGradientInstance).toHaveBeenCalledWith('█'.repeat(80), {
        interpolation: 'hsv',
        hsvSpin: 'short',
      })
      expect(result).toBe('mocked-gradient-result')
    })

    test('uses different colors at different times', () => {
      process.stdout.columns = 30

      // First call at time 10000: (10000 / 100 * 5) % 360 = 500 % 360 = 140
      createIndeterminateProgressBar()
      expect(gradient).toHaveBeenLastCalledWith('hsv(140, 70%, 90%)', 'hsv(200, 70%, 90%)')

      // Second call at time 20000: (20000 / 100 * 5) % 360 = 1000 % 360 = 280
      vi.mocked(Date.now).mockReturnValue(20000)
      createIndeterminateProgressBar()
      expect(gradient).toHaveBeenLastCalledWith('hsv(280, 70%, 90%)', 'hsv(340, 70%, 90%)')
    })

    test('handles hue wrapping around 360 degrees', () => {
      process.stdout.columns = 30
      // Should result in hue 3600 % 360 = 0
      vi.mocked(Date.now).mockReturnValue(72000)

      createIndeterminateProgressBar()

      expect(gradient).toHaveBeenCalledWith('hsv(0, 70%, 90%)', 'hsv(60, 70%, 90%)')
    })

    test('ignores _frame parameter but maintains API compatibility', () => {
      process.stdout.columns = 30

      const result1 = createIndeterminateProgressBar(0)
      const result2 = createIndeterminateProgressBar(999)

      // Both should produce same result since frame is ignored
      expect(result1).toBe('mocked-gradient-result')
      expect(result2).toBe('mocked-gradient-result')
      expect(gradient).toHaveBeenCalledTimes(2)
    })

    test('creates different width bars based on terminal size', () => {
      // Very narrow terminal - should use MIN_FULL_WIDTH (20) when <= 20
      process.stdout.columns = 15
      createIndeterminateProgressBar()
      // MIN_FULL_WIDTH
      expect(mockGradientInstance).toHaveBeenLastCalledWith('█'.repeat(20), expect.any(Object))

      // Wide terminal - should use max(80, floor(150 * 2/3)) = max(80, 100) = 100
      process.stdout.columns = 150
      createIndeterminateProgressBar()
      // max(80, floor(150 * 2/3)) = max(80, 100) = 100
      expect(mockGradientInstance).toHaveBeenLastCalledWith('█'.repeat(100), expect.any(Object))
    })
  })
})
