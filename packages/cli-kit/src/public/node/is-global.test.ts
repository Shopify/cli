import {
  currentProcessIsGlobal,
  inferPackageManagerForGlobalCLI,
  installGlobalCLIPrompt,
  installGlobalShopifyCLI,
} from './is-global.js'
import {terminalSupportsPrompting, exec} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {globalCLIVersion} from './version.js'
import {outputInfo} from './output.js'
import * as execa from 'execa'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./system.js')
vi.mock('./ui.js')
vi.mock('execa')
vi.mock('which')
vi.mock('./version.js')
vi.mock('./output.js')

const globalNPMPath = '/path/to/global/npm'
const globalYarnPath = '/path/to/global/yarn'
const globalPNPMPath = '/path/to/global/pnpm'
const globalBunPath = '/path/to/global/bun'
const unknownGlobalPath = '/path/to/global/unknown'
const localProjectPath = '/path/local'

beforeEach(() => {
  ;(vi.mocked(execa.execaSync) as any).mockReturnValue({stdout: localProjectPath})
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

  test('returns false when execaSync throws an error', () => {
    // Given
    ;(vi.mocked(execa.execaSync) as any).mockImplementation(() => {
      throw new Error('Command failed')
    })
    const argv = ['node', globalNPMPath, 'shopify']

    // When
    const got = currentProcessIsGlobal(argv)

    // Then
    expect(got).toBeFalsy()
  })

  test('handles undefined argv[1] gracefully', () => {
    // Given
    const argv = ['node']

    // When
    const got = currentProcessIsGlobal(argv)

    // Then
    expect(got).toBeTruthy()
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

  test('returns bun if bun is in path', async () => {
    // Given
    const argv = ['node', globalBunPath, 'shopify']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('bun')
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

  test('handles undefined argv[1] gracefully', async () => {
    // Given
    const argv = ['node']

    // When
    const got = inferPackageManagerForGlobalCLI(argv)

    // Then
    expect(got).toBe('npm')
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

  test('returns false when terminal does not support prompting', async () => {
    // Given
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: false})
    expect(globalCLIVersion).not.toHaveBeenCalled()
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })
})

describe('installGlobalShopifyCLI', () => {
  test('installs CLI using yarn when yarn is the package manager', async () => {
    // Given
    const packageManager = 'yarn'

    // When
    await installGlobalShopifyCLI(packageManager)

    // Then
    expect(outputInfo).toHaveBeenCalledWith('Running yarn global add @shopify/cli@latest...')
    expect(exec).toHaveBeenCalledWith('yarn', ['global', 'add', '@shopify/cli@latest'], {stdio: 'inherit'})
  })

  test('installs CLI using npm when npm is the package manager', async () => {
    // Given
    const packageManager = 'npm'

    // When
    await installGlobalShopifyCLI(packageManager)

    // Then
    expect(outputInfo).toHaveBeenCalledWith('Running npm install -g @shopify/cli@latest...')
    expect(exec).toHaveBeenCalledWith('npm', ['install', '-g', '@shopify/cli@latest'], {stdio: 'inherit'})
  })

  test('installs CLI using pnpm when pnpm is the package manager', async () => {
    // Given
    const packageManager = 'pnpm'

    // When
    await installGlobalShopifyCLI(packageManager)

    // Then
    expect(outputInfo).toHaveBeenCalledWith('Running pnpm install -g @shopify/cli@latest...')
    expect(exec).toHaveBeenCalledWith('pnpm', ['install', '-g', '@shopify/cli@latest'], {stdio: 'inherit'})
  })

  test('installs CLI using bun when bun is the package manager', async () => {
    // Given
    const packageManager = 'bun'

    // When
    await installGlobalShopifyCLI(packageManager)

    // Then
    expect(outputInfo).toHaveBeenCalledWith('Running bun install -g @shopify/cli@latest...')
    expect(exec).toHaveBeenCalledWith('bun', ['install', '-g', '@shopify/cli@latest'], {stdio: 'inherit'})
  })
})
