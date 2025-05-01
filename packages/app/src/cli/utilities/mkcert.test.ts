import {generateCertificate} from './mkcert.js'
import {generateCertificatePrompt} from '../prompts/dev.js'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {describe, vi, expect} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import which from 'which'
import {downloadGitHubFile, downloadGitHubRelease} from '@shopify/cli-kit/node/github'
import {testWithTempDir} from '@shopify/cli-kit/node/testing/test-with-temp-dir'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('which')
vi.mock('@shopify/cli-kit/node/github')
vi.mock('../prompts/dev.js')

describe('mkcert', () => {
  describe('generateCertificate', () => {
    testWithTempDir('generates a certificate using hard-coded mkcert path', async ({tempDir}) => {
      const appDirectory = tempDir

      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe('/path/to/mkcert')
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      vi.mocked(generateCertificatePrompt).mockResolvedValue(true)
      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        env: {
          SHOPIFY_CLI_MKCERT_BINARY: '/path/to/mkcert',
        },
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
    })

    testWithTempDir('generates a certificate using mkcert from default path', async ({tempDir}) => {
      const appDirectory = tempDir

      const mkcertDefaultPath = joinPath(appDirectory, '.shopify', 'mkcert')
      await mkdir(joinPath(appDirectory, '.shopify'))
      // put a fake mkcert binary in the app directory
      await writeFile(mkcertDefaultPath, 'echo "fake mkcert"')

      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe(mkcertDefaultPath)
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      vi.mocked(generateCertificatePrompt).mockResolvedValue(true)
      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
    })

    testWithTempDir('generates a certificate using mkcert from system PATH', async ({tempDir}) => {
      const appDirectory = tempDir

      // mock which to return the path to the mkcert binary
      vi.mocked(which).mockImplementation(async () => '/path/in/system/mkcert')

      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe('/path/in/system/mkcert')
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      vi.mocked(generateCertificatePrompt).mockResolvedValue(true)
      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
    })

    testWithTempDir('generates a certificate using a downloaded mkcert on linux', async ({tempDir}) => {
      const appDirectory = tempDir

      const mkcertDefaultPath = joinPath(appDirectory, '.shopify', 'mkcert')
      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe(mkcertDefaultPath)
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      vi.mocked(generateCertificatePrompt).mockResolvedValue(true)
      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
      expect(generateCertificatePrompt).toHaveBeenCalled()
      expect(downloadGitHubRelease).toHaveBeenCalledWith(
        'FiloSottile/mkcert',
        'v1.4.4',
        expect.any(String),
        mkcertDefaultPath,
      )
    })

    testWithTempDir('generates a certificate using a downloaded mkcert on darwin', async ({tempDir}) => {
      const appDirectory = tempDir

      const mkcertDefaultPath = joinPath(appDirectory, '.shopify', 'mkcert')
      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe(mkcertDefaultPath)
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      const onRequiresConfirmation = vi.fn().mockReturnValue(true)
      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        onRequiresConfirmation,
        platform: 'darwin',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
      expect(onRequiresConfirmation).toHaveBeenCalled()
      expect(downloadGitHubRelease).toHaveBeenCalledWith(
        'FiloSottile/mkcert',
        'v1.4.4',
        expect.any(String),
        mkcertDefaultPath,
      )
    })

    testWithTempDir('generates a certificate using a downloaded mkcert.exe on windows', async ({tempDir}) => {
      const appDirectory = tempDir

      const mkcertDefaultPath = joinPath(appDirectory, '.shopify', 'mkcert.exe')
      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe(mkcertDefaultPath)
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      vi.mocked(generateCertificatePrompt).mockResolvedValue(true)
      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        platform: 'win32',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
      expect(generateCertificatePrompt).toHaveBeenCalled()
      expect(downloadGitHubRelease).toHaveBeenCalledWith(
        'FiloSottile/mkcert',
        'v1.4.4',
        expect.any(String),
        mkcertDefaultPath,
      )
    })

    testWithTempDir('skips certificate generation if the user does not confirm', async ({tempDir}) => {
      const appDirectory = tempDir
      vi.mocked(generateCertificatePrompt).mockResolvedValue(false)
      const generatePromise = generateCertificate({
        appDirectory,
        platform: 'linux',
      })

      await expect(generatePromise).rejects.toThrow(AbortError)
      expect(generateCertificatePrompt).toHaveBeenCalled()
      expect(exec).not.toHaveBeenCalled()
      expect(downloadGitHubRelease).not.toHaveBeenCalled()
    })

    testWithTempDir('skips certificate generation if the certificate already exists', async ({tempDir}) => {
      const appDirectory = tempDir
      await mkdir(joinPath(appDirectory, '.shopify'))
      await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
      await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')

      const {keyContent, certContent, certPath} = await generateCertificate({
        appDirectory,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(certPath).toBe(joinPath('.shopify', 'localhost.pem'))
      expect(generateCertificatePrompt).not.toHaveBeenCalled()
      expect(exec).not.toHaveBeenCalled()
      expect(downloadGitHubRelease).not.toHaveBeenCalled()
    })
  })

  testWithTempDir('downloads the mkcert LICENSE when downloading mkcert', async ({tempDir}) => {
    const appDirectory = tempDir
    const mkcertLicensePath = joinPath(appDirectory, '.shopify', 'mkcert-LICENSE')
    vi.mocked(exec).mockImplementation(async () => {
      await mkdir(joinPath(appDirectory, '.shopify'))
      await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
      await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
    })
    vi.mocked(downloadGitHubFile).mockImplementation(async () => {})

    await generateCertificate({
      appDirectory,
      onRequiresConfirmation: vi.fn().mockReturnValue(true),
      platform: 'linux',
    })

    expect(downloadGitHubFile).toHaveBeenCalledWith('FiloSottile/mkcert', 'v1.4.4', 'LICENSE', mkcertLicensePath, {
      onError: expect.any(Function),
    })
  })

  testWithTempDir('Renders info if downloading the mkcert LICENSE fails', async ({tempDir}) => {
    const appDirectory = tempDir
    const licenseUrl = 'http://url.com'
    vi.mocked(exec).mockImplementation(async () => {
      await mkdir(joinPath(appDirectory, '.shopify'))
      await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
      await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
    })
    vi.mocked(downloadGitHubFile).mockImplementation(async (_repo, _tag, _file, _path, options) => {
      options?.onError?.('Oops!', licenseUrl)
    })
    const mockOutput = mockAndCaptureOutput()

    await generateCertificate({
      appDirectory,
      onRequiresConfirmation: vi.fn().mockReturnValue(true),
      platform: 'linux',
    })

    expect(mockOutput.info()).toMatch('Failed to download mkcert license.')
  })
})
