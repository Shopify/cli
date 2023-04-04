import {cloneRepoAndCheckoutLatestTag, cloneRepo} from './init.js'
import {describe, expect, vi, test} from 'vitest'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'

vi.mock('@shopify/cli-kit/node/git', () => {
  return {
    downloadGitRepository: vi.fn(),
  }
})

describe('cloneRepoAndCheckoutLatestTag()', async () => {
  test('calls downloadRepository function from git service to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    const latestTag = true

    // When
    await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

    // Then
    expect(downloadGitRepository).toHaveBeenCalledWith({repoUrl, destination, latestTag})
  })
})

describe('cloneRepo()', async () => {
  test('calls downloadRepository function from git service to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'

    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(downloadGitRepository).toHaveBeenCalledWith({repoUrl, destination})
  })
})
