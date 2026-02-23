import {currentProcessIsGlobal, findNpmPrefix, inferPackageManagerForGlobalCLI, installGlobalCLIPrompt} from './is-global.js'
import {sniffForPath, cwd} from './path.js'
import {terminalSupportsPrompting} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {globalCLIVersion} from './version.js'
import * as fs from 'fs'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./system.js')
vi.mock('./ui.js')
vi.mock('fs')
vi.mock('which')
vi.mock('./version.js')
vi.mock('./path.js', async (importOriginal) => {
  const original: any = await importOriginal()
  return {
    ...original,
    sniffForPath: vi.fn(),
    cwd: vi.fn(),
  }
})

const globalNPMPath = '/path/to/global/npm'
const globalYarnPath = '/path/to/global/yarn'
const globalPNPMPath = '/path/to/global/pnpm'
const unknownGlobalPath = '/path/to/global/unknown'
const localProjectPath = '/path/local'

beforeEach(() => {
  // sniffForPath returns undefined so findNpmPrefix starts from cwd()
  vi.mocked(sniffForPath).mockReturnValue(undefined)
  // cwd returns the local project path
  vi.mocked(cwd).mockReturnValue(localProjectPath)
  // Mock existsSync so that findNpmPrefix finds package.json at localProjectPath
  vi.mocked(fs.existsSync).mockImplementation((filePath) => {
    return filePath === `${localProjectPath}/package.json`
  })
})

describe('currentProcessIsGlobal', () => {
  test('returns true if argv point to the global npm path', () => {
    // Given
    const argv = ['node', globalNPMPath, 'shopify']

    // When
    const got = currentProcessIsGlobal(argv)

    // Then
    expect(got).toBeTruthy()
  })

  test('returns false if argv points to a local path', () => {
    // Given
    const argv = ['node', localProjectPath, 'shopify']

    // When
    const got = currentProcessIsGlobal(argv)

    // Then
    expect(got).toBeFalsy()
  })
})

describe('inferPackageManagerForGlobalCLI', () => {
  test('returns yarn if yarn is in path', async () => {
    // Given
    const argv = ['node', globalYarnPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('yarn')
  })

  test('returns pnpm is pnpm is in path', async () => {
    // Given
    const argv = ['node', globalPNPMPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('pnpm')
  })

  test('returns npm if nothing else is in path', async () => {
    // Given
    const argv = ['node', unknownGlobalPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('npm')
  })

  test('returns unknown if current process is not global', async () => {
    // Given
    const argv = ['node', localProjectPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('unknown')
  })
})

describe('installGlobalCLIPrompt', () => {
  test('does not prompt if global CLI is already installed', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockImplementationOnce(() => Promise.resolve('3.78.0'))
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: true})
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })

  test('returns true if the user installs the global CLI', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockImplementationOnce(() => Promise.resolve(undefined))
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(renderSelectPrompt).mockImplementationOnce(() => Promise.resolve('yes'))

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: true, alreadyInstalled: false})
  })

  test('returns false if the user does not install the global CLI', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockImplementationOnce(() => Promise.resolve(undefined))
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(renderSelectPrompt).mockImplementationOnce(() => Promise.resolve('no'))

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: false})
  })
})
