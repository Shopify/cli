import {
  packageManagerFromUserAgent,
  addNPMDependenciesIfNeeded,
  installNodeModules,
  getDependencies,
  getPackageName,
  checkForNewVersion,
  readAndParsePackageJson,
  findUpAndReadPackageJson,
  FindUpAndReadPackageJsonNotFoundError,
  usesWorkspaces,
  addResolutionOrOverride,
  writePackageJSON,
  getPackageManager,
  installNPMDependenciesRecursively,
  addNPMDependencies,
  DependencyVersion,
  PackageJsonNotFoundError,
  UnknownPackageManagerError,
} from './node-package-manager.js'
import {exec} from './system.js'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from './fs.js'
import {joinPath, dirname, normalizePath} from './path.js'
import latestVersion from 'latest-version'
import {vi, describe, test, expect} from 'vitest'

vi.mock('../../version.js')
vi.mock('./system.js')
vi.mock('latest-version')

const mockedExec = vi.mocked(exec)

describe('installNPMDependenciesRecursively', () => {
  test('runs install in all the directories containing a package.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const rootPackage = joinPath(tmpDir, 'package.json')
      const webPackage = joinPath(tmpDir, 'web/package.json')
      const backendPackage = joinPath(tmpDir, 'web/backend/package.json')

      await mkdir(dirname(webPackage))
      await mkdir(dirname(backendPackage))

      await writeFile(rootPackage, JSON.stringify({}))
      await writeFile(webPackage, JSON.stringify({}))
      await writeFile(backendPackage, JSON.stringify({}))

      // When
      await installNPMDependenciesRecursively({
        directory: tmpDir,
        packageManager: 'pnpm',
      })

      // Then
      const calls = vi.mocked(exec).mock.calls as any
      expect(exec).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({cwd: dirname(rootPackage)}))
      expect(exec).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({cwd: dirname(webPackage)}))
      expect(exec).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({cwd: dirname(backendPackage)}))
    })
  })
})

describe('packageManagerFromUserAgent', () => {
  test('returns pnpm if the npm_config_user_agent variable contains yarn', () => {
    // Given
    const env = {npm_config_user_agent: 'yarn/1.22.17'}

    // When
    const got = packageManagerFromUserAgent(env)

    // Then
    expect(got).toBe('yarn')
  })

  test('returns pnpm if the npm_config_user_agent variable contains pnpm', () => {
    // Given
    const env = {npm_config_user_agent: 'pnpm'}

    // When
    const got = packageManagerFromUserAgent(env)

    // Then
    expect(got).toBe('pnpm')
  })

  test('returns npm if the npm_config_user_agent variable contains npm', () => {
    // Given
    const env = {npm_config_user_agent: 'npm'}

    // When
    const got = packageManagerFromUserAgent(env)

    // Then
    expect(got).toBe('npm')
  })

  test('returns unknown when the package manager cannot be detected', () => {
    // When
    const got = packageManagerFromUserAgent({})

    // Then
    expect(got).toBe('unknown')
  })
})

describe('install', () => {
  test('runs the install command', async () => {
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {
        name: 'packageName',
        version: '1.0.0',
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      const pnpmWorkspaceFilePath = joinPath(tmpDir, 'pnpm-workspace.yaml')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')

      // When
      await expect(getDependencies(packageJsonPath)).rejects.toEqual(
        new PackageJsonNotFoundError(normalizePath(tmpDir)),
      )
    })
  })
})

describe('addNPMDependenciesIfNeeded', () => {
  test('runs the right command when there is no version in dependency', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
  test('returns undefined when last version is lower or equals than current version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.2'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)

    // When
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(undefined)
  })

  test('returns undefined when last version greater than current version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.3'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)

    // When
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(newestVersion)
  })

  test('returns undefined when error is thrown retrieving newest version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockRejectedValue(undefined)

    // When
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(undefined)
  })
})

describe('findUpAndReadPackageJson', () => {
  test('returns the content of the package.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = joinPath(tmpDir, 'subdir')
      const version = '1.2.3'
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      await mkdir(subDirectory)
      const packageJson = {version}
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await findUpAndReadPackageJson(subDirectory)

      // Then
      expect(got.path).toEqual(packageJsonPath)
      expect(got.content as any).toEqual(packageJson)
    })
  })

  test("throws a FindUpAndReadPackageJsonNotFoundError error if it can't find a package.json", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = joinPath(tmpDir, 'subdir')
      await mkdir(subDirectory)

      // When/Then
      await expect(() => findUpAndReadPackageJson(subDirectory)).rejects.toThrowError(
        new FindUpAndReadPackageJsonNotFoundError(subDirectory),
      )
    })
  })
})

