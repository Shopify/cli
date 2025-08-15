import {cloneRepoAndCheckoutLatestTag, cloneRepo, createAIInstructions} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {rmdir, fileExists, copyDirectoryContents} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/fs', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/fs')
  return {
    ...actual,
    fileExists: vi.fn(),
    rmdir: vi.fn(),
    copyDirectoryContents: vi.fn(),
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
  })

  test('creates AI instructions if it exists', async () => {
    // Given
    vi.mocked(downloadGitRepository).mockResolvedValue()
    vi.mocked(copyDirectoryContents).mockResolvedValue()

    // When
    await createAIInstructions(destination, 'cursor')

    // Then
    expect(downloadGitRepository).toHaveBeenCalled()
    expect(copyDirectoryContents).toHaveBeenCalledWith('/tmp/ai/cursor', '/path/to/theme/.cursor')
  })

  test('throws an error when the AI instructions directory does not exist', async () => {
    // Given
    vi.mocked(downloadGitRepository).mockResolvedValue()
    vi.mocked(copyDirectoryContents).mockRejectedValue(new Error('Directory does not exist'))

    await expect(createAIInstructions(destination, 'cursor')).rejects.toThrow('Failed to create AI instructions')
  })
})
