import {generateFunctionTypes} from './typegen.js'
import {buildGraphqlTypes} from './build.js'
import {testApp, testFunctionExtension} from '../../models/app/app.test-data.js'
import {expect, test, vi} from 'vitest'

// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('./build.js')

test('returns a typed Function identity after generation', async () => {
  const extension = await testFunctionExtension()
  const options = {app: testApp(), stdout: process.stdout, stderr: process.stderr}
  await expect(generateFunctionTypes(extension, options)).resolves.toEqual({
    status: 'success',
    function: {
      handle: extension.configuration.handle ?? null,
      name: extension.name,
      directory: resolve(extension.directory),
    },
  })
  expect(buildGraphqlTypes).toHaveBeenCalledWith(extension, options)
})
