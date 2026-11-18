import {
  javyBinary,
  functionRunnerBinary,
  downloadBinary,
  javyPluginBinary,
  wasmOptBinary,
  trampolineBinary,
  PREFERRED_JAVY_VERSION,
  PREFERRED_FUNCTION_RUNNER_VERSION,
  V1_TRAMPOLINE_VERSION,
  V2_TRAMPOLINE_VERSION,
} from './binaries.js'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {fileExists, readdir, readFile, removeFile, renameFile, writeFile} from '@shopify/cli-kit/node/fs'
import {basename, dirname} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {PassThrough} from 'stream'
import {gzipSync} from 'zlib'

const javy = javyBinary()
const javyPlugin = javyPluginBinary()
const functionRunner = functionRunnerBinary()

const oldJavy = javyBinary('6.0.0')

vi.mock('@shopify/cli-kit/node/http', async () => {
  const actualImports = await vi.importActual('@shopify/cli-kit/node/http')
  return {
    ...actualImports,
    fetch: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/fs', async (importActual) => {
  const actual: any = await importActual()
  return {...actual, renameFile: vi.fn(actual.renameFile)}
})

async function temporaryDownloads(bin: {path: string}) {
  const files = await readdir(dirname(bin.path))
  return files.filter((file) => file.startsWith(`${basename(bin.path)}.`))
}

describe('javy', () => {
  test('properties are set correctly', () => {
    expect(javy.name).toBe('javy')
    expect(javy.version).match(/^\d\.\d\.\d$/)
    if (process.platform === 'win32') {
      expect(javy.path).toContain(`javy-${PREFERRED_JAVY_VERSION}.exe`)
    } else {
      expect(javy.path).toContain(`javy-${PREFERRED_JAVY_VERSION}`)
    }
  })

  describe('downloadUrl returns the correct URL', () => {
    test('for Apple Silicon MacOS', () => {
      // When
      const url = javy.downloadUrl('darwin', 'arm64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-arm-macos-v\d\.\d\.\d\.gz/,
      )
    })

    test('for Intel MacOS', () => {
      // When
      const url = javy.downloadUrl('darwin', 'x64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-x86_64-macos-v\d\.\d\.\d\.gz/,
      )
    })

    test('for Arm Linux', () => {
      // When
      const url = javy.downloadUrl('linux', 'arm64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-arm-linux-v\d\.\d\.\d\.gz/,
      )
    })

    test('for x86 Linux', () => {
      // When
      const url = javy.downloadUrl('linux', 'x64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-x86_64-linux-v\d\.\d\.\d\.gz/,
      )
    })

    test('for a 32-bit installation of NodeJS on Windows', () => {
      // When
      const url = javy.downloadUrl('win32', 'ia32')

      // Uses the 64-bit version since we assume the operating system actually uses 64-bits and its just a 32-bit
      // installation of NodeJS.
      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-x86_64-windows-v\d\.\d\.\d\.gz/,
      )
    })

    test('for a 64-bit installation of NodeJS on Windows', () => {
      // When
      const url = javy.downloadUrl('win32', 'x64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-x86_64-windows-v\d\.\d\.\d\.gz/,
      )
    })

    test('aix (or any other unsupported platform) throws an error', () => {
      // When
      const platform = 'aix'

      // Then
      expect(() => javy.downloadUrl(platform, 'x64')).toThrowError('Unsupported platform aix')
    })

    test('ppc architecture (or any other unsupported architecture) throws an error', () => {
      // When
      const arch = 'ppc'

      // Then
      expect(() => javy.downloadUrl('darwin', arch)).toThrowError('Unsupported architecture ppc')
    })

    test('Supported combination on preferred Javy succeeds', () => {
      // When
      const url = javy.downloadUrl('win32', 'arm')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/bytecodealliance\/javy\/releases\/download\/v\d\.\d\.\d\/javy-arm-windows-v\d\.\d\.\d\.gz/,
      )
    })

    test('Unsupported combination on old Javy throws an error', () => {
      // When
      const arch = 'arm'
      const platform = 'win32'

      // Then
      expect(() => oldJavy.downloadUrl(platform, arch)).toThrowError(
        'Unsupported platform/architecture combination win32/arm',
      )
    })
  })

  test('downloads Javy', async () => {
    // Given
    await removeFile(javy.path)
    await expect(fileExists(javy.path)).resolves.toBeFalsy()
    vi.mocked(fetch).mockResolvedValue(new Response(gzipSync('javy binary')))

    // When
    await downloadBinary(javy)

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(fileExists(javy.path)).resolves.toBeTruthy()
  })

  test('handles concurrent downloads of Javy', async () => {
    // Given
    await removeFile(javy.path)
    await expect(fileExists(javy.path)).resolves.toBeFalsy()
    vi.mocked(fetch).mockResolvedValue(new Response(gzipSync('javy binary')))

    // When
    await Promise.all([
      downloadBinary(javy),
      downloadBinary(javy),
      downloadBinary(javy),
      downloadBinary(javy),
      downloadBinary(javy),
    ])

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(fileExists(javy.path)).resolves.toBeTruthy()
  })

  test('does not return early when file exists but rename is in progress', async () => {
    // Given
    await removeFile(javy.path)
    await expect(fileExists(javy.path)).resolves.toBeFalsy()

    let resolveDownload!: () => void
    const blockDownload = new Promise<void>((resolve) => {
      resolveDownload = resolve
    })
    let resolveFetchStarted!: () => void
    const fetchStarted = new Promise<void>((resolve) => {
      resolveFetchStarted = resolve
    })

    vi.mocked(fetch).mockImplementation(async () => {
      resolveFetchStarted()
      await blockDownload
      return new Response(gzipSync('javy binary'))
    })

    // When
    // Start first download — will block at fetch
    const firstDownload = downloadBinary(javy)

    // Wait for first download to reach fetch and register in downloadsInProgress
    await fetchStarted

    // Simulate file appearing on disk (e.g., another process renaming its download into place
    // while the download is still tracked as in-progress)
    await writeFile(javy.path, 'incomplete binary')

    // Start second download — should wait for first, not return early
    let secondResolved = false
    const secondDownload = downloadBinary(javy).then(() => {
      secondResolved = true
    })
    await Promise.resolve()

    // Then — second download should be blocked waiting for first
    expect(secondResolved).toBe(false)

    // Complete the first download
    resolveDownload()
    await Promise.all([firstDownload, secondDownload])

    // Only one fetch should have been made
    expect(fetch).toHaveBeenCalledOnce()
    expect(secondResolved).toBe(true)
    await expect(fileExists(javy.path)).resolves.toBeTruthy()
  })
})

