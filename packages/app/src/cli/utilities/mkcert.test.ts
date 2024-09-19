import {generateCertificate} from './mkcert.js'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {describe, vi, expect} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import which from 'which'
import {downloadGitHubRelease} from '@shopify/cli-kit/node/github'
import {testWithTempDir} from '@shopify/cli-kit/node/testing/test-with-temp-dir'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('which')
vi.mock('@shopify/cli-kit/node/github')

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

      const onRequiresDownloadConfirmation = vi.fn()
      const {keyContent, certContent} = await generateCertificate({
        appDirectory,
        onRequiresDownloadConfirmation,
        env: {
          SHOPIFY_CLI_MKCERT_BINARY: '/path/to/mkcert',
        },
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
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

      const onRequiresDownloadConfirmation = vi.fn()
      const {keyContent, certContent} = await generateCertificate({
        appDirectory,
        onRequiresDownloadConfirmation,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
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

      const onRequiresDownload = vi.fn()
      const {keyContent, certContent} = await generateCertificate({
        appDirectory,
        onRequiresDownloadConfirmation: onRequiresDownload,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
    })

    testWithTempDir('generates a certificate using a downloaded mkcert', async ({tempDir}) => {
      const appDirectory = tempDir

      const mkcertDefaultPath = joinPath(appDirectory, '.shopify', 'mkcert')
      vi.mocked(exec).mockImplementation(async (command) => {
        expect(command).toBe(mkcertDefaultPath)
        await mkdir(joinPath(appDirectory, '.shopify'))
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost-key.pem'), 'key')
        await writeFile(joinPath(appDirectory, '.shopify', 'localhost.pem'), 'cert')
      })

      const onRequiresDownloadConfirmation = vi.fn().mockReturnValue(true)
      const {keyContent, certContent} = await generateCertificate({
        appDirectory,
        onRequiresDownloadConfirmation,
        platform: 'linux',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(onRequiresDownloadConfirmation).toHaveBeenCalled()
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

      const onRequiresDownloadConfirmation = vi.fn().mockReturnValue(true)
      const {keyContent, certContent} = await generateCertificate({
        appDirectory,
        onRequiresDownloadConfirmation,
        platform: 'win32',
      })

      expect(keyContent).toBe('key')
      expect(certContent).toBe('cert')
      expect(onRequiresDownloadConfirmation).toHaveBeenCalled()
      expect(downloadGitHubRelease).toHaveBeenCalledWith(
        'FiloSottile/mkcert',
        'v1.4.4',
        expect.any(String),
        mkcertDefaultPath,
      )
    })
  })
})
