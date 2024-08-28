import {javyBinary, functionRunnerBinary, installBinary} from './binaries.js'
import {exec} from '@shopify/cli-kit/node/system'
import {describe, expect, test} from 'vitest'

const javy = javyBinary()
const functionRunner = functionRunnerBinary()

describe('javy', () => {
  test('properties are set correctly', () => {
    expect(javy.name).toBe('javy')
    expect(javy.version).match(/^v\d\.\d\.\d$/)
    if (process.platform === 'win32') {
      expect(javy.path).toMatch(/(\/|\\)javy.exe$/)
    } else {
      expect(javy.path).toMatch(/(\/|\\)javy$/)
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

    test('Unsupported combination throws an error', () => {
      // When
      const arch = 'arm'
      const platform = 'win32'

      // Then
      expect(() => javy.downloadUrl(platform, arch)).toThrowError(
        'Unsupported platform/architecture combination win32/arm',
      )
    })
  })

  // This shouldn't take 20 seconds to run but sometimes the network hangs and
  // retries need to happen.
  test('Javy installs and runs', {timeout: 20000}, async () => {
    await installBinary(javy)
    await exec(javy.path, ['--help'])
  })
})

describe('functionRunner', () => {
  test('properties are set correctly', () => {
    expect(functionRunner.name).toBe('function-runner')
    expect(functionRunner.version).match(/^v\d\.\d\.\d$/)
    if (process.platform === 'win32') {
      expect(functionRunner.path).toMatch(/(\/|\\)function-runner.exe$/)
    } else {
      expect(functionRunner.path).toMatch(/(\/|\\)function-runner$/)
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

    test('Unsupported combination throws an error', () => {
      // When
      const arch = 'arm'
      const platform = 'win32'

      // Then
      expect(() => functionRunner.downloadUrl(platform, arch)).toThrowError(
        'Unsupported platform/architecture combination win32/arm',
      )
    })
  })

  // This shouldn't take 20 seconds to run but sometimes the network hangs and
  // retries need to happen.
  test('function-runner installs and runs', {timeout: 20000}, async () => {
    await installBinary(functionRunner)
    await exec(functionRunner.path, ['--help'])
  })
})
