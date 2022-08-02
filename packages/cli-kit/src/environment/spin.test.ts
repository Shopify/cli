import {show, fqdn, isSpin, instance, workspace, namespace, host, SpinInstanceNotFound} from './spin.js'
import {captureOutput} from '../system.js'
import {describe, test, expect, vi, it} from 'vitest'

vi.mock('../system')
const mockedCaptureOutput = vi.mocked(captureOutput)

describe('fqdn', () => {
  it('shows the latest when SPIN_INSTANCE is not present', async () => {
    // Given
    const env = {}
    const showResponse = {fqdn: 'fqdn'}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))

    // When
    const got = await fqdn(env)

    // Then
    expect(got).toEqual('fqdn')
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--latest', '--json'], {env})
  })
  it("doesn't show the latest when SPIN_INSTANCE is present", async () => {
    // Given
    const env = {SPIN_INSTANCE: 'instance'}
    const showResponse = {fqdn: 'fqdn'}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))

    // When
    const got = await fqdn(env)

    // Then
    expect(got).toEqual('fqdn')
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--json'], {env})
  })
})

describe('show', () => {
  test("calls 'spin show' with --latest when latest is true", async () => {
    // Given
    const showResponse = {fqdn: 'fqdn'}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    const env = {}

    // When
    const got = await show(undefined, env)

    // Then
    expect(got).toEqual(showResponse)
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--latest', '--json'], {env})
  })

  test("calls 'spin show' without --latest when latest is false", async () => {
    // Given
    const showResponse = {fqdn: 'fqdn'}
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))
    const env = {}

    // When
    const got = await show('instance', env)

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

    // When
    await expect(() => show('instance', env)).rejects.toThrowError(SpinInstanceNotFound('instance', errorMessage))
  })
})

describe('isSpin', () => {
  test('returns true if SPIN=1', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = isSpin(env)

    // Then
    expect(got).toBeTruthy()
  })
})

describe('instance', () => {
  test('returns the value of SPIN_INSTANCE', () => {
    // Given
    const instanceName = 'instance'
    const env = {SPIN_INSTANCE: instanceName}

    // When
    const got = instance(env)

    // Then
    expect(got).toBe(instanceName)
  })

  test('returns undefined value when SPIN_INSTANCE is not defined', () => {
    // Given
    const env = {}

    // When
    const got = instance(env)

    // Then
    expect(got).toBeUndefined()
  })
})

describe('workspace', () => {
  test('returns the value of SPIN_WORKSPACE', () => {
    // Given
    const workspaceName = 'workspace'
    const env = {SPIN_WORKSPACE: workspaceName}

    // When
    const got = workspace(env)

    // Then
    expect(got).toBe(workspaceName)
  })

  test('returns undefined value when SPIN_WORKSPACE is not defined', () => {
    // Given
    const env = {}

    // When
    const got = workspace(env)

    // Then
    expect(got).toBeUndefined()
  })
})

describe('namespace', () => {
  test('returns the value of SPIN_NAMESPACE', () => {
    // Given
    const namespaceName = 'namespace'
    const env = {SPIN_NAMESPACE: namespaceName}

    // When
    const got = namespace(env)

    // Then
    expect(got).toBe(namespaceName)
  })

  test('returns undefined value when SPIN_NAMESPACE is not defined', () => {
    // Given
    const env = {}

    // When
    const got = namespace(env)

    // Then
    expect(got).toBeUndefined()
  })
})

describe('host', () => {
  test('returns the value of SPIN_HOST', () => {
    // Given
    const hostName = 'host'
    const env = {SPIN_HOST: hostName}

    // When
    const got = host(env)

    // Then
    expect(got).toBe(hostName)
  })

  test('returns undefined value when SPIN_HOST is not defined', () => {
    // Given
    const env = {}

    // When
    const got = host(env)

    // Then
    expect(got).toBeUndefined()
  })
})
