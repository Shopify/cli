import Package from './package.js'
import {themePackageJsonOutputSchema} from '../../services/package/types.js'
import {Config} from '@oclif/core'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {
  inTemporaryDirectory,
  mkdir,
  writeFile,
  fileExists,
  fileExistsSync,
  rmdir,
  tempDirectory,
} from '@shopify/cli-kit/node/fs'
import {joinPath, relativizePath, cwd} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {expect, test, vi} from 'vitest'
// Native JSON paths must preserve Windows separators instead of pathe normalization.
// eslint-disable-next-line no-restricted-imports
import {resolve as nativePath} from 'node:path'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/environments')

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  await new Package(argv, config).run()
}

test.each([false])('writes the package receipt to stdout with version=%s', async (includeVersion) => {
  await inTemporaryDirectory(async (directory) => {
    await mkdir(joinPath(directory, 'config'))
    await writeFile(
      joinPath(directory, 'config/settings_schema.json'),
      JSON.stringify([{name: 'theme_info', theme_name: 'Dawn', ...(includeVersion ? {theme_version: '1.0'} : {})}]),
    )
    const path = joinPath(directory, includeVersion ? 'Dawn-1.0.zip' : 'Dawn.zip')

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () => run(['--path', directory, '--json']))
      expect(stdout()).toBe(`${themePackageJsonOutputSchema.encode({path: nativePath(path)})}\n`)
      expect(stderr()).toBe('')
    })
    await expect(fileExists(path)).resolves.toBe(true)
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})

test('emits a fatal JSON error when the archive destination is a directory', async () => {
  await inTemporaryDirectory(async (directory) => {
    await mkdir(joinPath(directory, 'config'))
    await writeFile(
      joinPath(directory, 'config/settings_schema.json'),
      JSON.stringify([{name: 'theme_info', theme_name: 'Dawn'}]),
    )
    const destination = joinPath(directory, 'Dawn.zip')
    await mkdir(destination)
    await writeFile(joinPath(destination, 'keep.txt'), 'Existing content')
    const config = new Config({root: __dirname})
    await config.load()
    class LifecyclePackage extends Package {
      execute(): Promise<void> {
        return this._run<void>()
      }
    }
    vi.spyOn(Package.prototype as unknown as {init(): Promise<unknown>}, 'init').mockResolvedValue(undefined)
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const argv = ['--path', directory, '--json']
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(argv, () => new LifecyclePackage(argv, config).execute())
      expect(JSON.parse(stdout())).toEqual({error: expect.objectContaining({message: expect.any(String)})})
      expect(stderr()).toBe('')
    })
    expect(process.exit).toHaveBeenCalledWith(1)
    await expect(fileExists(joinPath(destination, 'keep.txt'))).resolves.toBe(true)
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})

test('rejects invalid package paths', () => {
  expect(() => themePackageJsonOutputSchema.validate({path: 42})).toThrow()
  expect(() => themePackageJsonOutputSchema.validate({path: 'Dawn.zip'})).toThrow()
  expect(() => themePackageJsonOutputSchema.validate({path: joinPath(cwd(), 'Dawn.zip'), extra: true})).toThrow()
})

let packageDirectory: string
const packagePath = () => joinPath(packageDirectory, 'Dawn-1.0.zip')

describeJsonCommand({
  command: Package,
  commandId: 'theme:package',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: () => ['--path', packageDirectory],
  expectedResult: () => ({path: nativePath(packagePath())}),
  expectedSchema: {type: 'object', required: ['path'], additionalProperties: false},
  setup: async () => {
    packageDirectory = tempDirectory()
    const directory = packageDirectory
    await mkdir(joinPath(directory, 'config'))
    await writeFile(
      joinPath(directory, 'config/settings_schema.json'),
      JSON.stringify([{name: 'theme_info', theme_name: 'Dawn', theme_version: '1.0'}]),
    )
    return () => rmdir(directory)
  },
  assertExecuted: (format) => {
    if (format === 'json') {
      expect(renderSuccess).not.toHaveBeenCalled()
    } else {
      expect(renderSuccess).toHaveBeenCalledExactlyOnceWith({
        body: ['Your local theme was packaged in', {filePath: relativizePath(packagePath())}],
      })
    }
  },
  assertNotExecuted: () => {
    expect(fileExistsSync(packagePath())).toBe(false)
    expect(renderSuccess).not.toHaveBeenCalled()
  },
  // The UI module is mocked, so text mode is checked through the rendered banner and the archive.
  textOutput: ({stdout, stderr}) => {
    expect({stdout, stderr}).toEqual({stdout: '', stderr: ''})
    expect(fileExistsSync(packagePath())).toBe(true)
  },
  failure: {
    setup: async () => {
      await rmdir(joinPath(packageDirectory, 'config'))
    },
    expectedError: {error: {type: 'abort', message: 'Provide a config/settings_schema.json to package your theme.'}},
    exitCode: 1,
  },
})
