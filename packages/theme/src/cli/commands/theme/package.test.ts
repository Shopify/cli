import Package from './package.js'
import {themePackageJsonOutputSchema} from '../../services/package/types.js'
import {renderThemePackageResult} from '../../services/package/result.js'
import {Config} from '@oclif/core'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, relativizePath, cwd} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/environments')

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  await new Package(argv, config).run()
}

test.each([true, false])('writes the package receipt to stdout with version=%s', async (includeVersion) => {
  await inTemporaryDirectory(async (directory) => {
    await mkdir(joinPath(directory, 'config'))
    await writeFile(
      joinPath(directory, 'config/settings_schema.json'),
      JSON.stringify([{name: 'theme_info', theme_name: 'Dawn', ...(includeVersion ? {theme_version: '1.0'} : {})}]),
    )
    const path = joinPath(directory, includeVersion ? 'Dawn-1.0.zip' : 'Dawn.zip')

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () => run(['--path', directory, '--json']))
      expect(stdout()).toBe(`${themePackageJsonOutputSchema.encode({path})}\n`)
      expect(stderr()).toBe('')
    })
    await expect(fileExists(path)).resolves.toBe(true)
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})

test('preserves the text success banner', () => {
  const path = joinPath(cwd(), 'Dawn.zip')
  renderThemePackageResult({path}, 'text')
  expect(renderSuccess).toHaveBeenCalledWith({
    body: ['Your local theme was packaged in', {filePath: relativizePath(path)}],
  })
})

test('does not emit a result when packaging fails', async () => {
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run(['--path', directory, '--json'])).rejects.toThrow(
        'Provide a config/settings_schema.json to package your theme.',
      )
      expect(stdout()).toBe('')
    })
  })
})

test('exposes the schema and rejects invalid package paths', () => {
  expect(Package.jsonOutputSchema).toBe(themePackageJsonOutputSchema)
  expect(Package.flags.json).toBeDefined()
  expect(Package.description).toContain('--json-schema')
  expect(() => themePackageJsonOutputSchema.validate({path: 42})).toThrow()
  expect(() => themePackageJsonOutputSchema.validate({path: 'Dawn.zip'})).toThrow()
  expect(() => themePackageJsonOutputSchema.validate({path: joinPath(cwd(), 'Dawn.zip'), extra: true})).toThrow()
})
