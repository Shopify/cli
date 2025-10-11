/* eslint-disable no-catch-all/no-catch-all */
import GitMergePreserve from './git-merge-preserve.js'
import {preserveEnvironmentMerge} from '../../utilities/theme-merge.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Config} from '@oclif/core'
import {test, describe, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('../../utilities/theme-merge.js')
vi.mock('@shopify/cli-kit/node/output')

const CommandConfig = new Config({root: __dirname})

describe('GitMergePreserve command', () => {
  let gitMergePreserve: GitMergePreserve
  let exitSpy: any

  beforeEach(async () => {
    await CommandConfig.load()
    gitMergePreserve = new GitMergePreserve([], CommandConfig)

    // Mock process.exit to prevent actual exit during tests
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called')
    }) as any)

    vi.mocked(preserveEnvironmentMerge).mockResolvedValue({
      success: true,
      conflictResolved: true,
      strategy: 'preserve-current-environment',
    })
  })

  afterEach(() => {
    exitSpy.mockRestore()
  })

  describe('successful merge', () => {
    test('should call preserveEnvironmentMerge with correct arguments', async () => {
      const command = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json', '7'],
        CommandConfig,
      )

      try {
        await command.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(preserveEnvironmentMerge).toHaveBeenCalledWith(
        '/path/to/base.json',
        '/path/to/current.json',
        '/path/to/incoming.json',
        7,
      )
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should use default marker size when not provided', async () => {
      const testCommand = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json'],
        CommandConfig,
      )

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(preserveEnvironmentMerge).toHaveBeenCalledWith(
        '/path/to/base.json',
        '/path/to/current.json',
        '/path/to/incoming.json',
        7,
      )
    })

    test('should parse marker size from string to number', async () => {
      const testCommand = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json', '10'],
        CommandConfig,
      )

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(preserveEnvironmentMerge).toHaveBeenCalledWith(
        '/path/to/base.json',
        '/path/to/current.json',
        '/path/to/incoming.json',
        10,
      )
    })

    test('should output debug information', async () => {
      const testCommand = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json'],
        CommandConfig,
      )

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(outputDebug).toHaveBeenCalledWith('Git merge driver called: /path/to/current.json')
    })
  })

  describe('failed merge', () => {
    test('should exit with code 1 when merge fails', async () => {
      vi.mocked(preserveEnvironmentMerge).mockResolvedValue({
        success: false,
        conflictResolved: false,
        strategy: 'failed-merge',
      })

      const testCommand = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json'],
        CommandConfig,
      )

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('should handle merge function errors', async () => {
      vi.mocked(preserveEnvironmentMerge).mockRejectedValue(new Error('Merge function failed'))

      const testCommand = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json'],
        CommandConfig,
      )

      await expect(testCommand.run()).rejects.toThrow('Merge function failed')
    })
  })

  describe('argument parsing', () => {
    test('should handle invalid marker size gracefully', async () => {
      const testCommand = new GitMergePreserve(
        ['/path/to/base.json', '/path/to/current.json', '/path/to/incoming.json', 'invalid'],
        CommandConfig,
      )

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      // Should use NaN when parsing fails (parseInt('invalid') returns NaN)
      expect(preserveEnvironmentMerge).toHaveBeenCalledWith(
        '/path/to/base.json',
        '/path/to/current.json',
        '/path/to/incoming.json',
        NaN,
      )
    })

    test('should handle various file types', async () => {
      const testCases = [
        '/path/to/settings_data.json',
        '/path/to/templates/product.json',
        '/path/to/sections/hero.json',
        '/path/to/assets/style.css',
        '/path/to/locales/en/checkout.json',
      ]

      await Promise.all(
        testCases.map(async (filePath) => {
          vi.mocked(preserveEnvironmentMerge).mockClear()
          const testCommand = new GitMergePreserve(['/base.json', filePath, '/incoming.json'], CommandConfig)

          try {
            await testCommand.run()
          } catch (error) {
            // Expected: process.exit is mocked to throw for test validation
            expect((error as Error).message).toBe('process.exit called')
          }

          expect(preserveEnvironmentMerge).toHaveBeenCalledWith('/base.json', filePath, '/incoming.json', 7)
        }),
      )
    })
  })

  describe('command metadata', () => {
    test('should be hidden from help', () => {
      expect(GitMergePreserve.hidden).toBe(true)
    })

    test('should have correct description', () => {
      expect(GitMergePreserve.description).toBe(
        'Git merge driver for Shopify theme environment-specific files (internal use)',
      )
    })

    test('should have correct args defined', () => {
      const args = GitMergePreserve.args

      expect(args.base).toBeDefined()
      expect(args.base.description).toBe('Base/ancestor file path (%O)')
      expect(args.base.required).toBe(true)

      expect(args.current).toBeDefined()
      expect(args.current.description).toBe('Current branch file path (%A)')
      expect(args.current.required).toBe(true)

      expect(args.incoming).toBeDefined()
      expect(args.incoming.description).toBe('Incoming branch file path (%B)')
      expect(args.incoming.required).toBe(true)

      expect(args.markerSize).toBeDefined()
      expect(args.markerSize.description).toBe('Conflict marker size (%L)')
      expect(args.markerSize.required).toBe(false)
    })
  })

  describe('exit codes', () => {
    test('should exit with 0 for successful merge', async () => {
      vi.mocked(preserveEnvironmentMerge).mockResolvedValue({
        success: true,
        conflictResolved: true,
        strategy: 'preserve-current-environment',
      })

      const testCommand = new GitMergePreserve(['/base.json', '/current.json', '/incoming.json'], CommandConfig)

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should exit with 1 for unsuccessful merge', async () => {
      vi.mocked(preserveEnvironmentMerge).mockResolvedValue({
        success: false,
        conflictResolved: false,
        strategy: 'failed',
      })

      const testCommand = new GitMergePreserve(['/base.json', '/current.json', '/incoming.json'], CommandConfig)

      try {
        await testCommand.run()
      } catch (error) {
        // Expected: process.exit is mocked to throw for test validation
        expect((error as Error).message).toBe('process.exit called')
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
