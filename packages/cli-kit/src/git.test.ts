import * as git from './git'
import {describe, expect, it, vi} from 'vitest'

const mockedClone = vi.fn(() => Promise.resolve({current: 'Mocked'}))

vi.mock('simple-git', async () => {
  return {
    default: () => ({
      clone: mockedClone,
    }),
  }
})

describe('git', () => {
  it('calls simple-git to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const options: any = {'--recurse-submodules': null}

    // When
    await git.downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith(repoUrl, destination, options, expect.any(Function))
  })

  it('calls simple-git to clone a repo with branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl#my-branch'
    const destination = 'destination'
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const options: any = {'--recurse-submodules': null, '--branch': 'my-branch'}

    // When
    await git.downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith('http://repoUrl', destination, options, expect.any(Function))
  })
})
