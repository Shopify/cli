import Sources from './sources.js'
import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AppErrors} from '../../../models/app/loader.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {formatSection} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../../services/app-context.js')

let app: ReturnType<typeof testAppLinked>

describeJsonCommand({
  command: Sources,
  commandId: 'app:logs:sources',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: () => {
    const extension = app.allExtensions[0]!
    return {
      sources: [
        {
          source: 'extensions.discount',
          namespace: 'extensions',
          handle: 'discount',
          name: extension.configuration.name,
          type: extension.type,
          externalType: extension.externalType,
          humanName: extension.humanName,
          uid: extension.uid,
          directory: extension.directory,
          configurationPath: extension.configurationPath,
          configuration: extension.configuration,
          entrySourceFilePath: extension.entrySourceFilePath,
          outputPath: extension.outputPath,
          surface: extension.surface,
          features: extension.features,
          ...(extension.dependency === undefined ? {} : {dependency: extension.dependency}),
        },
      ],
    }
  },
  expectedSchema: {type: 'object', required: ['sources'], additionalProperties: false},
  setup: async () => {
    app = testAppLinked({
      allExtensions: [
        await testFunctionExtension({
          config: {
            ...(await testFunctionExtension()).configuration,
            handle: 'discount',
          },
        }),
      ],
    })
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe(`${formatSection('extensions', 'extensions.discount')}\n`)
    expect(stderr).toBe('')
  },
})

async function runCommand(argv: string[], app = testAppLinked()) {
  vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
  return new Sources(argv, await Config.load()).run()
}

test('writes a named empty JSON collection when no sources exist', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(['--json'])
    expect(JSON.parse(stdout())).toEqual({sources: []})
    expect(stderr()).toBe('')
  })
})

test.each([{argv: []}, {argv: ['--json']}])(
  'exits with status 2 before output for invalid apps (%j)',
  async ({argv}) => {
    const errors = new AppErrors()
    errors.addError({file: 'shopify.app.toml', message: 'Invalid app'})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    try {
      await expect(runCommand(argv, testAppLinked({errors}))).rejects.toThrow('exit')
      expect(exit).toHaveBeenCalledWith(2)
      expect(mockAndCaptureOutput().output()).toBe('')
    } finally {
      exit.mockRestore()
    }
  },
)
