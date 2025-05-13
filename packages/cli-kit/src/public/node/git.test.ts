import * as git from './git.js'
import {appendFileSync, fileExistsSync, inTemporaryDirectory, readFileSync, writeFileSync} from './fs.js'
import {hasGit} from './context/local.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import simpleGit from 'simple-git'

const mockedClone = vi.fn(async () => ({current: 'Mocked'}))
const mockedInit = vi.fn(async () => {})
const mockedCheckIsRepo = vi.fn(async () => false)
const mockedGetConfig = vi.fn(async () => ({}))
const mockedGetLog = vi.fn(async () => ({}))
const mockedCommit = vi.fn(async () => ({}))
const mockedRaw = vi.fn(async () => '')
const mockedCheckout = vi.fn(async () => ({}))
const mockedGitStatus = vi.fn(async (): Promise<{isClean: () => boolean}> => ({isClean: () => false}))
const mockedTags = vi.fn(async () => ({}))
const simpleGitProperties = {
  clone: mockedClone,
  init: mockedInit,
  checkIsRepo: mockedCheckIsRepo,
  getConfig: mockedGetConfig,
  log: mockedGetLog,
  commit: mockedCommit,
  raw: mockedRaw,
  checkoutLocalBranch: mockedCheckout,
  status: mockedGitStatus,
  tags: mockedTags,
}

