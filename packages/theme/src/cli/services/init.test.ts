import {cloneRepoAndCheckoutLatestTag, cloneRepo, createAIInstructions, createAIInstructionFiles} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/shared/node/git'
import {rmdir, fileExists, readFile, writeFile, symlink} from '@shopify/cli-kit/shared/node/fs'
import {joinPath} from '@shopify/cli-kit/shared/node/path'

vi.mock('@shopify/cli-kit/shared/node/git')
vi.mock('@shopify/cli-kit/shared/node/fs', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/shared/node/fs')
  return {
    ...actual,
    fileExists: vi.fn(),
    rmdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    symlink: vi.fn(),
    inTemporaryDirectory: vi.fn(async (callback) => {
      // eslint-disable-next-line node/no-callback-literal
      return callback('/tmp')
    }),
  }
})
vi.mock('@shopify/cli-kit/shared/node/http')
vi.mock('@shopify/cli-kit/shared/node/path')
vi.mock('@shopify/cli-kit/shared/node/ui', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/shared/node/ui')
  return {
    ...actual,
    renderSelectPrompt: vi.fn(),
  }
})

describe('cloneRepoAndCheckoutLatestTag()', async () => {
  beforeEach(() => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(joinPath).mockImplementation((...paths) => paths.join('/'))
  })

  test('calls downloadRepository function from git service to clone a repo with latest tag', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    const latestTag = true
    const shallow = true

    // When
    await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

    // Then
    expect(downloadGitRepository).toHaveBeenCalledWith({repoUrl, destination, latestTag, shallow})
  })

  test('removes git remote after cloning', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'

    // When
    await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

    // Then
    expect(removeGitRemote).toHaveBeenCalledWith(destination)
  })

  test('removes .github directory from skeleton theme after cloning when it exists', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/skeleton-theme.git'
    const destination = 'destination'
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

    // Then
    expect(fileExists).toHaveBeenCalledWith('destination/.github')
    expect(rmdir).toHaveBeenCalledWith('destination/.github')
  })

  test('doesnt remove .github directory from non-skeleton theme after cloning when it exists', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

    // Then
    expect(rmdir).not.toHaveBeenCalledWith('destination/.github')
  })
})

describe('cloneRepo()', async () => {
  beforeEach(() => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(joinPath).mockImplementation((...paths) => paths.join('/'))
  })

  test('calls downloadRepository function from git service to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    const shallow = true
    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(downloadGitRepository).toHaveBeenCalledWith({repoUrl, destination, shallow})
  })

  test('removes git remote after cloning', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'

    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(removeGitRemote).toHaveBeenCalledWith(destination)
  })

  test('removes .github directory from skeleton theme after cloning when it exists', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/skeleton-theme.git'
    const destination = 'destination'
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(fileExists).toHaveBeenCalledWith('destination/.github')
    expect(rmdir).toHaveBeenCalledWith('destination/.github')
  })

  test('doesnt remove .github directory from non-skeleton theme after cloning when it exists', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(rmdir).not.toHaveBeenCalledWith('destination/.github')
  })
})

describe('createAIInstructions()', () => {
  const destination = '/path/to/theme'

  beforeEach(() => {
    vi.mocked(joinPath).mockImplementation((...paths) => paths.join('/'))
    vi.mocked(readFile).mockResolvedValue('Sample AI instructions content' as any)
    vi.mocked(writeFile).mockResolvedValue()
    vi.mocked(symlink).mockResolvedValue()
  })

  test('creates AI instructions for a single instruction type', async () => {
    // Given
    vi.mocked(downloadGitRepository).mockResolvedValue()

    // When
    await createAIInstructions(destination, 'cursor')

    // Then
    expect(downloadGitRepository).toHaveBeenCalled()
    expect(readFile).toHaveBeenCalledWith('/tmp/ai/github/copilot-instructions.md')
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', expect.stringContaining('# AGENTS.md'))
    expect(symlink).not.toHaveBeenCalled()
  })

  test('creates AI instructions for all instruction types when "all" is selected', async () => {
    // Given
    vi.mocked(downloadGitRepository).mockResolvedValue()

    // When
    await createAIInstructions(destination, 'all')

    // Then
    expect(downloadGitRepository).toHaveBeenCalled()
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(symlink).toHaveBeenCalledTimes(2)
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/copilot-instructions.md')
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/CLAUDE.md')
  })

  test('throws an error when file operations fail', async () => {
    // Given
    vi.mocked(downloadGitRepository).mockResolvedValue()
    vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

    await expect(createAIInstructions(destination, 'cursor')).rejects.toThrow('Failed to create AI instructions')
  })
})

describe('createAIInstructionFiles()', () => {
  const themeRoot = '/path/to/theme'
  const agentsPath = '/path/to/theme/AGENTS.md'

  beforeEach(() => {
    vi.mocked(joinPath).mockImplementation((...paths) => paths.join('/'))
    vi.mocked(readFile).mockResolvedValue('AI instruction content' as any)
    vi.mocked(writeFile).mockResolvedValue()
    vi.mocked(symlink).mockResolvedValue()
  })

  test('creates symlink for github instruction', async () => {
    // Givin/When
    await createAIInstructionFiles(themeRoot, agentsPath, 'github')

    // Then
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/copilot-instructions.md')
  })

  test('does not create symlink for cursor instruction (uses AGENTS.md natively)', async () => {
    // When
    await createAIInstructionFiles(themeRoot, agentsPath, 'cursor')

    // Then
    expect(symlink).not.toHaveBeenCalled()
  })

  test('creates symlink for claude instruction', async () => {
    // When
    await createAIInstructionFiles(themeRoot, agentsPath, 'claude')

    // Then
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/CLAUDE.md')
  })

  test('falls back to copying file when symlink fails with EPERM', async () => {
    // Given
    vi.mocked(symlink).mockRejectedValue(new Error('EPERM: operation not permitted'))
    vi.mocked(readFile).mockResolvedValue('AGENTS.md content' as any)

    // When
    const result = await createAIInstructionFiles(themeRoot, agentsPath, 'github')

    // Then
    expect(symlink).toHaveBeenCalled()
    expect(readFile).toHaveBeenCalledWith(agentsPath)
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/copilot-instructions.md', 'AGENTS.md content')
    expect(result.copiedFile).toBe('copilot-instructions.md')
  })
})
