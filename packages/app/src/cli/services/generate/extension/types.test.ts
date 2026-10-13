import {appGenerateExtensionJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'
import {resolvePath} from '@shopify/cli-kit/node/path'

const extension = {
  name: 'My extension',
  type: 'ui_extension',
  template: 'checkout_ui',
  flavor: 'typescript-react',
  directory: resolvePath('extensions/my-extension'),
}

test.each([
  {name: ''},
  {type: ''},
  {template: ''},
  {flavor: 'unknown'},
  {directory: 'extensions/my-extension'},
  {secret: 'unexpected'},
])('rejects invalid generated extension fields: %j', (fields) => {
  expect(() =>
    appGenerateExtensionJsonOutputSchema.validate({status: 'success', extension: {...extension, ...fields}}),
  ).toThrow()
})

test('rejects fields outside the public result projection', () => {
  expect(() =>
    appGenerateExtensionJsonOutputSchema.validate({status: 'success', extension, packageManager: 'pnpm'}),
  ).toThrow()
})
