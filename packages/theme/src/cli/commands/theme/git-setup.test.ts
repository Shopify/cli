import GitSetup from './git-setup.js'
import {
  setupMultiEnvironmentGit,
  resetGitConfiguration,
  isGitConfiguredForMultiEnv,
} from '../../utilities/git-config.js'
import {outputInfo, outputSuccess, outputWarn} from '@shopify/cli-kit/node/output'
import {insideGitDirectory} from '@shopify/cli-kit/node/git'
import {AbortError} from '@shopify/cli-kit/node/error'
import {test, describe, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('../../utilities/git-config.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/git')

const mockRootPath = '/fake/project'

describe('GitSetup command', () => {
  let gitSetup: GitSetup
  const originalCwd = process.cwd

  beforeEach(() => {
    vi.clearAllMocks()
    gitSetup = new GitSetup([], {})
    process.cwd = vi.fn().mockReturnValue(mockRootPath)
    vi.mocked(insideGitDirectory).mockResolvedValue(true)
    vi.mocked(setupMultiEnvironmentGit).mockResolvedValue()
    vi.mocked(resetGitConfiguration).mockResolvedValue()
    vi.mocked(isGitConfiguredForMultiEnv).mockResolvedValue(true)
  })

  afterEach(() => {
    process.cwd = originalCwd
  })

  describe('multi-environment flag', () => {
    test('should setup multi-environment git when flag is provided', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: false, status: false},
      })

      await gitSetup.run()

      expect(setupMultiEnvironmentGit).toHaveBeenCalledWith(mockRootPath)
      expect(outputInfo).toHaveBeenCalledWith(
        '🎉 Setup complete! Your Git repository now supports conflict-free multi-environment merges.',
      )
    })

    test('should show next steps after successful setup', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: false, status: false},
      })

      await gitSetup.run()

      expect(outputInfo).toHaveBeenCalledWith('Next steps:')
      expect(outputInfo).toHaveBeenCalledWith(expect.stringContaining('git add .gitattributes'))
      expect(outputInfo).toHaveBeenCalledWith(expect.stringContaining('Create branches for your environments'))
    })
  })

  describe('reset flag', () => {
    test('should reset git configuration when flag is provided', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': false, reset: true, status: false},
      })

      await gitSetup.run()

      expect(resetGitConfiguration).toHaveBeenCalledWith(mockRootPath)
    })
  })

  describe('status flag', () => {
    test('should show configured status when git is setup', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': false, reset: false, status: true},
      })
      vi.mocked(isGitConfiguredForMultiEnv).mockResolvedValue(true)

      await gitSetup.run()

      expect(isGitConfiguredForMultiEnv).toHaveBeenCalledWith(mockRootPath)
      expect(outputSuccess).toHaveBeenCalledWith('✅ Git is configured for multi-environment theme development')
      expect(outputInfo).toHaveBeenCalledWith(
        'Merging between environment branches will preserve environment-specific settings',
      )
    })

    test('should show unconfigured status when git is not setup', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': false, reset: false, status: true},
      })
      vi.mocked(isGitConfiguredForMultiEnv).mockResolvedValue(false)

      await gitSetup.run()

      expect(outputWarn).toHaveBeenCalledWith('⚠️  Git is not configured for multi-environment theme development')
      expect(outputInfo).toHaveBeenCalledWith(
        'Run "shopify theme git-setup --multi-environment" to eliminate merge conflicts',
      )
    })
  })

  describe('default behavior', () => {
    test('should show usage info when no flags are provided', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': false, reset: false, status: false},
      })

      await gitSetup.run()

      expect(outputInfo).toHaveBeenCalledWith('Use --multi-environment to setup conflict-free theme development')
      expect(outputInfo).toHaveBeenCalledWith('Use --status to check current configuration')
      expect(outputInfo).toHaveBeenCalledWith('Use --reset to remove Shopify theme Git customizations')
    })
  })

  describe('git directory validation', () => {
    test('should throw AbortError when not in a git directory', async () => {
      vi.mocked(insideGitDirectory).mockResolvedValue(false)
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: false, status: false},
      })

      await expect(gitSetup.run()).rejects.toThrow(AbortError)
      expect(setupMultiEnvironmentGit).not.toHaveBeenCalled()
    })

    test('should proceed when in a git directory', async () => {
      vi.mocked(insideGitDirectory).mockResolvedValue(true)
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: false, status: false},
      })

      await gitSetup.run()

      expect(setupMultiEnvironmentGit).toHaveBeenCalled()
    })
  })

  describe('flag combinations', () => {
    test('should prioritize status over other flags', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: true, status: true},
      })

      await gitSetup.run()

      expect(isGitConfiguredForMultiEnv).toHaveBeenCalled()
      expect(setupMultiEnvironmentGit).not.toHaveBeenCalled()
      expect(resetGitConfiguration).not.toHaveBeenCalled()
    })

    test('should prioritize reset over multi-environment when both are set', async () => {
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: true, status: false},
      })

      await gitSetup.run()

      expect(resetGitConfiguration).toHaveBeenCalled()
      expect(setupMultiEnvironmentGit).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    test('should handle setup errors gracefully', async () => {
      vi.mocked(setupMultiEnvironmentGit).mockRejectedValue(new Error('Setup failed'))
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': true, reset: false, status: false},
      })

      await expect(gitSetup.run()).rejects.toThrow('Setup failed')
    })

    test('should handle reset errors gracefully', async () => {
      vi.mocked(resetGitConfiguration).mockRejectedValue(new Error('Reset failed'))
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': false, reset: true, status: false},
      })

      await expect(gitSetup.run()).rejects.toThrow('Reset failed')
    })

    test('should handle status check errors gracefully', async () => {
      vi.mocked(isGitConfiguredForMultiEnv).mockRejectedValue(new Error('Status check failed'))
      gitSetup.parse = vi.fn().mockResolvedValue({
        flags: {'multi-environment': false, reset: false, status: true},
      })

      await expect(gitSetup.run()).rejects.toThrow('Status check failed')
    })
  })

  describe('command metadata', () => {
    test('should have correct summary and description', () => {
      expect(GitSetup.summary).toBe('Configure Git for conflict-free multi-environment theme development')
      expect(GitSetup.description).toBe(
        'Setup Git merge strategies to eliminate conflicts when working with themes across multiple environments (dev, staging, production).',
      )
    })

    test('should have correct flags defined', () => {
      const flags = GitSetup.flags

      expect(flags['multi-environment']).toBeDefined()
      expect(flags['multi-environment'].description).toBe('Setup Git merge strategies for multi-environment themes')
      expect(flags['multi-environment'].default).toBe(false)

      expect(flags.reset).toBeDefined()
      expect(flags.reset.description).toBe('Reset Git configuration to remove Shopify theme customizations')
      expect(flags.reset.default).toBe(false)

      expect(flags.status).toBeDefined()
      expect(flags.status.description).toBe('Show current Git configuration status')
      expect(flags.status.default).toBe(false)
    })
  })
})
