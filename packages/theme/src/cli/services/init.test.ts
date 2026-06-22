import {cloneRepoAndCheckoutLatestTag, cloneRepo, createAIInstructions, createAIInstructionFiles} from './init.js'
import {describe, expect, vi, test} from 'vitest'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import * as fs from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/ui')>('@shopify/cli-kit/node/ui')
  return {
    ...actual,
    renderSelectPrompt: vi.fn(),
    renderTasks: vi.fn(async (tasks: any[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    }),
  }
})

describe('cloneRepoAndCheckoutLatestTag()', async () => {
  test('calls downloadRepository function from git service to clone a repo with latest tag', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/dawn.git'
      const destination = joinPath(tmpDir, 'destination')
      const latestTag = true
      const shallow = true

      // When
      await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

      // Then
      expect(downloadGitRepository).toHaveBeenCalledWith({repoUrl, destination, latestTag, shallow})
    })
  })

  test('removes git remote after cloning', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/dawn.git'
      const destination = joinPath(tmpDir, 'destination')

      // When
      await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

      // Then
      expect(removeGitRemote).toHaveBeenCalledWith(destination)
    })
  })

  test('removes .github directory from skeleton theme after cloning when it exists', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/skeleton-theme.git'
      const destination = joinPath(tmpDir, 'destination')
      await fs.mkdir(destination)
      const githubDir = joinPath(destination, '.github')
      await fs.mkdir(githubDir)

      // When
      await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

      // Then
      expect(fs.fileExistsSync(githubDir)).toBe(false)
    })
  })

  test('doesnt remove .github directory from non-skeleton theme after cloning when it exists', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/dawn.git'
      const destination = joinPath(tmpDir, 'destination')
      await fs.mkdir(destination)
      const githubDir = joinPath(destination, '.github')
      await fs.mkdir(githubDir)

      // When
      await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

      // Then
      expect(fs.fileExistsSync(githubDir)).toBe(true)
    })
  })
})

describe('cloneRepo()', async () => {
  test('calls downloadRepository function from git service to clone a repo without branch', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/dawn.git'
      const destination = joinPath(tmpDir, 'destination')
      const shallow = true

      // When
      await cloneRepo(repoUrl, destination)

      // Then
      expect(downloadGitRepository).toHaveBeenCalledWith({repoUrl, destination, shallow})
    })
  })

  test('removes git remote after cloning', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/dawn.git'
      const destination = joinPath(tmpDir, 'destination')

      // When
      await cloneRepo(repoUrl, destination)

      // Then
      expect(removeGitRemote).toHaveBeenCalledWith(destination)
    })
  })

  test('removes .github directory from skeleton theme after cloning when it exists', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/skeleton-theme.git'
      const destination = joinPath(tmpDir, 'destination')
      await fs.mkdir(destination)
      const githubDir = joinPath(destination, '.github')
      await fs.mkdir(githubDir)

      // When
      await cloneRepo(repoUrl, destination)

      // Then
      expect(fs.fileExistsSync(githubDir)).toBe(false)
    })
  })

  test('doesnt remove .github directory from non-skeleton theme after cloning when it exists', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const repoUrl = 'https://github.com/Shopify/dawn.git'
      const destination = joinPath(tmpDir, 'destination')
      await fs.mkdir(destination)
      const githubDir = joinPath(destination, '.github')
      await fs.mkdir(githubDir)

      // When
      await cloneRepo(repoUrl, destination)

      // Then
      expect(fs.fileExistsSync(githubDir)).toBe(true)
    })
  })
})

