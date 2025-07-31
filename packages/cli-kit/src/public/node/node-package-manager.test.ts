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
  checkForCachedNewVersion,
  inferPackageManager,
  PackageManager,
  determineYarnInstallCommand,
} from './node-package-manager.js'
import {captureOutput, exec} from './system.js'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from './fs.js'
import {joinPath, dirname} from './path.js'
import {inferPackageManagerForGlobalCLI} from './is-global.js'
import {outputDebug} from './output.js'
import {AbortController} from './abort.js'
import {cacheClear} from '../../private/node/conf-store.js'
import latestVersion from 'latest-version'
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'

vi.mock('./version.js')
vi.mock('./system.js')
vi.mock('latest-version')
vi.mock('./is-global')

const mockedExec = vi.mocked(exec)
const mockedCaptureOutput = vi.mocked(captureOutput)

// Mock only outputDebug, not the entire output module
vi.mock('./output.js', async () => {
  const actual = await vi.importActual('./output.js')
  return {
    ...actual,
    outputDebug: vi.fn(),
  }
})

const mockedOutputDebug = vi.mocked(outputDebug)

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
  beforeEach(() => {
    // Mocks are cleared automatically by vitest
  })

  describe('non-yarn package managers', () => {
    test('runs the install command for npm', async () => {
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
        stdin: undefined,
        stdout: undefined,
        stderr: undefined,
        signal: undefined,
      })
    })

    test('runs the install command for pnpm', async () => {
      // Given
      const packageManager = 'pnpm'
      const directory = '/path/to/project'

      // When
      await installNodeModules({
        directory,
        packageManager,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith(packageManager, ['install'], {
        cwd: directory,
        stdin: undefined,
        stdout: undefined,
        stderr: undefined,
        signal: undefined,
      })
    })

    test('runs the install command for bun', async () => {
      // Given
      const packageManager = 'bun'
      const directory = '/path/to/project'

      // When
      await installNodeModules({
        directory,
        packageManager,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith(packageManager, ['install'], {
        cwd: directory,
        stdin: undefined,
        stdout: undefined,
        stderr: undefined,
        signal: undefined,
      })
    })
  })

  describe('yarn version-aware behavior', () => {
    test('uses add command when yarn v3 is detected via packageManager field', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@3.6.4',
          }),
        )

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
          args: ['lodash'],
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'lodash'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })

    test('uses install command when yarn v1 is detected via packageManager field', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@1.22.19',
          }),
        )

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
          args: ['express'],
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['install', 'express'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })

    test('uses add command when yarn v3 is detected via yarn --version', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        mockedCaptureOutput.mockResolvedValueOnce('3.6.4')

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['add'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })

    test('uses install command when yarn v1 is detected via yarn --version', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        mockedCaptureOutput.mockResolvedValueOnce('1.22.19')

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
          args: ['react'],
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['install', 'react'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })

    test('uses add command when .yarnrc.yml exists and version detection fails', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        const yarnrcPath = joinPath(tmpDir, '.yarnrc.yml')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        await writeFile(yarnrcPath, 'yarnPath: .yarn/releases/yarn-3.6.4.cjs')
        mockedCaptureOutput.mockRejectedValueOnce(new Error('Command failed'))

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['add'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })

    test('falls back to install command when all yarn detection fails', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        mockedCaptureOutput.mockRejectedValueOnce(new Error('yarn not found'))

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
          args: ['typescript'],
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['install', 'typescript'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })

    test('falls back to install command when yarn is not available on system', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        mockedCaptureOutput.mockRejectedValueOnce(new Error('spawn yarn ENOENT'))

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['install'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: undefined,
        })
      })
    })
  })

  describe('stream options passthrough', () => {
    test('passes stdout and stderr options correctly for yarn', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            packageManager: 'yarn@3.0.0',
          }),
        )
        const mockStdout = {write: vi.fn()} as any
        const mockStderr = {write: vi.fn()} as any

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
          stdout: mockStdout,
          stderr: mockStderr,
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['add'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: mockStdout,
          stderr: mockStderr,
          signal: undefined,
        })
      })
    })

    test('passes signal option correctly for yarn', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            packageManager: 'yarn@2.4.3',
          }),
        )
        const mockAbortController = new AbortController()

        // When
        await installNodeModules({
          directory: tmpDir,
          packageManager: 'yarn',
          signal: mockAbortController.signal,
        })

        // Then
        expect(mockedExec).toHaveBeenCalledWith('yarn', ['add'], {
          cwd: tmpDir,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          signal: mockAbortController.signal,
        })
      })
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
      await expect(getDependencies(packageJsonPath)).rejects.toThrowError(PackageJsonNotFoundError)
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

