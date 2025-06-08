import FunctionTest from './test.js'
import {functionTest, checkIfTestFilesHaveExports} from '../../../services/function/test.js'
import {inFunctionContext, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../../../services/function/test.js')
vi.mock('../../../services/function/common.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')

describe('FunctionTest command', () => {
  test('calls functionTest service', async () => {
    // Given
    vi.mocked(functionTest).mockResolvedValue()
    vi.mocked(getOrGenerateSchemaPath).mockResolvedValue('/path/to/schema.graphql')
    vi.mocked(checkIfTestFilesHaveExports).mockResolvedValue(false)
    vi.mocked(inFunctionContext).mockImplementation(async ({callback}) => {
      return callback(
        {} as any, // app
        {} as any, // developerPlatformClient
        {
          configuration: {
            targeting: [{target: 'test', export: '_start'}],
          },
          directory: '/test/function',
        } as any, // ourFunction
        '123', // orgId
      )
    })

    // When
    await FunctionTest.run(['--path=/test/path'], import.meta.url)

    // Then
    expect(functionTest).toHaveBeenCalled()
  })
})
