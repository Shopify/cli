import {importChannelConfigJsonOutputSchema} from './types.js'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {expect, test} from 'vitest'

const result = {
  status: 'success' as const,
  handle: 'example',
  filename: 'example.toml',
  path: resolvePath('extensions/channel-config/specifications/example.toml'),
  toml: 'handle = "example"\n',
  warnings: [{code: 'missing_countries', message: 'Add a countries section.'}],
}

test('encodes native TOML and warning data without changing it', () => {
  expect(JSON.parse(importChannelConfigJsonOutputSchema.encode(result))).toEqual(result)
  expect(JSON.parse(importChannelConfigJsonOutputSchema.encode({...result, warnings: []}))).toEqual({
    ...result,
    warnings: [],
  })
})

test.each([
  {...result, status: 'failed'},
  {...result, internal: true},
  {...result, path: 'extensions/channel-config/specifications/example.toml'},
  {...result, path: 'C:example.toml'},
  {...result, warnings: [{...result.warnings[0], internal: true}]},
  {...result, warnings: [{code: 42, message: 'Add a countries section.'}]},
  {...result, toml: null},
])('rejects invalid CLI-owned fields: %j', (value) => {
  expect(() => importChannelConfigJsonOutputSchema.validate(value)).toThrow()
})

test.each(['/tmp/example.toml', 'C:\\app\\example.toml', '\\\\server\\app\\example.toml'])(
  'accepts absolute native paths: %s',
  (path) => {
    expect(JSON.parse(importChannelConfigJsonOutputSchema.encode({...result, path})).path).toBe(path)
  },
)
