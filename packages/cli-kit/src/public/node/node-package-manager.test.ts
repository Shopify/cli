import {
  packageManagerUsedForCreating,
  addNPMDependenciesIfNeeded,
  installNodeModules,
  getDependencies,
  getPackageName,
  PackageJsonNotFoundError,
  checkForNewVersion,
  readAndParsePackageJson,
  findUpAndReadPackageJson,
  FindUpAndReadPackageJsonNotFoundError,
  usesWorkspaces,
  addResolutionOrOverride,
} from './node-package-manager.js'
import {exec} from '../../system.js'
import {join as pathJoin, normalize as pathNormalize} from '../../path.js'
import {inTemporaryDirectory, mkdir, touch, write, write as writeFile} from '../../file.js'
import {latestNpmPackageVersion} from '../../version.js'
import {Abort} from '../../error.js'
import {describe, it, expect, vi, test} from 'vitest'

vi.mock('../../version.js')
vi.mock('../../system.js')
const mockedExec = vi.mocked(exec)

describe('packageManagerUsedForCreating', () => {
  it('returns pnpm if the npm_config_user_agent variable contains yarn', () => {
    // Given
    const env = {npm_config_user_agent: 'yarn/1.22.17'}

    // When
    const got = packageManagerUsedForCreating(env)

    // Then
    expect(got).toBe('yarn')
  })

  it('returns pnpm if the npm_config_user_agent variable contains pnpm', () => {
    // Given
    const env = {npm_config_user_agent: 'pnpm'}

    // When
    const got = packageManagerUsedForCreating(env)

    // Then
    expect(got).toBe('pnpm')
  })

  it('returns npm if the npm_config_user_agent variable contains npm', () => {
    // Given
    const env = {npm_config_user_agent: 'npm'}

    // When
    const got = packageManagerUsedForCreating(env)

    // Then
    expect(got).toBe('npm')
  })

  it('returns unknown when the package manager cannot be detected', () => {
    // When
    const got = packageManagerUsedForCreating({})

    // Then
    expect(got).toBe('unknown')
  })
})

describe('install', () => {
  it('runs the install command', async () => {
    // Given
    const packageManager = 'npm'
    const directory = '/path/to/project'

    // When
    await installNodeModules({
      directory,
      packageManager,
      args: ['arg1'],
    })

    // Then
    expect(mockedExec).toHaveBeenCalledWith(packageManager, ['install', 'arg1'], {
      cwd: directory,
    })
  })
})

describe('getPackageName', () => {
  test('returns package name', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        name: 'packageName',
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await getPackageName(packageJsonPath)

      // Then
      expect(got).toEqual('packageName')
    })
  })
})

describe('packageJSONContents', () => {
  test('returns full package content', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        name: 'packageName',
        version: '1.0.0',
        dependencies: {prod: '1.2.3'},
        devDependencies: {dev: '4.5.6'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await readAndParsePackageJson(packageJsonPath)

      // Then
      expect(got).toEqual(packageJson)
    })
  })
})

describe('usesWorkspaces', () => {
  test('returns true when workspaces are used in the package.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        name: 'packageName',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await usesWorkspaces(tmpDir)

      // Then
      expect(got).toEqual(true)
    })
  })

  test('returns true when workspaces are used by pnpm', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        name: 'packageName',
        version: '1.0.0',
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      const pnpmWorkspaceFilePath = pathJoin(tmpDir, 'pnpm-workspace.yaml')
      await writeFile(pnpmWorkspaceFilePath, '')

      // When
      const got = await usesWorkspaces(tmpDir)

      // Then
      expect(got).toEqual(true)
    })
  })

  test('returns false when workspaces are not used', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        name: 'packageName',
        version: '1.0.0',
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await usesWorkspaces(tmpDir)

      // Then
      expect(got).toEqual(false)
    })
  })
})

describe('getDependencies', () => {
  test('returns dev and production dependencies', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {prod: '1.2.3'},
        devDependencies: {dev: '4.5.6'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await getDependencies(packageJsonPath)

      // Then
      expect(got.prod).toEqual('1.2.3')
      expect(got.dev).toEqual('4.5.6')
    })
  })

  test('returns dev dependencies when production dependencies do not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        devDependencies: {dev: '4.5.6'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await getDependencies(packageJsonPath)

      // Then
      expect(got.dev).toEqual('4.5.6')
    })
  })

  test('returns production dependencies when dev dependencies do not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {prod: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await getDependencies(packageJsonPath)

      // Then
      expect(got.prod).toEqual('1.2.3')
    })
  })

  test('throws an error if the package.json file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')

      // When
      await expect(getDependencies(packageJsonPath)).rejects.toEqual(PackageJsonNotFoundError(pathNormalize(tmpDir)))
    })
  })
})