describe('javy-plugin', () => {
  test('properties are set correctly', () => {
    expect(javyPlugin.name).toBe('shopify_functions_javy_v4')
    expect(javyPlugin.version).match(/^\d+$/)
    expect(javyPlugin.path).toMatch(/(\/|\\)shopify_functions_javy_v4.wasm$/)
  })

  test('downloadUrl returns the correct URL', () => {
    // When
    const url = javyPlugin.downloadUrl('', '')

    // Then
    expect(url).toMatch(
      /^https:\/\/cdn\.shopify\.com\/shopifycloud\/shopify-functions-javy-plugin\/shopify_functions_javy_v\d+\.wasm$/,
    )
  })

  test('downloads javy-plugin', async () => {
    // Given
    await removeFile(javyPlugin.path)
    await expect(fileExists(javyPlugin.path)).resolves.toBeFalsy()
    vi.mocked(fetch).mockResolvedValue(new Response(gzipSync('javy-plugin binary')))

    // When
    await downloadBinary(javyPlugin)

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(fileExists(javyPlugin.path)).resolves.toBeTruthy()
  })
})

describe('functionRunner', () => {
  test('properties are set correctly', () => {
    expect(functionRunner.name).toBe('function-runner')
    expect(functionRunner.version).match(/^\d\.\d\.\d$/)
    if (process.platform === 'win32') {
      expect(functionRunner.path).toContain(`function-runner-${PREFERRED_FUNCTION_RUNNER_VERSION}.exe`)
    } else {
      expect(functionRunner.path).toContain(`function-runner-${PREFERRED_FUNCTION_RUNNER_VERSION}`)
    }
  })

  describe('downloadUrl returns the correct URL', () => {
    test('for Apple Silicon MacOS', () => {
      // When
      const url = functionRunner.downloadUrl('darwin', 'arm64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/Shopify\/function-runner\/releases\/download\/v\d\.\d\.\d\/function-runner-arm-macos-v\d\.\d\.\d\.gz/,
      )
    })

    test('for Intel MacOS', () => {
      // When
      const url = functionRunner.downloadUrl('darwin', 'x64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/Shopify\/function-runner\/releases\/download\/v\d\.\d\.\d\/function-runner-x86_64-macos-v\d\.\d\.\d\.gz/,
      )
    })

    test('for Arm Linux', () => {
      // When
      const url = functionRunner.downloadUrl('linux', 'arm64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/Shopify\/function-runner\/releases\/download\/v\d\.\d\.\d\/function-runner-arm-linux-v\d\.\d\.\d\.gz/,
      )
    })

    test('for x86 Linux', () => {
      // When
      const url = functionRunner.downloadUrl('linux', 'x64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/Shopify\/function-runner\/releases\/download\/v\d\.\d\.\d\/function-runner-x86_64-linux-v\d\.\d\.\d\.gz/,
      )
    })

    test('for a 32-bit installation of NodeJS on Windows', () => {
      // When
      const url = functionRunner.downloadUrl('win32', 'ia32')

      // Uses the 64-bit version since we assume the operating system actually uses 64-bits and its just a 32-bit
      // installation of NodeJS.
      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/Shopify\/function-runner\/releases\/download\/v\d\.\d\.\d\/function-runner-x86_64-windows-v\d\.\d\.\d\.gz/,
      )
    })

    test('for a 64-bit installation of NodeJS on Windows', () => {
      // When
      const url = functionRunner.downloadUrl('win32', 'x64')

      // Then
      expect(url).toMatch(
        /https:\/\/github.com\/Shopify\/function-runner\/releases\/download\/v\d\.\d\.\d\/function-runner-x86_64-windows-v\d\.\d\.\d\.gz/,
      )
    })

    test('aix (or any other unsupported platform) throws an error', () => {
      // When
      const platform = 'aix'

      // Then
      expect(() => functionRunner.downloadUrl(platform, 'x64')).toThrowError('Unsupported platform aix')
    })

    test('ppc architecture (or any other unsupported architecture) throws an error', () => {
      // When
      const arch = 'ppc'

      // Then
      expect(() => functionRunner.downloadUrl('darwin', arch)).toThrowError('Unsupported architecture ppc')
    })
  })

  test('downloads function-runner', async () => {
    // Given
    await removeFile(functionRunner.path)
    await expect(fileExists(functionRunner.path)).resolves.toBeFalsy()
    vi.mocked(fetch).mockResolvedValue(new Response(gzipSync('function-runner binary')))

    // When
    await downloadBinary(functionRunner)

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(fileExists(functionRunner.path)).resolves.toBeTruthy()
  })

  test('writes function-runner next to its final path and renames it into place when complete', async () => {
    // Given
    await removeFile(functionRunner.path)
    const gzippedBinary = gzipSync('function-runner binary')
    const responseBody = new PassThrough()
    responseBody.write(gzippedBinary.subarray(0, 10))
    vi.mocked(fetch).mockResolvedValue(new Response(responseBody))

    // When
    const download = downloadBinary(functionRunner)

    // Then
    // The partial download is in the same directory, so the rename can't fall back to a copy into the final
    // path, and the final path doesn't exist while the binary is written.
    await vi.waitFor(() => expect(temporaryDownloads(functionRunner)).resolves.toHaveLength(1))
    await expect(fileExists(functionRunner.path)).resolves.toBeFalsy()

    responseBody.end(gzippedBinary.subarray(10))
    await download
    await expect(readFile(functionRunner.path)).resolves.toBe('function-runner binary')
    await expect(temporaryDownloads(functionRunner)).resolves.toEqual([])
  })

  test('removes the partial download when the download fails', async () => {
    // Given
    await removeFile(functionRunner.path)
    vi.mocked(fetch).mockImplementation(async () => new Response('not a gzipped binary'))

    // When
    const download = downloadBinary(functionRunner)

    // Then
    await expect(download).rejects.toThrow()
    await expect(fileExists(functionRunner.path)).resolves.toBeFalsy()
    await expect(temporaryDownloads(functionRunner)).resolves.toEqual([])
  })

  test('uses the function-runner that another process put in place when the rename fails', async () => {
    // Given
    await removeFile(functionRunner.path)
    vi.mocked(fetch).mockResolvedValue(new Response(gzipSync('function-runner binary')))
    vi.mocked(renameFile).mockImplementationOnce(async () => {
      await writeFile(functionRunner.path, 'function-runner from another process')
      throw new Error('EPERM: operation not permitted, rename')
    })

    // When
    await downloadBinary(functionRunner)

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(readFile(functionRunner.path)).resolves.toBe('function-runner from another process')
    await expect(temporaryDownloads(functionRunner)).resolves.toEqual([])
  })

  test('fails when the rename fails and no function-runner is in place', async () => {
    // Given
    await removeFile(functionRunner.path)
    vi.mocked(fetch).mockImplementation(async () => new Response(gzipSync('function-runner binary')))
    vi.mocked(renameFile).mockRejectedValue(new Error('EACCES: permission denied, rename'))

    // When
    const download = downloadBinary(functionRunner)

    // Then
    await expect(download).rejects.toThrow('EACCES: permission denied, rename')
    await expect(fileExists(functionRunner.path)).resolves.toBeFalsy()
    await expect(temporaryDownloads(functionRunner)).resolves.toEqual([])
  })
})

