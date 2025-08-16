import {createRightAlignedText, clearLines, twoThirdsOfTerminalWidth} from './terminal-layout.js'
import {describe, test, expect, vi} from 'vitest'

describe('terminal-layout utilities', () => {
  describe('createRightAlignedText', () => {
    test('pads the string to match terminal width', () => {
      const result = createRightAlignedText('Importing...', '50 / 100')
      expect(result.length).toBe(80)
      expect(result).toMatchInlineSnapshot(
        `"Importing...                                                            50 / 100"`,
      )
    })

    test('truncates long left text to make sure the right text can display fully', () => {
      const result = createRightAlignedText(
        'Very long importing text that should be truncated before this because it is so long',
        '50 / 100',
      )
      expect(result.length).toBe(80)
      expect(result).toMatchInlineSnapshot(
        `"Very long importing text that should be truncated before this becaus... 50 / 100"`,
      )
    })

    test('never truncates to less than 80 characters', () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: 10,
        writable: true,
      })

      const result = createRightAlignedText('Left', 'Right')
      expect(result.length).toBe(80)
    })
  })

  describe('clearLines', () => {
    const mockStdoutWrite = vi.fn()

    Object.defineProperty(process.stdout, 'write', {
      value: mockStdoutWrite,
      writable: true,
    })

    test('writes cursor control sequences for each line', () => {
      clearLines(3)
      expect(mockStdoutWrite).toHaveBeenCalledTimes(3)
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[1A\x1b[2K\r')
    })

    test('does nothing when clearing 0 lines', () => {
      clearLines(0)
      expect(mockStdoutWrite).not.toHaveBeenCalled()
    })
  })

  describe('twoThirdsOfTerminalWidth', () => {
    test('returns terminal width based on 2/3 ratio', () => {
      Object.defineProperty(process.stdout, 'columns', {value: 300, writable: true})
      expect(twoThirdsOfTerminalWidth()).toBe(200)
    })

    test('respects minimum terminal width', () => {
      Object.defineProperty(process.stdout, 'columns', {value: 10, writable: true})
      expect(twoThirdsOfTerminalWidth()).toBe(80)
    })
  })
})
