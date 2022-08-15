import {
  initializeRepository,
  downloadRepository,
  getRemoteRepository,
  getLatestCommit,
  getHeadSymbolicRef,
  GitNotPresentError,
  OutsideGitDirectoryError,
  ensurePresentOrAbort,
  ensureInsideGitDirectory,
  MalformedRemoteUrlError,
  NoCommitError,
  DetachedHeadError,
} from './git.js'
import {hasGit} from './environment/local.js'
import {beforeEach, describe, expect, it, test, vi} from 'vitest'
import git from 'simple-git'

const mockedClone = vi.fn(async () => ({current: 'Mocked'}))
const mockedInit = vi.fn(async () => {})
const mockedCheckIsRepo = vi.fn(async () => false)
const mockedGetConfig = vi.fn(async () => ({}))
const mockedGetLog = vi.fn(async () => ({}))
const mockedRaw = vi.fn(async () => '')

beforeEach(() => {
  vi.mock('./environment/local')
  vi.mocked(hasGit).mockResolvedValue(true)

  vi.mock('simple-git')
  vi.mocked<any>(git).mockReturnValue({
    clone: mockedClone,
    init: mockedInit,
    checkIsRepo: mockedCheckIsRepo,
    getConfig: mockedGetConfig,
    log: mockedGetLog,
    raw: mockedRaw,
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

describe('getRemoteRepository', () => {
  it('gets remote.origing.url from git config & parses it', async () => {
    const testRemoteUrl = 'https://test.com/my/unit/test.git'

    mockedGetConfig.mockResolvedValue({value: testRemoteUrl})

    await expect(getRemoteRepository()).resolves.toBe('my/unit/test')
  })

  it('throws if remote URL is malformed', async () => {
    const testRemoteUrl = 'not.a.url'

    mockedGetConfig.mockResolvedValue({value: testRemoteUrl})

    await expect(getRemoteRepository()).rejects.toThrowError(MalformedRemoteUrlError())
  })
})

describe('getLatestCommit', () => {
  it('gets the latest commit through git log', async () => {
    const latestCommit = {key: 'value'}

    mockedGetLog.mockResolvedValue({latest: latestCommit, all: [latestCommit], total: 1})

    await expect(getLatestCommit()).resolves.toBe(latestCommit)
  })
  it('throws if no latest commit is found', async () => {
    mockedGetLog.mockResolvedValue({latest: null, all: [], total: 0})

    await expect(getLatestCommit()).rejects.toThrowError(NoCommitError())
  })
})

describe('getHeadSymbolicRef', () => {
  it('gets git HEAD symbolic reference', async () => {
    const testRef = 'refs/heads/my-test-branch'

    mockedRaw.mockResolvedValue(testRef)

    await expect(getHeadSymbolicRef()).resolves.toBe(testRef)
  })
  it('throws if HEAD is detached', async () => {
    const testRef = ''

    mockedRaw.mockResolvedValue(testRef)

    await expect(getHeadSymbolicRef()).rejects.toThrowError(DetachedHeadError())
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
