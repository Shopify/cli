import {
  currentProcessIsGlobal,
  inferPackageManagerForGlobalCLI,
  installGlobalCLIPrompt,
  isGlobalCLIInstalled,
} from './is-global.js'
import {captureOutput, terminalSupportsRawMode} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./system.js')
vi.mock('./ui.js')

describe('currentProcessIsGlobal', () => {
  test('returns true if npm_config_user_agent is undefined', () => {
    // Given
    const env = {}

    // When
    const got = currentProcessIsGlobal(env)

    // Then
    expect(got).toBeTruthy()
  })

  test('returns pnpm if the npm_config_user_agent variable contains pnpm', () => {
    // Given
    const env = {npm_config_user_agent: 'pnpm'}

    // When
    const got = currentProcessIsGlobal(env)

    // Then
    expect(got).toBeFalsy()
  })
})

describe('inferPackageManagerForGlobalCLI', () => {
  test('returns yarn if yarn is in path', async () => {
    // Given
    const argv = ['node', 'path/to/yarn', 'shopify']

    // When
    const got = await inferPackageManagerForGlobalCLI(argv, {})

    // Then
    expect(got).toBe('yarn')
  })

  test('returns pnpm is pnpm is in path', async () => {
    // Given
    const argv = ['node', 'path/to/pnpm/something', 'shopify']

    // When
    const got = await inferPackageManagerForGlobalCLI(argv, {})

    // Then
    expect(got).toBe('pnpm')
  })

  test('returns npm if nothing else is in path', async () => {
    // Given
    const argv = ['node', 'path/to/package/manager', 'shopify']

    // When
    const got = await inferPackageManagerForGlobalCLI(argv, {})

    // Then
    expect(got).toBe('npm')
  })

  test('returns unknown if current process is not global', async () => {
    // Given
    const argv = ['node', 'path/to/package/manager', 'shopify']

    // When
    const got = await inferPackageManagerForGlobalCLI(argv, {npm_config_user_agent: 'npm'})

    // Then
    expect(got).toBe('unknown')
  })
})

describe('isGlobalCLIInstalled', () => {
  test('returns true if the global CLI is installed', async () => {
    // Given
    vi.mocked(captureOutput).mockImplementationOnce(() => Promise.resolve('app help includes the `app dev` command'))

    // When
    const got = await isGlobalCLIInstalled()

    // Then
    expect(got).toBeTruthy()
  })

  test('returns false if the global CLI is not installed', async () => {
    // Given
    vi.mocked(captureOutput).mockImplementationOnce(() => {
      throw new Error('')
    })

    // When
    const got = await isGlobalCLIInstalled()

    // Then
    expect(got).toBeFalsy()
  })

  test('returns false if the global CLI is installed but doesnt have app dev command', async () => {
    // Given
    vi.mocked(captureOutput).mockImplementationOnce(() => Promise.resolve('app help that includes something else'))

    // When
    const got = await isGlobalCLIInstalled()

    // Then
    expect(got).toBeFalsy()
  })
})

describe('installGlobalCLIPrompt', () => {
  test('if global CLI is already installed', async () => {
    // Given
    // Global CLI is already installed
    vi.mocked(captureOutput).mockImplementationOnce(() => Promise.resolve('app dev'))
    vi.mocked(terminalSupportsRawMode).mockReturnValue(true)

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: true})
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })

  test('returns true if the user installs the global CLI', async () => {
    // Given
    // Global CLI is not installed yet
    vi.mocked(captureOutput).mockImplementationOnce(() => {
      throw new Error('')
    })
    vi.mocked(terminalSupportsRawMode).mockReturnValue(true)
    vi.mocked(renderSelectPrompt).mockImplementationOnce(() => Promise.resolve('yes'))

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: true, alreadyInstalled: false})
  })

  test('returns false if the user does not install the global CLI', async () => {
    // Given
    // Global CLI is not installed yet
    vi.mocked(captureOutput).mockImplementationOnce(() => {
      throw new Error('')
    })
    vi.mocked(terminalSupportsRawMode).mockReturnValue(true)
    vi.mocked(renderSelectPrompt).mockImplementationOnce(() => Promise.resolve('no'))

    // When
    const got = await installGlobalCLIPrompt()

    // Then
    expect(got).toEqual({install: false, alreadyInstalled: false})
  })
})
