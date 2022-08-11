import {
  initializeRepository,
  downloadRepository,
  GitNotPresentError,
  OutsideGitDirectoryError,
  ensurePresentOrAbort,
  ensureInsideGitDirectory,
} from './git.js'
import {hasGit} from './environment/local.js'
import {beforeEach, describe, expect, it, test, vi} from 'vitest'
import git from 'simple-git'

const mockedClone = vi.fn(async () => ({current: 'Mocked'}))
const mockedInit = vi.fn(async () => {})
const mockedCheckIsRepo = vi.fn(async () => false)

beforeEach(() => {
  vi.mock('./environment/local')
  vi.mocked(hasGit).mockResolvedValue(true)

  vi.mock('simple-git')
  vi.mocked<any>(git).mockReturnValue({
    clone: mockedClone,
    init: mockedInit,
    checkIsRepo: mockedCheckIsRepo,
  })
})

describe('downloadRepository()', () => {
  it('calls simple-git to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    const options: any = {'--recurse-submodules': null}

    // When
    await downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith(repoUrl, destination, options)
  })

  it('calls simple-git to clone a repo with branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl#my-branch'
    const destination = 'destination'
    const options: any = {'--recurse-submodules': null, '--branch': 'my-branch'}

    // When
    await downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith('http://repoUrl', destination, options)
  })
})

describe('initializeRepository()', () => {
  it('calls simple-git to init a repo in the given directory', async () => {
    // Given
    const directory = '/tmp/git-repo'

    // When
    await initializeRepository(directory)

    // Then
    expect(git).toHaveBeenCalledWith('/tmp/git-repo')
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

describe('ensureInsideGitDirectory', () => {
  test('throws an error if not inside a git directory', async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(false)

    // Then
    await expect(ensureInsideGitDirectory()).rejects.toThrowError(OutsideGitDirectoryError())
  })

  test("doesn't throw an error if inside a git directory", async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(true)

    // Then
    await expect(ensureInsideGitDirectory()).resolves.toBeUndefined()
  })
})
