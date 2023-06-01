import FetchSchema from './schema.js'
import {testApp, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {generateSchemaService} from '../../../services/generate-schema.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as output from '@shopify/cli-kit/node/output'

vi.mock('../../../services/generate-schema.js')
vi.mock('../../../models/app/loader.ts')

describe('FetchSchema', async () => {
  test('Save the latest GraphQL schema to ./[extension]/schema.graphql when stdout flag is ABSENT', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const testOutput = 'my_output'
      const mockExtension = await testFunctionExtension({
        dir: tmpDir,
      })
      const app = testApp({allExtensions: [mockExtension]})
      const apiKey = 'api-key'

      vi.mocked(generateSchemaService).mockResolvedValue(testOutput)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      await FetchSchema.run(['--api-key', apiKey, '--path', mockExtension.directory])

      // Then
      const outputFile = await readFile(joinPath(tmpDir, 'schema.graphql'))
      expect(outputFile).toEqual(testOutput)
    })
  })

  test('Print the latest GraphQL schema to stdout when stdout flag is PRESENT', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const testOutput = 'my_output'
      const mockOutput = vi.fn()
      vi.spyOn(output, 'outputInfo').mockImplementation(mockOutput)

      const mockExtension = await testFunctionExtension({
        dir: tmpDir,
      })
      const app = testApp({allExtensions: [mockExtension]})
      const apiKey = 'api-key'

      vi.mocked(generateSchemaService).mockResolvedValue(testOutput)
      vi.mocked(loadApp).mockResolvedValue(app)

      // When
      await FetchSchema.run(['--api-key', apiKey, '--path', mockExtension.directory, '--stdout'])

      // Then
      expect(mockOutput).toHaveBeenCalledWith(testOutput)
    })
  })
})
