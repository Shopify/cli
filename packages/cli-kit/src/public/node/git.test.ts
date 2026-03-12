import * as git from './git.js'
import {
  appendFileSync,
  fileExists,
  fileExistsSync,
  glob,
  inTemporaryDirectory,
  isDirectory,
  readFileSync,
  writeFileSync,
} from './fs.js'
import {hasGit, isTerminalInteractive} from './context/local.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {execa} from 'execa'

vi.mock('execa')
vi.mock('./context/local.js')
vi.mock('./fs.js', async () => {
  const fs = await vi.importActual('./fs.js')
  return {
    ...fs,
    appendFileSync: vi.fn(),
    fileExists: vi.fn(),
    isDirectory: vi.fn(),
    glob: vi.fn(),
  }
})

const mockedExeca = vi.mocked(execa)

function mockGitCommand(stdout = '', stderr = '') {
  mockedExeca.mockResolvedValue({stdout, stderr} as any)
}

function mockGitCommandSequence(results: {stdout?: string; error?: Error}[]) {
  const mutableResults = [...results]
  mockedExeca.mockImplementation((() => {
    const result = mutableResults.shift()
    if (result?.error) throw result.error
    return Promise.resolve({stdout: result?.stdout ?? '', stderr: ''})
  }) as any)
}

beforeEach(() => {
  vi.mocked(hasGit).mockResolvedValue(true)
  vi.mocked(isTerminalInteractive).mockReturnValue(true)
  mockedExeca.mockReset()
  mockGitCommand()
})

