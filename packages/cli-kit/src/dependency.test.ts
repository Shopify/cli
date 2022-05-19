import {
  dependencyManagerUsedForCreating,
  addNPMDependenciesIfNeeded,
  install,
  getDependencies,
  PackageJsonNotFoundError,
} from './dependency'
import {exec} from './system'
import {join as pathJoin} from './path'
import {write as writeFile} from './file'
import {describe, it, expect, vi, test} from 'vitest'
import {temporary} from '@shopify/cli-testing'

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
      expect(got.length).toEqual(2)
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
      expect(got.length).toEqual(1)
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
      expect(got.length).toEqual(1)
      expect(got.prod).toEqual('1.2.3')
    })
  })

  test('throws an error if the package.json file does not exist', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')

      // When
      await expect(getDependencies(packageJsonPath)).rejects.toEqual(PackageJsonNotFoundError(tmpDir))
    })
  })
})

describe('addNPMDependenciesIfNeeded', () => {
  test("runs the right command when it's npm and dev dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded(['new'], {
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

  test("runs the right command when it's npm and production dependencies", async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {existing: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'prod',
        dependencyManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new', '--save-prod'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'peer',
        dependencyManager: 'npm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('npm', ['install', 'new', '--save-peer'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'dev',
        dependencyManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new', '--dev'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'prod',
        dependencyManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new', '--prod'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'peer',
        dependencyManager: 'yarn',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('yarn', ['add', 'new', '--peer'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'dev',
        dependencyManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new', '--save-dev'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'prod',
        dependencyManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new', '--save-prod'], {
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
      await addNPMDependenciesIfNeeded(['new'], {
        type: 'peer',
        dependencyManager: 'pnpm',
        directory: tmpDir,
      })

      // Then
      expect(mockedExec).toHaveBeenCalledWith('pnpm', ['add', 'new', '--save-peer'], {
        cwd: tmpDir,
      })
    })
  })
})
