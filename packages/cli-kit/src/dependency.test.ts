import {
  dependencyManagerUsedForCreating,
  addNPMDependenciesIfNeeded,
  install,
  getDependencies,
  getPackageName,
  PackageJsonNotFoundError,
  checkForNewVersion,
  getOutputUpdateCLIReminder,
  DependencyManager,
  packageJSONContents,
  getProjectType,
} from './dependency'
import {exec} from './system'
import {join as pathJoin, normalize as pathNormalize} from './path'
import {unstyled} from './output'
import {write as writeFile} from './file'
import {latestNpmPackageVersion} from './version'
import {describe, it, expect, vi, test} from 'vitest'
import {temporary} from '@shopify/cli-testing'

vi.mock('./version')
vi.mock('./system')
const mockedExec = vi.mocked(exec)

describe('dependencyManagerUsedForCreating', () => {
  it('returns pnpm if the npm_config_user_agent variable contains yarn', () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const env = {npm_config_user_agent: 'yarn/1.22.17'}

    // When
    const got = dependencyManagerUsedForCreating(env)

    // Then
    expect(got).toBe('yarn')
  })

  it('returns pnpm if the npm_config_user_agent variable contains pnpm', () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const env = {npm_config_user_agent: 'pnpm'}

    // When
    const got = dependencyManagerUsedForCreating(env)

    // Then
    expect(got).toBe('pnpm')
  })

  it('returns npm when the package manager cannot be detected', () => {
    // When
    const got = dependencyManagerUsedForCreating({})

    // Then
    expect(got).toBe('npm')
  })
})

describe('install', () => {
  it('runs the install command', async () => {
    // Given
    const dependencyManager = 'npm'
    const directory = '/path/to/project'

    // When
    await install(directory, dependencyManager)

    // Then
    expect(mockedExec).toHaveBeenCalledWith(dependencyManager, ['install'], {
      cwd: directory,
    })
  })
})

describe('getPackageName', () => {
  test('returns package name', async () => {
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
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
      const got = await packageJSONContents(packageJsonPath)

      // Then
      expect(got).toEqual(packageJson)
    })
  })
})

describe('getDependencies', () => {
  test('returns dev and production dependencies', async () => {
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')

      // When
      await expect(getDependencies(packageJsonPath)).rejects.toEqual(PackageJsonNotFoundError(pathNormalize(tmpDir)))
    })
  })
})

describe('addNPMDependenciesIfNeeded', () => {
  test('runs the right command when there is no version in dependency', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: undefined}], {
        type: 'dev',
        dependencyManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new', '--save-dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's npm and dev dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'dev',
        dependencyManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new@version', '--save-dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's npm and production dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'prod',
        dependencyManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new@version', '--save-prod'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's npm and peer dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'peer',
        dependencyManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new@version', '--save-peer'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's yarn and dev dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'dev',
        dependencyManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new@version', '--dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's yarn and production dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'prod',
        dependencyManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new@version', '--prod'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's yarn and peer dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'peer',
        dependencyManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new@version', '--peer'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's pnpm and dev dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'dev',
        dependencyManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new@version', '--save-dev'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's pnpm and production dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'prod',
        dependencyManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new@version', '--save-prod'], {
        cwd: tmpDir,
      })
    })
  })

  test("runs the right command when it's pnpm and peer dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded([{name: 'new', version: 'version'}], {
        type: 'peer',
        dependencyManager: 'pnpm',
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

describe('getOutputUpdateCLIReminder', () => {
  it.each([['yarn'], ['npm'], ['pnpm']])(
    'returns upgrade reminder when using %s dependency manager',
    (dependencyManager: string) => {
      const isYarn = dependencyManager === 'yarn'

      // When
      const result = getOutputUpdateCLIReminder(dependencyManager as DependencyManager, '1.2.3')

      // Then
      expect(unstyled(result)).toBe(
        `💡 Version 1.2.3 available! Run ${dependencyManager}${isYarn ? '' : ' run'} shopify${
          isYarn ? '' : ' --'
        } upgrade`,
      )
    },
  )
})

describe('getProjectType', () => {
  it('returns node when the directory contains a package.json', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await writeFile(pathJoin(tmpDir, 'package.json'), '')

      // When
      const got = await getProjectType(tmpDir)

      // Then
      expect(got).toBe('node')
    })
  })

  it('returns ruby when the directory contains a Gemfile', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await writeFile(pathJoin(tmpDir, 'Gemfile'), '')

      // When
      const got = await getProjectType(tmpDir)

      // Then
      expect(got).toBe('ruby')
    })
  })

  it('returns php when the directory contains a composer.json', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await writeFile(pathJoin(tmpDir, 'composer.json'), '')

      // When
      const got = await getProjectType(tmpDir)

      // Then
      expect(got).toBe('php')
    })
  })

  it('returns undefined when the directory does not contain a known config file', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await writeFile(pathJoin(tmpDir, 'config.toml'), '')

      // When
      const got = await getProjectType(tmpDir)

      // Then
      expect(got).toBe(undefined)
    })
  })
})
