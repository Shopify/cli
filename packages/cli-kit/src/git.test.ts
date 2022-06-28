import {initializeRepository, downloadRepository, GitNotPresentError, ensurePresentOrAbort} from './git.js'
import {hasGit} from './environment/local.js'
import {beforeEach, describe, expect, it, test, vi} from 'vitest'

const mockedClone = vi.fn(() => Promise.resolve({current: 'Mocked'}))

const mockedInit = vi.fn(() => Promise.resolve())

beforeEach(() => {
  vi.mock('simple-git', async () => {
    return {
      default: () => ({
        clone: mockedClone,
        init: mockedInit,
      }),
    }
  })
  vi.mock('./environment/local')
})

describe('downloadRepository()', () => {
  it('calls simple-git to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const options: any = {'--recurse-submodules': null}
    vi.mocked(hasGit).mockResolvedValue(true)

    // When
    await downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith(repoUrl, destination, options, expect.any(Function))
  })

  it('calls simple-git to clone a repo with branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl#my-branch'
    const destination = 'destination'
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const options: any = {'--recurse-submodules': null, '--branch': 'my-branch'}
    vi.mocked(hasGit).mockResolvedValue(true)

    // When
    await downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith('http://repoUrl', destination, options, expect.any(Function))
  })
})

describe('initializeRepository()', () => {
  it('calls simple-git to init a repo in the given directory', async () => {
    const simpleGit = await import('simple-git')
    vi.mocked(hasGit).mockResolvedValue(true)

    vi.spyOn(simpleGit, 'default')

    // Given
    const directory = '/tmp/git-repo'

    // When
    await initializeRepository(directory)

    // Then
    expect(simpleGit.default).toHaveBeenCalledWith('/tmp/git-repo')
    expect(mockedInit).toHaveBeenCalledOnce()
  })
})

describe('ensurePresentOrAbort', () => {
  test('throws an error if git is not present', async () => {
    // Given
    vi.mocked(hasGit).mockResolvedValue(false)

    // Then
    await expect(ensurePresentOrAbort()).rejects.toThrowError(GitNotPresentError())
  })

  test("doesn't throw an error if Git is present", async () => {
    // Given
    vi.mocked(hasGit).mockResolvedValue(true)

    // Then
    await expect(ensurePresentOrAbort()).resolves.toBeUndefined()
  })
})
