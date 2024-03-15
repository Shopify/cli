import {
  show,
  isSpin,
  spinFqdn,
  instance,
  isSpinEnvironment,
  appPort,
  appHost,
  fetchSpinPort,
  spinVariables,
} from './spin.js'
import {getCachedSpinFqdn, setCachedSpinFqdn} from '../../../private/node/context/spin-cache.js'
import {captureOutput} from '../system.js'
import {inTemporaryDirectory, mkdir, writeFile} from '../fs.js'
import {joinPath} from '../path.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../system.js')
vi.mock('../../../private/node/context/spin-cache.js')

const mockedCaptureOutput = vi.mocked(captureOutput)

describe('fqdn', () => {
  test('shows the latest when SPIN_INSTANCE is not present and there is no cached value', async () => {
    // Given
    const env = {}
    const showResponse = {fqdn: 'fqdn'}
    vi.mocked(getCachedSpinFqdn).mockReturnValue(undefined)
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))

    // When
    const got = await spinFqdn(env)

    // Then
    expect(got).toEqual('fqdn')
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--latest', '--json'], {env})
    expect(setCachedSpinFqdn).toBeCalledWith('fqdn')
  })

  test("doesn't show the latest when SPIN_INSTANCE is present and there is no cached value", async () => {
    // Given
    const env = {SPIN_INSTANCE: 'instance'}
    const showResponse = {fqdn: 'fqdn'}
    vi.mocked(getCachedSpinFqdn).mockReturnValue(undefined)
    mockedCaptureOutput.mockResolvedValue(JSON.stringify(showResponse))

    // When
    const got = await spinFqdn(env)

    // Then
    expect(got).toEqual('fqdn')
    expect(mockedCaptureOutput).toHaveBeenCalledWith('spin', ['show', '--json'], {env})
    expect(setCachedSpinFqdn).toBeCalledWith('fqdn')
  })

  test('return cached spin fqdn if valid', async () => {
    // Given
    const env = {}
    vi.mocked(getCachedSpinFqdn).mockReturnValue('cachedFQDN')

    // When
    const got = await spinFqdn(env)

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
    await expect(() => show('instance', env)).rejects.toThrowError(/yielded the following error.*Something went wrong/s)
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

describe('isSpinEnvironment', () => {
  test('returns true when running against SPIN instance', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'spin'}

    // When
    const got = isSpinEnvironment(env)

    // Then
    expect(got).toBe(true)
  })

  test('returns true when running inside a SPIN instance', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = isSpinEnvironment(env)

    // Then
    expect(got).toBe(true)
  })

  test('returns false when not working with spin instances', () => {
    // Given
    const env = {SHOPIFY_SERVICE_ENV: 'local'}

    // When
    const got = isSpinEnvironment(env)

    // Then
    expect(got).toBe(false)
  })
})

describe('appPort', () => {
  test('returns the value of SERVER_PORT', () => {
    // Given
    const port = '1234'
    const env = {SERVER_PORT: port}

    // When
    const got = appPort(env)

    // Then
    expect(got).toBe(1234)
  })

  test('returns undefined value when SERVER_PORT is not defined', () => {
    // Given
    const env = {}

    // When
    const got = appPort(env)

    // Then
    expect(got).toBeUndefined()
  })

  test('returns undefined value when SERVER_PORT is malformed', () => {
    // Given
    const port = 'invalid-port-number'
    const env = {SERVER_PORT: port}

    // When
    const got = appPort(env)

    // Then
    expect(got).toBeUndefined()
  })
})

describe('appHost', () => {
  test('returns the value of SPIN_APP_HOST', () => {
    // Given
    const host = '1p-app-host.spin.domain.dev'
    const env = {SPIN_APP_HOST: host}

    // When
    const got = appHost(env)

    // Then
    expect(got).toBe(host)
  })

  test('returns undefined value when SPIN_APP_HOST is not defined', () => {
    // Given
    const env = {}

    // When
    const got = appHost(env)

    // Then
    expect(got).toBeUndefined()
  })
})

describe('fetchSpinPort', () => {
  ;['1', '2'].forEach((spinVersion: string) => {
    test(`using spin${spinVersion} when the file exists and the port is defined then the port is returned`, async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const portValue = '1030'
        const serviceName = 'shopify--partners'
        const portName = 'CLI_EXTENSION_SERVER'
        await createPortFileContent(tmpDir, spinVersion, serviceName, portName, portValue)

        // When
        const got = await fetchSpinPort(spinVariables.partnersSpinService, spinVariables.manualCliSpinPortName, tmpDir)

        // Then
        expect(got).toEqual(parseInt(portValue, 10))
      })
    })

    test(`using spin${spinVersion} when the file exists and the port is defined wrong then undefined is returned`, async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const portValue = 'wrong-port'
        const serviceName = 'shopify--partners'
        const portName = 'CLI_EXTENSION_SERVER'
        await createPortFileContent(tmpDir, spinVersion, serviceName, portName, portValue)

        // When
        const got = await fetchSpinPort(spinVariables.partnersSpinService, spinVariables.manualCliSpinPortName, tmpDir)

        // Then
        expect(got).toBeUndefined()
      })
    })
  })

  test(`using both versions when the spin2 file exists and the port is defined then is returned`, async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const port2Value = '1030'
      const port1Value = '1040'
      const serviceName = 'shopify--partners'
      const portName = 'CLI_EXTENSION_SERVER'
      await createPortFileContent(tmpDir, '2', serviceName, portName, port2Value)
      await createPortFileContent(tmpDir, '1', serviceName, portName, port1Value)

      // When
      const got = await fetchSpinPort(spinVariables.partnersSpinService, spinVariables.manualCliSpinPortName, tmpDir)

      // Then
      expect(got).toEqual(parseInt(port2Value, 10))
    })
  })

  test(`using both versions when the spin2 file exists and the port is defined wrong but spin1 file is ok then the latest is returned`, async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const port2Value = 'wrong-port'
      const port1Value = '1040'
      const serviceName = 'shopify--partners'
      const portName = 'CLI_EXTENSION_SERVER'
      await createPortFileContent(tmpDir, '2', serviceName, portName, port2Value)
      await createPortFileContent(tmpDir, '1', serviceName, portName, port1Value)

      // When
      const got = await fetchSpinPort(spinVariables.partnersSpinService, spinVariables.manualCliSpinPortName, tmpDir)

      // Then
      expect(got).toEqual(parseInt(port1Value, 10))
    })
  })

  test(`using both versions when port is defined wrong in both files then undefined is returned`, async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const port2Value = 'wrong-port'
      const port1Value = 'wrong-port'
      const serviceName = 'shopify--partners'
      const portName = 'CLI_EXTENSION_SERVER'
      await createPortFileContent(tmpDir, '2', serviceName, portName, port2Value)
      await createPortFileContent(tmpDir, '1', serviceName, portName, port1Value)

      // When
      const got = await fetchSpinPort(spinVariables.partnersSpinService, spinVariables.manualCliSpinPortName, tmpDir)

      // Then
      expect(got).toBeUndefined()
    })
  })

  async function createPortFileContent(
    tmpDir: string,
    spinVersion: string,
    service: string,
    portName: string,
    port: string,
  ) {
    const portPath =
      spinVersion === '2' ? joinPath(tmpDir, 'ports2', service, 'custom') : joinPath(tmpDir, 'ports', service, 'proc')
    const content = spinVersion === '2' ? `[{"internal":${port}}]` : `${port}`
    return mkdir(portPath).then(() => writeFile(joinPath(portPath, portName), content))
  }
})