describe('checkForCachedNewVersion', () => {
  beforeEach(() => cacheClear())

  test('returnes undefined when there is no cached value', () => {
    // Given
    const currentVersion = '2.2.2'
    const dependency = 'dependency'

    // When
    const result = checkForCachedNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBeUndefined()
  })

  test('returnes undefined when the cached value is lower than or equal to the current version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.2'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)
    await checkForNewVersion(dependency, currentVersion)

    // When
    const result = checkForCachedNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(undefined)
  })

  test('returnes a version string when the cached value is greater than the current version', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.3'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)
    await checkForNewVersion(dependency, currentVersion)

    // When
    const result = checkForCachedNewVersion(dependency, currentVersion)

    // Then
    expect(result).toEqual(newestVersion)
  })
})

describe('checkForNewVersion', () => {
  beforeEach(() => cacheClear())
  afterEach(() => {
    vi.useRealTimers()
  })

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

  test('caches results when given a nonzero timeout', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.3'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)

    // When
    await checkForNewVersion(dependency, currentVersion)
    vi.setSystemTime(vi.getRealSystemTime() + 999 * 3600 * 1000)
    const result = await checkForNewVersion(dependency, currentVersion, {cacheExpiryInHours: 1000})

    // Then
    expect(result).toBe(newestVersion)
    expect(latestVersion).toHaveBeenCalledTimes(1)
  })

  test('refreshes results when given a nonzero timeout that has expired', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.3'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)

    // When
    await checkForNewVersion(dependency, currentVersion)
    vi.setSystemTime(vi.getRealSystemTime() + 1001 * 3600 * 1000)
    const result = await checkForNewVersion(dependency, currentVersion, {cacheExpiryInHours: 1000})

    // Then
    expect(result).toBe(newestVersion)
    expect(latestVersion).toHaveBeenCalledTimes(2)
  })

  test('refreshes results when given no timeout', async () => {
    // Given
    const currentVersion = '2.2.2'
    const newestVersion = '2.2.3'
    const dependency = 'dependency'
    vi.mocked(latestVersion).mockResolvedValue(newestVersion)

    // When
    await checkForNewVersion(dependency, currentVersion)
    const result = await checkForNewVersion(dependency, currentVersion)

    // Then
    expect(result).toBe(newestVersion)
    expect(latestVersion).toHaveBeenCalledTimes(2)
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
        FindUpAndReadPackageJsonNotFoundError,
      )
    })
  })
})