describe('downloadRepository()', async () => {
  test('calls git clone without branch', async () => {
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'

    await git.downloadGitRepository({repoUrl, destination})

    expect(mockedExeca).toHaveBeenCalledWith('git', ['clone', '--recurse-submodules', repoUrl, destination])
  })

  test('calls git clone with branch', async () => {
    const repoUrl = 'http://repoUrl#my-branch'
    const destination = 'destination'

    await git.downloadGitRepository({repoUrl, destination})

    expect(mockedExeca).toHaveBeenCalledWith('git', [
      'clone',
      '--recurse-submodules',
      '--branch',
      'my-branch',
      'http://repoUrl',
      destination,
    ])
  })

  test('fails when the shallow and latestTag properties are passed', async () => {
    await expect(async () => {
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      const shallow = true
      const latestTag = true

      await git.downloadGitRepository({repoUrl, destination, shallow, latestTag})
    }).rejects.toThrowError(/Git can't clone the latest release with the 'shallow' property/)
  })

  test('fails when the branch and latestTag properties are passed', async () => {
    await expect(async () => {
      const repoUrl = 'http://repoUrl#my-branch'
      const destination = 'destination'
      const latestTag = true

      await git.downloadGitRepository({repoUrl, destination, latestTag})
    }).rejects.toThrowError(/Git can't clone the latest release with a 'branch'/)
  })

  test("fails when the latestTag doesn't exist ", async () => {
    mockGitCommandSequence([
      // clone
      {stdout: ''},
      // describe --tags
      {error: new Error('fatal: No names found')},
    ])

    await expect(async () => {
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      const latestTag = true

      await git.downloadGitRepository({repoUrl, destination, latestTag})
    }).rejects.toThrowError(/fatal: No names found/)
  })

  test('clones and checks out the latest tag', async () => {
    mockGitCommandSequence([
      // clone
      {stdout: ''},
      // describe --tags --abbrev=0
      {stdout: '1.2.3'},
      // checkout
      {stdout: ''},
    ])

    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    const latestTag = true

    await git.downloadGitRepository({repoUrl, destination, latestTag})

    expect(mockedExeca).toHaveBeenCalledWith('git', ['clone', '--recurse-submodules', repoUrl, destination])
    expect(mockedExeca).toHaveBeenCalledWith('git', ['checkout', '1.2.3'], {cwd: destination})
  })

  test('throws when destination exists as a file', async () => {
    await expect(async () => {
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(isDirectory).mockResolvedValue(false)

      await git.downloadGitRepository({repoUrl, destination})
    }).rejects.toThrowError(/Can't clone to/)
  })

  test('throws when destination directory is not empty', async () => {
    await expect(async () => {
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(isDirectory).mockResolvedValue(true)
      vi.mocked(glob).mockResolvedValue(['file1.txt', 'file2.txt'])

      await git.downloadGitRepository({repoUrl, destination})
    }).rejects.toThrowError(/already exists and is not empty/)
  })

  test('throws when destination contains only hidden files', async () => {
    await expect(async () => {
      const repoUrl = 'http://repoUrl'
      const destination = 'destination'
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(isDirectory).mockResolvedValue(true)
      vi.mocked(glob).mockResolvedValue(['.git', '.DS_Store'])

      await git.downloadGitRepository({repoUrl, destination})
    }).rejects.toThrowError(/already exists and is not empty/)
  })

  test('succeeds when destination directory is empty', async () => {
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(isDirectory).mockResolvedValue(true)
    vi.mocked(glob).mockResolvedValue([])

    await git.downloadGitRepository({repoUrl, destination})

    expect(mockedExeca).toHaveBeenCalledWith('git', ['clone', '--recurse-submodules', repoUrl, destination])
  })

  test('succeeds when destination does not exist', async () => {
    const repoUrl = 'http://repoUrl'
    const destination = 'destination'
    vi.mocked(fileExists).mockResolvedValue(false)

    await git.downloadGitRepository({repoUrl, destination})

    expect(mockedExeca).toHaveBeenCalledWith('git', ['clone', '--recurse-submodules', repoUrl, destination])
  })
})

describe('initializeRepository()', () => {
  test('calls git init and checkout in the given directory', async () => {
    const directory = '/tmp/git-repo'

    await git.initializeGitRepository(directory, 'my-branch')

    expect(mockedExeca).toHaveBeenCalledWith('git', ['init'], {cwd: directory})
    expect(mockedExeca).toHaveBeenCalledWith('git', ['checkout', '-b', 'my-branch'], {cwd: directory})
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
    mockGitCommand('abc123\x002024-01-01\x00commit message\x00HEAD -> main\x00\x00John\x00john@test.com')

    const result = await git.getLatestGitCommit()
    expect(result.hash).toBe('abc123')
    expect(result.message).toBe('commit message')
    expect(result.author_name).toBe('John')
  })

  test('throws if no latest commit is found', async () => {
    mockGitCommand('')

    await expect(() => git.getLatestGitCommit()).rejects.toThrowError(/Must have at least one commit to run command/)
  })

  test('passes the directory option', async () => {
    const directory = '/test/directory'
    mockGitCommand('abc123\x002024-01-01\x00msg\x00refs\x00\x00John\x00john@test.com')

    await git.getLatestGitCommit(directory)

    expect(mockedExeca).toHaveBeenCalledWith('git', expect.arrayContaining(['log']), {cwd: directory})
  })
})

describe('addAll()', () => {
  test('calls git add --all', async () => {
    const directory = '/test/directory'

    await git.addAllToGitFromDirectory(directory)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['add', '--all'], {cwd: directory})
  })
})

describe('commit()', () => {
  test('calls git commit and returns sha', async () => {
    mockGitCommandSequence([
      // commit
      {stdout: ''},
      // rev-parse HEAD
      {stdout: 'abc123'},
    ])
    const commitMsg = 'my msg'

    const commitSha = await git.createGitCommit(commitMsg)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['commit', '-m', commitMsg], {cwd: undefined})
    expect(commitSha).toBe('abc123')
  })

  test('passes author and directory options', async () => {
    const author = 'Vincent Lynch <vincent.lynch@shopify.com>'
    const directory = '/some/path'
    mockGitCommandSequence([
      // commit
      {stdout: ''},
      // rev-parse HEAD
      {stdout: 'sha'},
    ])

    await git.createGitCommit('msg', {author, directory})

    expect(mockedExeca).toHaveBeenCalledWith('git', ['commit', '-m', 'msg', '--author', author], {cwd: directory})
  })
})

describe('getHeadSymbolicRef()', () => {
  test('gets git HEAD symbolic reference', async () => {
    const testRef = 'refs/heads/my-test-branch'
    mockGitCommand(testRef)

    await expect(git.getHeadSymbolicRef()).resolves.toBe(testRef)
  })

  test('throws if HEAD is detached', async () => {
    mockGitCommand('')

    await expect(() => git.getHeadSymbolicRef()).rejects.toThrowError(/Git HEAD can't be detached to run command/)
  })

  test('passes the directory option', async () => {
    const directory = '/test/directory'
    mockGitCommand('ref/unit')

    await git.getHeadSymbolicRef(directory)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['symbolic-ref', '-q', 'HEAD'], {cwd: directory})
  })
})

describe('ensurePresentOrAbort()', () => {
  test('throws an error if git is not present', async () => {
    vi.mocked(hasGit).mockResolvedValue(false)

    await expect(() => git.ensureGitIsPresentOrAbort()).rejects.toThrowError(
      /Git is necessary in the environment to continue/,
    )
  })

  test("doesn't throw an error if Git is present", async () => {
    vi.mocked(hasGit).mockResolvedValue(true)

    await expect(git.ensureGitIsPresentOrAbort()).resolves.toBeUndefined()
  })
})

describe('ensureInsideGitDirectory()', () => {
  test('throws an error if not inside a git directory', async () => {
    const error = Object.assign(new Error('not a git repo'), {exitCode: 128})
    mockedExeca.mockRejectedValue(error)

    await expect(() => git.ensureInsideGitDirectory()).rejects.toThrowError(/is not a Git directory/)
  })

  test("doesn't throw an error if inside a git directory", async () => {
    mockGitCommand('')

    await expect(git.ensureInsideGitDirectory()).resolves.toBeUndefined()
  })
})

describe('insideGitDirectory()', () => {
  test('returns true if inside a git directory', async () => {
    mockGitCommand('.git')

    await expect(git.insideGitDirectory()).resolves.toBe(true)
  })

  test('returns false if not inside a git directory', async () => {
    const error = Object.assign(new Error('not a git repo'), {exitCode: 128})
    mockedExeca.mockRejectedValue(error)

    await expect(git.insideGitDirectory()).resolves.toBe(false)
  })

  test('passes the directory option', async () => {
    const directory = '/test/directory'
    mockGitCommand('.git')

    await git.insideGitDirectory(directory)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['rev-parse', '--git-dir'], {cwd: directory})
  })
})

