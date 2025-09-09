import {setupMultiEnvironmentGit, resetGitConfiguration, isGitConfiguredForMultiEnv} from './git-config.js'
import {writeFile, fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {exec, captureOutput} from '@shopify/cli-kit/node/system'
import {outputInfo, outputSuccess, outputWarn} from '@shopify/cli-kit/node/output'
import {ensureInsideGitDirectory} from '@shopify/cli-kit/node/git'
import {AbortError} from '@shopify/cli-kit/node/error'
import {test, describe, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/error')

const mockRootPath = '/fake/project'
const mockGitAttributesPath = '/fake/project/.gitattributes'

describe('git-config', () => {
  beforeEach(() => {
    vi.mocked(joinPath).mockReturnValue(mockGitAttributesPath)
    vi.mocked(ensureInsideGitDirectory).mockResolvedValue()
    vi.mocked(exec).mockResolvedValue()
    vi.mocked(captureOutput).mockResolvedValue('shopify theme git-merge-preserve')
    vi.mocked(fileExists).mockResolvedValue(false)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(''))
    vi.mocked(writeFile).mockResolvedValue()
  })

  describe('setupMultiEnvironmentGit', () => {
    test('should setup git attributes and merge drivers', async () => {
      await setupMultiEnvironmentGit(mockRootPath)

      expect(ensureInsideGitDirectory).toHaveBeenCalledWith(mockRootPath)
      expect(outputInfo).toHaveBeenCalledWith('Configuring Git for multi-environment theme development...')
      expect(outputSuccess).toHaveBeenCalledWith('✅ Git configured for multi-environment theme development')
    })

    test('should create .gitattributes file with Shopify configuration', async () => {
      await setupMultiEnvironmentGit(mockRootPath)

      expect(joinPath).toHaveBeenCalledWith(mockRootPath, '.gitattributes')
      expect(writeFile).toHaveBeenCalledWith(
        mockGitAttributesPath,
        expect.stringContaining('# Shopify Theme Multi-Environment Configuration'),
      )
      expect(writeFile).toHaveBeenCalledWith(
        mockGitAttributesPath,
        expect.stringContaining('config/settings_data.json merge=shopify-preserve-env'),
      )
    })

    test('should configure git merge drivers', async () => {
      await setupMultiEnvironmentGit(mockRootPath)

      expect(exec).toHaveBeenCalledWith(
        'git',
        ['config', 'merge.shopify-preserve-env.driver', 'shopify theme git-merge-preserve %O %A %B %L'],
        {cwd: mockRootPath},
      )
      expect(exec).toHaveBeenCalledWith(
        'git',
        ['config', 'merge.shopify-preserve-env.name', 'Shopify theme environment-preserving merge'],
        {cwd: mockRootPath},
      )
    })

    test('should skip .gitattributes setup if already configured', async () => {
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(
        Buffer.from('# Shopify Theme Multi-Environment Configuration\nexisting content'),
      )

      await setupMultiEnvironmentGit(mockRootPath)

      expect(outputInfo).toHaveBeenCalledWith('.gitattributes already configured for multi-environment themes')
    })

    test('should throw error if git merge driver configuration fails', async () => {
      vi.mocked(exec).mockRejectedValue(new Error('Git config failed'))

      await expect(setupMultiEnvironmentGit(mockRootPath)).rejects.toThrow(AbortError)
    })

    test('should handle validation errors gracefully', async () => {
      vi.mocked(captureOutput).mockRejectedValue(new Error('Validation failed'))

      await setupMultiEnvironmentGit(mockRootPath)

      expect(outputWarn).toHaveBeenCalledWith(expect.stringContaining('Git configuration validation failed'))
    })
  })

  describe('resetGitConfiguration', () => {
    test('should reset git merge driver configuration', async () => {
      await resetGitConfiguration(mockRootPath)

      expect(exec).toHaveBeenCalledWith('git', ['config', '--unset', 'merge.shopify-preserve-env.driver'], {
        cwd: mockRootPath,
      })
      expect(exec).toHaveBeenCalledWith('git', ['config', '--unset', 'merge.shopify-preserve-env.name'], {
        cwd: mockRootPath,
      })
      expect(outputSuccess).toHaveBeenCalledWith('✅ Git configuration reset')
    })

    test('should provide warning about .gitattributes not being removed', async () => {
      await resetGitConfiguration(mockRootPath)

      expect(outputWarn).toHaveBeenCalledWith('Note: .gitattributes file content not automatically removed')
      expect(outputInfo).toHaveBeenCalledWith(
        'Remove Shopify theme configuration from .gitattributes manually if needed',
      )
    })

    test('should handle errors during reset gracefully', async () => {
      vi.mocked(exec).mockRejectedValue(new Error('Config unset failed'))

      await resetGitConfiguration(mockRootPath)

      expect(outputWarn).toHaveBeenCalledWith(expect.stringContaining('Some configuration may not have been reset'))
    })
  })

  describe('isGitConfiguredForMultiEnv', () => {
    test('should return true when merge driver is configured', async () => {
      vi.mocked(captureOutput).mockResolvedValue('shopify theme git-merge-preserve %O %A %B %L')

      const result = await isGitConfiguredForMultiEnv(mockRootPath)

      expect(result).toBe(true)
      expect(captureOutput).toHaveBeenCalledWith('git', ['config', 'merge.shopify-preserve-env.driver'], {
        cwd: mockRootPath,
      })
    })

    test('should return false when merge driver is not configured', async () => {
      vi.mocked(captureOutput).mockResolvedValue('some other driver')

      const result = await isGitConfiguredForMultiEnv(mockRootPath)

      expect(result).toBe(false)
    })

    test('should return false when git config command fails', async () => {
      vi.mocked(captureOutput).mockRejectedValue(new Error('Config not found'))

      const result = await isGitConfiguredForMultiEnv(mockRootPath)

      expect(result).toBe(false)
    })
  })

  describe('Git attributes content', () => {
    test('should include all expected file patterns', async () => {
      await setupMultiEnvironmentGit(mockRootPath)

      const writeCallArgs = vi.mocked(writeFile).mock.calls[0]
      expect(writeCallArgs).toBeDefined()
      const gitAttributesContent = writeCallArgs![1] as string

      expect(gitAttributesContent).toContain('config/settings_data.json merge=shopify-preserve-env')
      expect(gitAttributesContent).toContain('templates/*.json merge=shopify-preserve-env')
      expect(gitAttributesContent).toContain('sections/*.json merge=shopify-preserve-env')
      expect(gitAttributesContent).toContain('locales/*/checkout.json merge=shopify-preserve-env')
      expect(gitAttributesContent).toContain('locales/*/customer.json merge=shopify-preserve-env')
      expect(gitAttributesContent).toContain('locales/*/sections.json merge=shopify-preserve-env')
      expect(gitAttributesContent).toContain('*.liquid diff=text')
      expect(gitAttributesContent).toContain('assets/* diff=text')
    })

    test('should append to existing .gitattributes content', async () => {
      const existingContent = '# Existing content\n*.txt text=auto'
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(readFile).mockResolvedValue(Buffer.from(existingContent))

      await setupMultiEnvironmentGit(mockRootPath)

      const writeCallArgs = vi.mocked(writeFile).mock.calls[0]
      expect(writeCallArgs).toBeDefined()
      const newContent = writeCallArgs![1] as string

      expect(newContent).toContain(existingContent)
      expect(newContent).toContain('# Shopify Theme Multi-Environment Configuration')
    })
  })
})