describe('addResolutionOrOverride', () => {
  test('when no package.json then an abort exception is thrown', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given/When
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))
      const result = () => addResolutionOrOverride(tmpDir, {'@types/react': '17.0.30'})

      // Then
      await expect(result).rejects.toThrowError(PackageJsonNotFoundError)
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
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))
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
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))
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
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))
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
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))
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
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))
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

      // When
      await writePackageJSON(tmpDir, packageJSON)
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))

      // Then
      const packageManager = await getPackageManager(tmpDir)
      expect(packageManager).toEqual('npm')
    })
  })

  test('finds if yarn is being used', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJSON = {name: 'mock name'}
      const yarnLock = joinPath(tmpDir, 'yarn.lock')

      // When
      await writePackageJSON(tmpDir, packageJSON)
      await writeFile(yarnLock, '')
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))

      // Then
      const packageManager = await getPackageManager(tmpDir)
      expect(packageManager).toEqual('yarn')
    })
  })

  test('finds if pnpm is being used', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJSON = {name: 'mock name'}
      const pnpmLock = joinPath(tmpDir, 'pnpm-lock.yaml')

      // When
      await writePackageJSON(tmpDir, packageJSON)
      await writeFile(pnpmLock, '')
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))

      // Then
      const packageManager = await getPackageManager(tmpDir)
      expect(packageManager).toEqual('pnpm')
    })
  })

  test('falls back to packageManagerFromUserAgent when npm prefix fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.stubEnv('npm_config_user_agent', 'yarn/1.22.0')

      // Mock npm prefix to fail
      mockedCaptureOutput.mockRejectedValueOnce(new Error('npm prefix failed'))

      // When
      const packageManager = await getPackageManager(tmpDir)

      // Then
      expect(mockedCaptureOutput).toHaveBeenCalledWith('npm', ['prefix'], expect.anything())
      expect(packageManager).toEqual('yarn')

      // Restore original implementation
      vi.unstubAllEnvs()
    })
  })

  test("tries to guess the package manager from the environment if it can't find a package.json", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const subDirectory = joinPath(tmpDir, 'subdir')
      await mkdir(subDirectory)
      mockedCaptureOutput.mockReturnValueOnce(Promise.resolve(tmpDir))

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

describe('inferPackageManager', () => {
  test('returns the package manager when a valid one is provided in options', () => {
    expect(inferPackageManager('yarn')).toBe('yarn')
    expect(inferPackageManager('npm')).toBe('npm')
    expect(inferPackageManager('pnpm')).toBe('pnpm')
    expect(inferPackageManager('bun')).toBe('bun')
  })

  test('ignores invalid package manager in options', () => {
    const mockEnv = {npm_config_user_agent: 'npm/1.0.0'}
    expect(inferPackageManager('invalid' as PackageManager, mockEnv)).toBe('npm')
  })

  test('infers package manager from user agent when not provided in options', () => {
    const mockEnv = {npm_config_user_agent: 'yarn/1.22.0'}
    expect(inferPackageManager(undefined, mockEnv)).toBe('yarn')
  })

  test('infers package manager from global CLI when not in options or user agent', () => {
    const mockEnv = {}
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('pnpm')
    expect(inferPackageManager(undefined, mockEnv)).toBe('pnpm')
  })

  test('defaults to npm when no other method succeeds', () => {
    const mockEnv = {}
    vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('unknown')
    expect(inferPackageManager(undefined, mockEnv)).toBe('npm')
  })
})

describe('determineYarnInstallCommand', () => {
  beforeEach(() => {
    // Mocks are cleared automatically by vitest
  })

  describe('packageManager field detection', () => {
    test('returns ["add"] when package.json has packageManager field with yarn v2+', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@3.0.0',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["add"] when package.json has prerelease version yarn@4.0.0-beta.1', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@4.0.0-beta.1',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["add"] when package.json has dist-tag yarn@next', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@next',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["add"] when package.json has dist-tag yarn@latest', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@latest',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["add"] when package.json has dist-tag yarn@canary', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@canary',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["add"] when package.json has coercible version yarn@4', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@4',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["install"] when package.json has coercible version yarn@1.22', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@1.22',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })

    test('finds packageManager field when called from subdirectory', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Create package.json in root
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@3.6.4',
          }),
        )

        // Create subdirectory
        const subDir = joinPath(tmpDir, 'src', 'components')
        await mkdir(dirname(subDir))
        await mkdir(subDir)

        // Call from subdirectory - should find root package.json
        const result = await determineYarnInstallCommand(subDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["add"] when package.json has packageManager field with yarn v2', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@2.4.3',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["install"] when package.json has packageManager field with yarn v1', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@1.22.19',
          }),
        )

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })
  })

  describe('yarn --version command detection', () => {
    test('returns ["add"] when yarn --version shows v3.x', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))

        mockedCaptureOutput.mockResolvedValueOnce('3.6.4')

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
        expect(mockedCaptureOutput).toHaveBeenCalledWith(
          'yarn',
          ['--version'],
          expect.objectContaining({
            cwd: tmpDir,
          }),
        )
      })
    })

    test('returns ["install"] when yarn --version shows v1.x', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))

        mockedCaptureOutput.mockResolvedValueOnce('1.22.19')

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })

    test('returns ["install"] when yarn is not available on the system', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))

        mockedCaptureOutput.mockRejectedValueOnce(new Error('spawn yarn ENOENT'))

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })
  })

  describe('.yarnrc.yml file detection', () => {
    test('returns ["add"] when .yarnrc.yml exists and yarn --version fails', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        const yarnrcPath = joinPath(tmpDir, '.yarnrc.yml')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        await writeFile(yarnrcPath, 'yarnPath: .yarn/releases/yarn-3.6.4.cjs')

        mockedCaptureOutput.mockRejectedValueOnce(new Error('Command failed'))

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
      })
    })

    test('returns ["install"] when .yarnrc.yml does not exist and yarn --version fails', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))

        mockedCaptureOutput.mockRejectedValueOnce(new Error('Command failed'))

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })

    test('returns ["install"] when .yarnrc.yml exists but yarn is not available on system', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        const yarnrcPath = joinPath(tmpDir, '.yarnrc.yml')
        await writeFile(packageJsonPath, JSON.stringify({name: 'test-package'}))
        await writeFile(yarnrcPath, 'yarnPath: .yarn/releases/yarn-3.6.4.cjs')

        mockedCaptureOutput.mockRejectedValueOnce(new Error('spawn yarn ENOENT'))

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })
  })

  describe('error handling and fallbacks', () => {
    test('falls back to yarn --version when packageManager has invalid semver yarn@invalid-version', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@invalid-version',
          }),
        )

        mockedCaptureOutput.mockResolvedValueOnce('3.6.4')

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['add'])
        expect(mockedCaptureOutput).toHaveBeenCalledWith(
          'yarn',
          ['--version'],
          expect.objectContaining({
            cwd: tmpDir,
          }),
        )
      })
    })

    test('falls back to yarn --version when packageManager has unknown tag yarn@unknown-tag', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@unknown-tag',
          }),
        )

        mockedCaptureOutput.mockResolvedValueOnce('1.22.19')

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })

    test('returns ["install"] when all detection methods fail', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        mockedCaptureOutput.mockRejectedValueOnce(new Error('Command failed'))

        const result = await determineYarnInstallCommand(tmpDir)

        expect(result).toEqual(['install'])
      })
    })

    test('logs debug information during detection process', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const packageJsonPath = joinPath(tmpDir, 'package.json')
        await writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test-package',
            packageManager: 'yarn@3.6.4',
          }),
        )

        await determineYarnInstallCommand(tmpDir)

        expect(mockedOutputDebug).toHaveBeenCalledWith('Detected yarn v3.6.4 from packageManager field: yarn@3.6.4')
      })
    })
  })
})
