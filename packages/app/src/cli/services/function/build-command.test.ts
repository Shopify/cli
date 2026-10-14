import {buildFunction} from './build-command.js'
import {buildFunctionExtension} from '../build/extension.js'
import {testApp, testFunctionExtension} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {expect, test, vi} from 'vitest'

// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('../build/extension.js')

test('returns typed facts using the builder-selected output path', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extension = await testFunctionExtension({dir: directory})
    const options = {app: testApp(), stdout: process.stdout, stderr: process.stderr, environment: 'production' as const}
    const path = joinPath(directory, 'custom.wasm')
    vi.mocked(buildFunctionExtension).mockImplementation(async () => {
      extension.outputPath = path
      await writeFile(path, Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))
    })
    await expect(buildFunction(extension, options)).resolves.toEqual({
      status: 'success',
      function: {
        handle: extension.configuration.handle ?? null,
        name: extension.name,
        directory,
        wasmPath: resolve(path),
      },
    })
    expect(buildFunctionExtension).toHaveBeenCalledWith(extension, options)
  })
})
