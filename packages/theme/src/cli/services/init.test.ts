import {cloneRepoAndCheckoutLatestTag, cloneRepo} from './init.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {git} from '@shopify/cli-kit'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit', async () => {
    const actualCliKit = await vi.importActual<typeof import('@shopify/cli-kit')>('@shopify/cli-kit')

    return {
      ...actualCliKit,
      git: {
        downloadRepository: vi.fn(),
      },
    }
  })
})

describe('cloneRepoAndCheckoutLatestTag()', async () => {
  it('calls downloadRepository function from git service to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'https://github.com/Shopify/dawn.git'
    const destination = 'destination'
    const latestTag = true
    const downloadRepositorySpy = vi.spyOn(git, 'downloadRepository')

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
    const downloadRepositorySpy = vi.spyOn(git, 'downloadRepository')

    // When
    await cloneRepo(repoUrl, destination)

    // Then
    expect(downloadRepositorySpy).toHaveBeenCalledWith({repoUrl, destination})
  })
})