describe('ensureIsClean()', () => {
  test('throws an error if git directory is not clean', async () => {
    mockGitCommand(' M file.txt')

    await expect(() => git.ensureIsClean()).rejects.toThrowError(/is not a clean Git directory/)
  })

  test("doesn't throw an error if git directory is clean", async () => {
    mockGitCommand('')

    await expect(git.ensureIsClean()).resolves.toBeUndefined()
  })
})

describe('getLatestTag()', () => {
  test('returns the latest tag from git', async () => {
    const expectedTag = 'v1.0.0'
    mockGitCommand(expectedTag)

    await expect(git.getLatestTag()).resolves.toBe(expectedTag)
  })

  test('return undefined when no tags exist', async () => {
    const error = Object.assign(new Error('fatal: No names found'), {exitCode: 128})
    mockedExeca.mockRejectedValue(error)

    await expect(git.getLatestTag()).resolves.toBeUndefined()
  })
})

describe('isGitClean()', () => {
  test('return false if git directory is not clean', async () => {
    mockGitCommand(' M file.txt')

    await expect(git.isClean()).resolves.toBe(false)
  })

  test('return true if git directory is clean', async () => {
    mockGitCommand('')

    await expect(git.isClean()).resolves.toBe(true)
  })

  test('passes the directory option', async () => {
    mockGitCommand('')
    const directory = '/test/directory'

    await git.isClean(directory)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['status', '--porcelain'], {cwd: directory})
  })
})

