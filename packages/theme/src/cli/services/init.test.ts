import {cloneRepoAndCheckoutLatestTag, cloneRepo} from './init.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import * as git from '@shopify/cli-kit/node/git'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/git')
})

describe('cloneRepoAndCheckoutLatestTag()', async () => {
  it('calls downloadRepository function from git service to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    const latestTag = true
    const downloadRepositorySpy = vi.spyOn(git, 'downloadGitRepository')

    // When
    await cloneRepoAndCheckoutLatestTag(repoUrl, destination)

    // Then
    expect(downloadRepositorySpy).toHaveBeenCalledWith({repoUrl, destination, latestTag})
  })
})

describe('cloneRepo()', async () => {
  it('calls downloadRepository function from git service to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    const downloadRepositorySpy = vi.spyOn(git, 'downloadGitRepository')

    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(downloadRepositorySpy).toHaveBeenCalledWith({repoUrl, destination})
  })
})
