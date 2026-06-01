import DocsSearch from './search.js'
import {searchShopifyDevDocs} from '../../services/docs/search.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/docs/search.js')

describe('DocsSearch', () => {
  test('outputs search results as JSON', async () => {
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    vi.mocked(searchShopifyDevDocs).mockResolvedValue({results: [{title: 'Inventory'}]})

    await DocsSearch.run(['inventory scopes', '--api', 'admin', '--json'], import.meta.url)

    expect(searchShopifyDevDocs).toHaveBeenCalledWith({query: 'inventory scopes', apiName: 'admin'})
    expect(JSON.parse(outputMock.output())).toEqual({results: [{title: 'Inventory'}]})
  })
})