describe('createAIInstructions()', () => {
  test('creates AI instructions for a single instruction type', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const destination = joinPath(tmpDir, 'theme')
      await fs.mkdir(destination)
      vi.mocked(downloadGitRepository).mockImplementation(async (options: any) => {
        const aiGithubDir = joinPath(options.destination, 'ai', 'github')
        await fs.mkdir(aiGithubDir)
        await fs.writeFile(joinPath(aiGithubDir, 'copilot-instructions.md'), 'Sample AI instructions content')
      })

      // When
      await createAIInstructions(destination, 'cursor')

      // Then
      expect(downloadGitRepository).toHaveBeenCalled()
      const agentsPath = joinPath(destination, 'AGENTS.md')
      expect(fs.fileExistsSync(agentsPath)).toBe(true)
      expect(fs.readFileSync(agentsPath).toString()).toContain('Sample AI instructions content')
    })
  })

  test('creates AI instructions for all instruction types when "all" is selected', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const destination = joinPath(tmpDir, 'theme')
      await fs.mkdir(destination)
      vi.mocked(downloadGitRepository).mockImplementation(async (options: any) => {
        const aiGithubDir = joinPath(options.destination, 'ai', 'github')
        await fs.mkdir(aiGithubDir)
        await fs.writeFile(joinPath(aiGithubDir, 'copilot-instructions.md'), 'Sample AI instructions content')
      })

      // When
      await createAIInstructions(destination, 'all')

      // Then
      expect(downloadGitRepository).toHaveBeenCalled()
      expect(fs.fileExistsSync(joinPath(destination, 'AGENTS.md'))).toBe(true)
      expect(fs.fileExistsSync(joinPath(destination, 'copilot-instructions.md'))).toBe(true)
      expect(fs.fileExistsSync(joinPath(destination, 'CLAUDE.md'))).toBe(true)
    })
  })

  test('throws an error when file operations fail', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const destination = joinPath(tmpDir, 'theme')
      await fs.mkdir(destination)
      vi.mocked(downloadGitRepository).mockResolvedValue()

      await expect(createAIInstructions(destination, 'cursor')).rejects.toThrow('Failed to create AI instructions')
    })
  })
})

describe('createAIInstructionFiles()', () => {
  test('creates symlink for github instruction', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const themeRoot = tmpDir
      const agentsPath = joinPath(themeRoot, 'AGENTS.md')
      await fs.writeFile(agentsPath, 'content')

      // When
      await createAIInstructionFiles(themeRoot, agentsPath, 'github')

      // Then
      const symlinkPath = joinPath(themeRoot, 'copilot-instructions.md')
      expect(fs.fileExistsSync(symlinkPath)).toBe(true)
    })
  })

  test('does not create symlink for cursor instruction (uses AGENTS.md natively)', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const themeRoot = tmpDir
      const agentsPath = joinPath(themeRoot, 'AGENTS.md')
      await fs.writeFile(agentsPath, 'content')

      // When
      await createAIInstructionFiles(themeRoot, agentsPath, 'cursor')

      // Then
      expect(fs.fileExistsSync(joinPath(themeRoot, 'copilot-instructions.md'))).toBe(false)
      expect(fs.fileExistsSync(joinPath(themeRoot, 'CLAUDE.md'))).toBe(false)
    })
  })

  test('creates symlink for claude instruction', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const themeRoot = tmpDir
      const agentsPath = joinPath(themeRoot, 'AGENTS.md')
      await fs.writeFile(agentsPath, 'content')

      // When
      await createAIInstructionFiles(themeRoot, agentsPath, 'claude')

      // Then
      const symlinkPath = joinPath(themeRoot, 'CLAUDE.md')
      expect(fs.fileExistsSync(symlinkPath)).toBe(true)
    })
  })

  test('falls back to copying file when symlink fails with EPERM', async () => {
    await fs.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const themeRoot = tmpDir
      const agentsPath = joinPath(themeRoot, 'AGENTS.md')
      await fs.writeFile(agentsPath, 'AGENTS.md content')

      vi.spyOn(fs, 'symlink').mockRejectedValue(new Error('EPERM: operation not permitted'))

      // When
      const result = await createAIInstructionFiles(themeRoot, agentsPath, 'github')

      // Then
      expect(fs.symlink).toHaveBeenCalled()
      const symlinkPath = joinPath(themeRoot, 'copilot-instructions.md')
      expect(fs.fileExistsSync(symlinkPath)).toBe(true)
      expect(fs.readFileSync(symlinkPath).toString()).toBe('AGENTS.md content')
      expect(result.copiedFile).toBe('copilot-instructions.md')
    })
  })
})
