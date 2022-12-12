import {show, fqdn, isSpin, instance, workspace, namespace, host} from './spin.js'
import {getCachedSpinFqdn, setCachedSpinFqdn} from './spin-cache.js'
import {captureOutput} from '../system.js'
import {getEnvironmentVariables} from '../public/node/environment.js'
import {describe, test, expect, vi, it, beforeAll, beforeEach} from 'vitest'

beforeAll(() => {
  vi.mock('../system')
  vi.mock('./spin-cache')
  vi.mock('../public/node/environment.js')
})

beforeEach(() => {
  vi.mocked(getEnvironmentVariables).mockReturnValue({})
})

const mockedCaptureOutput = vi.mocked(captureOutput)

describe('fqdn', () => {
  it('shows the latest when SPIN_INSTANCE is not present and there is no cached value', async () => {
    // Given
    const env = {}
    const showResponse = {fqdn: 'fqdn'}
    vi.mocked(getCachedSpinFqdn).mockReturnValue(undefined)
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = await fqdn()

    // Then
    expect(got).toEqual('fqdn')
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--latest', '--json'], {env})
    expect(setCachedSpinFqdn).toBeCalledWith('fqdn')
  })

  it("doesn't show the latest when SPIN_INSTANCE is present and there is no cached value", async () => {
    // Given
    const env = {SPIN_INSTANCE: 'instance'}
    const showResponse = {fqdn: 'fqdn'}
    vi.mocked(getCachedSpinFqdn).mockReturnValue(undefined)
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = await fqdn()

    // Then
    expect(got).toEqual('fqdn')
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--json'], {env})
    expect(setCachedSpinFqdn).toBeCalledWith('fqdn')
  })

  it('return cached spin fqdn if valid', async () => {
    // Given
    const env = {}
    vi.mocked(getCachedSpinFqdn).mockReturnValue('cachedFQDN')
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = await fqdn()

    // Then
    expect(got).toEqual('cachedFQDN')
    expect(mockedCaptureOutput).not.toHaveBeenCalledWith('spin', ['show', '--json'], {env})
    expect(setCachedSpinFqdn).not.toBeCalled()
  })
})

describe('show', () => {
  test("calls 'spin show' with --latest when latest is true", async () => {
    // Given
    const showResponse = {fqdn: 'fqdn'}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = await show(undefined)

    // Then
    expect(got).toEqual(showResponse)
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--latest', '--json'], {env})
  })

  test("calls 'spin show' without --latest when latest is false", async () => {
    // Given
    const showResponse = {fqdn: 'fqdn'}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = await show('instance')

    // Then
    expect(got).toEqual(showResponse)
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--json'], {env})
  })

  test("throws an error when 'show --json' returns a JSON response with an error key", async () => {
    // Given
    const errorMessage = 'Something went wrong'
    const showResponse = {error: errorMessage}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    await expect(() => show('instance')).rejects.toThrowErrorMatchingInlineSnapshot(`
      "[1m[33mspin[39m[22m yielded the following error trying to obtain the fully qualified domain name of the Spin instance:
        Something went wrong
          "
    `)
  })
})

describe('isSpin', () => {
  test('returns true if SPIN=1', () => {
    // Given
    const env = {SPIN: '1'}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = isSpin()

    // Then
    expect(got).toBeTruthy()
  })
})

describe('instance', () => {
  test('returns the value of SPIN_INSTANCE', () => {
    // Given
    const instanceName = 'instance'
    const env = {SPIN_INSTANCE: instanceName}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = instance()

    // Then
    expect(got).toBe(instanceName)
  })

  test('returns undefined value when SPIN_INSTANCE is not defined', () => {
    // Given
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = instance()

    // Then
    expect(got).toBeUndefined()
  })
})

describe('workspace', () => {
  test('returns the value of SPIN_WORKSPACE', () => {
    // Given
    const workspaceName = 'workspace'
    const env = {SPIN_WORKSPACE: workspaceName}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = workspace()

    // Then
    expect(got).toBe(workspaceName)
  })

  test('returns undefined value when SPIN_WORKSPACE is not defined', () => {
    // Given
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = workspace()

    // Then
    expect(got).toBeUndefined()
  })
})

describe('namespace', () => {
  test('returns the value of SPIN_NAMESPACE', () => {
    // Given
    const namespaceName = 'namespace'
    const env = {SPIN_NAMESPACE: namespaceName}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = namespace()

    // Then
    expect(got).toBe(namespaceName)
  })

  test('returns undefined value when SPIN_NAMESPACE is not defined', () => {
    // Given
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = namespace()

    // Then
    expect(got).toBeUndefined()
  })
})

describe('host', () => {
  test('returns the value of SPIN_HOST', () => {
    // Given
    const hostName = 'host'
    const env = {SPIN_HOST: hostName}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = host()

    // Then
    expect(got).toBe(hostName)
  })

  test('returns undefined value when SPIN_HOST is not defined', () => {
    // Given
    const env = {}
    vi.mocked(getEnvironmentVariables).mockReturnValue(env)

    // When
    const got = host()

    // Then
    expect(got).toBeUndefined()
  })
})
