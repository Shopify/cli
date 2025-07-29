import {isOperationComplete, renderExportProgress, renderImportProgress} from './bulk-operation-progress.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui', () => ({
  createRightAlignedText: vi.fn((left, right) => (right ? `${left} ${right}` : left)),
  createColoredProgressBar: vi.fn((percentage) => `[${percentage}%]`),
  createIndeterminateProgressBar: vi.fn((_counter) => '[rainbow gradient bar]'),
  clearLines: vi.fn(),
  createAnimatedDots: vi.fn((counter) => '.'.repeat(counter % 4)),
}))

vi.mock('@shopify/cli-kit/node/colors', () => ({
  default: {
    dim: vi.fn((text) => text),
  },
}))

describe('bulk-operation-progress', () => {
  describe('isOperationComplete', () => {
    test('returns true when status is completed', () => {
      expect(isOperationComplete({remoteOperationStatus: 'completed'})).toBe(true)
    })

    test('returns true when status is failed', () => {
      expect(isOperationComplete({remoteOperationStatus: 'failed'})).toBe(true)
    })

    test('returns false when status is pending', () => {
      expect(isOperationComplete({remoteOperationStatus: 'pending'})).toBe(false)
    })

    test('returns false when status is undefined', () => {
      expect(isOperationComplete({})).toBe(false)
    })
  })

  describe('renderExportProgress', () => {
    test('renders progress with completed count', () => {
      const result = renderExportProgress(42, 32)
      expect(result).toContain('[rainbow gradient bar]')
      expect(result).toContain('Exporting..')
      expect(result).toContain('42 items processed')
    })

    test('renders progress with zero completed count', () => {
      const result = renderExportProgress(0, 16)
      expect(result).toContain('[rainbow gradient bar]')
      expect(result).toContain('Exporting.')
      expect(result).not.toContain('items processed')
    })

    test('cycles dot animation', () => {
      expect(renderExportProgress(5, 16)).toContain('Exporting.')
      expect(renderExportProgress(5, 32)).toContain('Exporting..')
      expect(renderExportProgress(5, 48)).toContain('Exporting...')
      expect(renderExportProgress(5, 64)).toContain('Exporting')
    })
  })

  describe('renderImportProgress', () => {
    test('renders progress with percentage calculation', () => {
      const result = renderImportProgress(25, 100, 32)
      expect(result).toContain('[25%]')
      expect(result).toContain('Importing..')
      expect(result).toContain('25 / 100')
    })

    test('handles zero total count', () => {
      const result = renderImportProgress(0, 0, 16)
      expect(result).toContain('[0%]')
      expect(result).toContain('Importing.')
      expect(result).not.toContain('/')
    })

    test('rounds percentage correctly', () => {
      const result = renderImportProgress(1, 3, 0)
      expect(result).toContain('[33%]')
    })
  })
})
