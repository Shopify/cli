import {FileWatcherOptions, setupBundlerAndFileWatcher} from './bundler.js'
import * as bundle from '../../extensions/bundle.js'
import {describe, expect, test, vi} from 'vitest'
import chokidar from 'chokidar'
import {BuildFailure} from 'esbuild'

async function testBundlerAndFileWatcher() {
  const fileWatcherOptions = {
    devOptions: {
      extensions: [
        {
          devUUID: '1',
          outputBundlePath: 'output/bundle/path/1',
          entrySourceFilePath: 'source/file/path/1',
          directory: 'directory/1',
        },
        {
          devUUID: '2',
          outputBundlePath: 'output/bundle/path/2',
          entrySourceFilePath: 'source/file/path/2',
          directory: 'directory/2',
        },
      ],
      app: {
        dotenv: {
          variables: {
            some_key: 'SOME_VALUE',
          },
        },
      },
      stderr: {
        mockStdErr: 'STD_ERR',
      },
      stdout: {
        mockStdOut: 'STD_OUT',
      },
    },
    payloadStore: {
      updateExtension: vi.fn(() => Promise.resolve(undefined)),
    },
  } as unknown as FileWatcherOptions
  await setupBundlerAndFileWatcher(fileWatcherOptions)
  return fileWatcherOptions
}

describe('setupBundlerAndFileWatcher()', () => {
  test("call 'bundleExtension' for each extension", async () => {
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: vi.fn() as any,
    } as any)
    await testBundlerAndFileWatcher()
    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputBundlePath: 'output/bundle/path/1',
        sourceFilePath: 'source/file/path/1',
        environment: 'development',
        env: {
          some_key: 'SOME_VALUE',
        },
        stderr: {
          mockStdErr: 'STD_ERR',
        },
        stdout: {
          mockStdOut: 'STD_OUT',
        },
      }),
    )
    expect(bundle.bundleExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
        outputBundlePath: 'output/bundle/path/2',
        sourceFilePath: 'source/file/path/2',
        environment: 'development',
        env: {
          some_key: 'SOME_VALUE',
        },
        stderr: {
          mockStdErr: 'STD_ERR',
        },
        stdout: {
          mockStdOut: 'STD_OUT',
        },
      }),
    )
  })

  test("Call 'updateExtension' with status success when no error occurs", async () => {
    // GIVEN
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: vi.fn() as any,
    } as any)
    const fileWatcherOptions = await testBundlerAndFileWatcher()

    // WHEN
    bundle.bundleExtension.mock.calls[0][0].watch()

    // THEN
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[0],
      {status: 'success'},
    )
  })

  test("Call 'updateExtension' with status error when an error occurs", async () => {
    // GIVEN
    vi.spyOn(bundle, 'bundleExtension').mockResolvedValue(undefined)
    vi.spyOn(chokidar, 'watch').mockReturnValue({
      on: vi.fn() as any,
    } as any)
    const fileWatcherOptions = await testBundlerAndFileWatcher()

    // WHEN
    const buildFailure = {} as unknown as BuildFailure
    bundle.bundleExtension.mock.calls[0][0].watch(buildFailure)

    // THEN
    expect(fileWatcherOptions.payloadStore.updateExtension).toHaveBeenCalledWith(
      fileWatcherOptions.devOptions.extensions[0],
      {status: 'error'},
    )
  })
})
