import downloadTemplate from './download'
import {git} from '@shopify/cli-kit'
import {describe, expect, it, vi} from 'vitest'

describe('download', () => {
  it('clones the factory template URL', async () => {
    // Given
    const mockGitFactory = vi.spyOn(git, 'factory')
    const mockGit = {clone: vi.fn()}
    mockGitFactory.mockImplementation(() => mockGit as any)

    const templateUrl = 'www.example.com'
    const into = 'folder'

    // When
    await downloadTemplate({templateUrl, into})

    // Then
    expect(mockGit.clone).toHaveBeenCalledWith(templateUrl, into, expect.any(Object), expect.any(Function))
  })

  it('throws when git clone fails', async () => {
    // Given
    const mockGitFactory = vi.spyOn(git, 'factory')
    const mockGit = {
      clone: vi.fn().mockImplementation((_, _2, _3, callback) => {
        callback(new Error('test message'))
      }),
    }
    mockGitFactory.mockImplementation(() => mockGit as any)

    const templateUrl = 'www.example.com'
    const into = 'folder'

    // When
    const download = () => downloadTemplate({templateUrl, into})

    // Then
    await expect(download).rejects.toThrow(/test message/)
  })
})
