import * as git from './git.js'
import {hasGit} from './environment/local.js'
import {appendSync} from './file.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import simpleGit from 'simple-git'

const mockedClone = vi.fn(async () => ({current: 'Mocked'}))
const mockedInit = vi.fn(async () => {})
const mockedCheckIsRepo = vi.fn(async () => false)
const mockedGetConfig = vi.fn(async () => ({}))
const mockedGetLog = vi.fn(async () => ({}))
const mockedCommit = vi.fn(async () => ({}))
const mockedRaw = vi.fn(async () => '')
const mockedCheckout = vi.fn(async () => ({}))

beforeEach(() => {
  vi.mock('./environment/local')
  vi.mocked(hasGit).mockResolvedValue(true)

  vi.mock('./file.js')

  vi.mock('simple-git')
  vi.mocked<any>(simpleGit).mockReturnValue({
    clone: mockedClone,
    init: mockedInit,
    checkIsRepo: mockedCheckIsRepo,
    getConfig: mockedGetConfig,
    log: mockedGetLog,
    commit: mockedCommit,
    raw: mockedRaw,
    checkoutLocalBranch: mockedCheckout,
  })
})

describe('downloadRepository()', () => {
  it('calls simple-git to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    const options: any = {'--recurse-submodules': null}

    // When
    await git.downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith(repoUrl, destination, options)
  })

  it('calls simple-git to clone a repo with branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl#my-branch'
    const destination = 'destination'
    const options: any = {'--recurse-submodules': null, '--branch': 'my-branch'}

    // When
    await git.downloadRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith('http://repoUrl', destination, options)
  })
})

describe('initializeRepository()', () => {
  it('calls simple-git to init a repo in the given directory', async () => {
    // Given
    const directory = '/tmp/git-repo'

    // When
    await git.initializeRepository(directory, 'my-branch')

    // Then
    expect(simpleGit).toHaveBeenCalledOnce()
    expect(simpleGit).toHaveBeenCalledWith('/tmp/git-repo')

    expect(mockedInit).toHaveBeenCalledOnce()
    expect(mockedCheckout).toHaveBeenCalledOnce()
    expect(mockedCheckout).toHaveBeenCalledWith('my-branch')
  })
})

describe('createGitIgnore()', () => {
  it('writes to a file in the provided directory', async () => {
    const mockedAppendSync = vi.fn()
    vi.mocked(appendSync).mockImplementation(mockedAppendSync)
    const directory = '/unit/test'
    const template = {
      section: ['first', 'second'],
    }

    git.createGitIgnore(directory, template)

    expect(mockedAppendSync).toHaveBeenCalledOnce()
    expect(mockedAppendSync.mock.lastCall?.[0]).toBe(`${directory}/.gitignore`)
    expect(mockedAppendSync.mock.lastCall?.[1]).toBe('# section\nfirst\nsecond\n\n')
  })
})

describe('getLatestCommit()', () => {
  it('gets the latest commit through git log', async () => {
    const latestCommit = {key: 'value'}

    mockedGetLog.mockResolvedValue({latest: latestCommit, all: [latestCommit], total: 1})

    await expect(git.getLatestCommit()).resolves.toBe(latestCommit)
  })
  it('throws if no latest commit is found', async () => {
    mockedGetLog.mockResolvedValue({latest: null, all: [], total: 0})

    await expect(() => git.getLatestCommit()).rejects.toThrowError(git.NoCommitError())
  })
  it('passes the directory option to simple git', async () => {
    // Given
    const directory = '/test/directory'
    const latestCommit = {key: 'value'}
    mockedGetLog.mockResolvedValue({latest: latestCommit, all: [latestCommit], total: 1})

    // When
    await git.getLatestCommit(directory)

    // Then
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('addAll()', () => {
  it('builds valid raw command', async () => {
    const directory = '/test/directory'

    await git.addAll(directory)

    expect(mockedRaw).toHaveBeenCalledOnce()
    expect(mockedRaw).toHaveBeenCalledWith('add', '--all')
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('commit()', () => {
  it('calls simple-git commit method', async () => {
    mockedCommit.mockResolvedValue({commit: 'sha'})
    const commitMsg = 'my msg'

    const commitSha = await git.commit(commitMsg)

    expect(mockedCommit).toHaveBeenCalledOnce()
    expect(mockedCommit).toHaveBeenCalledWith(commitMsg, undefined)
    expect(commitSha).toBe('sha')
  })
  it('passes options to relevant function', async () => {
    const author = 'Vincent Lynch <vincent.lynch@shopify.com>'
    const directory = '/some/path'
    mockedCommit.mockResolvedValue({commit: 'sha'})

    await git.commit('msg', {author, directory})

    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
    expect(mockedCommit).toHaveBeenCalledWith('msg', {'--author': author})
  })
})

describe('getHeadSymbolicRef()', () => {
  it('gets git HEAD symbolic reference', async () => {
    const testRef = 'refs/heads/my-test-branch'
    mockedRaw.mockResolvedValue(testRef)

    await expect(git.getHeadSymbolicRef()).resolves.toBe(testRef)
  })
  it('throws if HEAD is detached', async () => {
    mockedRaw.mockResolvedValue('')

    await expect(() => git.getHeadSymbolicRef()).rejects.toThrowError(git.DetachedHeadError())
  })
  it('passes the directory option to simple git', async () => {
    const directory = '/test/directory'
    mockedRaw.mockResolvedValue('ref/unit')

    await git.getHeadSymbolicRef(directory)

    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('ensurePresentOrAbort()', () => {
  it('throws an error if git is not present', async () => {
    // Given
    vi.mocked(hasGit).mockResolvedValue(false)

    // Then
    await expect(() => git.ensurePresentOrAbort()).rejects.toThrowError(git.GitNotPresentError())
  })

  it("doesn't throw an error if Git is present", async () => {
    // Given
    vi.mocked(hasGit).mockResolvedValue(true)

    // Then
    await expect(git.ensurePresentOrAbort()).resolves.toBeUndefined()
  })
})

describe('ensureInsideGitDirectory()', () => {
  it('throws an error if not inside a git directory', async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(false)

    // Then
    await expect(() => git.ensureInsideGitDirectory()).rejects.toThrowError(git.OutsideGitDirectoryError(process.cwd()))
  })

  it("doesn't throw an error if inside a git directory", async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(true)

    // Then
    await expect(git.ensureInsideGitDirectory()).resolves.toBeUndefined()
  })

  it('passes the directory option to simple git', async () => {
    // Given
    const directory = '/test/directory'
    mockedCheckIsRepo.mockResolvedValue(true)

    // When
    await git.ensureInsideGitDirectory(directory)

    // Then
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})
