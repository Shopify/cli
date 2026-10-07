import {importDashboardExtensionsJsonOutputSchema, ImportDashboardExtensionsResult} from './types.js'
import {expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {tmpdir} from 'node:os'

const extension = {
  id: 'e7282f2d-3017-4608-a9a4-54dd5a7a70aa',
  name: 'Example action',
  type: 'flow_action_definition',
  directory: joinPath(tmpdir(), 'app', 'extensions', 'example-action'),
  configurationPath: joinPath(tmpdir(), 'app', 'extensions', 'example-action', 'shopify.extension.toml'),
  changed: true,
}
const result: ImportDashboardExtensionsResult = {
  status: 'success',
  reason: null,
  extensions: [extension],
  errors: [],
  identifiersUpdated: true,
}

test('encodes completed imports, known empty results, and kept directories without a TOML file', () => {
  expect(JSON.parse(importDashboardExtensionsJsonOutputSchema.encode(result))).toEqual(result)
  const skipped: ImportDashboardExtensionsResult = {
    status: 'skipped',
    reason: 'no-extensions',
    extensions: [],
    errors: [],
    identifiersUpdated: false,
  }
  expect(JSON.parse(importDashboardExtensionsJsonOutputSchema.encode(skipped))).toEqual(skipped)
  const cancelled: ImportDashboardExtensionsResult = {
    status: 'cancelled',
    reason: 'directory-selection-cancelled',
    extensions: [{...extension, changed: false, configurationPath: null}],
    errors: [],
    identifiersUpdated: false,
  }
  expect(JSON.parse(importDashboardExtensionsJsonOutputSchema.encode(cancelled))).toEqual(cancelled)
})

test.each([
  {field: 'id', value: 'gid://shopify/AppExtension/1'},
  {field: 'directory', value: 'extensions/example-action'},
  {field: 'configurationPath', value: 'shopify.extension.toml'},
  {field: 'type', value: ''},
  {field: 'changed', value: null},
])('rejects invalid extension $field', ({field, value}) => {
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.validate({...result, extensions: [{...extension, [field]: value}]}),
  ).toThrow()
})

test('rejects unknown status and accidental internal fields', () => {
  expect(() => importDashboardExtensionsJsonOutputSchema.validate({...result, status: 'failed'})).toThrow()
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.validate({...result, extensionUuids: {handle: extension.id}}),
  ).toThrow()
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.validate({
      ...result,
      extensions: [{...extension, activeVersion: {config: 'secret'}}],
    }),
  ).toThrow()
})

test('encodes partial results with structured errors and rejects invalid failure records', () => {
  const partial: ImportDashboardExtensionsResult = {
    ...result,
    status: 'partial',
    identifiersUpdated: false,
    errors: [{extensionId: null, error: {type: 'abort', message: 'Identifiers could not be saved', code: 'EACCES'}}],
  }
  expect(JSON.parse(importDashboardExtensionsJsonOutputSchema.encode(partial))).toEqual(partial)
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.validate({
      ...partial,
      errors: [{extensionId: 'bad-id', error: {type: 'abort', message: 'Import failed'}}],
    }),
  ).toThrow()
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.validate({
      ...partial,
      errors: [{extensionId: extension.id, error: {type: 'unknown', message: 'Import failed'}}],
    }),
  ).toThrow()
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.validate({
      ...partial,
      errors: [{extensionId: extension.id, error: {type: 'abort', message: 'Import failed', code: ''}}],
    }),
  ).toThrow()
})
