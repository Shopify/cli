import {previewInWorker} from './preview.js'
import {describe, it, expect, vi, afterEach} from 'vitest'
import {path, file, system} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    system: {
      ...cliKit.system,
      exec: vi.fn(),
    },
    path: {
      ...cliKit.path,
      findUp: vi.fn(),
    },
    file: {
      ...cliKit.file,
      write: vi.fn(),
    },
  }
})

vi.mock('@shopify/mini-oxygen')

describe('hydrogen preview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('worker', () => {
    it('writes a local mini oxygen config file', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
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
        }
        const pathToExecutable = path.join(tmpDir, 'mini-oxygen.js')
        await file.write(pathToExecutable, '// some executable file')
        vi.mocked(path.findUp).mockResolvedValue(pathToExecutable)

        // When
        await previewInWorker({directory: tmpDir, port})

        // Then
        expect(file.write).toHaveBeenCalledWith(
          path.join(tmpDir, `mini-oxygen.config.json`),
          JSON.stringify(expectedConfig, null, 2),
        )
      })
    })

    it('runs the mini-oxygen executable from the app directory', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const pathToExecutable = path.join(tmpDir, 'mini-oxygen.js')
        await file.write(pathToExecutable, '// some executable file')
        vi.mocked(path.findUp).mockResolvedValue(pathToExecutable)

        // When
        await previewInWorker({directory: tmpDir, port: 4000})

        // Then
        expect(system.exec).toHaveBeenCalledWith(
          pathToExecutable,
          expect.arrayContaining([]),
          expect.objectContaining({cwd: tmpDir}),
        )
      })
    })

    it('shows an error when mini-oxygen executable file is not found', async () => {
      // Given
      vi.mocked(path.findUp).mockResolvedValue(undefined)

      await file.inTemporaryDirectory(async (tmpDir) => {
        // When
        const run = previewInWorker({directory: tmpDir, port: 4000})

        // Then
        await expect(run).rejects.toThrow(/Could not locate the executable file to run Oxygen locally./)
      })
    })
  })
})