describe('addResolutionOrOverride', () => {
  test('when no package.json then an abort exception is thrown', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given/When
      const result = () => addResolutionOrOverride(tmpDir, {'@types/react': '17.0.30'})

      // Then
      await expect(result).rejects.toThrow(new PackageJsonNotFoundError(normalizePath(tmpDir)))
    })
  })

  test('when package.json without resolution and yarn manager then new resolution should be added', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {}
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      await touchFile(joinPath(tmpDir, 'yarn.lock'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.resolutions).toBeDefined()
      expect(packageJsonContent.resolutions).toEqual(reactType)
      expect(packageJsonContent.overrides).toBeUndefined()
    })
  })

  test('when package.json without resolution and npm manager then new overrides should be added', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {}
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      await touchFile(joinPath(tmpDir, 'pnpm-lock.yaml'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.overrides).toBeDefined()
      expect(packageJsonContent.overrides).toEqual(reactType)
      expect(packageJsonContent.resolutions).toBeUndefined()
    })
  })

  test('when package.json without resolution and pnpm manager then new overrides should be added', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {}
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      await touchFile(joinPath(tmpDir, 'pnpm-workspace.yaml'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.overrides).toBeDefined()
      expect(packageJsonContent.overrides).toEqual(reactType)
      expect(packageJsonContent.resolutions).toBeUndefined()
    })
  })

  test('when package.json with existing resolution type and yarn manager then dependency version is overwritten', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {resolutions: {'@types/react': '17.0.50'}}
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      await touchFile(joinPath(tmpDir, 'yarn.lock'))

      // When
      await addResolutionOrOverride(tmpDir, reactType)

      // Then
      const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
      expect(packageJsonContent.resolutions).toBeDefined()
      expect(packageJsonContent.resolutions).toEqual(reactType)
      expect(packageJsonContent.overrides).toBeUndefined()
    })
  })

  test('when package.json with different resolution types and yarn manager then dependency version is overwritten', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const reactType = {'@types/react': '17.0.30'}
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {resolutions: {'@types/node': '^17.0.38'}}
      await writeFile(packageJsonPath, JSON.stringify(packageJson))
      await touchFile(joinPath(tmpDir, 'yarn.lock'))

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

describe('writePackageJSON', () => {
  test('writes the package.json and returns it parsed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJSON = {name: 'mock name'}
      const filePath = joinPath(tmpDir, 'package.json')

      // When
      await writePackageJSON(tmpDir, packageJSON)

      // Then
      const packageJsonContent = await readAndParsePackageJson(filePath)
      expect(packageJsonContent).toEqual(packageJSON)
    })
  })
})

describe('getPackageManager', () => {
  test('finds if npm is being used', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJSON = {name: 'mock name'}
      const filePath = joinPath(tmpDir, 'package.json')

      // When
      await writePackageJSON(tmpDir, packageJSON)

      // Then
      const packageManager = await getPackageManager(tmpDir)
      expect(packageManager).toEqual('npm')
    })
  })

  test('finds if yarn is being used', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJSON = {name: 'mock name'}
      const filePath = joinPath(tmpDir, 'package.json')
      const yarnLock = joinPath(tmpDir, 'yarn.lock')

      // When
      await writePackageJSON(tmpDir, packageJSON)
      await writeFile(yarnLock, '')

      // Then
      const packageManager = await getPackageManager(tmpDir)
      expect(packageManager).toEqual('yarn')
    })
  })

  test('finds if pnpm is being used', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJSON = {name: 'mock name'}
      const filePath = joinPath(tmpDir, 'package.json')
      const pnpmLock = joinPath(tmpDir, 'pnpm-lock.yaml')

      // When
      await writePackageJSON(tmpDir, packageJSON)
      await writeFile(pnpmLock, '')

      // Then
      const packageManager = await getPackageManager(tmpDir)
      expect(packageManager).toEqual('pnpm')
    })
  })

  test("tries to guess the package manager from the environment if it can't find a package.json", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = joinPath(tmpDir, 'subdir')
      await mkdir(subDirectory)

      // When/Then
      const packageManager = await getPackageManager(tmpDir)
      // pnpm is used locally and in CI
      expect(packageManager).toEqual('pnpm')
    })
  })
})

describe('addNPMDependencies', () => {
  test('when using npm with multiple dependencies they should be installed one by one, adding --save-exact if needed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dependencies: DependencyVersion[] = [
        {name: 'first', version: '^0.0.1'},
        {name: 'second', version: '0.0.2'},
      ]

      // When
      await addNPMDependencies(dependencies, {
        type: 'prod',
        packageManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenNthCalledWith(1, 'npm', ['install', 'first@^0.0.1', '--save-prod'], {
        cwd: tmpDir,
      })
      expect(mockedExec).toHaveBeenNthCalledWith(2, 'npm', ['install', 'second@0.0.2', '--save-prod', '--save-exact'], {
        cwd: tmpDir,
      })
    })
  })

  test('when using yarn with multiple dependencies they should be installed all at once', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dependencies: DependencyVersion[] = [
        {name: 'first', version: '0.0.1'},
        {name: 'second', version: '0.0.2'},
      ]

      // When
      await addNPMDependencies(dependencies, {
        type: 'prod',
        packageManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'first@0.0.1', 'second@0.0.2', '--prod'], {
        cwd: tmpDir,
      })
    })
  })

  test('when using pnpm with multiple dependencies they should be installed all at once', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dependencies: DependencyVersion[] = [
        {name: 'first', version: '0.0.1'},
        {name: 'second', version: '0.0.2'},
      ]

      // When
      await addNPMDependencies(dependencies, {
        type: 'prod',
        packageManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'first@0.0.1', 'second@0.0.2', '--save-prod'], {
        cwd: tmpDir,
      })
    })
  })

  test('when the package manager is unknown an error is thrown', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const dependencies: DependencyVersion[] = [
        {name: 'first', version: '0.0.1'},
        {name: 'second', version: '0.0.2'},
      ]

      // When/Then
      await expect(
        addNPMDependencies(dependencies, {
          type: 'prod',
          packageManager: 'unknown',
          directory: tmpDir,
        }),
      ).rejects.toThrowError(UnknownPackageManagerError)
    })
  })
})
