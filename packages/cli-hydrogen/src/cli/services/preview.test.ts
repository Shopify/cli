import {previewInWorker} from './preview.js'
import {describe, it, expect, vi, afterEach} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, findPathUp} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/path', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/path')
  return {
    ...actual,
    findPathUp: vi.fn(),
  }
})

vi.mock('@shopify/mini-oxygen')
vi.mock('@shopify/cli-kit/node/system')

describe('hydrogen preview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('worker', () => {
    it('writes a local mini oxygen config file', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const port = 5000
        const envPath = undefined
        const expectedConfig = {
          port,
          workerFile: 'dist/worker/index.js',
          assetsDir: 'dist/client',
          buildCommand: 'yarn build',
          modules: true,
          watch: true,
          buildWatchPaths: ['./src'],
          autoReload: true,
        }
        const pathToExecutable = joinPath(tmpDir, 'mini-oxygen.js')
        await writeFile(pathToExecutable, '// some executable file')
        vi.mocked(findPathUp).mockResolvedValue(pathToExecutable)

        // When
        await previewInWorker({directory: tmpDir, port, envPath})

        // Then
        expect(writeFile).toHaveBeenCalledWith(
          joinPath(tmpDir, `mini-oxygen.config.json`),
          JSON.stringify(expectedConfig, null, 2),
        )
      })
    })

    it('writes a local mini oxygen config file with env bindings from a .env file', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const tmpEnv = joinPath(tmpDir, '.env')

        vi.mocked(writeFile).mockRestore()
        // create a .env file in tmpDir
        await writeFile(tmpEnv, `FOO="BAR"\nBAZ="BAX"\nAPI_KEY='SUPER_SECRET'\nPORT:8000`)

        // Given
        const port = 5000
        const expectedConfig = {
          port,
          workerFile: 'dist/worker/index.js',
          assetsDir: 'dist/client',
          buildCommand: 'yarn build',
          modules: true,
          watch: true,
          buildWatchPaths: ['./src'],
          autoReload: true,
          env: {
            FOO: 'BAR',
            BAZ: 'BAX',
            API_KEY: 'SUPER_SECRET',
            PORT: '8000',
          },
        }
        const pathToExecutable = joinPath(tmpDir, 'mini-oxygen.js')
        await writeFile(pathToExecutable, '// some executable file')
        vi.mocked(findPathUp).mockResolvedValue(pathToExecutable)

        // When
        await previewInWorker({directory: tmpDir, port, envPath: tmpEnv})

        // Then
        expect(writeFile).toHaveBeenCalledWith(
          joinPath(tmpDir, `mini-oxygen.config.json`),
          JSON.stringify(expectedConfig, null, 2),
        )
      })
    })

    it('shows an error when the .env path is incorrect', async () => {
      // Given
      vi.mocked(findPathUp).mockResolvedValue(undefined)

      await inTemporaryDirectory(async (tmpDir) => {
        // When
        const run = previewInWorker({directory: tmpDir, port: 4000, envPath: '/foo/bar/.env'})

        // Then
        await expect(run).rejects.toThrow('The environment file at /foo/bar/.env does not exist.')
      })
    })

    it('runs the mini-oxygen executable from the app directory', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const pathToExecutable = joinPath(tmpDir, 'mini-oxygen.js')
        await writeFile(pathToExecutable, '// some executable file')
        vi.mocked(findPathUp).mockResolvedValue(pathToExecutable)

        // When
        await previewInWorker({directory: tmpDir, port: 4000, envPath: undefined})

        // Then
        expect(exec).toHaveBeenCalledWith(
          pathToExecutable,
          expect.arrayContaining([]),
          expect.objectContaining({cwd: tmpDir}),
        )
      })
    })

    it('shows an error when mini-oxygen executable file is not found', async () => {
      // Given
      vi.mocked(findPathUp).mockResolvedValue(undefined)

      await inTemporaryDirectory(async (tmpDir) => {
        // When
        const run = previewInWorker({directory: tmpDir, port: 4000, envPath: undefined})

        // Then
        await expect(run).rejects.toThrow(/Could not locate the executable file to run Oxygen locally./)
      })
    })
  })
})
