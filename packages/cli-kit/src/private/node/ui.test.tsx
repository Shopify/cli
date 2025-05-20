import {handleCtrlC, Stdout} from './ui.js'
import {treeKill} from '../../public/node/tree-kill.js'
import {mockAndCaptureOutput} from '../../public/node/testing/output.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {Key} from 'ink'

// Only mock tree-kill
vi.mock('../../public/node/tree-kill.js', () => ({
  treeKill: vi.fn(),
}))

describe('ui', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  describe('Stdout', () => {
    test('initializes with default columns and rows', () => {
      // When
      const stdout = new Stdout({})

      // Then
      expect(stdout.columns).toBe(80)
      expect(stdout.rows).toBe(80)
    })

    test('initializes with custom columns and rows', () => {
      // When
      const stdout = new Stdout({columns: 100, rows: 50})

      // Then
      expect(stdout.columns).toBe(100)
      expect(stdout.rows).toBe(50)
    })

    test('tracks written frames and returns the last frame', () => {
      // Given
      const stdout = new Stdout({})

      // When
      stdout.write('First frame')
      stdout.write('Second frame')

      // Then
      expect(stdout.frames).toEqual(['First frame', 'Second frame'])
      expect(stdout.lastFrame()).toBe('Second frame')
    })
  })

  describe('handleCtrlC', () => {
    beforeEach(() => {
      vi.mocked(treeKill).mockClear()
    })

    test('calls treeKill with SIGINT when Ctrl+C is pressed', () => {
      // When
      // We only need the ctrl property for our tests
      const key = {ctrl: true} as Key
      handleCtrlC('c', key)

      // Then
      expect(treeKill).toHaveBeenCalledWith(process.pid, 'SIGINT')
    })

    test('does not call treeKill when other key combinations are pressed', () => {
      // When - just 'c' without ctrl
      const keyWithoutCtrl = {ctrl: false} as Key
      handleCtrlC('c', keyWithoutCtrl)

      // Then
      expect(treeKill).not.toHaveBeenCalled()

      // When - different character with ctrl
      const keyCtrlX = {ctrl: true} as Key
      handleCtrlC('x', keyCtrlX)

      // Then
      expect(treeKill).not.toHaveBeenCalled()
    })

    test('uses custom exit function when provided', () => {
      // Given
      const customExit = vi.fn()
      const key = {ctrl: true} as Key

      // When
      handleCtrlC('c', key, customExit)

      // Then
      expect(customExit).toHaveBeenCalled()
      expect(treeKill).not.toHaveBeenCalled()
    })
  })
})
