import {importDashboardExtensionsJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'
import {cwd, joinPath} from '@shopify/cli-kit/node/path'

test.each([
  {id: 'gid://shopify/AppExtensionRegistration/1'},
  {directory: 'extensions/example-action'},
  {configurationPath: 'extensions/example-action/shopify.extension.toml'},
  {type: ''},
  {internal: true},
])('rejects invalid imported extension fields: %j', (fields) => {
  const directory = joinPath(cwd(), 'extensions', 'example-action')
  expect(() =>
    importDashboardExtensionsJsonOutputSchema.encode({
      status: 'success',
      reason: null,
      extensions: [
        {
          id: 'e7282f2d-3017-4608-a9a4-54dd5a7a70aa',
          name: 'Example action',
          type: 'flow_action_definition',
          directory,
          configurationPath: joinPath(directory, 'shopify.extension.toml'),
          changed: true,
          ...fields,
        },
      ],
      errors: [],
      identifiersUpdated: true,
    }),
  ).toThrow()
})