vi.mock('simple-git')
vi.mock('./context/local.js')
vi.mock('./fs.js', async () => {
  const fs = await vi.importActual('./fs.js')
  return {
    ...fs,
    appendFileSync: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(hasGit).mockResolvedValue(true)
  vi.mocked<any>(simpleGit).mockReturnValue(simpleGitProperties)
})

describe('downloadRepository()', async () => {
  test('calls simple-git to clone a repo without branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    const options: any = {'--recurse-submodules': null}

    // When
    await git.downloadGitRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith(repoUrl, destination, options)
  })

  test('calls simple-git to clone a repo with branch', async () => {
    // Given
    const repoUrl = 'http://repoUrl#my-branch'
    const destination = 'destination'
    const options: any = {'--recurse-submodules': null, '--branch': 'my-branch'}

    // When
    await git.downloadGitRepository({repoUrl, destination})

    // Then
    expect(mockedClone).toHaveBeenCalledWith('http://repoUrl', destination, options)
  })

  test('fails when the shallow and latestTag properties are passed', async () => {
    await expect(async () => {
      // Given
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      const shallow = true
      const latestTag = true

      // When
      await git.downloadGitRepository({repoUrl, destination, shallow, latestTag})

      // Then
    }).rejects.toThrowError(/Git can't clone the latest release with the 'shallow' property/)
  })

  test('fails when the branch and latestTag properties are passed', async () => {
    await expect(async () => {
      // Given
      const repoUrl = 'http://repoUrl#my-branch'
      const destination = 'destination'
      const latestTag = true

      // When
      await git.downloadGitRepository({repoUrl, destination, latestTag})

      // Then
    }).rejects.toThrowError(/Git can't clone the latest release with a 'branch'/)
  })

  test("fails when the latestTag doesn't exist ", async () => {
    await expect(async () => {
      // Given
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      const latestTag = true
      const mockedTags = vi.fn(async () => ({
        all: [],
        latest: undefined,
      }))

      vi.mocked<any>(simpleGit).mockReturnValue({
        ...simpleGitProperties,
        tags: mockedTags,
      })

      // When
      await git.downloadGitRepository({repoUrl, destination, latestTag})

      // Then
    }).rejects.toThrowError(/Couldn't obtain the most recent tag of the repository http:\/\/repoUrl/)
  })

  test('calls simple-git to clone a repo with branch and checkouts the latest release', async () => {
    // Given
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    const latestTag = true
    const options: any = {'--recurse-submodules': null}
    const expectedLatestTag = '1.2.3'
    const mockedTags = vi.fn(async () => ({
      all: [],
      latest: expectedLatestTag,
    }))
    const mockCheckout = vi.fn(async () => ({current: 'Mocked'}))

    vi.mocked<any>(simpleGit).mockReturnValue({
      ...simpleGitProperties,
      tags: mockedTags,
      checkout: mockCheckout,
    })

    // When
    await git.downloadGitRepository({repoUrl, destination, latestTag})

    // Then
    expect(mockedClone).toHaveBeenCalledWith('http://repoUrl', destination, options)
    expect(mockCheckout).toHaveBeenCalledWith(expectedLatestTag)
  })
})

describe('initializeRepository()', () => {
  test('calls simple-git to init a repo in the given directory', async () => {
    // Given
    const directory = '/tmp/git-repo'

    // When
    await git.initializeGitRepository(directory, 'my-branch')

    // Then
    expect(simpleGit).toHaveBeenCalledOnce()
    expect(simpleGit).toHaveBeenCalledWith('/tmp/git-repo')

    expect(mockedInit).toHaveBeenCalledOnce()
    expect(mockedCheckout).toHaveBeenCalledOnce()
    expect(mockedCheckout).toHaveBeenCalledWith('my-branch')
  })
})

describe('createGitIgnore()', () => {
  test('writes to a file in the provided directory', async () => {
    const mockedAppendSync = vi.fn()
    vi.mocked(appendFileSync).mockImplementation(mockedAppendSync)
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
  test('gets the latest commit through git log', async () => {
    const latestCommit = {key: 'value'}

    mockedGetLog.mockResolvedValue({latest: latestCommit, all: [latestCommit], total: 1})

    await expect(git.getLatestGitCommit()).resolves.toBe(latestCommit)
  })
  test('throws if no latest commit is found', async () => {
    mockedGetLog.mockResolvedValue({latest: null, all: [], total: 0})

    await expect(() => git.getLatestGitCommit()).rejects.toThrowError(/Must have at least one commit to run command/)
  })
  test('passes the directory option to simple git', async () => {
    // Given
    const directory = '/test/directory'
    const latestCommit = {key: 'value'}
    mockedGetLog.mockResolvedValue({latest: latestCommit, all: [latestCommit], total: 1})

    // When
    await git.getLatestGitCommit(directory)

    // Then
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('addAll()', () => {
  test('builds valid raw command', async () => {
    const directory = '/test/directory'

    await git.addAllToGitFromDirectory(directory)

    expect(mockedRaw).toHaveBeenCalledOnce()
    expect(mockedRaw).toHaveBeenCalledWith('add', '--all')
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('commit()', () => {
  test('calls simple-git commit method', async () => {
    mockedCommit.mockResolvedValue({commit: 'sha'})
    const commitMsg = 'my msg'

    const commitSha = await git.createGitCommit(commitMsg)

    expect(mockedCommit).toHaveBeenCalledOnce()
    expect(mockedCommit).toHaveBeenCalledWith(commitMsg, undefined)
    expect(commitSha).toBe('sha')
  })
  test('passes options to relevant function', async () => {
    const author = 'Vincent Lynch <vincent.lynch@shopify.com>'
    const directory = '/some/path'
    mockedCommit.mockResolvedValue({commit: 'sha'})

    await git.createGitCommit('msg', {author, directory})

    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
    expect(mockedCommit).toHaveBeenCalledWith('msg', {'--author': author})
  })
})

describe('getHeadSymbolicRef()', () => {
  test('gets git HEAD symbolic reference', async () => {
    const testRef = 'refs/heads/my-test-branch'
    mockedRaw.mockResolvedValue(testRef)

    await expect(git.getHeadSymbolicRef()).resolves.toBe(testRef)
  })
  test('throws if HEAD is detached', async () => {
    mockedRaw.mockResolvedValue('')

    await expect(() => git.getHeadSymbolicRef()).rejects.toThrowError(/Git HEAD can't be detached to run command/)
  })
  test('passes the directory option to simple git', async () => {
    const directory = '/test/directory'
    mockedRaw.mockResolvedValue('ref/unit')

    await git.getHeadSymbolicRef(directory)

    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('ensurePresentOrAbort()', () => {
  test('throws an error if git is not present', async () => {
    // Given
    vi.mocked(hasGit).mockResolvedValue(false)

    // Then
    await expect(() => git.ensureGitIsPresentOrAbort()).rejects.toThrowError(
      /Git is necessary in the environment to continue/,
    )
  })

  test("doesn't throw an error if Git is present", async () => {
    // Given
    vi.mocked(hasGit).mockResolvedValue(true)

    // Then
    await expect(git.ensureGitIsPresentOrAbort()).resolves.toBeUndefined()
  })
})

describe('ensureInsideGitDirectory()', () => {
  test('throws an error if not inside a git directory', async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(false)

    // Then
    await expect(() => git.ensureInsideGitDirectory()).rejects.toThrowError(/is not a Git directory/)
  })

  test("doesn't throw an error if inside a git directory", async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(true)

    // Then
    await expect(git.ensureInsideGitDirectory()).resolves.toBeUndefined()
  })
})

describe('insideGitDirectory()', () => {
  test('returns true if inside a git directory', async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(true)

    // Then
    await expect(git.insideGitDirectory()).resolves.toBe(true)
  })

  test('returns false if not inside a git directory', async () => {
    // Given
    mockedCheckIsRepo.mockResolvedValue(false)

    // Then
    await expect(git.insideGitDirectory()).resolves.toBe(false)
  })

  test('passes the directory option to simple git', async () => {
    // Given
    const directory = '/test/directory'
    mockedCheckIsRepo.mockResolvedValue(true)

    // When
    await git.insideGitDirectory(directory)

    // Then
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('ensureIsClean()', () => {
  test('throws an error if git directory is not clean', async () => {
    // Given
    mockedGitStatus.mockResolvedValue({isClean: () => false})

    // Then
    await expect(() => git.ensureIsClean()).rejects.toThrowError(/is not a clean Git directory/)
  })

  test("doesn't throw an error if git directory is clean", async () => {
    // Given
    mockedGitStatus.mockResolvedValue({isClean: () => true})

    // Then
    await expect(git.ensureIsClean()).resolves.toBeUndefined()
  })
})

describe('getLatestTag()', () => {
  test('returns the latest tag from git', async () => {
    // Given
    const expectedTag = 'v1.0.0'
    mockedTags.mockResolvedValue({latest: expectedTag})

    // When
    const tag = await git.getLatestTag()

    // Then
    await expect(git.getLatestTag()).resolves.toBe(expectedTag)
  })

  test('return undefined when no tags exist', async () => {
    // Given
    mockedTags.mockResolvedValue({})

    // When
    const tag = await git.getLatestTag()

    // Then
    await expect(git.getLatestTag()).resolves.toBeUndefined()
  })
})

describe('isGitClean()', () => {
  test('return false if git directory is not clean', async () => {
    // Given
    mockedGitStatus.mockResolvedValue({isClean: () => false})

    // Then
    await expect(git.isClean()).resolves.toBe(false)
  })

  test('return true if git directory is not clean', async () => {
    // Given
    mockedGitStatus.mockResolvedValue({isClean: () => true})

    // Then
    await expect(git.isClean()).resolves.toBe(true)
  })

  test('passes the directory option to simple git', async () => {
    // Given
    mockedGitStatus.mockResolvedValue({isClean: () => true})
    const directory = '/test/directory'

    // When
    await git.isClean(directory)

    // Then
    expect(simpleGit).toHaveBeenCalledWith({baseDir: directory})
  })
})

describe('addToGitIgnore()', () => {
  test('does nothing when .gitignore does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gitIgnorePath = `${tmpDir}/.gitignore`

      // When
      git.addToGitIgnore(tmpDir, '.shopify')

      // Then
      expect(fileExistsSync(gitIgnorePath)).toBe(false)
    })
  })

  test('does nothing when pattern already exists in .gitignore', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gitIgnorePath = `${tmpDir}/.gitignore`
      const gitIgnoreContent = ' .shopify \nnode_modules\n'

      writeFileSync(gitIgnorePath, gitIgnoreContent)

      // When
      git.addToGitIgnore(tmpDir, '.shopify')

      // Then
      const actualContent = readFileSync(gitIgnorePath).toString()
      expect(actualContent).toBe(gitIgnoreContent)
    })
  })

  test('appends pattern to .gitignore when file exists and pattern not present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gitIgnorePath = `${tmpDir}/.gitignore`

      writeFileSync(gitIgnorePath, 'node_modules\ndist')

      // When
      git.addToGitIgnore(tmpDir, '.shopify')

      // Then
      const gitIgnoreContent = readFileSync(gitIgnorePath).toString()
      expect(gitIgnoreContent).toBe('node_modules\ndist\n.shopify\n')
    })
  })

  test('appends pattern to .gitignore when file exists and pattern not present without duplicating the last empty line', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gitIgnorePath = `${tmpDir}/.gitignore`

      writeFileSync(gitIgnorePath, 'node_modules\ndist\n')

      // When
      git.addToGitIgnore(tmpDir, '.shopify')

      // Then
      const gitIgnoreContent = readFileSync(gitIgnorePath).toString()
      expect(gitIgnoreContent).toBe('node_modules\ndist\n.shopify\n')
    })
  })

  test('does nothing when .shopify/* pattern exists in .gitignore', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gitIgnorePath = `${tmpDir}/.gitignore`
      const gitIgnoreContent = '.shopify/*\nnode_modules\n'

      writeFileSync(gitIgnorePath, gitIgnoreContent)

      // When
      git.addToGitIgnore(tmpDir, '.shopify')

      // Then
      const actualContent = readFileSync(gitIgnorePath).toString()
      expect(actualContent).toBe(gitIgnoreContent)
    })
  })

  test('does nothing when .shopify/** pattern exists in .gitignore', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gitIgnorePath = `${tmpDir}/.gitignore`
      const gitIgnoreContent = '.shopify/**\nnode_modules\n'

      writeFileSync(gitIgnorePath, gitIgnoreContent)

      // When
      git.addToGitIgnore(tmpDir, '.shopify')

      // Then
      const actualContent = readFileSync(gitIgnorePath).toString()
      expect(actualContent).toBe(gitIgnoreContent)
    })
  })
})
