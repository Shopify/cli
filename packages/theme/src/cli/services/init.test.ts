import {cloneRepoAndCheckoutLatestTag, cloneRepo, promptAndCreateAIFile} from './init.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'
import {downloadGitRepository, removeGitRemote} from '@shopify/cli-kit/node/git'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {writeFile, rmdir, fileExists} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/fs')
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
})

describe('promptAndCreateAIFile()', () => {
  const destination = '/path/to/theme'
  const aiFileUrl = 'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/ai/liquid.mdc'
  const mockFileContent = 'AI file content 🤖✨'

  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      text: vi.fn().mockResolvedValue(mockFileContent),
    } as any)
  })

  test('creates VSCode AI file when vscode option is selected', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('vscode')
    vi.mocked(joinPath)
      .mockReturnValueOnce('/path/to/theme/.github')
      .mockReturnValueOnce('/path/to/theme/.github/copilot-instructions.md')

    // When
    await promptAndCreateAIFile(destination)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Set up AI dev support?',
      choices: [
        {label: 'VSCode (GitHub Copilot)', value: 'vscode'},
        {label: 'Cursor', value: 'cursor'},
        {label: 'Skip', value: 'none'},
      ],
    })

    expect(fetch).toHaveBeenCalledWith(aiFileUrl)
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/.github/copilot-instructions.md', mockFileContent)
  })

  test('creates Cursor AI file when cursor option is selected', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('cursor')
    vi.mocked(joinPath)
      .mockReturnValueOnce('/path/to/theme/.cursor/rules')
      .mockReturnValueOnce('/path/to/theme/.cursor/rules/liquid.mdc')

    // When
    await promptAndCreateAIFile(destination)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Set up AI dev support?',
      choices: [
        {label: 'VSCode (GitHub Copilot)', value: 'vscode'},
        {label: 'Cursor', value: 'cursor'},
        {label: 'Skip', value: 'none'},
      ],
    })

    expect(fetch).toHaveBeenCalledWith(aiFileUrl)
    expect(writeFile).toHaveBeenCalledWith('/path/to/theme/.cursor/rules/liquid.mdc', mockFileContent)
  })

  test('does not create any AI file when none option is selected', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('none')

    // When
    await promptAndCreateAIFile(destination)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Set up AI dev support?',
      choices: [
        {label: 'VSCode (GitHub Copilot)', value: 'vscode'},
        {label: 'Cursor', value: 'cursor'},
        {label: 'Skip', value: 'none'},
      ],
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })
})