describe('addNPMDependenciesIfNeeded', () => {
  test('runs the right command when there is no version in dependency', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: undefined}], {
        type: 'dev',
        packageManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new', '--save-dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's npm and dev dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'dev',
        packageManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new@version', '--save-dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's npm and production dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'prod',
        packageManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new@version', '--save-prod'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's npm and peer dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'peer',
        packageManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new@version', '--save-peer'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's yarn and dev dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'dev',
        packageManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new@version', '--dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's yarn and production dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'prod',
        packageManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new@version', '--prod'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's yarn and peer dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'peer',
        packageManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new@version', '--peer'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's pnpm and dev dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'dev',
        packageManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new@version', '--save-dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's pnpm and production dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'prod',
        packageManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new@version', '--save-prod'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's pnpm and peer dependencies", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'peer',
        packageManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new@version', '--save-peer'], {
        cwd: tmpDir,
      })
    })
  })
})

describe('checkForNewVersion', () => {
  it('returns undefined when last version is lower or equals than current version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.2'
    const dependency = 'dependency'
    vi.mocked(latestNpmPackageVersion).mockResolvedValue(newestVersion)

    // When
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(undefined)
  })

  it('returns undefined when last version greater than current version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.3'
    const dependency = 'dependency'
    vi.mocked(latestNpmPackageVersion).mockResolvedValue(newestVersion)

    // When
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(newestVersion)
  })

  it('returns undefined when error is thrown retrieving newest version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const dependency = 'dependency'
    vi.mocked(latestNpmPackageVersion).mockRejectedValue(undefined)

    // When
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(undefined)
  })
})

describe('findUpAndReadPackageJson', () => {
  it('returns the content of the package.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = pathJoin(tmpDir, 'subdir')
      const version = '1.2.3'
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      await mkdir(subDirectory)
      const packageJson = {version}
      await write(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await findUpAndReadPackageJson(subDirectory)

      // Then
      expect(got.path).toEqual(packageJsonPath)
      expect(got.content as any).toEqual(packageJson)
    })
  })

  it("throws a FindUpAndReadPackageJsonNotFoundError error if it can't find a package.json", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = pathJoin(tmpDir, 'subdir')
      await mkdir(subDirectory)

      // When/Then
      await expect(() => findUpAndReadPackageJson(subDirectory)).rejects.toThrowError(
        FindUpAndReadPackageJsonNotFoundError(subDirectory),
      )
    })
  })
})

describe('addResolutionOrOverride', () => {
  it('when no package.json then an abort exception is thrown', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      // When
      const result = () => addResolutionOrOverride(tmpDir, {'@types/react': '17.0.30'})

      // Then

      await expect(result).rejects.toThrow(Abort)
    })
  })

  it('when package.json without resolution and yarn manager then new resolution should be added', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {}
      await write(packageJsonPath, JSON.stringify(packageJson))
      await touch(pathJoin(tmpDir, 'yarn.lock'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.resolutions).toBeDefined()
      expect(packageJsonContent.resolutions).toEqual(reactType)
      expect(packageJsonContent.overrides).toBeUndefined()
    })
  })

  it('when package.json without resolution and npm manager then new overrides should be added', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {}
      await write(packageJsonPath, JSON.stringify(packageJson))
      await touch(pathJoin(tmpDir, 'pnpm-lock.yaml'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.overrides).toBeDefined()
      expect(packageJsonContent.overrides).toEqual(reactType)
      expect(packageJsonContent.resolutions).toBeUndefined()
    })
  })

  it('when package.json without resolution and pnpm manager then new overrides should be added', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {}
      await write(packageJsonPath, JSON.stringify(packageJson))
      await touch(pathJoin(tmpDir, 'pnpm-workspace.yaml'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.overrides).toBeDefined()
      expect(packageJsonContent.overrides).toEqual(reactType)
      expect(packageJsonContent.resolutions).toBeUndefined()
    })
  })

  it('when package.json with existing resolution type and yarn manager then dependency version is overwritten', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {resolutions: {'@types/react': '17.0.50'}}
      await write(packageJsonPath, JSON.stringify(packageJson))
      await touch(pathJoin(tmpDir, 'yarn.lock'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.resolutions).toBeDefined()
      expect(packageJsonContent.resolutions).toEqual(reactType)
      expect(packageJsonContent.overrides).toBeUndefined()
    })
  })

  it('when package.json with different resolution types and yarn manager then dependency version is overwritten', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {resolutions: {'@types/node': '^17.0.38'}}
      await write(packageJsonPath, JSON.stringify(packageJson))
      await touch(pathJoin(tmpDir, 'yarn.lock'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.resolutions).toBeDefined()
      expect(packageJsonContent.resolutions).toEqual({'@types/node': '^17.0.38', '@types/react': '17.0.30'})
      expect(packageJsonContent.overrides).toBeUndefined()
    })
  })
})
