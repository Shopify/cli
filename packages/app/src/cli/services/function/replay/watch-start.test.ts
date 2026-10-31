import {watchReplay} from './watch.js'
import {captureFunctionRun} from '../runner.js'
import {type FunctionRunData} from '../replay.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdir, writeFile, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as output from '@shopify/cli-kit/node/output'
import {expect, test, vi} from 'vitest'

vi.mock('../runner.js')

test('rebuilds an edit made immediately after the watching record', async () => {
  await inTemporaryDirectory(async (directory) => {
    const extensionDirectory = joinPath(directory, 'extensions', 'function')
    await mkdir(extensionDirectory)
    const sourcePath = joinPath(extensionDirectory, 'index.js')
    await writeFile(sourcePath, 'initial')
    const extension = await testFunctionExtension({dir: extensionDirectory})
    vi.spyOn(extension, 'watchedFiles').mockReturnValue([sourcePath])
    vi.spyOn(extension, 'rescanImports').mockResolvedValue(false)
    const build = vi.spyOn(extension, 'buildForBundle').mockResolvedValue(undefined)
    const app = testAppLinked({directory, allExtensions: [extension]})
    vi.spyOn(app, 'generateExtensionTypes').mockResolvedValue(undefined)
    const controller = new AbortController()
    const results: string[] = []
    vi.spyOn(output, 'outputResult').mockImplementation((content) => {
      const record = String(content)
      results.push(record)
      if (record.includes('"status":"watching"')) writeFileSync(sourcePath, 'edited')
    })
    vi.mocked(captureFunctionRun).mockResolvedValue({
      state: 'completed',
      resultJson: JSON.stringify({
        name: 'function.wasm',
        size: 1,
        memory_usage: 64,
        instructions: 1,
        logs: '',
        input: {},
        output: {},
        success: true,
      }),
      exitCode: 0,
      diagnostics: [],
    })
    const running = watchReplay({
      app,
      extension,
      abortController: controller,
      selectedRun: {payload: {input: {}, export: 'run'}} as FunctionRunData,
    })

    try {
      await vi.waitFor(() => expect(captureFunctionRun).toHaveBeenCalledTimes(2), {timeout: 3000})
      expect(build).toHaveBeenCalledOnce()
      expect(results.map((record) => JSON.parse(record).type)).toEqual(['status', 'execution', 'build', 'execution'])
    } finally {
      controller.abort()
      await running
    }
  })
})
