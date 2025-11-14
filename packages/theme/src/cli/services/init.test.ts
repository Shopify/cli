import {cloneRepoAndCheckoutLatestTag, cloneRepo, createAIInstructions, createAIInstructionFiles} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {rmdir, fileExists, readFile, writeFile, symlink} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/fs', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/fs')
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
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ui')
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
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/.cursorrules')
  })

  test('creates AI instructions for all instruction types when "all" is selected', async () => {
    // Given
    vi.mocked(downloadGitRepository).mockResolvedValue()

    // When
    await createAIInstructions(destination, 'all')

    // Then
    expect(downloadGitRepository).toHaveBeenCalled()
    // github, cursor, claude
    expect(readFile).toHaveBeenCalledTimes(3)
    expect(writeFile).toHaveBeenCalledTimes(3)
    expect(symlink).toHaveBeenCalledTimes(3)
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/copilot-instructions.md')
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/.cursorrules')
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
  const tempDir = '/tmp'
  const themeRoot = '/path/to/theme'

  beforeEach(() => {
    vi.mocked(joinPath).mockImplementation((...paths) => paths.join('/'))
    vi.mocked(readFile).mockResolvedValue('AI instruction content' as any)
    vi.mocked(writeFile).mockResolvedValue()
    vi.mocked(symlink).mockResolvedValue()
  })

  test('creates AGENTS.md with prepended header for github instruction', async () => {
    // When
    await createAIInstructionFiles(tempDir, themeRoot, 'github')

    // Then
    expect(readFile).toHaveBeenCalledWith('/tmp/ai/github/copilot-instructions.md')
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '# AGENTS.md\n\nAI instruction content')
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/copilot-instructions.md')
  })

  test('creates AGENTS.md and .cursorrules symlink for cursor instruction', async () => {
    // When
    await createAIInstructionFiles(tempDir, themeRoot, 'cursor')

    // Then
    expect(readFile).toHaveBeenCalledWith('/tmp/ai/github/copilot-instructions.md')
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '# AGENTS.md\n\nAI instruction content')
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/.cursorrules')
  })

  test('creates AGENTS.md and CLAUDE.md symlink for claude instruction', async () => {
    // When
    await createAIInstructionFiles(tempDir, themeRoot, 'claude')

    // Then
    expect(readFile).toHaveBeenCalledWith('/tmp/ai/github/copilot-instructions.md')
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '# AGENTS.md\n\nAI instruction content')
    expect(symlink).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', '/path/to/theme/CLAUDE.md')
  })

  test('prepends header to source content', async () => {
    // Given
    const sourceContent = 'Original content from repo'
    vi.mocked(readFile).mockResolvedValue(sourceContent as any)

    // When
    await createAIInstructionFiles(tempDir, themeRoot, 'github')

    // Then
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/AGENTS.md', `# AGENTS.md\n\n${sourceContent}`)
  })
})