describe('wasm-opt', () => {
  const wasmOpt = wasmOptBinary()

  test('properties are set correctly', () => {
    expect(wasmOpt.name).toBe('wasm-opt.cjs')
    expect(wasmOpt.version).match(/\d.\d.\d$/)
    expect(wasmOpt.path).toMatch(/(\/|\\)wasm-opt.cjs$/)
  })

  test('downloadUrl returns the correct URL', () => {
    // When
    const url = wasmOpt.downloadUrl('', '')

    // Then
    expect(url).toMatch(/https:\/\/cdn.jsdelivr.net\/npm\/binaryen@\d{3}\.\d\.\d\/bin\/wasm-opt/)
  })

  test('downloads wasm-opt', async () => {
    // Given
    await removeFile(wasmOpt.path)
    await expect(fileExists(wasmOpt.path)).resolves.toBeFalsy()
    vi.mocked(fetch).mockResolvedValue(new Response('wasm-opt'))

    // When
    await downloadBinary(wasmOpt)

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(fileExists(wasmOpt.path)).resolves.toBeTruthy()
  })
})

describe('trampoline', () => {
  const v1Trampoline = trampolineBinary(V1_TRAMPOLINE_VERSION)
  const v2Trampoline = trampolineBinary(V2_TRAMPOLINE_VERSION)

  test('v1 properties are set correctly', () => {
    expect(v1Trampoline.name).toBe('shopify-function-trampoline')
    expect(v1Trampoline.version).match(/1.\d.\d$/)
    if (process.platform === 'win32') {
      expect(v1Trampoline.path).toContain(`shopify-function-trampoline-${V1_TRAMPOLINE_VERSION}.exe`)
    } else {
      expect(v1Trampoline.path).toContain(`shopify-function-trampoline-${V1_TRAMPOLINE_VERSION}`)
    }
  })

  test('v2 properties are set correctly', () => {
    expect(v2Trampoline.name).toBe('shopify-function-trampoline')
    expect(v2Trampoline.version).match(/2.\d.\d$/)
    if (process.platform === 'win32') {
      expect(v2Trampoline.path).toContain(`shopify-function-trampoline-${V2_TRAMPOLINE_VERSION}.exe`)
    } else {
      expect(v2Trampoline.path).toContain(`shopify-function-trampoline-${V2_TRAMPOLINE_VERSION}`)
    }
  })

  test('downloadUrl returns the correct URL', () => {
    // When
    const url = v2Trampoline.downloadUrl('darwin', 'x64')

    // Then
    const expectedUrlRegex = new RegExp(
      `https://github.com/Shopify/shopify-function-wasm-api/releases/download/shopify_function_trampoline/v${v2Trampoline.version}/shopify-function-trampoline-x86_64-macos-v${v2Trampoline.version}.gz`,
    )
    expect(url).toMatch(expectedUrlRegex)
  })

  test('downloads trampoline', async () => {
    // Given
    await removeFile(v2Trampoline.path)
    await expect(fileExists(v2Trampoline.path)).resolves.toBeFalsy()
    vi.mocked(fetch).mockResolvedValue(new Response(gzipSync('trampoline')))

    // When
    await downloadBinary(v2Trampoline)

    // Then
    expect(fetch).toHaveBeenCalledOnce()
    await expect(fileExists(v2Trampoline.path)).resolves.toBeTruthy()
  })
})
