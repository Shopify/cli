import {assetToString} from './assetToString'
import type {Asset} from '../types'

describe('assetToString tests', () => {
  test('creates a URL string from an asset', () => {
    const asset: Asset = {
      name: 'main',
      url: 'http://localhost:8000/extensions/00000000/assets/handle.js',
      lastUpdated: 1637004124,
    }

    const url = assetToString(asset)

    expect(url).toBe(`${asset.url}?lastUpdated=${asset.lastUpdated}`)
  })
})
