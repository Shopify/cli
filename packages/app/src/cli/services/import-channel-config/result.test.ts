import {renderImportChannelConfigResult} from './result.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {unstyled} from '@shopify/cli-kit/node/output'
import {resolvePath, joinPath} from '@shopify/cli-kit/node/path'
import {expect, test} from 'vitest'

const directory = resolvePath('example-app')
const result = {
  status: 'success' as const,
  handle: 'example',
  filename: 'example.toml',
  path: joinPath(directory, 'extensions/channel-config/specifications/example.toml'),
  toml: 'handle = "example"\nlabel = "Café channel"\n',
  warnings: [{code: 'missing_countries', message: 'Add a countries section.'}],
  extensionConfigurationPath: joinPath(directory, 'extensions/channel-config/shopify.extension.toml'),
}
const app = {directory, name: 'Example app'}

test('writes one public document and warning events through the real encoder and writers', async () => {
  const warnings = [{...result.warnings[0]!, internal: 'private'}]
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    runWithCommandEventsForCommand(['--json'], () =>
      renderImportChannelConfigResult({...result, warnings}, app, 'json'),
    )
    expect(JSON.parse(stdout())).toEqual({
      status: 'success',
      handle: result.handle,
      filename: result.filename,
      path: result.path,
      toml: result.toml,
      warnings: result.warnings,
    })
    expect(JSON.parse(stderr())).toMatchObject({
      type: 'diagnostic',
      level: 'warning',
      ...result.warnings[0],
    })
    expect(stdout()).not.toContain('extensionConfigurationPath')
    expect(stdout()).not.toContain('internal')
  })
})

test('preserves empty warnings and does not emit an empty diagnostic code', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    runWithCommandEventsForCommand(['--json'], () =>
      renderImportChannelConfigResult({...result, warnings: []}, app, 'json'),
    )
    expect(JSON.parse(stdout()).warnings).toEqual([])
    expect(stderr()).toBe('')
  })
  await withCapturedStandardStreams(async ({stderr}) => {
    runWithCommandEventsForCommand(['--json'], () =>
      renderImportChannelConfigResult({...result, warnings: [{code: '', message: 'Review the spec.'}]}, app, 'json'),
    )
    expect(JSON.parse(stderr())).not.toHaveProperty('code')
  })
})

test('keeps the warning and success text on stderr with relative file paths', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    renderImportChannelConfigResult(result, app, 'text')
    expect(stdout()).toBe('')
    const text = unstyled(stderr())
    expect(text).toContain('Add a countries section.')
    expect(text).toContain('Imported the channel spec for Example app.')
    expect(text).toContain('extensions/channel-config/specifications/example.toml')
    expect(text).toContain('Also created')
    expect(text).toContain('extensions/channel-config/shopify.extension.toml')
    expect(text).toContain('shopify app dev')
    expect(text).toContain('shopify app deploy')
    expect(text).not.toContain(directory)
  })
})

test('omits the created-extension text when the extension already exists', async () => {
  await withCapturedStandardStreams(async ({stderr}) => {
    renderImportChannelConfigResult({...result, extensionConfigurationPath: null}, app, 'text')
    expect(unstyled(stderr())).not.toContain('Also created')
  })
})