describe('addToGitIgnore()', () => {
  test('does nothing when .gitignore does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const gitIgnorePath = `${tmpDir}/.gitignore`

      git.addToGitIgnore(tmpDir, '.shopify')

      expect(fileExistsSync(gitIgnorePath)).toBe(false)
    })
  })

  test('does nothing when pattern already exists in .gitignore', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const gitIgnorePath = `${tmpDir}/.gitignore`
      const gitIgnoreContent = ' .shopify \nnode_modules\n'

      writeFileSync(gitIgnorePath, gitIgnoreContent)

      git.addToGitIgnore(tmpDir, '.shopify')

      const actualContent = readFileSync(gitIgnorePath).toString()
      expect(actualContent).toBe(gitIgnoreContent)
    })
  })

  test('appends pattern to .gitignore when file exists and pattern not present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const gitIgnorePath = `${tmpDir}/.gitignore`

      writeFileSync(gitIgnorePath, 'node_modules\ndist')

      git.addToGitIgnore(tmpDir, '.shopify')

      const gitIgnoreContent = readFileSync(gitIgnorePath).toString()
      expect(gitIgnoreContent).toBe('node_modules\ndist\n.shopify\n')
    })
  })

  test('appends pattern to .gitignore when file exists and pattern not present without duplicating the last empty line', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const gitIgnorePath = `${tmpDir}/.gitignore`

      writeFileSync(gitIgnorePath, 'node_modules\ndist\n')

      git.addToGitIgnore(tmpDir, '.shopify')

      const gitIgnoreContent = readFileSync(gitIgnorePath).toString()
      expect(gitIgnoreContent).toBe('node_modules\ndist\n.shopify\n')
    })
  })

  test('does nothing when .shopify/* pattern exists in .gitignore', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const gitIgnorePath = `${tmpDir}/.gitignore`
      const gitIgnoreContent = '.shopify/*\nnode_modules\n'

      writeFileSync(gitIgnorePath, gitIgnoreContent)

      git.addToGitIgnore(tmpDir, '.shopify')

      const actualContent = readFileSync(gitIgnorePath).toString()
      expect(actualContent).toBe(gitIgnoreContent)
    })
  })

  test('does nothing when .shopify/** pattern exists in .gitignore', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const gitIgnorePath = `${tmpDir}/.gitignore`
      const gitIgnoreContent = '.shopify/**\nnode_modules\n'

      writeFileSync(gitIgnorePath, gitIgnoreContent)

      git.addToGitIgnore(tmpDir, '.shopify')

      const actualContent = readFileSync(gitIgnorePath).toString()
      expect(actualContent).toBe(gitIgnoreContent)
    })
  })
})

describe('removeGitRemote()', () => {
  test('calls git remote remove successfully', async () => {
    const directory = '/test/directory'
    const remoteName = 'origin'
    mockGitCommandSequence([
      // remote
      {stdout: 'origin\n'},
      // remote remove
      {stdout: ''},
    ])

    await git.removeGitRemote(directory, remoteName)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['remote'], {cwd: directory})
    expect(mockedExeca).toHaveBeenCalledWith('git', ['remote', 'remove', remoteName], {cwd: directory})
  })

  test('does nothing when remote does not exist', async () => {
    const directory = '/test/directory'
    const remoteName = 'nonexistent'
    mockGitCommand('origin\nupstream\n')

    await git.removeGitRemote(directory, remoteName)

    expect(mockedExeca).toHaveBeenCalledWith('git', ['remote'], {cwd: directory})
    expect(mockedExeca).not.toHaveBeenCalledWith('git', ['remote', 'remove', remoteName], {cwd: directory})
  })
})
